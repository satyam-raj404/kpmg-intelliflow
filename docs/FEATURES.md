# IntelliSource — Feature Guide

What the application does, verified against the code. Where this guide and the UI disagree, this
guide is right — several UI strings advertise features that do not exist (see [Advertised but not
real](#9-advertised-but-not-real)).

Companion to `TECHNICAL_DOCUMENTATION.md` (architecture and API) and `AGENTS.md` (working in the
codebase).

---

## 1. What the app is

A procure-to-pay (P2P) analytics platform for SAP data. It ingests 10 SAP export CSVs (PRs, POs,
deliveries, GRNs, invoices, payments, vendor master, change log, company/plant master), builds a
joined fact table, mines process anomalies, and computes ~100 KPIs across 5 dashboards. Plus an LLM
agent that answers questions against the live DB and generates chart/report files.

**Stack:** React 19 + Vite + TanStack Router/Query + Recharts · FastAPI + psycopg3 · PostgreSQL ·
OpenRouter (GPT-4o) or Ollama.

---

## 2. Data ingestion

**Upload** (`/upload`) — drag-drop a single `.csv/.xlsx/.xls`, max 50 MB (server-side only). Returns
a `batch_id` immediately; ETL runs on a background thread and you watch a progress bar over SSE.

**The pipeline** (`services/etl.py`) is 10 stages, each broadcasting a progress %:

| % | Stage |
|---|---|
| 5 | Parse — dataset auto-detected by ≥3 matching signature columns, ~90 SAP field aliases normalised (`EBELN → purchasing_document`) |
| 20 | Validate — 6 rules: mandatory fields, numerics, PO ranges, PO referential integrity (warn-only), enum checks, composite-key dupes |
| 40 | Load — `DELETE`-then-`INSERT` per natural key, so **re-uploading replaces rows** |
| 48 | Contract check — only when the file is `po_dump` |
| 55 | Entity hierarchy rebuild |
| 60 | Fact table rebuild (`pr_po_grn_invoice`) |
| 75 | Process mining re-run |
| 90 | All KPIs recomputed for every company code + `ALL` |
| 100 | Done — rows accepted / rejected + a 20-row rejection sample |

A file whose columns don't match any known signature is **rejected wholesale**, with the full column
list in the error.

**Demo data** — `data/*.csv` auto-seeds on first boot (background thread, non-blocking). Three files
(`RFQ.csv`, `BID_Data.csv`, `Budget_Master.csv`) are present but have no parser signature, so
**sourcing/RFQ/bidding and budgeting are not in the product at all**.

---

## 3. The five dashboards

Every page: KPI cards with ⓘ hover tooltips (title + prose + formula + the actual SQL), a company-code
filter, Recharts visualisations, and a client-side **PDF export** (renders the DOM to canvas, slices
across A4 landscape pages). The **Excel button is a stub on every page** — it just toasts
"Export ready".

### Procurement (`/dashboard`)

Total PO Value MTD, Active PO Count, High-Value PO Count, Open PR Aging, Avg PR→PO days, PO Approval
Cycle, PO Deletions MTD, PO Amendment Rate.
Charts: PO value trend (area), PO count vs maverick spend (composed bar + line).

### Financial (`/financial`)

Total Payments YTD, Payment-to-PO Ratio, 3-Way Match Rate, Invoice Processing Days, On-Time Payment
Rate, Open Invoice Value, Early / On-Time / Late payment split.
Charts: monthly payments (area), timing donut, monthly volume (bar).

### Leadership (`/leadership`)

The most feature-dense page. Total Spend YTD, Maverick PO Rate, End-to-End Cycle, Vendor
Concentration, Negotiation Savings, Supply Risk Score, SOD Conflicts, High-Value POs. Plus:

- A **P2P Summary Counts** panel — 10 hover tiles in two groups (Pipeline Health / Risk &
  Exceptions), each opening a **drill-down table** of the underlying rows (15 at a time, up to 200).
  This is the only drill-down mechanism in the app.
- A `HighValueThresholdPanel` — the *only* mutating control in any dashboard. Enter a threshold in
  Crores, hit Apply, and the backend re-runs **every KPI for every company code** synchronously.
- CAPEX/OPEX split, risk indicator bars, top-10 invoices by vendor, PR aging buckets, PR qty by
  material group, invoice-vs-payment trend.

### Vendor Performance (`/vendors`)

Active Vendor Count, Compliance Rate, Avg Delivery Lead Time (signed, negative = early), Avg Delay,
Blocked Vendors, Master changes. Plus a vendor health breakdown strip
(Active / Non-Active / One-Time / Domestic / International / MSME), compliance donut, delivery
lead-time bars, top-10 spend, vendor type chart.

### Utilization (`/utilization`)

CAPEX vs OPEX spend, % split, PO counts, avg PO values, pending delivery. Materials panel: delivery
utilisation, 3-way match, open PO value, vendor GRN fill rate, material spend by category. Has a
second filter — a hardcoded department list (Civil Works, Electrical, Office, IT Hardware/Software,
Consulting, Logistics, Maintenance).

---

## 4. P2P lifecycle & process mining

### P2P Lifecycle (`/p2p`)

The strongest page in the app.

- **Document search** by PO / PR / GRN / INVOICE number → collapsible per-line results, each with a
  5-stage horizontal timeline and cycle-time chips colour-coded against thresholds (PR→PO ≤5d,
  PO→GRN ≤30d, GRN→Inv ≤7d, Inv→Pay ≤30d).
- **End-to-end flow schematic** — 7 clickable stage cards with counts, conversion % badges, and RAG
  dots (green / amber / red) on each transition.
- Click any stage → a records table of the actual documents at that stage.
- Filters (date / vendor / plant / purchasing group), summary tiles, monthly funnel chart,
  process-variant distribution bar chart.

### Fact table

`fact_builder.py` builds `pr_po_grn_invoice` at PO-line grain, joining
PR → PO → delivery → GRN → PO-invoice → invoice → payment, netting GRN/invoice quantities and
amounts by debit/credit sign, and computing four cycle-time columns (`pr_to_po_days`,
`po_to_grn_days`, `grn_to_invoice_days`, `invoice_to_payment_days`) plus `total_cycle_days`.

### Process mining

`event_generator.py` classifies each line into a **process variant** (7 classes from
`PR_PO_GRN_INV_PAY` down to `INCOMPLETE`) and flags **9 anomalies**:

| Severity | Codes |
|---|---|
| HIGH | `MAVERICK_BUY`, `THREE_WAY_MISMATCH`, `DUPLICATE_INVOICE`, `PAYMENT_BEFORE_GRN`, `VENDOR_BLOCK` |
| MEDIUM | `LATE_DELIVERY`, `PRICE_DEVIATION`, `SPLIT_PO` |
| LOW | `LATE_PAYMENT` |

Three more codes are *declared* (`OVERDUE_INVOICE`, `GRN_WITHOUT_PO`, `LONG_APPROVAL`) but never
emitted — the detector code for the first is computed then discarded, the second has no detection
code, and the third is structurally impossible (PR_CREATED and PR_APPROVED share a timestamp).

### Alerts (`/alerts`)

Anomaly list sorted by severity with a High/Medium/Low strip, a detail sheet showing every PO
carrying that flag (with co-occurring flags as chips), and a **PO Deletion Monitor** table
(`deletion_indicator = 'L'`, value at risk, created-by, anomalies). Also surfaced in the sidebar bell
and as a panel on the Procurement dashboard.

---

## 5. Ask IntelliSource — the AI agent

The most interesting piece. `/ask` → `orchestrator.run_turn()`.

### Three-tier loop

1. **Fast path** — a pure-regex router classifies the question with *zero* LLM calls. A metric lookup
   ("total PO value") hits one tool and answers. A document number tries PO→PR→GRN→INVOICE and takes
   the first non-empty hit. Everything else falls through.
2. **Planner loop** — up to 8 iterations, 8 tool calls per turn. The system prompt carries a
   read-only contract, 17 canonical metric definitions, a **schema card** (4 relevant tables selected
   by keyword relevance, with columns and worked SQL patterns), and a list of data already fetched
   this session. Multiple tool calls in one response run concurrently on a thread pool. One automatic
   SQL-repair attempt if a query fails.
3. **Narrator** — uses the planner's own prose if it wrote any; only calls a separate narrator LLM
   when the planner stopped empty.

### The 15 tools

*Lookup* — `query_database` (guarded SQL), `get_metric` (17 canonical metrics), `get_kpis` (any
dashboard's stored KPIs), `find_document`, `get_anomalies`, `get_vendor_info`,
`get_p2p_stage_summary`.

*Analysis* — `analyze_data` (groupby / trend / top_n / describe / correlation / pivot over pandas),
`create_visual` (matplotlib PNG, 6 chart types).

*Reports* — `create_report` (one-shot) or `start_report` → `add_table_section` →
`add_chart_section` → `add_narrative_section` → `finalize_report`.

Tools operate on a **session-scoped data manifest** — results get keys like `metric3`, and
chart/report tools reference the key, never the raw data. That's what makes "now chart that" work
across turns.

### Defence in depth

Genuinely good, unlike the rest of the app:

1. A real PostgreSQL `SELECT`-only role with `default_transaction_read_only = on`
2. `SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY` on every connection
3. Regex write-keyword rejection + forced `LIMIT 150` + single-statement enforcement
4. `EXPLAIN` cost ceiling (200,000) on untrusted SQL
5. Prompt-injection scrubbing of the 5 known injection patterns
6. Per-turn budget: 8 tool calls, 90 seconds
7. **Numeric grounding** — every number in the reply is checked against the manifest, and anything
   not present is replaced with `[unverifiable]`

### Provider cascade

`provider:model` strings per role (planner / sql / narrator), OpenRouter or Ollama, escalating only
on network / 429 failure. AI is **off by default** with a blank API key: the UI shows an amber
banner, the input is disabled, and `POST /api/chat` returns a canned message rather than an error.

### Chat UI

Session id in localStorage, history drawer (create / resume / delete), prompt-library drawer, 10
click-to-send quick prompts, tool badges per turn, artifact cards with inline PNG previews and
download links, hover-to-save any user message as a reusable prompt. Hand-rolled markdown renderer
(headings, bullets, code fences, pipe tables, bold, inline code). No streaming, no transcript export,
and a page refresh doesn't rehydrate the visible messages.

---

## 6. Reports & artifacts

Generated server-side into `backend/_artifacts/<session>/`, 25 MB cap, 24 h TTL, 50 files per session
FIFO. All four kinds are KPMG-branded:

- **PDF** (ReportLab) — cover page with KPMG wordmark, then narrative / chart / table sections, navy
  footer bar with page numbers, tables capped at 40 rows
- **PPTX** (python-pptx) — 16:9, full-bleed navy title slide, navy header bands, tables capped to 6×12
- **Excel** (openpyxl) — one sheet per section, `00338D` header fill, frozen panes, auto-fit columns
- **PNG charts** (matplotlib) — `Agg`, KPMG palette, bar / line / pie / donut / hbar / scatter

---

## 7. Supporting features

| Feature | What it does |
|---|---|
| **Vendor Repository** (`/vendor-repo`) | Searchable vendor cards, category chips, grid/list toggle, Add-Vendor sheet (13 fields incl. MSME flag, payment terms). |
| **Contract Center** (`/contract-center`) | Contract CRUD, and a **contract-number check** that annotates every PO line `MATCHED` / `UNMATCHED` / `NO_CONTRACT`. Summary tiles + an unmatched-PO table. Re-runs on every create/edit/delete. |
| **Profit Centers** (`/profit-center`) | CAPEX/OPEX classification master. CRUD, budget vs actual with overrun markers, and a **flag toggle that cascades** — flipping a PC's default re-flags every system-tagged `po_categorization` row for that PC. |
| **Action Log** (`/actions`) | A 4-column Kanban: Open POs → PRs without a PO (with client-side ageing) → Under Review → Closed. A modal logs proposed changes + notes + approver email. |
| **Audit Trail** (`/admin/audit`) | Last 200 audit rows, 30 s auto-refresh, tone-coloured action pills. ~17 action types are written across the app. |
| **User Management** (`/admin/users`) | Add user (server generates a 12-char password, shown once), edit role, activate/deactivate, reset password. |
| **Activity History** (`/history`) | Browser-local upload/download log from localStorage. Not server-backed. |
| **Prompt Library** | 10 seeded prompts across 6 categories, `use_count` tracking, save-from-chat, audit-logged CRUD. |
| **Real-time** | `/api/stream` SSE — 3 event types (`UPLOAD_PROGRESS`, `KPI_REFRESH`, `UPLOAD_ERROR`), 30 s ping keepalive, in-process fan-out. |

**Auth & roles** — login with plaintext password compare against 13 seeded demo accounts
(`admin` / `12345678`, plus 12 persona accounts on `demo1234` with one-click persona chips on the
login page). 12 roles. Signup lets you pick any role with a description of what it gets.

---

## 8. Exports

| Path | Behaviour |
|---|---|
| Dashboard PDF | `html-to-image` + `jspdf`, client-side only. Wired on the 5 dashboard pages. Files named `IntelliFlow_*` (brand mismatch). |
| Excel button | **Stub.** `toast.success("Export ready")` on every page. No Excel export exists in the frontend. |
| Agent artifacts | Real — PDF/PPTX/XLSX/PNG from Ask IntelliSource, served from `/api/chat/artifacts/{id}`. |
| `backend/run_kpi_queries_to_excel.py` | Standalone script, run by hand. Dumps every KPI query to an Excel workbook. Not an endpoint. |
| `scripts/run_compute.py` | Standalone CLI: re-run `compute_all()` and print the utilization KPIs. |

---

## 9. Advertised but not real

Worth knowing before a demo.

1. **Auth is entirely decorative.** No tokens, no JWT, no `Depends` anywhere in the routers. Every
   endpoint — including `/api/audit` and user management — is callable unauthenticated. Role only
   hides 3 sidebar links; `/admin/users` is URL-reachable by anyone, and the TopBar has a **"View as
   role" dropdown that hands Admin to anyone in one click**.
2. **Admin → Settings is a 16-line prose placeholder.** The Procurement dashboard's High-Value PO card
   says the threshold is configurable there; it's actually on the Leadership page.
3. **Excel export doesn't exist** anywhere in the frontend.
4. **The entire software-licensing block (14 KPIs)** is computed, has full tooltips in `kpiMeta.ts`,
   and has no UI at all.
5. **`PlantBreakdown`** (CAPEX/OPEX by plant) is written and never rendered. Same for
   `OPEN_PO_AGING_BUCKETS`, `OPEN_INVOICE_VALUE` aging buckets, and the `charts.vendor.otif` series.
6. **Vendor Repository shows mock data** when the vendors API errors, and hardcodes every real vendor
   to category `"IT Services"` with spend 0 and compliance "Compliant" — so the category filter
   returns nothing for 5 of its 6 chips.
7. **Action Log is write-only** — nothing ever moves a row out of "Under Review", and logging an
   action doesn't modify the PO/PR.
8. **History's Downloads tab is permanently empty** — nothing ever writes a download entry, and PDF
   export doesn't log.
9. **GRN document search 500s** — `routers/p2p.py:481` queries `grn_dump.mat_doc`, which doesn't
   exist (the column is `material_document`).
10. **`monthly_funnel`** on the P2P page silently ignores every filter.
11. Six committed junk files (`backend/.DS_Store`, `backend/backend.log`), a stale `bun.lockb`
    alongside `package-lock.json`, and `frontend/vercel.json` pointing at a placeholder host.

`README.md` is also out of date: it says React 18, port 8080, "bundled" API key, and docs at repo
root.
