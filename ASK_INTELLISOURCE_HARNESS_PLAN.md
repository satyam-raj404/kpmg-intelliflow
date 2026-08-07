# Ask IntelliSource — Agentic Harness & Report Studio

## Context

Today "Ask IntelliSource" is a single blocking loop: `POST /api/chat` → `run_chat`
([backend/services/chat_engine.py:225](backend/services/chat_engine.py)) calls OpenRouter
`gpt-4o` in an agentic tool-loop over 6 **read-only** tools
([backend/services/chat_tools.py](backend/services/chat_tools.py)), returns `{reply, tools_used}`.
The frontend ([kpmg-intelliflow/src/routes/ask.tsx](kpmg-intelliflow/src/routes/ask.tsx))
renders markdown with a hand-rolled parser. There is **no** artifact/file output, **no**
data-analysis engine, **no** chart/PPT/Excel/PDF generation, and the model is hardwired to one
provider.

Goal: turn it into a real **harness** (Claude/opencode-style) that, on request, does data
analysis, produces charts, and generates **Excel / PPTX / PDF** artifacts grounded strictly in
real data — while running cost-effectively on a **model cascade** (small/local Ollama or
lesser models for the cheap work, escalating only when needed) and **not hallucinating**.

Decisions locked with the user:
- **Model:** provider-agnostic **cascade** (OpenRouter *any model* + Ollama + small models); not GPT-4o-specific.
- **Analysis/visuals:** **parameterized tools** only (no arbitrary code execution).
- **PDF:** **ReportLab** (pure pip, no system deps).
- **UX:** **artifacts first** (download cards + inline chart previews), SSE streaming deferred to a later phase.

---

## Architecture Overview

```
Frontend ask.tsx ──POST /api/chat──▶ routers/chat.py
                                          │
                                          ▼
                            services/agent/orchestrator.py   (CASCADE loop)
              ┌───────────────┬───────────┴────────────┬──────────────────┐
              ▼               ▼                        ▼                  ▼
        providers/       tools/ (registry)        grounding.py       schema_card.py
     openrouter|ollama   data|analysis|chart      (numeric verify)   (compact schema
     (role-routed)       |report                  + citations)        retrieval)
                              │                        │
                              ▼                        ▼
                     services/reports/*          TurnContext (DataManifest:
                  excel|pptx|pdf|charts|theme     every number traces to a
                              │                    tool-result cell)
                              ▼
                     services/artifacts.py  ──▶  GET /api/chat/artifacts/{id}
                     (per-session store)          (FileResponse download)
```

Two hard rules the whole design enforces:
1. **Deterministic Python owns every number.** The model plans, picks tools, and writes prose.
   SQL results, aggregations, charts, and report layout are code. The model never authors a figure.
2. **The harness is READ-ONLY on the database.** It can `SELECT` only — it can **never** create,
   update, or delete any data. This is an absolute invariant (see below), not a best-effort guard.

### HARD CONSTRAINT — read-only data plane (defense in depth)

The harness cannot write to the database under any circumstance. Enforced at **five independent layers**, so no single failure (model, prompt injection, bug) can cause a write:

1. **DB role:** the harness connects with a dedicated Postgres role granted `SELECT` only
   (`GRANT SELECT` / no INSERT/UPDATE/DELETE/DDL). The database physically rejects any write.
2. **Read-only session:** connection opened with `default_transaction_read_only = on` /
   `SET TRANSACTION READ ONLY` — the server aborts write statements.
3. **Write-guard regex:** reuse ([chat_tools.py:5-8](backend/services/chat_tools.py)) to reject
   INSERT/UPDATE/DELETE/DROP/TRUNCATE/ALTER/CREATE/GRANT/REVOKE/EXECUTE/CALL before execution.
4. **Tool surface:** the registry exposes **only** read/analysis/report tools. No write/DDL/DML
   tool exists to be called. Analysis tools operate on in-memory result frames, never write back.
5. **SQL validator:** generated SQL is parsed and must be a single `SELECT`/CTE; anything else is rejected pre-execution.

**Reconciling non-data writes:** artifacts (files) are written to the filesystem, not the DB.
Chat **audit logging** and **session history** are the only persistence needs — audit uses the
app's existing separate write path/connection ([write_audit](backend/services/audit.py)), *not*
the harness's read-only data connection; session history stays in-memory (as today). So the
harness's **data connection is strictly read-only**, while the app's own audit trail (a system
concern, outside the harness data plane) continues through its normal channel. If even that
must be avoided, audit can be emitted as a log/event instead of a DB row — called out as a toggle.

---

## 1. Model cascade & provider abstraction — `services/agent/providers/`

`base.py` — `LLMProvider` interface: `chat(messages, tools=None, json_mode=False, model=...) -> {content, tool_calls}`.
- `openrouter.py` — refactor the existing `_openrouter_call` ([chat_engine.py:157](backend/services/chat_engine.py)); model id becomes a param (any OpenRouter model).
- `ollama.py` — local `http://localhost:11434/api/chat` via `urllib`/`httpx`; supports `format:"json"` for constrained tool-call output (small models are far more reliable constrained).

`config.py` — **role → model** map, env-driven, with cascade fallback:

| Role | Default (cheap) | Escalate to |
|---|---|---|
| `planner` (intent → plan, tool pick) | Ollama small / deepseek-flash | GPT-4o only on parse failure |
| `sql` (text→SQL) | small model + validate/repair | bigger model on repeated SQL error |
| `narrator` (prose over computed numbers) | small model | — |
| `hard_reason` (rare, multi-step) | — | GPT-4o / strong model, invoked explicitly |

**Why small models still give high value (the crux of the ask):**
- **Role split** — the small model only *plans, picks tools, writes short summaries*. All heavy lifting is deterministic Python, so weak reasoning barely matters.
- **Compact schema card** (`schema_card.py`) — retrieve only the 1–3 relevant tables per question (keyword/embedding match) instead of dumping the full schema. Slashes context to fit small windows.
- **JSON-constrained decoding** — Ollama `format:json` / grammars force valid tool calls; small models rarely free-form correctly but follow schemas well.
- **SQL validate + 1-shot repair** — generated SQL checked against `information_schema` + read-only guard before running; on error, feed the error back once. Cheap, reliable, no fabricated columns.
- **Pre-computed KPI shortcut** — `get_kpis` already returns finished numbers; the model just narrates.
- **Deterministic report templates** — model supplies only titles/bullets/narrative; layout+numbers are code, so a tiny model produces a polished deck.
- **Metric registry** (`schema_card.py` + a `metrics.py` map) — canonical KPI SQL the model reuses instead of inventing, preventing metric drift.
- **Aggressive result compression** — keep `_compress_result` ([chat_engine.py:198](backend/services/chat_engine.py)); cap rows/chars so context stays tiny.

---

## 2. Orchestrator — `services/agent/orchestrator.py`

Replaces `run_chat`. Same agentic-loop shape (iteration cap, tool exec, history) but:
- Model calls go through the provider/role router (cascade).
- A **`TurnContext`** (`context.py`) accumulates a **DataManifest**: every tool result stored under a key (`q1`, `kpi_procurement`, …). Report/analysis tools reference manifest keys — never re-query, never invent.
- Tool registry (`registry.py`): `name → {json_schema, executor}`; providers get schemas, executor dispatches.
- Returns `{reply, tools_used, artifacts:[{id,type,filename,url,preview?}], citations:[…]}`.

Keep thin backward-compat shims in `chat_engine.py`/`chat_tools.py` so nothing else breaks during migration.

---

## 3. Tools — `services/agent/tools/`

**Existing (moved in):** `data_tools.py` = `query_database`, `get_kpis`, `find_document`, `get_anomalies`, `get_vendor_info`, `get_p2p_stage_summary` (verbatim from [chat_tools.py](backend/services/chat_tools.py)).

**New — analysis (parameterized, safe):** `analysis_tools.py`
- `analyze_data(source, op, group_by?, metric?, agg?, top_n?, filters?)` — op ∈ {groupby, trend, top_n, describe, correlation, pivot}. Operates on a manifest dataset or a scoped SELECT. Pure pandas. Returns a result table + stores it in the manifest.

**New — visuals:** `chart_tool.py`
- `create_visual(data_key, chart_type, x, y, series?, title)` — chart_type ∈ {bar, line, pie, donut, hbar, scatter}. Renders **matplotlib** PNG in KPMG theme → artifact. Returns `{artifact_id, preview_url}` for inline display. Numbers come only from the referenced manifest data.

**New — reports:** `report_tools.py`
- `generate_excel_report(spec)` → `services/reports/excel.py`
- `generate_pptx(spec)` → `services/reports/pptx.py`
- `generate_pdf_report(spec)` → `services/reports/pdf.py`
Each takes a **ReportSpec** (sections/titles/narrative + **manifest data-keys**), builds the file deterministically, registers an artifact.

---

## 4. Report generators — `services/reports/`

- `theme.py` — KPMG palette/fonts shared by all (reuse the constants already in
  [build_presentation_pptx.py](kpmg-intelliflow/build_presentation_pptx.py): NAVY `#00338D`, etc.).
- `charts.py` — matplotlib helpers (KPMG-styled), shared by `chart_tool` and PDF/PPTX embeds.
- `excel.py` — openpyxl/xlsxwriter styled workbook (KPI tables, conditional formatting, freeze
  header). Pattern already proven in [backend/run_kpi_queries_to_excel.py](backend/run_kpi_queries_to_excel.py) — refactor its helpers into an importable builder.
- `pptx.py` — refactor the standalone `build_*_pptx.py` helpers (`add_rect`, `add_text`,
  `kpmg_header`, `slide_a/b`) into a reusable branded deck generator driven by ReportSpec.
- `pdf.py` — **ReportLab** in-depth report: cover, exec summary, KPI tables, embedded charts,
  narrative, footer — all from the manifest.

All consume `(ReportSpec, DataManifest)`; **no generator ever receives a model-authored number** — only data-keys it resolves against the manifest.

---

## 5. Guardrails — `services/agent/guardrails.py` + `grounding.py`

Guardrails run at three points: **input** (before the model), **tool-call** (before execution),
and **output** (before returning). All are deterministic Python — not model self-policing.

### 5a. Anti-hallucination (grounding.py)
- **Grounding rule** (strengthen existing system prompt): must call a tool before any data claim; never invent numbers; temperature 0.1.
- **DataManifest provenance:** answers/reports render only values present in tool results (§2).
- **Numeric verifier (output guard):** extract numeric tokens from the final answer; verify each matches a manifest value (normalized for ₹/Cr/%/commas) or is arithmetically derivable; strip/flag unverifiable numbers before returning.
- **Citations:** each figure carries provenance (which tool/query produced it), surfaced in the response.
- **Refuse over guess:** empty tool result → assistant says so, returns no number.

### 5b. Tool-call guardrails (guardrails.py)
- **Read-only enforcement (5-layer, see Hard Constraint above):** dedicated `SELECT`-only Postgres role + read-only session + write-guard regex + read-only-only tool surface + single-`SELECT` SQL validator. The harness can never create/update/delete data.
- **SQL validation + repair:** parse/validate generated SQL before run — read-only guard, column/table existence via `information_schema`, forced `LIMIT`, and an `EXPLAIN` cost ceiling to reject runaway scans; 1 automatic repair pass on error, then fail cleanly.
- **Tool-arg schema validation:** validate every tool call against its JSON schema (types, enums, ranges) before executing; reject out-of-range (e.g. `top_n` ≤ 100, chart series ≤ 12).
- **Prompt-injection defense:** uploaded data values are **data, not instructions** — tool results are passed as structured JSON, never concatenated into the system prompt; a scrubber strips instruction-like strings ("ignore previous", tool-call mimics) from row values before they reach the model.
- **Resource budgets per turn:** max tool calls (existing iteration cap = 8), max rows returned, max artifact size, chart/report cell caps, and a wall-clock timeout per tool (esp. analysis/chart rendering).
- **Cost/model budget:** per-turn token + escalation budget; cascade escalates to a bigger model only within budget, else degrades gracefully.

### 5c. Access & safety guardrails
- **RBAC-aware data:** chat must not surface data a user's role can't see on dashboards (respect the 12 roles); scope queries by the caller's role/company where applicable.
- **Artifact isolation:** artifacts written under per-session dirs; download endpoint validates `artifact_id` ownership (no path traversal, no cross-session access).
- **Audit:** every chat turn + artifact generation logged via `write_audit` (already used at [routers/chat.py](backend/routers/chat.py)) — `CHAT_QUERY`, `ARTIFACT_GENERATED`.
- **Rate limiting:** per-session request throttle to bound cost/abuse.

## 5d. Evaluation harness — `backend/tests/eval_chat.py` (+ `eval/` cases)

A runnable eval suite (no framework — plain asserts, per repo norm) that gates changes and
model swaps. Ties to the AISIA testing scenarios already documented in `ARB/AI_ARB.md`.

**Golden case set** (`backend/tests/eval/*.jsonl`) — each case = `{question, expects}`:

| Eval category | What it checks | Pass metric |
|---|---|---|
| **Numeric grounding** | Answer numbers all trace to tool results | Numeric-verification pass rate = 100% |
| **Injected hallucination** | A case where the model is nudged to invent a figure | Verifier strips/flags it (must catch) |
| **Tool selection** | Right tool chosen for the intent (KPI vs SQL vs chart vs report) | Tool-precision ≥ target |
| **SQL correctness** | Generated SQL runs + matches a hand-written reference result | Row/value match |
| **Read-only enforcement** | Write attempts (incl. injection-driven) are blocked | 100% blocked |
| **Refusal** | No-data questions → refuses, invents nothing | 100% refuse-clean |
| **Artifact integrity** | Excel/PPTX/PDF/PNG generate, open, and every figure ∈ manifest | Files valid + grounded |
| **Prompt injection** | Malicious strings in data don't alter behavior | No tool/behavior change |
| **Model-swap regression** | Same cases on Ollama/small model | Numbers identical (deterministic); prose may vary |

**Reported metrics:** grounding rate, numeric-verifier pass %, tool-selection precision, SQL
success %, mean latency, escalation rate, cost/turn. Run per PR touching the agent; block on
regressions. Feedback thumbs (frontend) append new failing cases to the golden set over time.

---

## 6. Artifacts store & serving — `services/artifacts.py` + `routers/chat.py`

- Per-session temp dir (e.g. `backend/_artifacts/{session_id}/`), registry `artifact_id → {path, type, filename, created}`.
- New endpoint `GET /api/chat/artifacts/{artifact_id}` → `FileResponse` with `Content-Disposition`
  (first file-download route in the backend — none exists today).
- Cleanup: TTL/max-per-session eviction; `.gitignore` the dir.
- Chat response includes `artifacts[]` with `url` + optional `preview` (base64/thumb for charts).

---

## 7. Frontend — `kpmg-intelliflow/src/routes/ask.tsx`

- Render **artifact cards** (icon by type, filename, Download button → artifact `url`).
- **Inline chart preview** (`<img>` from chart artifact preview URL).
- Tool-progress list from `tools_used` (already present) — richer labels.
- Swap the hand-rolled markdown parser for a small lib (`react-markdown` + `remark-gfm`) — optional cleanup, reduces bespoke code in [ask.tsx:147-266](kpmg-intelliflow/src/routes/ask.tsx).
- Use `apiFetch` ([api/client.ts](kpmg-intelliflow/src/api/client.ts)) for cold-start retry (chat currently bypasses it).
- **Deferred (phase 2):** SSE token streaming + live tool timeline via the existing bus
  ([backend/routers/events.py](backend/routers/events.py)) with a new per-session event `type`.

---

## New dependencies

Backend `requirements.txt` (also pin the already-used-but-undeclared ones):
`matplotlib`, `reportlab`, `python-pptx`, `xlsxwriter`. Ollama needs **no** Python lib (HTTP).
Frontend (optional): `react-markdown`, `remark-gfm`.

---

## Proposed file structure

```
backend/
  services/
    agent/
      orchestrator.py  registry.py  context.py  config.py
      grounding.py     guardrails.py  schema_card.py  metrics.py
      providers/  base.py  openrouter.py  ollama.py
      tools/      data_tools.py  analysis_tools.py  chart_tool.py  report_tools.py
    reports/    theme.py  charts.py  excel.py  pptx.py  pdf.py
    artifacts.py
  routers/chat.py         # + artifacts in response, + /artifacts/{id} download
  tests/eval_chat.py      # runnable eval suite (guardrails + grounding + tools)
  tests/eval/*.jsonl      # golden case set (grows via feedback thumbs)
  chat_engine.py / chat_tools.py   # thin shims → services/agent (compat)
kpmg-intelliflow/src/routes/ask.tsx   # artifact cards + chart previews
```

---

## Phasing

- **Phase 1 — Foundations:** provider abstraction + cascade config; move existing tools into
  registry; TurnContext/DataManifest; artifact store + download endpoint. (No behavior change to users yet.)
- **Phase 2 — Analysis & visuals:** `analyze_data` + `create_visual` (matplotlib); inline chart previews in `ask.tsx`.
- **Phase 3 — Reports:** `excel.py`, `pptx.py`, `pdf.py` + report tools + artifact cards.
- **Phase 4 — Guardrails & Evals:** `guardrails.py` (tool-arg validation, SQL validate/repair + EXPLAIN ceiling, prompt-injection scrubber, resource/cost budgets, RBAC, artifact isolation) + `grounding.py` (numeric verifier, citations) + the `eval_chat.py` suite and golden case set. Wire evals to gate agent changes.
- **Phase 5 — Small-model enablement:** Ollama provider, compact schema card, JSON-constrained tool calls, role routing tuned for local models — re-run the eval suite to confirm numbers stay identical.
- **Phase 6 (later):** SSE streaming UX.

---

## New functionality worth adding

- **Metric/semantic registry** — canonical KPI definitions the AI reuses (kills metric drift; huge win for small models).
- **Comparison mode** — period-over-period, company-vs-company, vendor-vs-vendor.
- **Scheduled/emailed reports** — reuse report generators on a cron.
- **Analysis-session bundle** — download all artifacts from a session as one zip.
- **RBAC-aware data** — respect the 12 roles so chat never surfaces data a role can't see on dashboards.
- **"Explain this KPI / anomaly"** deep-links from dashboards into chat with context pre-loaded.
- **Feedback thumbs → eval dataset** — grows the regression bank automatically.
- **Auto chart-type selection** — pick bar/line/pie from data shape when the user doesn't specify.

---

## Verification (end-to-end)

1. Backend up (`backend/venv`, port 8001). Confirm `pip install matplotlib reportlab python-pptx xlsxwriter`.
2. **Analysis:** `curl POST /api/chat` "spend by vendor top 5" → returns a table sourced from a real query; numbers match a direct `query_database`.
3. **Visual:** "chart CAPEX vs OPEX monthly" → response has a chart artifact; `GET /api/chat/artifacts/{id}` returns a PNG; matches `utilization` dashboard data.
4. **Excel/PPTX/PDF:** "make an Excel/PPT/PDF of procurement KPIs" → each artifact downloads and opens; every figure traces to a manifest value.
5. **Anti-hallucination:** ask something with no data → assistant refuses, no invented numbers; run `eval_chat.py` incl. the injected-hallucination case (verifier must strip/flag it).
6. **Small model:** set role models to a local Ollama model → same asks still produce correct grounded artifacts (quality of prose may vary; numbers must be identical since they're deterministic).
7. Verify **read-only invariant** (all 5 layers): attempt writes via chat (direct, and via
   prompt-injection in data) → all blocked; confirm the harness role has no write grants
   (`\dp`), and that a raw INSERT on the harness connection is rejected by the DB itself.

Note: app runs against **Neon** (cloud) via repo-root `.env` — verify through the API, never a bare local script (local Postgres is a different DB).
