# AGENTS.md

IntelliSource — KPMG procure-to-pay analytics. React 19 + Vite frontend, FastAPI + psycopg3
backend, PostgreSQL. Ships as an on-prem Windows demo box; deploy configs for Render + Vercel
also exist.

**No CI exists.** No workflow runs lint, types, or tests on your branch. You are the verification
step — see [Verify](#verify). Every command below is the gate that catches what the others miss.

## Verify

Backend and frontend are separate apps with separate cwds. The venv is `Intl/` at the repo root
(not `venv/`).

| Gate | Command | Run from |
|---|---|---|
| Types | `npx tsc --noEmit` | `frontend/` |
| Lint + format | `npm run lint` | `frontend/` |
| Frontend build | `npm run build` | `frontend/` |
| Backend tests | `python -m tests.eval_chat` | `backend/` |
| Agent eval (live LLM, costs tokens) | `python -m tests.eval_chat --live` | `backend/` |

Two of these are the real gate:

- **`npx tsc --noEmit` is the only type gate.** There is no `typecheck` script, and `npm run build`
  is Vite/esbuild transpile — type errors sail straight through. Run it on every frontend change.
- **`npm run lint` is formatting plus non-type-aware rules** (`tseslint.configs.recommended`, not
  `recommendedTypeChecked`; `no-unused-vars` is off). A clean lint means Prettier is happy, not that
  types are sound.

`python -m tests.eval_chat` tier 1 needs a seeded database (it asserts `po_dump` has rows) and no
API key. Many `backend/services/agent/*.py` modules are also their own tests — run
`python services/agent/guardrails.py` directly.

### Run it

`start_kpmg.bat` (Windows) is the launcher: it builds `Intl/`, installs deps, writes `.env`, starts
both services. `init_kpmg.py` is the same thing as a Python module. Login `admin` / `12345678`.

Frontend dev server is **5173**, not 8080 — 8080 is silently blocked on the KPMG network path.
`strictPort` makes it fail loudly rather than drift. Backend is 8001. `start.sh` still says 8080 and
is stale; use `init_kpmg.py`.

## Map

```
frontend/src/routes/*.tsx        one file per route, TanStack Router file-based
frontend/src/hooks/useKpi.ts     the TanStack Query layer (queries.ts is plain fetchers, not hooks)
frontend/src/api/client.ts       apiFetch() — the whole HTTP layer, relative "/api" via Vite proxy
frontend/src/lib/{brand,format,utils}.ts   brand tokens, INR formatting, cn()
backend/main.py                  mounts every router at prefix="/api"; init_db() on boot
backend/routers/*.py             plain `def` handlers, inline SQL, no DI, no Depends
backend/services/kpi_engine.py   ~80 KPI formulas as hardcoded SQL; results persisted to kpi_results
backend/services/agent/          the Ask IntelliSource harness: orchestrator, guardrails, 15 tools
backend/schema.sql               the ONLY DDL source, replayed on every boot, all IF NOT EXISTS
data/*.csv                       synthetic SAP exports, auto-seeded on first boot
tools/                           one-off pptx/doc/data generators; nothing imports them
docs/                            all documentation; see docs/README.md for the index
```

Request path: route file → `apiFetch`/`useKpi` → `/api/*` → router handler → `get_connection()` →
Postgres. Chat is the exception: `routers/chat.py` → `services/agent/orchestrator.run_turn()`, which
runs its own loop and its own read-only connection.

**Two database planes, and the agent never crosses.** `database.get_connection()` is the app's
write-capable connection. `services/agent/harness_db.py` points at `HARNESS_DATABASE_URL` (default
`...intellisource_harness_ro...`), sets `READ ONLY` per session, and enforces a real `SELECT`-only
Postgres role. Provision it once with `psql -f backend/scripts/setup_harness_ro_role.sql`;
agent tools fail at connect without it while the rest of the app looks healthy.

## Invariants

These are silent-failure rules. Each one has already cost a debugging session.

- **`?` placeholders require a params tuple.** `database.py` only translates `?` → `%s` when params
  are passed. A no-params `execute()` ships any `?` raw. Always pass params.
- **`get_connection()` rolls back on every call** and hands back a thread-local connection. A handler
  that writes without `conn.commit()` loses the write when the next request lands on that thread.
  Commit explicitly.
- **Columns are `TEXT`.** Timestamps default to `NOW()::TEXT`; money and dates are cast in SQL
  (`CAST(x AS REAL)`, `::FLOAT`, `date::DATE`). `to_date()` and `DATEDIFF` are not Postgres — they
  survive in `frontend/src/data/kpiDrillDowns.ts` (dead) and are a trap.
- **`schema.sql` is append-only.** No migration framework exists. New tables and new columns go at
  the bottom under a section comment; changing an existing column type needs a hand-written script
  in the style of `backend/migrate_utilization.py`. And because `init_db()` splits the file on `;`,
  **`DO $$ ... $$` blocks are impossible** there.
- **Tailwind v4 runs `source(none)` + explicit `@source`.** A stylesheet outside `frontend/src/`
  contributes no utility classes. No `tailwind.config.js` exists.
- **`OPENROUTER_API_KEY` is read at import time** in `providers/openrouter.py`. Setting it after
  import does nothing; it must be in `.env` before the process starts.
- **Auth is decorative.** No tokens, no JWT, no server-side role checks — `Depends` appears nowhere
  in `backend/routers/`, passwords are plaintext, and the frontend gates the UI by role only. Treat
  every endpoint as public when reasoning about exposure; the *agent* plane is the only one with real
  defence in depth (`guardrails.py` + the read-only DB role).

## Recipes

**New KPI** — end to end, all four steps or it does not appear:
1. `kpi_engine.py` — one `_run(conn, sql)` + `_upsert(conn, dashboard, code, label, ...)` inside the
   relevant `_procurement` / `_financial` / `_leadership` / `_vendor` / `_utilization` function.
   Add the row to `schema.sql`'s `kpi_config` INSERT if it is user-configurable.
2. `frontend/src/routes/<dashboard>.tsx` — call `useKpiValue("<dashboard>", "<KPI_CODE>", company)`.
   Pages list KPIs one by one; there is no generic KPI grid.
3. `frontend/src/data/kpiMeta.ts` — without an entry, `KpiInfoHover` renders nothing (it returns
   `null` on a missing key).
4. Optionally a drill-down under `routers/kpi.py`'s `_VALID_SUMMARY_KEYS` whitelist — unknown keys 404.

`_upsert` keys on `UNIQUE (dashboard, kpi_code, company_code)`; `compute_all()` loops every dashboard
function once per company code plus once for `"ALL"`. Structured KPIs store JSON in `value_text`
with `unit='json'` and the frontend `JSON.parse`s it. `_run()` swallows exceptions into `NULL` — a
broken formula shows as an empty card, not a 500. When adding one, verify the row landed.

**New agent tool** — four places, all required:
1. Implement `def my_tool(args: dict, ctx: TurnContext)` and `register(Tool(...))` at the bottom of a
   file in `services/agent/tools/`.
2. Add the module to the import list in `registry.py` — `_load_all_tool_modules()` runs at import and
   a file missing from that list never loads.
3. Add the name to `CORE_TOOL_NAMES` or `REPORT_TOOL_NAMES`. A tool in neither set is invisible to
   the model (report tools only get offered when the question matches `REPORT_INTENT_KEYWORDS`).
4. Add a label to the `ToolBadge` map in `frontend/src/routes/ask.tsx`, or the badge renders blank.

Put results in the manifest (`ctx.manifest.put(result, hint=...)`) and pass the returned key to
chart/report tools — never the raw data. That session-scoped manifest is what makes "now chart
that" work across turns.

`query_database` goes through `run_guarded_select`; structured tools use `harness_select`. Keep new
SQL on the harness plane.

## Sync points

Duplicated by hand across files. Change one and you change all of them.

| Thing | Copies |
|---|---|
| 5 dashboard names | `routers/kpi.py::VALID_DASHBOARDS`, `hooks/useKpi.ts`, the `get_kpis` tool schema enum, `upload.py`'s `KPI_REFRESH` broadcast |
| 12 roles | `schema.sql` users, `routers/auth.py::VALID_ROLES`, `AppContext.tsx::ROLES`, `AppContext.tsx::DEMO_PERSONAS` |
| Demo logins | `schema.sql` seeds `password = EXCLUDED.password` on every boot; `DEMO_PERSONAS` only fills the login form — a persona missing from the schema 401s |
| Chart types `{bar,line,pie,donut,hbar,scatter}` | `guardrails.py`, `report_tools._CHART_TYPES`, `_render_chart_png` |
| `CRORE = 1e7` | `lib/format.ts`, ~10 places in `kpi_engine.py`, and `_add_cr_hints` in the harness — independently, on purpose (a model dividing by 1e7 itself got it wrong) |
| `5173` | `vite.config.ts`, `init_kpmg.py::FRONTEND_PORT` |

## Generated and inert

Regenerate by running the tool that owns it; hand edits are silently overwritten.

- `frontend/src/routeTree.gen.ts` — TanStack Router output, `@ts-nocheck`, rewritten by `vite dev`
  and `vite build`. Add routes as files in `src/routes/` (`admin.users.tsx` → `/admin/users`).
- `backend/schema.sql` seed blocks — replayed on every boot; only `ON CONFLICT DO NOTHING` /
  `IF NOT EXISTS` forms are safe there.
- `tools/` — one-off pptx/doc/data generators, nothing imports them. Run standalone; leave them
  alone.
- `backend/services/chat_engine.py` and `chat_tools.py` — deliberate compat shims, kept so old
  import paths resolve. New agent code goes in `services/agent/`.
- `backend/models/*.py`, `frontend/src/data/kpiDrillDowns.ts` — dead, kept for reference.

Watch for `frontend/src/data/mock.ts`: `vendor-repo.tsx` falls back to it when the vendors API
returns empty, so fabricated data can reach the screen. A page that "works" against zero rows is
showing mock data, not a working query.

## Environment traps

- **`Intl/` is the venv, and it can be broken.** A venv copied between machines keeps the old
  `pyvenv.cfg` base path. `init_kpmg.py` smoke-tests and rebuilds it; if `Intl\Scripts\python` fails,
  delete `Intl/` and re-run rather than debugging the venv.
- **Python 3.12** (`backend/.python-version`). The pandas/pydantic pins in `requirements.txt` are
  deliberately the versions with cp314 wheels — downgrading them forces a Rust source build.
  `python-dotenv` is deliberately absent; `main.py` has a manual `.env` fallback.
- **Windows encoding.** `client_encoding=UTF8` on connect, `PYTHONUTF8=1`, and
  `ensure_db.py`'s `ENCODING 'UTF8' TEMPLATE template0` are all load-bearing — the KPMG box's
  `template1` is WIN1252 and cannot hold a `→` in `change_log`. Some committed files have mojibake
  (`�?`); leave them.
- **AI features are off by default.** Blank `OPENROUTER_API_KEY` means `ai_enabled()` is false, the UI
  greys out, and `POST /api/chat` returns 200 with a canned reply rather than an error. A chat route
  "working" with no output is the gate, not a bug.
- **ETL replaces rows.** Upload is `DELETE`-then-`INSERT` per natural key, and
  `parser.detect_dataset` rejects a whole file if fewer than 3 signature columns match.
- `frontend/vercel.json` is broken (placeholder host) and contradicts the root one. The real deploy
  path is the on-prem launcher.

## Reference

Read the doc when the task touches that area; do not preload them. `docs/README.md` indexes all of
them.

| Task | Doc |
|---|---|
| What the app does, end to end | `docs/FEATURES.md` |
| Architecture, API surface, schema, design rationale | `docs/reference/TECHNICAL_DOCUMENTATION.md` |
| SAP field → column mapping, KPI SQL, CAPEX/OPEX logic | `docs/reference/SAP_FUNCTIONAL_DOCUMENTATION.md` |
| P2P lifecycle, full DDL, ETL contract | `docs/reference/SKILL_IntelliSource.md` |
| Harness design; cited by `orchestrator.py`, `harness_db.py`, `guardrails.py` | `docs/reference/ASK_INTELLISOURCE_HARNESS_PLAN.md` + `ASK_INTELLISOURCE_OPTIMIZATION_PLAN.md` |
| Per-dashboard KPI SQL | `docs/reference/PROCUREMENT_KPI_QUERIES.md`, `finance.md`, `UTILIZATION_KPI_REFERENCE.md`, `VendorD.md` |
| Business requirements, security posture | `docs/reference/BRD_Summary_IntelliSource.md`, `BRD_Security_Requirements_Addendum.md` |
| KPMG submission artefacts (ARB, decks, screenshots) | `docs/architecture/`, `docs/deliverables/`, `docs/assets/` |

`docs/architecture/` and `docs/deliverables/` are frozen submission artefacts, not living docs.
`README.md` is the user-facing pitch and is **partly out of date** — trust the code.