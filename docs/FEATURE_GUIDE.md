# IntelliSource — Feature & KPI Reference

What each feature does, how it works, and what every KPI on every dashboard
actually measures.

- [How the product fits together](#how-the-product-fits-together)
- [The data underneath](#the-data-underneath)
- [Features](#features)
- [Dashboard KPIs](#dashboard-kpis)
  - [Procurement](#procurement--dashboard)
  - [Financial](#financial--dashboard)
  - [Leadership](#leadership--dashboard)
  - [Vendor Performance](#vendor-performance--dashboard)
  - [CAPEX / OPEX (Utilization)](#capex-opex--utilization--dashboard)
  - [P2P Lifecycle](#p2p-lifecycle-tracker)

---

## How the product fits together

IntelliSource reads procure-to-pay (P2P) data extracted from SAP, joins it back into
one continuous chain per purchase, computes ~80 KPIs from it, and lets a
read-only AI agent answer questions about it.

Every feature is downstream of the same three steps:

1. **Load** — CSVs from `data/` land in staging tables (`po_dump`, `grn_dump`, …).
2. **Rebuild** — a fact table (`pr_po_grn_invoice`) joins every PO line to its
   requisition, delivery schedule, goods receipt, invoice and payment, and
   pre-computes cycle times and flags like `is_maverick`.
3. **Compute** — the KPI engine runs each formula and stores the result in
   `kpi_results`, keyed by dashboard, KPI code and company code.

Because results are **stored rather than queried at page load**, a dashboard is
fast, a KPI value is reproducible, and the exact SQL behind any number is
available on hover.

---

## The data underneath

Ten datasets, each one stage of the same purchase:

| Dataset | What it is |
|---|---|
| Purchase Requisition | Someone asks for something — what, how much, estimated cost, who asked, who approved |
| Purchase Order | The company commits money to a supplier — price, quantity, tax, vendor, plant |
| PO Delivery Schedule | When the goods were promised, and how much has arrived |
| Goods Receipt (GRN) | Proof the goods physically arrived, netted against returns |
| PO Invoice | Links a supplier invoice to a specific PO line — the third leg of the three-way match |
| Invoice | The invoice as a financial document: due date, credit memos, clearing status |
| Payment | Money leaving the bank, and which invoice it settled |
| Vendor Master | Supplier identity, tax details, MSME status, blocking flags |
| Change Log | Every field anyone edited, by whom, when, old value → new value |
| Company / Plant Master | The org structure every filter rolls up through |

Full field-level explanation is in [`FEATURES.md`](FEATURES.md) and
[`reference/SAP_FUNCTIONAL_DOCUMENTATION.md`](reference/SAP_FUNCTIONAL_DOCUMENTATION.md).

---

## Features

### Login, roles and access

**What it does.** Twelve roles, from CXO down to Associate Director, plus Admin and
Consultant. The role determines which navigation items appear and what the user is
allowed to see or do.

**How it works.** The login page lists one demo persona per role; clicking one
auto-fills the email and password. Authentication checks the email and password
against the `users` table and returns the role. The role is held in app context and
re-checked at every route. Switching role from the avatar menu (`View as role`) is
also recorded server-side as a `ROLE_SWITCH` event.

The **ADMIN** section of the sidebar only renders for the Admin role — User
Management, Audit Trail and Settings.

---

### Global filters

**What it does.** Narrows what every dashboard is showing.

| Filter | Where | Options |
|---|---|---|
| Company | Dashboard headers | All Companies, or a specific company code |
| Vendor | Procurement, Vendor Performance | All Vendors, or a named vendor |
| Department | CAPEX/OPEX | All Departments, or one of eight departments |
| Period | Top bar | Q1/Q2/Q3 FY24, FY24, Custom |
| Role | Avatar menu | All twelve roles |

**How it works.** Company code is a column on almost every table, so filtering is a
`WHERE company_code = ?` added to each query. KPI results are pre-computed *per
company code*, so choosing a company reads a different stored row rather than
re-running the formula.

---

### Procurement Dashboard

**What it does.** The operational landing page: how much is being ordered, how fast
requisitions convert, and whether anything is being deleted or amended.

**How it works.** Reads eight stored KPIs from `kpi_results` plus two charts
(`PO Value Trend`, `PO Count vs Maverick Spend`) and a live anomaly/activity panel
fed from the process-mining tables. Every KPI card has an **ⓘ** hover showing its
formula and, expandable, the raw SQL.

---

### Financial Dashboard

**What it does.** Money out: how much was paid, whether invoices were paid on time,
whether the three-way match is holding, and how much is still owed.

**How it works.** Reads seven stored KPIs plus a payment-timing trio computed in one
query, then charts monthly payments and the early/on-time/late split as a donut.

---

### Leadership Dashboard

**What it does.** A 30-second executive view — pipeline health, risk and exceptions,
spend and concentration.

**How it works.** Reads eight stored KPIs plus two structured JSON blocks
(`SUMMARY_COUNTS`, `CAPEX_OPEX_SPLIT`). The **High-Value Threshold** control in the
header writes to `kpi_config` and re-runs the affected KPIs, so the user defines
what counts as "high value". Hovering any summary tile with a `Review` pill opens the
underlying transaction rows.

---

### Vendor Performance Dashboard

**What it does.** Supplier reliability, compliance and spend concentration.

**How it works.** Reads six stored KPIs and three structured JSON blocks
(`VENDOR_BREAKDOWN`, `VENDOR_DELIVERY_DAYS`, `TOP_VENDOR_SPEND`) to populate the
health table, the delivery lead-time chart and the top-10 spend chart. This is the
one dashboard where the `Vendor:` filter genuinely changes the output.

---

### CAPEX / OPEX (Utilization) Dashboard

**What it does.** Splits spend into capital (fixed assets) versus operating (running
cost), by category, department and trend.

**How it works.** Every PO line carries a `capex_opex_flag`. Ten stored KPIs split on
that flag; the department filter re-scopes the cards, donut and category charts. A
Materials Summary panel adds delivery and three-way-match metrics for physical goods.

---

### P2P Lifecycle Tracker

**What it does.** Shows the whole chain as a flow — where cases stall, how long each
stage takes, and which orders took an abnormal path.

**How it works.** Reads the fact table and produces:

- A **7-stage flow** (`PR Created → PR Approved → PO Created → PO Approved → GRN
  Posted → Invoice Posted → Payment Made`), each stage RAG-coloured and clickable to
  open its record list.
- A **cycle-time breakdown** into `PR→PO`, `PO→GRN`, `GRN→Invoice`, `Invoice→Pay`.
- A **6-stat strip**: total cases, average cycle time, maverick POs, GRN returns,
  credit memos, payments made.
- **Monthly funnel** and **process variant distribution** — real process mining, where
  cases that skipped a stage are grouped as their own variant rather than averaged
  into the happy path.
- A **Find** box: pick PO / PR / GRN / INVOICE, enter a document number, and get the
  full expanded chain with any `MAVERICK` tag.

---

### Alerts and anomaly detection

**What it does.** Surfaces control breaches across the pipeline and names the
transactions behind each one.

**How it works.** `event_generator.py` derives process-mining events from the fact
table and flags twelve anomaly types, each with a severity:

| Code | Severity | Meaning |
|---|---|---|
| `MAVERICK_BUY` | High | PO raised with no approved requisition |
| `THREE_WAY_MISMATCH` | High | Invoice quantity differs from received quantity by >5% |
| `DUPLICATE_INVOICE` | High | Same vendor, amount and date appearing more than once |
| `PAYMENT_BEFORE_GRN` | High | Money paid before the goods were received |
| `GRN_WITHOUT_PO` | High | Receipt references a PO that isn't in the data |
| `VENDOR_BLOCK` | High | PO raised against a payment-blocked vendor |
| `LATE_DELIVERY` | Medium | Goods received after the promised date |
| `PRICE_DEVIATION` | Medium | PO price >10% off the requisition estimate |
| `SPLIT_PO` | Medium | Multiple same-day POs to one vendor, same material group |
| `OVERDUE_INVOICE` | Medium | Past due date, unpaid for >30 days |
| `LONG_APPROVAL` | Low | Requisition approval took over 7 days |
| `LATE_PAYMENT` | Low | Payment cleared after the due date |

The Alerts page groups these by severity with a status pill, and clicking one opens
a panel listing every affected PO with vendor, material, value and all its flags. A
second table monitors deleted POs.

---

### Log Action

**What it does.** Turns a detected anomaly into a tracked corrective action with an
owner and an approver.

**How it works.** A 4-column Kanban (`Open → In Progress → Under Review → Closed`)
holds action records. `Log New Action` opens a form for document type, document,
proposed changes, notes and a required approver email. Actions write to the `actions`
table and appear in the audit trail.

---

### Contract Center

**What it does.** Holds supplier contracts and checks every PO line against them.

**How it works.** `contract_check.py` stamps each PO line `MATCHED`, `UNMATCHED` or
`NO_CONTRACT`. Five tiles summarise coverage. Creating or deactivating a contract
automatically re-runs the check across all POs. The `Show Unmatched PO Lines` toggle
exposes the gaps.

---

### Profit Center Management

**What it does.** Maps spend to cost centres and tracks it against budget.

**How it works.** Profit centres are derived from the **plant × material group**
combination, mirroring SAP's cost-object assignment. Each carries a CAPEX/OPEX
classification and a budget for both. Clicking the CAPEX/OPEX pill flips the
classification in place and the spend figures move with it. `▲OVR` marks actuals over
budget.

---

### Ask IntelliSource (the AI agent)

**What it does.** Answers natural-language questions about the P2P data, and can
produce charts and downloadable reports.

**How it works.** A tool-calling loop, not a free-form chatbot:

1. The question is matched against a fast-path router. Obvious patterns
   ("total PO value", a PO number) skip the loop entirely.
2. Otherwise the planner picks from **8 core tools** — `query_database`,
   `get_metric`, `get_kpis`, `find_document`, `get_anomalies`, `get_vendor_info`,
   `get_p2p_stage_summary`, `analyze_data`. Questions containing a report keyword
   ("chart", "excel", "ppt", "pdf", "download"…) additionally unlock **7 report
   tools** — `create_visual`, `create_report`, and the
   `start_report` / `add_*_section` / `finalize_report` chain.
3. Results are placed in a **session-scoped manifest**. This is why "now chart that"
   works — a later turn can reference an earlier turn's data by key.
4. A narrator model writes the final answer from the fetched data only.

Metrics come from a fixed set of 17 canonical keys (`total_po_value`,
`spend_by_vendor`, `maverick_rate`, …) so the same question gets a consistent answer.
Charts come from the 6 supported types (`bar`, `line`, `pie`, `donut`, `hbar`,
`scatter`). Reports come out as Excel, PowerPoint or PDF.

Supporting UI: ten curated quick prompts, a shared **Prompt Library** with category
filters, resumable **conversation history**, bookmarking any question into the
library, and artifact cards with inline preview plus download.

**Guardrails.** The agent is read-only by construction:

| Layer | Enforcement |
|---|---|
| Database role | A dedicated Postgres role with `SELECT` only |
| Session | `READ ONLY` set on every connection |
| Regex guard | `INSERT/UPDATE/DELETE/DROP/CREATE/ALTER/TRUNCATE/…` rejected |
| Single statement | A second `;` is rejected — blocks `SELECT 1; DROP TABLE` |
| Cost ceiling | `EXPLAIN` runs first; runaway scans are rejected before executing |

Plus a 150-row cap, an auto-appended `LIMIT`, an 8-tool-call and 90-second budget per
turn, and prompt-injection patterns scrubbed from user input. Because no write tool
exists in the registry at all, the model cannot delete a record even if instructed to.

---

### Vendor Repository

**What it does.** A searchable catalogue of suppliers with contact details and
classification.

**How it works.** A grid/list view with search and category chips (IT Services,
Consulting, Cloud Infrastructure, Security, Data Analytics, SaaS). `Add Vendor`
opens a sheet capturing code, name, address, country, a named SPOC, PAN, MSME flag,
payment terms and what they supply.

> Note: if the API is unreachable the page falls back to bundled demo data and shows
> *"Could not reach API — showing demo data."*

---

### Data Upload

**What it does.** Loads new CSV or Excel extracts and refreshes everything
downstream.

**How it works.** A six-stage pipeline:

| Stage | What happens |
|---|---|
| Parse | Read as text; SAP field names mapped to canonical names; dates normalised |
| Detect | Dataset type inferred from column headers — over half must match a known signature or the file is rejected |
| Validate | Mandatory fields, numeric parseability, non-negative amounts, enum values, duplicate natural keys |
| Load | Upsert on the natural key — delete matching rows, then insert |
| Rebuild | Entity hierarchy, then the fact table |
| Derive | Contract check → process mining events → all KPIs |

The results card shows rows accepted, rows rejected, and a sample of rejections with
row number, field and reason. A reference rail lists all ten datasets and their
mandatory columns.

Two behaviours worth knowing: uploads **replace** rather than append, and rows are
rejected as a whole if fewer than three signature columns match.

---

### Activity History

**What it does.** A record of uploads and report downloads made in this browser.

**How it works.** Reads the activity log held in `localStorage` under
`intellisource_activity_log`, with counts for total events, uploads, downloads,
successes and failures.

---

### User Management

**What it does.** Creates users, assigns roles, activates or deactivates accounts,
resets passwords.

**How it works.** `Add User` generates a password server-side and shows it **once**
in a dialog that must be dismissed. The table lists every user with role, status and
creation date; role changes and password resets are available per row. Writes
`USER_CREATED`, `USER_UPDATED` and `PASSWORD_RESET` to the audit trail.

---

### Audit Trail

**What it does.** A real-time log of system activity.

**How it works.** Every consequential action writes a row with timestamp, user,
action, entity, ID and detail. Action types include `LOGIN`, `LOGIN_FAILED`,
`LOGOUT`, `SELF_REGISTER`, `USER_CREATED`, `DATA_UPLOAD`, `VENDOR_CREATED`,
`PC_UPDATED`, `KPI_CONFIG_UPDATED`, `ACTION_LOGGED`, `CHAT_QUERY` and `SESSION`.
Refreshes every 30 seconds, showing the last 200 events.

---

### Export

**What it does.** Downloads any dashboard as PDF or Excel.

**How it works.** The PDF/Excel buttons in the page header render the dashboard's
current KPI set into a formatted document. The AI agent produces Excel, PowerPoint
and PDF artefacts through the same path.

---

## Dashboard KPIs

Unless stated otherwise: *YTD* means the Indian financial year starting 1 April, and
*MTD* means the current calendar month. All figures exclude deleted PO lines unless
noted.

---

### Procurement — Dashboard

| KPI | What it is | What it signifies |
|---|---|---|
| **Total PO Value (MTD)** | Sum of net order value for PO lines created this month | How much the company has committed to spend this month |
| **Active PO Count** | Distinct POs not deleted and not yet delivery-complete | How much procurement is still open and committed |
| **High-Value PO Count** | POs whose value exceeds a configurable threshold (default ₹1 Cr) | How many orders need executive-level attention |
| **Open PR Aging (>7d)** | Approved requisitions waiting >7 days with no PO raised | Demand that was sanctioned but never converted — a planning failure |
| **Avg PR→PO Time** | Average days from requisition approval to PO creation | How long buying takes once a request is approved |
| **PO Cycle Time** | Average days from PO creation to final release in the change log | How long internal approval takes |
| **PO Deletions (MTD)** | PO lines deleted this month | Wasted effort or a control weakness, depending on why |
| **PO Amendment Rate** | % of active PO lines whose price or quantity was changed after creation | Demand instability, or renegotiation after approval |

---

### Financial — Dashboard

| KPI | What it is | What it signifies |
|---|---|---|
| **Total Payments (YTD)** | Sum of all payment amounts this financial year | Total cash outflow to suppliers |
| **Payment-to-PO Ratio** | Payments as a % of PO value | Above 100% means paying out more than was ordered — advances or prior-year clearances |
| **3-Way Match Rate** | % of PO lines where PO, GRN and invoice all agree within 5% | Whether billing matches ordering and receipt. Low rates mean overbilling or short-delivery disputes |
| **Invoice Processing Days** | Average days from supplier's invoice date to payment clearing | How fast the company pays. Directly affects supplier relationships |
| **On-Time Payment Rate** | % of cleared invoices paid exactly on the due date | Payment discipline |
| **Open Invoice Value** | Total unpaid invoice value, split into ageing buckets (not yet due, 0–10d, 10–20d, 20–30d, 30–60d, 60–90d, 90+d) | Working capital tied up in unpaid bills, and how overdue it is |
| **Approved PRs (YTD)** | Requisition lines fully released this year | Approved demand volume |
| **Early / On-Time / Late Payments** | Counts of payments made before, exactly on, or after the due date | The timing spread — early can mean paying for convenience, late means supplier risk |

> **Worth knowing:** On-Time Payment Rate is an *exact* match against the due date, so
> both early and late payments fall outside its numerator. The Early / On-Time / Late
> trio is the honest read of payment timing.

---

### Leadership — Dashboard

| KPI | What it is | What it signifies |
|---|---|---|
| **Total Procurement Value (YTD)** | Total committed PO value since 1 April | The headline number |
| **Maverick PO Rate** | % of POs raised without a linked requisition | The single most important control in P2P — off-contract, off-process buying |
| **End-to-End Cycle Time** | Average days from requisition to final payment | Total cash-to-cash efficiency |
| **Vendor Concentration** | % of spend with the top 3 vendors | Dependency risk — high concentration means negotiating weakness |
| **Negotiation Savings** | (Requisition estimate − PO price) × quantity, where the PO came in cheaper | Documented value won at the negotiating table |
| **Supply Risk Score** | Composite 0–100: 40% vendor concentration + 30% maverick rate + 30% anomaly rate | A single rollup of structural risk |
| **SoD Conflict Count** | Cases where one user crossed a control boundary: created and released the same PO; created the PO and posted the GRN; posted the GRN and raised the invoice; raised the invoice and made the payment | Segregation-of-duties breaches — the classic internal-fraud pattern |
| **High-Value POs** | POs above the configurable threshold | Orders that warrant sign-off |

**P2P Summary Counts** — two groups of tiles:

| Pipeline Health | What it counts |
|---|---|
| Approved PRs | Requisition lines fully released |
| Approved POs | PO lines with a release indicator set |
| GRN Lines | Goods receipts posted (debits only) |
| Invoice Lines | Invoices and credit memos |
| Payments | Payment documents |

| Risk & Exceptions | What it counts |
|---|---|
| POs Without PR | Orders raised with no requisition |
| One-Time Vendors | Suppliers created for a single transaction — a common leakage route |
| POs Without Contract | Orders with no contract number against them |
| Duplicate Invoices | Suspected duplicate supplier invoices |
| SOD Conflicts | Segregation-of-duties breaches |

---

### Vendor Performance — Dashboard

| KPI | What it is | What it signifies |
|---|---|---|
| **Active Vendor Count** | Vendors with all five SAP block flags clear | How many suppliers can actually be transacted with |
| **Vendor Compliance Rate** | % of vendors where all five block fields are strictly empty | Master-data hygiene. Stricter than Active Vendor Count |
| **Avg Delivery Lead Time** | Days between promised delivery date and first goods receipt | Positive = late, negative = early |
| **Avg Delivery Delay** | Average lateness across *late deliveries only* | How bad the worst performance is |
| **Blocked Vendor Count** | Vendors with at least one active block | Suppliers under restriction |
| **Vendor Master Changes** | Distinct vendor records edited this month | A fraud indicator — frequent bank-detail edits are a known pattern |

**Vendor Health Breakdown** segments the panel into Active, Non-Active, One-Time,
Domestic, International and MSME, plus a compliance rate. MSME status matters in
Indian public procurement because it carries statutory preference.

---

### CAPEX / OPEX (Utilization) — Dashboard

| KPI | What it is | What it signifies |
|---|---|---|
| **Total CAPEX Spend (YTD)** | PO value on lines flagged CAPEX | Investment in fixed assets — things capitalised |
| **Total OPEX Spend (YTD)** | PO value on lines flagged OPEX or untagged | Day-to-day running cost |
| **CAPEX % / OPEX %** | Each as a share of combined spend | The capital-versus-operating balance |
| **CAPEX / OPEX PO Count** | Distinct orders in each category | Order volume by type |
| **Avg CAPEX / OPEX PO Value** | Mean value per order line | Typical ticket size in each category |
| **CAPEX / OPEX Pending** | Value on orders not yet marked delivery-complete | Capital committed but not yet delivered |

> **Worth knowing:** the two average-value KPIs use all historical POs, not
> year-to-date, so they read as a stable long-run benchmark. The Pending figures use
> the PO's own delivery flag and do not cross-check against goods receipts.

**Materials Summary** — physical goods specifically:

| Metric | What it is | What it signifies |
|---|---|---|
| **Delivery Utilization** | Received quantity as % of ordered quantity | How much of what was bought has actually arrived |
| **Delivery Complete %** | % of material PO lines with the delivery-complete flag set | Whether SAP considers receipt closed |
| **3-Way Match Rate** | % where invoice value matches received value within 5% | Whether suppliers are billing for what was delivered |
| **Open PO Value** | PO value where received value is more than 5% short of the order | Undelivered commitment — a working-capital liability |
| **Material CAPEX / OPEX Spend** | Category-restricted CAPEX and OPEX totals | The capital split within physical goods only |

**Vendor GRN Fill Rate** shows, per vendor, received quantity as % of ordered
quantity, colour-coded green above 90%, amber above 70%, red below.

**Material Spend by Category** ranks the top eight material groups by spend with PO
counts.

---

### P2P Lifecycle Tracker

| Stat | What it is | What it signifies |
|---|---|---|
| **Total Cases** | Orders in scope | Volume through the pipeline |
| **Avg Cycle Time** | Mean days from requisition approval to payment | Overall speed |
| **Maverick POs** | Orders with no upstream requisition | Control breaches |
| **GRN Returns** | Orders with a goods return against them | Quality or wrong-item problems |
| **Credit Memos** | Orders with a supplier credit note | Billing corrections |
| **Payments Made** | Payment documents | Throughput at the final stage |

The seven-stage flow adds a per-stage **conversion rate** — what percentage of cases
that reached the previous stage also reached this one. A sharp drop at one stage
localises the bottleneck without needing to inspect individual records.

---

## Notes on a few definitions

- **Three-way match** compares PO, GRN and invoice. For material items it compares
  quantities; for service items (no goods receipt) it compares amounts. Tolerance is
  5%.
- **Maverick buy** is determined at ETL time: a PO line with no linked purchase
  requisition.
- **Block flags** use two different sentinel values — most are `'X'`, but SAP's
  payment block uses `'*'`.
- **Deletion indicator** `'L'` means the line was deleted; `'X'` means it is a
  blocked item. Most KPIs exclude both; `Total Procurement Value (YTD)` excludes only
  `'L'`.