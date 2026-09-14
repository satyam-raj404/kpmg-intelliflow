# Ask IntelliSource — Speed & Accuracy Optimization Plan

## Context

The harness is built and live ([ASK_INTELLISOURCE_HARNESS_PLAN.md](ASK_INTELLISOURCE_HARNESS_PLAN.md)):
cascade orchestrator, 12 read-only tools, DataManifest grounding, 5-layer read-only invariant,
matplotlib/Excel/PPTX/PDF generation, artifact download endpoint, Tier-1 eval suite. It works
end-to-end. This plan makes it **fast** and **accurate** enough for daily use, and adds the
functionality that turns it from a demo into a product (starting with a **Prompt Library**).

Current code (`backend/services/agent/`, ~2,250 lines): `orchestrator.py` (267), `guardrails.py`,
`grounding.py`, `schema_card.py`, `metrics.py`, `providers/`, `tools/`, plus `services/reports/`,
`services/artifacts.py`, `routers/chat.py`, `tests/eval_chat.py`.

---

## Part A — Where the time and errors actually come from

Read straight off the current implementation:

### Speed bottlenecks
| # | Bottleneck | Location | Cost |
|---|---|---|---|
| S1 | **Every turn is N sequential blocking LLM round-trips** | `orchestrator.run_turn` loop | dominant latency; free-tier >120s observed |
| S2 | **A separate narrator call every turn** (extra full LLM round-trip even when the planner already produced prose) | `orchestrator.py:211-216` | +1 network call/turn |
| S3 | **All 12 tool schemas sent on every planner call** | `orchestrator.py:180` `openai_tool_schemas()` | big prompt → slower + costlier + worse tool pick on small models |
| S4 | **Tool calls executed sequentially** even when independent | `orchestrator.py:200-205` | serial DB/IO |
| S5 | **EXPLAIN round-trip before every SQL**, including pre-validated canonical metrics | `guardrails.validate_sql_cost` via `data_tools.get_metric` | extra DB hop on the common path |
| S6 | **No caching** — identical questions re-run the whole loop | none exists | repeated cost |
| S7 | **No streaming** — user stares at a spinner until the whole turn finishes | `routers/chat.py` blocking POST | perceived latency |
| S8 | **No fast-path** — "what is total PO value" runs the full agentic loop | `run_turn` | overkill for 60% of questions |

### Accuracy gaps
| # | Gap | Location | Effect |
|---|---|---|---|
| A1 | **Manifest is per-turn** — follow-ups ("chart that", "export this") can't see prior data | `TurnContext` created fresh each `run_turn:172` | breaks conversational analysis |
| A2 | **Crude table retrieval** — keyword overlap picks the wrong table → wrong SQL | `schema_card.select_relevant_tables` | wrong answers on phrasing edge-cases |
| A3 | **Nested report schemas fail on small models** (observed on 20B) | `report_tools` params | reports silently don't build |
| A4 | **Model-authored SQL can be subtly wrong** (joins/filters) with no result sanity check | `query_database` path | plausible-but-wrong numbers |
| A5 | **Citations never populated** — `ctx.citations` always empty | `orchestrator._finish:254` | "trust me" numbers, no provenance UI |
| A6 | **Grounding is heuristic** (±1% tolerance, scale-guessing) | `grounding.verify_numbers` | can pass a wrong number within tolerance, or over-strip |
| A7 | **Metric selection is soft** — model may hand-write SQL when a canonical metric exists | prompt guidance only | metric drift |
| A8 | **No self-consistency / no eval gating on accuracy** | Tier-2 eval is opt-in | regressions ship silently |

---

## Part B — Speed optimization plan

### B1. Fast-path intent router *(biggest win, low effort)*
New `services/agent/router.py`. Before the agentic loop, a cheap classifier decides:
- **Direct-metric**: question maps to a canonical metric (fuzzy match on `metrics.py` keys/aliases) → call `get_metric` directly, skip the planner entirely, one narrator call. ~60% of questions.
- **Document lookup**: regex detects a PO/PR/GRN/invoice number → `find_document` directly.
- **Agentic**: everything else → current loop.

Rule-based first (regex + keyword + alias table), so it adds **zero** LLM latency. Optional tiny-model classifier later. Cuts the common path from 3-4 LLM calls to 1.

### B2. Merge the narrator call when possible *(S2)*
In `run_turn`, when the planner's terminating response **already has `content`**, use it directly
(after grounding) instead of firing a second narrator call. Only invoke the separate narrator when
the planner stopped with empty content. Saves one full round-trip on most turns.

### B3. Tool subsetting per intent *(S3, also helps accuracy)*
`registry.openai_tool_schemas(subset=...)`. Use the `schema_card`/router intent to send only
relevant tools: data+analysis tools always; **report/chart tools only when** the question mentions
chart/graph/report/excel/pdf/ppt/download. Smaller prompt → faster, cheaper, and small models pick
the right tool far more reliably from 4 options than 12.

### B4. Parallel independent tool calls *(S4)*
When the planner returns multiple `tool_calls` in one response and they're all read tools
(no manifest-key dependency between them), run them concurrently via a `ThreadPoolExecutor`.
DB reads are IO-bound; the harness connection is thread-local so each worker gets its own.

### B5. Skip EXPLAIN on trusted SQL *(S5)*
`run_guarded_select(sql, trusted=False)`. Canonical metric SQL and the parameterized structured
tools are pre-validated — pass `trusted=True` to skip the EXPLAIN cost probe. Keep EXPLAIN only for
model-authored `query_database` SQL, where it's actually earning its keep.

### B6. Two-layer cache *(S6)*
New `services/agent/cache.py`:
- **Exact cache**: `(normalized_question, data_version)` → full result, per process, short TTL.
  `data_version` = max(`upload_batches.completed_at`) so any new upload invalidates it.
- **Tool-result memoization**: identical `(tool, args)` within a turn/session returns the cached
  manifest entry instead of re-querying.
- **LLM prompt caching**: send OpenRouter/Anthropic `cache_control` on the stable system-prompt
  prefix so providers that support it skip re-encoding it.

### B7. SSE streaming *(S7 — the perceived-speed win)*
Reuse the existing bus (`routers/events.py` `broadcast` + `/stream`). Emit per-session events:
`CHAT_TOOL_START`/`CHAT_TOOL_DONE` (live tool-progress timeline) and `CHAT_TOKEN` (streamed answer
tokens; providers that stream) / `CHAT_DONE`. Frontend `ask.tsx` subscribes and renders progress +
streaming text. Backend answer stays correct; only delivery changes.

### B8. Model warmth & config
Document `ollama pull` + `keep_alive`; note OpenRouter prompt-cache; expose a per-request "fast vs
accurate" model choice (maps to cascade tiers) so the UI can trade latency for depth.

---

## Part C — Accuracy optimization plan

### C1. Persist the manifest across turns *(A1 — enables conversational analysis)*
Promote `DataManifest` from per-turn to **per-session** (keyed store with TTL, capped size), stored
alongside session history in `routers/chat.py`. Follow-ups like "now chart that" / "export this to
Excel" resolve the previous turn's `manifest_key`. Grounding then verifies against the whole
session's fetched data, not just this turn's.

### C2. Embedding-assisted table + metric retrieval *(A2, A7)*
Upgrade `schema_card.select_relevant_tables` and metric selection from keyword-overlap to semantic
match. Two options: a small local embedding model (sentence-transformers) computed once over the
~12 table cards + metric descriptions, or — since the catalog is tiny — always include a compact
one-line index of *all* tables and let the model pick, reserving the detailed card for the top
matches. Add an **alias table** (synonyms → canonical metric key) so "spend"/"expenditure"/"outlay"
all route to `spend_by_vendor`.

### C3. Flatten report schemas + 2-step report build *(A3)*
Small models choke on the nested `sections[]` report schema. Fix: (a) flatten to the simplest
viable shape; (b) a 2-step build — model first calls `plan_report` (returns section list as plain
strings referencing manifest keys), backend validates + fills, then `render_report(format)`. Also
enable **JSON-constrained decoding** (Ollama `format:"json"`, OpenRouter structured outputs) for
report/tool args so malformed calls stop happening.

### C4. SQL result sanity checks + expand metric registry *(A4, A7)*
- Grow `metrics.py` to cover more common questions so fewer answers rely on model-authored SQL.
- Add lightweight post-query sanity checks (non-empty when expected, no all-NULL aggregate,
  row-count within sane bounds) that trigger the existing repair path.
- Add 2-3 worked SQL examples per table into the schema card (few-shot) — biggest single accuracy
  lever for text-to-SQL on small models.

### C5. Real citations *(A5)*
Populate `ctx.citations`: each figure carries `{tool, manifest_key, sql?}`. Return them in the API
and render a "sources" affordance in `ask.tsx` — click a number, see the query/rows that produced
it. Turns grounding from invisible into a trust feature.

### C6. Stronger grounding *(A6)*
- Tighten tolerance; make scale-matching explicit (use the `_cr` sibling as the canonical display
  value rather than guessing ×1e7).
- Prefer **slot-filling**: where the answer is tabular, have the backend render the table from the
  manifest directly (numbers never pass through the model), and let the model write only the prose
  around it. Eliminates a whole class of transcription errors.

### C7. Accuracy eval gating *(A8)*
Expand `tests/eval/golden_questions.jsonl` with reference answers; add a **self-consistency** check
(run critical questions twice, flag disagreement) and a CI gate that fails the build on grounding-
rate or tool-precision regression. Wire feedback thumbs (see D) to append new failing cases.

---

## Part D — Additional functionality

### D1. Prompt Library *(explicitly requested)*
Evolve the hardcoded `QUICK_PROMPTS` in `ask.tsx` into a DB-backed, shareable library.
- **Schema**: `prompt_library(id, name, category, prompt_text, params_json, created_by, is_shared, use_count, created_at)`. `params_json` supports templated placeholders like `{{company_code}}`, `{{period}}` filled via a small form before run.
- **Backend**: `routers/prompt_library.py` — GET (list, filter by category/mine/shared), POST (create), PUT, DELETE, POST `/{id}/use` (increment use_count). Read/write to the **app** DB (this is app metadata, not the harness read-only plane).
- **Frontend**: a Library panel in `ask.tsx` — browse by category (Spend, Risk, Vendor, P2P, Compliance), **save-from-chat** (turn any question into a reusable prompt), parameter form, one-click run, "most used" sort. Seed it with the current 10 quick prompts.

### D2. Conversation persistence & history
Sessions + transcripts are in-memory today (lost on restart). Persist to `chat_sessions` /
`chat_messages` tables; add a conversation sidebar (list, resume, rename, delete). Enables C1's
cross-turn manifest to survive restarts too.

### D3. Feedback loop
Thumbs up/down + optional note per answer → `chat_feedback` table → auto-appends to the eval golden
set (C7). Closes the accuracy flywheel.

### D4. Comparison mode
First-class period-over-period / company-vs-company / vendor-vs-vendor deltas — a `compare` analysis
op + a dedicated prompt-library category.

### D5. Dashboard → chat deep-links
"Explain this KPI" / "Investigate this anomaly" buttons on dashboards open Ask IntelliSource
pre-loaded with context (the KPI, company code, period). Meets users where they already are.

### D6. Scheduled & shareable reports
Cron a saved prompt → generate the artifact → email/store. Plus "share artifact" links and a
"download all session artifacts as zip" bundle.

### D7. RBAC-scoped answers
Respect the 12 roles: the harness must not surface data a user can't see on dashboards. Scope
queries by the caller's role/company at the tool layer.

### D8. UX niceties
Model selector (fast/accurate), per-answer latency+cost telemetry, auto chart-type selection, pin
an answer to a dashboard, voice input, export to Teams/email.

---

## Part E — Phasing (impact × effort)

| Phase | Items | Why first |
|---|---|---|
| **1 — Quick wins** | B1 fast-path, B2 merge narrator, B3 tool subset, B5 skip-EXPLAIN | Biggest latency cut, low risk, no new deps. Common question 3-4 calls → 1. |
| **2 — Prompt Library + persistence** | D1, D2 | Highest user-visible value; unblocks D3 feedback loop. |
| **3 — Conversational accuracy** | C1 session manifest, C5 citations, C6 grounding | Makes multi-turn analysis actually work + trustworthy. |
| **4 — Streaming UX** | B7, B4 parallel tools | Perceived speed; live tool timeline. |
| **5 — Retrieval & SQL accuracy** | C2 embeddings/aliases, C4 metric expansion + few-shot SQL, C3 report schema | Deepest correctness gains; more involved. |
| **6 — Caching + eval gating + extras** | B6, C7, D3-D8 | Hardening + flywheel + reach. |

---

## Part F — File change map

| Area | Files |
|---|---|
| Fast-path router | **new** `services/agent/router.py`; wire in `orchestrator.run_turn` |
| Narrator merge / tool subset / EXPLAIN skip | `orchestrator.py`, `registry.py`, `guardrails.py`, `tools/data_tools.py` |
| Parallel tools | `orchestrator.py` |
| Cache | **new** `services/agent/cache.py`; `orchestrator.py` |
| Streaming | `routers/chat.py`, `routers/events.py`, `kpmg-intelliflow/src/routes/ask.tsx` |
| Session manifest + persistence | `routers/chat.py`, `context.py`, **new** `chat_sessions`/`chat_messages` tables in `schema.sql` |
| Retrieval/metrics | `schema_card.py`, `metrics.py` |
| Report schema | `tools/report_tools.py`, `providers/*` (json mode) |
| Citations + grounding | `orchestrator.py`, `grounding.py`, `context.py`, `ask.tsx` |
| Prompt Library | **new** `routers/prompt_library.py`, `schema.sql`, **new** `kpmg-intelliflow/src/routes/prompt-library.tsx` + panel in `ask.tsx` |
| Eval gating | `tests/eval_chat.py`, `tests/eval/golden_questions.jsonl` |

---

## Part G — Verification (per phase, against LOCAL Postgres)

- **Speed**: measure end-to-end latency for a fixed question set before/after each phase; assert
  the fast-path answers "total PO value" in **1 LLM call** (log call count per turn); confirm
  cached identical questions return without an LLM call.
- **Accuracy**: `python -m tests.eval_chat --live` grounding-rate must not regress; add the
  cross-turn case ("top 5 vendors" → "chart that" → "export to Excel") and assert the follow-ups
  resolve the prior manifest key and produce artifacts.
- **Prompt Library**: create → list → run-with-params → save-from-chat → delete via API + UI.
- **Read-only invariant** (unchanged, must stay green): `backend/scripts/verify_harness_ro_role.sh`
  plus the eval's read-only + injection cases.
- Always verify through the running FastAPI server on :8001 (not bare scripts); app data lives on
  Neon, the harness reads LOCAL Postgres via `HARNESS_DATABASE_URL`.

---

## Headline recommendation

Do **Phase 1 first** — the fast-path router + narrator merge + tool subsetting collapse the common
question from 3-4 model round-trips to 1, which is the single largest speed lever and costs almost
nothing. Then **Prompt Library (Phase 2)** for immediate user value. Accuracy phases (3, 5) matter
most once real users are asking varied questions — the session-manifest (C1) and citations (C5) are
what make it feel like a real analyst rather than a one-shot Q&A box.
