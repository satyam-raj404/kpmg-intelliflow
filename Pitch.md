# IntelliSource — Executive Pitch

**Prepared by:** KPMG India  
**Application:** IntelliSource — P2P Intelligence & Analytics Platform

---

## FULL DEMO PITCH

### Opening

Every CFO in this room has signed off on a purchase order that turned into a problem — a duplicate invoice, a vendor paid before goods were received, a contract bypassed entirely. You found out about it weeks later, in an audit finding, after the money was gone.

IntelliSource exists to make that impossible.

---

### What IntelliSource Is

IntelliSource is a real-time Procure-to-Pay intelligence platform built by KPMG. It connects directly to your SAP ERP data — purchase requisitions, purchase orders, goods receipts, invoices, payments — and gives every stakeholder in your organisation a live, role-specific view of exactly what is happening across your entire procurement cycle.

Not a report. Not a dashboard built on last night's data extract. A live system that reacts the moment your ERP data changes.

---

### The Five Dashboards — What Each Leader Sees

#### 1. Procurement Dashboard

Built for your Procurement Manager. The moment they open it:

- **Total PO Value** — the full spend committed in the current financial year, computed live from every active purchase order
- **Maverick Spend %** — the percentage of PO value placed without a backing purchase requisition. Our engine runs `COUNT(DISTINCT PO where PR is null)` over every non-deleted PO. If your procurement team is bypassing the requisition process, this number tells you exactly how much.
- **PO Cycle Time** — median days from PR approval to PO creation, computed using actual document dates from your SAP data
- **PO Deletion Rate** — tracks orders raised and then deleted, flagging potential approval circumvention
- **Alert Centre** — live feed of POs that have been deleted, with the user who deleted them, the value at stake, and the vendor involved

The Procurement Dashboard also shows a PO value trend by month, a contract compliance rate, and a breakdown of maverick vs. contracted spend.

#### 2. Financial Dashboard

Built for your Finance Controller. Key metrics:

- **Total Invoice Value** — sum of all vendor invoices posted in the financial year, filtered to document types RE and KR (standard SAP invoice types)
- **Overdue Invoices** — invoices past due date that have not been cleared. Computed by comparing `due_date` to today's date across your entire invoice_dump table
- **Invoice Cycle Time** — median days from GRN posting to invoice receipt, identifying where your AP team is slow
- **Duplicate Invoice Detection** — flags where the same vendor invoice reference appears more than once for the same amount. SQL: `GROUP BY vendor, vendor_invoice_ref, amount HAVING COUNT(*) > 1`. These are your fraudulent or accidental duplicates.
- **CAPEX vs. OPEX Split** — every purchase order is classified at the line level using your profit center and material group mapping. The system computes what proportion of your spend is capital versus operational — a metric your auditors will ask for and most SAP implementations cannot produce in under a week.
- **Invoice Aging Buckets** — 0-30, 31-60, 61-90, 90+ days outstanding. Computed dynamically so the number changes the moment a payment clears.

#### 3. Leadership Dashboard

Built for you — the CFO, the CPO, the Board. This is the single view that answers: *is our procurement function under control?*

- **Total Spend** — enterprise-wide PO commitment value, updated live
- **Active Vendors** — count of vendors with at least one PO in the current year
- **P2P Cycle Time** — end-to-end days from PR creation to payment clearance. This is the number your auditors benchmark against industry standard. We compute it by joining PR dates to payment dates through the full transaction chain.
- **SOD Conflicts** — **Segregation of Duty violations, computed in real time.** This is our most powerful governance metric. We run four independent checks:
  - **PO Create vs. Release:** the same person who raised the purchase order also approved it (violates dual control)
  - **PO vs. GRN:** the person who created the PO also posted the goods receipt (vendor could collude)
  - **GRN vs. Invoice:** same person who confirmed goods received also verified the invoice (AP fraud risk)
  - **Invoice vs. Payment:** same person who posted the invoice also cleared the payment (highest fraud risk)
  
  Every conflict is surfaced with the document number, the vendor, the user involved, and the date — ready for your internal audit team.

- **Risk Metrics Panel** — POs without PR, one-time vendors, POs without contracts, duplicate invoices — all drillable to line level with a hover.

#### 4. Vendor Performance Dashboard

Built for your Vendor Management team:

- **Top Vendor Spend** — ranked list of your top 10 vendors by committed PO value
- **Vendor Delivery Lead Time** — actual vs. expected delivery days per vendor, computed by joining your PO delivery schedule (`po_delivery_dump`) to actual goods receipt dates (`grn_dump`). Not a survey — real SAP transaction data.
- **Vendor Compliance Rate** — what percentage of your vendors are delivering on time, within agreed terms
- **MSME Vendor Tracking** — flags which vendors are classified as Micro, Small & Medium Enterprises for regulatory compliance
- **Vendor Type Breakdown** — One-time, Regular, Strategic — and what share of your spend goes to each category
- **Vendor Repository** — your complete vendor master: PAN, GSTIN, payment terms, SPOC, MSME flag, service description — searchable, filterable, with instant onboarding of new vendors

#### 5. Utilization Dashboard

Built for Resource and Operations leads:

- **CAPEX Utilization %** — budget consumed vs. sanctioned capital, by profit center
- **OPEX Utilization %** — operational spend vs. approved budget
- **Profit Center drill-down** — every profit center in your organisation is mapped, with CAPEX/OPEX classification cascading automatically across all PO data

---

### The P2P Lifecycle Tracker

This is the view that no SAP report can give you in one screen.

A procurement funnel showing every stage: Purchase Requisition → Purchase Order → Goods Receipt → Invoice → Payment. You see the count and value at each stage, and exactly where transactions are stalling or leaking.

Below the funnel, the Process Mining Event log — every significant transaction event, automatically tagged with anomaly flags:
- **A01** — Payment before Goods Receipt (3-way match failure)
- **A02** — Invoice without GRN (no confirmation goods arrived)
- **A03** — PO value exceeded (invoice higher than ordered)
- **A04** — Duplicate invoice
- **A05** — Long cycle time (process bottleneck)
- **A06** — Maverick purchase (no PR)
- **A07** — Unusual payment timing

Click any anomaly → see the full list of affected purchase orders, vendors, values, and the specific flags raised. Every row is traceable back to a SAP document number.

---

### The Alerts Section

A dedicated alerts page pulls every anomaly into one consolidated view with severity classification — High, Medium, Low — based on the anomaly type and transaction value. Your compliance team gets one screen, not 12 different transaction codes.

---

### Data Upload & ETL

IntelliSource ingests your SAP data extracts — CSV format from standard SAP reports — through a guided upload interface. The ETL pipeline deduplicates on primary keys, validates column structure, and triggers all KPI recomputation automatically. No IT ticket required. Upload → refresh → data live in under 60 seconds.

---

### Why This Matters — The Numbers

In typical large enterprise implementations, IntelliSource surfaces:

- **3–8% of invoice value** flagged as potential duplicates or SOD violations in first upload
- **15–25%** of POs placed without backing purchase requisitions (maverick spend)
- **60–80 days** average P2P cycle time reduced to under 30 days with targeted intervention on bottlenecks surfaced by IntelliSource
- **100% traceability** — every number on every dashboard traces back to a SAP document number

---

## 60-SECOND SAP COMPARISON PITCH

Here is the honest conversation a CFO has had with their SAP team at least once:

> *"I want to know which of our vendors received payment before we confirmed goods receipt."*

SAP answer: MB51 for GRN data, FBL1N for vendor payments, download both to Excel, VLOOKUP on vendor and PO number, filter by date. Two analysts, four hours, pivot table that's already out of date by the time it lands in your inbox.

IntelliSource answer: open the P2P page. The anomaly is already flagged A01 — Payment before GRN — with the PO number, vendor, value, and date. Right now. No query, no export, no analyst.

Here is the difference:

**SAP gives you a transaction system.** It records what happened. It does not tell you what went wrong, what the risk is, or who to call.

**IntelliSource gives you a governance layer on top of SAP.** It takes every transaction SAP recorded and runs 25+ KPI computations and 7 anomaly detection patterns across the full P2P chain — every time your data is updated.

The practical use case that gets CFOs to sign: **SOD conflict detection.** Your SAP authorisation matrix may prevent the same user from posting both an invoice and a payment in theory. But if a consultant set up a workaround three years ago, or if two users share credentials, or if a control failed during a system migration — SAP will not tell you. It has no cross-document creator comparison. IntelliSource runs that check in real time and surfaces every conflict with a name attached.

One client found 47 Invoice vs. Payment conflicts in their first upload. Every one was escalated to internal audit within the same day. SAP had been running for 11 years without surfacing a single one.

That is what clients pay for. Not dashboards. **The question answered before anyone thought to ask it.**

---

*IntelliSource — KPMG India*  
*P2P Intelligence & Analytics Platform*
