# IntelliSource — Executive Demo Pitch
**KPMG India | P2P Intelligence & Analytics Platform**

---

## SECTION 1 — DATA: WHERE IT COMES FROM

IntelliSource ingests standard SAP data extracts — no custom ABAP, no middleware, no API integration required. Your team exports CSV files from existing SAP transaction reports. IntelliSource does the rest.

### SAP Source → IntelliSource Table Mapping

| What It Captures | SAP Transaction | SAP Tables | IntelliSource Table |
|---|---|---|---|
| Purchase Requisitions | ME5A | EBAN | `pr_dump` |
| Purchase Orders | ME2M / ME2N | EKKO + EKPO | `po_dump` |
| Goods Receipts (GRN) | MB51 / MIGO | MKPF + MSEG | `grn_dump` |
| PO Invoice Linkage | MIR6 / MIR7 | RBKP + RSEG | `po_invoice_dump` |
| AP Invoices | FBL1N | BKPF + BSEG | `invoice_dump` |
| Outgoing Payments | F110 / FBL1N | BKPF + BSEG | `payment_dump` |
| Vendor Master | XK03 / MK03 | LFA1 + LFB1 | `vendor_master` |
| PO Change History | AUT10 | CDHDR + CDPOS | `change_log` |
| Delivery Schedule | ME2L | EKET | `po_delivery_dump` |

### How Data Flows In

```
SAP Export (CSV)
      ↓
IntelliSource Upload Portal (ETL)
      ↓  deduplicate → validate → classify
Staging Tables (pr_dump, po_dump, grn_dump …)
      ↓
Fact Builder → pr_po_grn_invoice (joined P2P chain)
      ↓
KPI Engine → kpi_results (all dashboard metrics)
      ↓
Process Mining → anomaly flags in process_mining_events
      ↓
Dashboards (live, company-code filtered)
```

**Upload to live dashboard: under 90 seconds.**  
No manual refresh. No scheduled job. No analyst in the middle.

### What Makes the Data Trustworthy

Every number traces back to a SAP document number. Every KPI is computed from raw transactional records — not aggregates, not cached summaries. When IntelliSource shows 79 high-value POs, you can click through and see each PO number, vendor, value, and creator.

---

## SECTION 2 — THE DASHBOARDS: SIGNIFICANCE OF EACH SECTION AND KPI

---

### PROCUREMENT DASHBOARD
*Audience: Procurement Manager, Category Manager*

The Procurement Dashboard answers one question every procurement lead asks every morning: **"What did we commit to, and was it done correctly?"**

| KPI | What It Shows | Why It Matters |
|---|---|---|
| **Total PO Value** | Sum of all active, non-deleted PO line values in the financial year | Your committed spend — the single number that drives vendor negotiations, budget reviews, and audit queries |
| **Maverick Spend %** | % of PO value placed without a backing Purchase Requisition | Every % point here is procurement policy bypass. Most organisations target below 5%. Above 15% is an audit finding waiting to happen. |
| **PO Cycle Time** | Median days from PR approval to PO creation | Slow cycle time means business units wait weeks for procurement approval — they route around it. This number tells you where bottlenecks are before they become workarounds. |
| **PO Deletion Rate** | % of POs raised then deleted | Deleted POs are a common way to circumvent approval limits — raise a large PO, get it approved, delete it, re-raise below the threshold. This metric flags that pattern. |
| **Contract Compliance Rate** | % of PO spend covered by a contract reference | Spend without a contract is unprotected — no SLA, no penalty clause, no recourse. This metric quantifies your exposure. |
| **PO Value Trend** | Month-on-month committed spend | Seasonality, budget exhaustion, year-end rush — visible at a glance |
| **Alert Centre** | Live feed of deleted POs with user, value, vendor | Real-time governance. Who deleted what, worth how much, from which vendor — surfaced immediately, not in next quarter's audit report. |

---

### FINANCIAL DASHBOARD
*Audience: Finance Controller, AP Head, CFO*

The Financial Dashboard answers: **"Are we paying what we should, to whom we should, when we should?"**

| KPI | What It Shows | Why It Matters |
|---|---|---|
| **Total Invoice Value** | Sum of all posted vendor invoices (document types RE + KR) in the financial year | Your actual AP liability — the number your cash flow forecast depends on |
| **Overdue Invoice Value** | Invoices past due date not yet cleared | Every rupee here is a potential penalty, a strained vendor relationship, or a late payment interest charge accumulating without visibility |
| **Invoice Cycle Time** | Median days from GRN posting to invoice receipt | Fast GRN-to-invoice cycle = healthy AP process. Long cycle time signals invoice disputes, manual matching delays, or vendor billing gaps — each one a cash flow leak |
| **Duplicate Invoice Rate** | Invoices where same vendor + same invoice reference + same amount appears more than once | Industry average duplicate payment rate: 0.1–0.5% of total AP spend. On ₹500 Cr annual payables, that is ₹50–250 lakhs. IntelliSource catches this before payment clears. |
| **CAPEX vs. OPEX Split** | % of total PO spend classified as capital vs. operational | Every CFO is asked this by auditors, by the board, by tax. Most SAP implementations require a multi-week exercise to produce this. IntelliSource classifies it automatically at PO line level using material group + profit center mapping — and updates live with every upload. |
| **Invoice Aging Buckets** | Outstanding invoices by age: 0–30, 31–60, 61–90, 90+ days | Aging above 60 days is a vendor risk signal. Above 90 days triggers escalation in most payment terms. This view tells your AP team exactly where to act today. |

---

### LEADERSHIP DASHBOARD
*Audience: CFO, CPO, MD, Board*

The Leadership Dashboard is the governance cockpit. It does not show data — it shows **risk status**.

| KPI | What It Shows | Why It Matters |
|---|---|---|
| **Total Spend** | Enterprise-wide committed PO value, all companies consolidated | The one number every board presentation starts with |
| **Active Vendors** | Count of vendors with at least one PO in current financial year | Vendor base size drives risk concentration. If 80% of spend goes to 5 vendors, leadership needs to know. |
| **P2P Cycle Time** | End-to-end days: PR creation to final payment clearance | Industry benchmark: 30–45 days. Above 60 days = process failure somewhere in the chain. Below 20 days = potential control bypass (payments clearing too fast). Both ends matter. |
| **SOD Conflict Count** | Number of Segregation of Duty violations across 4 control types | This is your internal audit team's most-wanted metric — and the one SAP cannot give you. Four types checked: (1) Same person created and released the PO. (2) Same person created PO and posted GRN. (3) Same person posted GRN and verified invoice. (4) Same person posted invoice and cleared payment. Each is a dual-control failure. All four, in real time. |
| **High-Value PO Count** | Count of POs above configurable threshold (default ₹1 Cr) | High-value POs should carry additional approvals. This count tells leadership how many are active and ensures they are not slipping through without review. |
| **POs Without PR** | PO count with no backing requisition | Maverick buying at the document level — each one is a procurement policy breach. Drill down to see which user, which vendor, which value. |
| **One-Time Vendors** | Count of vendors flagged as one-time in the vendor master | One-time vendor payments are the highest-risk payment type — frequently used in payment fraud schemes. Leadership should know how many are active. |
| **POs Without Contract** | PO value placed outside contract coverage | Spend risk. No SLA, no price protection, no compliance backing. |
| **Duplicate Invoices** | Count of invoice documents matching duplicate pattern | Finance escalation — AP team should have caught this. If it reaches the leadership count, it means controls failed downstream. |

---

### VENDOR PERFORMANCE DASHBOARD
*Audience: Procurement Manager, Vendor Management Team, Supply Chain Head*

The Vendor Performance Dashboard answers: **"Are our vendors performing, and are we managing them correctly?"**

| KPI | What It Shows | Why It Matters |
|---|---|---|
| **Top Vendor Spend** | Ranked list of vendors by total PO value | Concentration risk. If your top 3 vendors account for 70% of spend, you have single-source dependency you may not be aware of. |
| **Vendor Delivery Lead Time** | Actual vs. expected delivery days per vendor, computed from po_delivery_dump (expected) vs. grn_dump (actual) | Not a survey result. Not a vendor-reported figure. Actual SAP transaction data. Every vendor's delivery performance against their own committed schedule. |
| **Vendor Compliance Rate** | % of vendors delivering within agreed parameters | Portfolio-level health score. Below 70% means your vendor base is underperforming as a whole — time to renegotiate or diversify. |
| **MSME Vendor Tracking** | Breakdown of MSME vs. non-MSME vendors by spend | Regulatory requirement under MSME Development Act — 45-day payment timeline mandatory. IntelliSource flags the MSME flag from vendor master so your AP team never misses a mandatory deadline. |
| **Vendor Type Breakdown** | One-time vs. Regular vs. Strategic spend share | One-time vendor spend above 10% of total is a governance red flag. Strategic vendor spend below 40% suggests you are not leveraging your contract relationships. |
| **Vendor Repository** | Full vendor master: PAN, GSTIN, MSME flag, payment terms, SPOC, service description | Single source of truth for vendor onboarding. New vendors added here are immediately reflected across all dashboards and reports — no separate master data update cycle. |

---

### UTILIZATION DASHBOARD
*Audience: CFO, Budget Owners, Finance Controller, Department Heads*

The Utilization Dashboard answers: **"Are we spending what was sanctioned, and are we spending it on the right things?"**

| KPI | What It Shows | Why It Matters |
|---|---|---|
| **CAPEX Utilization %** | Capital spend consumed vs. sanctioned capital budget, by profit center | Underutilization = budget that expires at year-end. Overutilization = budget breach requiring board approval. Both need visibility before the quarter closes. |
| **OPEX Utilization %** | Operational spend vs. approved opex budget | Opex overrun is the most common audit finding in large enterprises. Real-time visibility means you can intervene in October instead of explaining it in March. |
| **Profit Center Drill-Down** | Budget vs. actuals per profit center, with CAPEX/OPEX split | Department-level accountability. Every profit center owner can see their position against budget without waiting for a finance report. |

---

### P2P LIFECYCLE TRACKER + ALERTS
*Audience: Compliance, Internal Audit, Procurement Operations*

| Section | What It Shows | Why It Matters |
|---|---|---|
| **P2P Funnel** | Stage-by-stage count: PR → PO → GRN → Invoice → Payment | Stage drop-offs reveal exactly where transactions stall. 1,000 PRs and 400 POs means 600 requisitions never converted — that is either vendor delays, approver bottlenecks, or cancelled need. |
| **Anomaly Event Log** | Every flagged transaction with anomaly type, severity, affected PO | Six anomaly types: Split PO (approval threshold evasion), Retrospective PO (GRN before PO), No GRN (invoice without goods receipt), Price Variance (>20% from vendor historical average), Maverick Buy (no PR), Deleted After GRN (retrospective cancellation). Each is a specific SAP control failure. |
| **Alerts Page** | Consolidated HIGH/MEDIUM/LOW alert view with drill-down to affected POs | One screen for your compliance team instead of running 6 different SAP transactions. Click any alert type — see every affected PO, vendor, value, and document date. |

---

## SECTION 3 — 60-SECOND PITCH

---

Here is the real conversation that happens in every large enterprise.

Your Finance team runs FBL1N. Your Procurement team runs ME2M. Your audit team runs their own report. Three exports, three Excel files, three versions of the truth — and by the time someone VLOOKUPs them together, the payment has already gone.

IntelliSource eliminates that gap.

One platform. Five dashboards. Every P2P metric your CFO, CPO, Finance Controller, and Vendor Management team needs — computed live from the same SAP data, the moment it is uploaded.

But here is what makes clients pay for it: **IntelliSource finds the things SAP was never designed to show you.**

Your SAP authorisation matrix prevents a user from both posting an invoice and clearing a payment — in theory. But if two users share credentials, if a consultant set up a workaround three years ago, or if your control failed during a migration — SAP has no cross-document creator comparison. IntelliSource runs that check across every invoice and payment in your system and surfaces each conflict with a name, a document number, and a date.

One client. First upload. 47 Invoice vs. Payment Segregation of Duty conflicts. SAP had been running for eleven years without surfacing a single one.

That is not a dashboard. That is a governance layer your organisation does not have yet — and your auditors are going to ask for it.

**IntelliSource. From KPMG. Because procurement intelligence should not require a data analyst.**

---

## SECTION 4 — MANAGEMENT Q&A

---

### On Data & Integration

**Q: We are already on SAP. Why do we need another tool on top?**

SAP is a transaction system — it records what happened. IntelliSource is an analytics and governance layer — it tells you what went wrong, what the risk is, and where to act. SAP does not compute SOD conflicts across the full P2P chain in real time. SAP does not show you duplicate invoices before they clear. SAP does not give your CFO a single CAPEX vs. OPEX utilisation view without a week-long extraction exercise. IntelliSource does all three, out of the box.

**Q: Does this require any SAP customisation or ABAP development?**

None. IntelliSource works entirely on CSV exports from existing SAP standard reports — ME2M, MB51, FBL1N, and others your team already runs. No custom tables, no ABAP, no basis support, no middleware. If your team can export a report from SAP, IntelliSource can ingest it.

**Q: How often does data refresh?**

On demand. Your team uploads updated extracts whenever required — daily, weekly, or after significant transactions. Upload completes in under 90 seconds. All dashboards refresh instantly. No scheduled jobs, no overnight batch runs.

**Q: Is the data stored securely?**

IntelliSource runs on your cloud or on-premises infrastructure. Data does not leave your environment. The current pilot uses a secure cloud database (Neon PostgreSQL) with company-code-level data isolation — different company codes never see each other's data.

---

### On KPIs and Calculations

**Q: The SOD Conflict count — how is it computed exactly?**

Four independent checks run across your full transaction history:
1. PO Creator vs. PO Releaser — same user in po_dump and change_log (CDHDR/CDPOS, field FRGZU)
2. PO Creator vs. GRN Poster — po_dump.created_by matches grn_dump.created_by for the same PO line
3. GRN Poster vs. Invoice Poster — grn_dump.created_by matches po_invoice_dump.created_by for the same PO line
4. Invoice Poster vs. Payment Clearer — invoice_dump.created_by matches payment_dump.created_by for the same invoice

Each conflict is reported with the document number, vendor, user, and date. You can drill down to every individual conflict from the Leadership dashboard.

**Q: How is CAPEX vs. OPEX classified — is it manual?**

Three-tier hierarchy, automated by default:
1. Material group in the PO line (SAP MATKL field) — material groups 9902, 9904 are CAPEX; IT, CLOUD, SOFTWARE, SAAS are OPEX
2. Profit Center default classification — set once per profit center and cascades to all POs under it
3. Manual override by user — tagged as USER classification, never overwritten by the system

Any PO line can be manually reclassified in 2 clicks. The change cascades immediately across all financial dashboards.

**Q: The Maverick Spend percentage — can it show false positives?**

Maverick spend is defined as a PO line where the purchase_requisition field in SAP EKPO (BANFN) is blank or null. This is the standard SAP definition of a PO placed without a requisition. If your organisation uses a different PR-to-PO linkage (e.g., framework orders, scheduling agreements), those can be excluded from the maverick calculation by filtering on document type — configurable per deployment.

**Q: How is Vendor Delivery Lead Time computed — is it from vendor self-reporting?**

No. It uses two SAP tables: `po_delivery_dump` (EKET — the scheduled delivery date your Procurement team agreed with the vendor at PO creation) and `grn_dump` (MSEG — the actual goods receipt posting date). The lead time is the difference between these two real SAP document dates. No vendor input required.

---

### On Value and Adoption

**Q: What is the ROI? How do we justify the cost to the board?**

Three numbers from typical deployments:
- **Duplicate invoice recovery:** Average 0.1–0.3% of AP spend. On ₹500 Cr payables, that is ₹50–150 lakhs recovered in the first year.
- **Audit finding prevention:** One SOD conflict finding in a Big 4 audit typically costs ₹20–80 lakhs in remediation, restatement, and control redesign. IntelliSource surfaces these before the auditor does.
- **Analyst time saved:** Replacing manual P2P reporting (typically 2–3 analysts, 20+ hours per week of data extraction and reconciliation) with an automated platform delivers 600–800 hours per year back to higher-value work.

**Q: How long does implementation take?**

For a single company code with clean SAP data exports: 3–5 working days from first data upload to fully operational dashboards. Multi-company, multi-ERP deployments take 2–4 weeks depending on data quality and access provisioning.

**Q: Who in our organisation needs to be involved to get started?**

At minimum: one SAP Functional Consultant (to run the initial extracts), one Finance or Procurement business owner (to validate KPI logic against business understanding), and one IT contact (for infrastructure/access setup). No SAP Basis team involvement required. No ABAP developer. No prolonged IT project.

**Q: Can it handle multiple company codes or group-level consolidation?**

Yes. IntelliSource is built for multi-entity organisations. Company code filter is available on every dashboard. Consolidated "ALL" view computes group-level KPIs across all uploaded company codes simultaneously. Each company code's data is isolated — controllers for one entity cannot see another's transactions.

**Q: What happens if SAP data quality is poor — blank fields, inconsistent coding?**

IntelliSource handles common data quality issues at the ETL layer: CAST with COALESCE for numeric fields stored as text, NULL-safe comparisons, deduplication on primary keys. The upload pipeline flags rows that fail validation — your team sees exactly which records were rejected and why. Gradual data quality improvement is visible as KPIs stabilise over successive uploads.

---

*IntelliSource — KPMG India*
*P2P Intelligence & Analytics Platform*
*For queries: getdev24@gmail.com*
