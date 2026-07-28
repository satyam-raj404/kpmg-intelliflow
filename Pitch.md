# IntelliSource — The Complete Demo Pitch
**KPMG India | P2P Intelligence & Analytics Platform**
*Crafted from the desk of a CMO — 30 years building enterprise technology narratives*

---

## THE POSITIONING STATEMENT

> **IntelliSource is not a dashboard. It is the governance layer your organisation never knew it was missing — and that your auditors are already looking for.**

Every enterprise running SAP has a hidden problem. The data is there. The transactions are recorded. The evidence is all in the system. But nobody has connected the dots — until something goes wrong.

IntelliSource connects the dots. Before something goes wrong.

---

## SECTION 1 — THE MARKET STORY: WHY THIS, WHY NOW

### The Problem Worth Solving

Across Indian enterprises, the Procure-to-Pay function processes hundreds of thousands of transactions every year. Purchase orders. Goods receipts. Vendor invoices. Outgoing payments. Every one of them recorded faithfully in SAP.

And yet, every CFO has signed off on a budget review where the numbers didn't quite add up. Every internal auditor has written a finding that started with the words "it appears that the same individual..." Every Finance Controller has discovered a duplicate invoice three weeks after the payment cleared.

The problem is not SAP. SAP does exactly what it was built to do — record transactions.

The problem is that **recording transactions is not the same as understanding them.**

SAP tells you what happened.  
IntelliSource tells you what it means — and what to do about it.

### The Market Moment

Three forces are converging to make procurement intelligence a boardroom priority right now:

1. **Regulatory pressure:** SEBI, MSME Development Act timelines, GST reconciliation requirements, Companies Act audit committee mandates — the compliance surface area for procurement has never been larger.

2. **Audit expectations:** Big 4 audit teams are now specifically checking for SOD (Segregation of Duty) conflicts in the P2P cycle as a standard audit procedure. Companies that find these themselves — before the auditor does — pay significantly less in remediation.

3. **Digital transformation accountability:** Boards have invested crores in SAP implementations. They now want to see the ROI. A live intelligence layer on top of SAP is the visible proof that the ERP investment is being maximised.

IntelliSource answers all three — deployed in days, not months.

---

## SECTION 2 — THE DATA FOUNDATION: BUILT ON YOUR SAP, NOT BESIDE IT

### No New Data. No New Integration. No New Risk.

This is the first objection every CTO and CFO raises: *"We already have SAP. We're not adding another integration."*

IntelliSource's answer: there is no integration. Your team exports CSV files from the SAP transaction reports they already run. IntelliSource ingests them. That is the entire technical handshake.

**The nine data streams IntelliSource uses:**

| What It Captures | Where It Comes From in SAP | IntelliSource Table |
|---|---|---|
| Purchase Requisitions | ME5A → SAP table EBAN | `pr_dump` |
| Purchase Orders | ME2M / ME2N → EKKO + EKPO | `po_dump` |
| Goods Receipts (GRN) | MB51 / MIGO → MKPF + MSEG | `grn_dump` |
| PO-Invoice Linkage | MIR6 / MIR7 → RBKP + RSEG | `po_invoice_dump` |
| AP Invoices | FBL1N → BKPF + BSEG | `invoice_dump` |
| Outgoing Payments | F110 / FBL1N → BKPF + BSEG | `payment_dump` |
| Vendor Master | XK03 / MK03 → LFA1 + LFB1 | `vendor_master` |
| PO Change History | AUT10 → CDHDR + CDPOS | `change_log` |
| Delivery Schedules | ME2L → EKET | `po_delivery_dump` |

**The message to your CTO:** No ABAP. No middleware. No API. No SAP Basis involvement. No IT project. A CSV upload and a browser tab.

**The message to your CFO:** No new infrastructure risk. No new data exposure. No new vendor dependency for the transaction layer.

**Upload to live intelligence: under 90 seconds.**

---

## SECTION 3 — THE FIVE DASHBOARDS: WHAT EACH BUYER SEES, AND WHY IT CHANGES THEIR WORLD

---

### DASHBOARD 1: PROCUREMENT
*The Buyer: Procurement Manager, Category Head, CPO*
*The Question It Answers: "Is our procurement function in control — or just busy?"*

There is a difference between a procurement team that is busy and a procurement team that is effective. IntelliSource makes that difference visible for the first time.

---

**TOTAL PO VALUE**
*What it shows:* The full rupee value of every active, non-deleted purchase order committed in the current financial year.

*Why it matters to the buyer:* This is the number your Procurement Manager quotes in budget reviews and has never been able to pull in real time before. It was always yesterday's data, or last week's export. Now it is live. The moment a new PO is posted in SAP and the data is uploaded, this number changes. Every negotiation, every vendor conversation, every board presentation starts here.

---

**MAVERICK SPEND %**
*What it shows:* The percentage of PO value placed without a backing Purchase Requisition — meaning someone in the organisation went directly to a vendor and raised a PO without going through the approval process.

*The KPI logic:* IntelliSource checks the `purchase_requisition` field in every PO line. If it is blank or null, the PO is maverick. The engine computes the total value of maverick POs as a percentage of all active PO spend.

*Why it matters to the buyer:* Industry benchmark is below 5%. Above 15% is an audit finding. Above 25% means your procurement policy is being routinely bypassed — and you have no idea by whom, for which vendors, or at what value. IntelliSource gives you all three. The moment you can show a department head the ₹ value of their team's maverick purchases, behaviour changes.

---

**PO CYCLE TIME**
*What it shows:* The median number of days between PR approval date and PO creation date.

*The KPI logic:* Computed from the `pr_po_grn_invoice` fact table — the difference between `po.document_date` and `pr.release_date`, taking the median across all matched PR-PO pairs in the financial year.

*Why it matters to the buyer:* Long cycle time is the single biggest reason business units route around procurement. If it takes 18 days to get a PO raised after a PR is approved, people stop raising PRs. They call the vendor directly. Maverick spend goes up. Compliance goes down. This one number tells you whether your procurement process is a business enabler or a bottleneck.

---

**PO DELETION RATE**
*What it shows:* The percentage of POs raised and subsequently deleted, with a live alert feed showing who deleted what, worth how much, from which vendor.

*Why it matters to the buyer:* PO deletion is a known compliance bypass technique. Raise a PO above the approval threshold, get it approved, delete it, raise two smaller POs below the threshold. IntelliSource's Alert Centre catches this pattern and puts it in front of the Procurement Manager in real time — not in next quarter's audit report.

---

**CONTRACT COMPLIANCE RATE**
*What it shows:* The percentage of PO spend backed by a contract reference number.

*Why it matters to the buyer:* Uncontracted spend is unprotected spend. No SLA, no penalty clause, no price protection. For a ₹500 Cr procurement function with 30% uncontracted spend, that is ₹150 Cr committed with no recourse if a vendor underdelivers.

---

### DASHBOARD 2: FINANCIAL
*The Buyer: Finance Controller, AP Head, CFO*
*The Question It Answers: "Are we paying correctly — and are we paying for things we actually received?"*

The AP function is the last line of defence before money leaves the organisation. IntelliSource turns it from a processing function into a control function.

---

**TOTAL INVOICE VALUE**
*What it shows:* The sum of all vendor invoices posted in the current financial year (SAP document types RE and KR — Logistics Invoice Verification and standard vendor invoice).

*Why it matters to the buyer:* This is the live AP liability number your cash flow forecast is built on. Most Finance teams pull this from FBL1N once a week. IntelliSource makes it live. When your Treasury team asks "how much do we owe vendors this month?", the answer is on screen before the question finishes.

---

**DUPLICATE INVOICE DETECTION**
*What it shows:* Vendor invoices where the same vendor + same invoice reference number + same amount appears more than once in your system.

*The KPI logic:* `GROUP BY vendor, vendor_invoice_ref, amount_local_ccy HAVING COUNT(*) > 1`. Every duplicate surfaces with the vendor, invoice reference, amount, duplicate count, and first posting date.

*Why it matters to the buyer:* Industry average: 0.1–0.5% of total AP spend is paid as duplicates. On ₹500 Cr annual payables, that is ₹50 to ₹250 lakhs. IntelliSource surfaces every duplicate *before the payment clears*. Your AP team can act. The money stays in the company.

---

**INVOICE CYCLE TIME**
*What it shows:* Median days from Goods Receipt Note posting to invoice receipt in AP.

*Why it matters to the buyer:* Long GRN-to-invoice time means either your vendors are slow to bill (cash flow advantage for you, but indicates process gaps) or your AP team is slow to process (liability risk and vendor relationship strain). This number tells you which story is true — and where the bottleneck is.

---

**OVERDUE INVOICES**
*What it shows:* The total value of invoices past their due date that have not been cleared.

*Why it matters to the buyer:* Every overdue invoice is a potential late payment penalty, a strained vendor relationship, and — for MSME vendors specifically — a regulatory compliance violation under the MSME Development Act (45-day payment requirement). This number, live, gives your AP team a daily action list.

---

**CAPEX vs. OPEX SPLIT**
*What it shows:* The proportion of total PO spend classified as capital expenditure versus operational expenditure, automatically computed at PO line level.

*The KPI logic — three-tier classification hierarchy:*
1. Manual user override (highest priority — never overwritten by system)
2. Profit Center default classification (set once, cascades to all POs under that cost centre)
3. SAP material group default (9902/9904 = CAPEX; IT/CLOUD/SOFTWARE/SAAS = OPEX; all others = OPEX)

*Why it matters to the buyer:* Your auditors ask for this every year. Your board asks for this every quarter. Most SAP implementations require a 2–3 week exercise to produce a credible CAPEX/OPEX split. IntelliSource classifies it automatically at line level and updates live with every upload. The number your Finance Controller presents in the board meeting is the same number IntelliSource shows right now.

---

**INVOICE AGING BUCKETS**
*What it shows:* Outstanding AP balances segmented by age — 0–30 days, 31–60 days, 61–90 days, 90+ days.

*Why it matters to the buyer:* Aging above 90 days triggers escalation in almost all vendor payment terms. Aging above 60 days for MSME vendors triggers regulatory action. This view gives your AP team one screen to prioritise their entire outstanding workload — instead of sorting a 10,000-row FBL1N export by column C.

---

### DASHBOARD 3: LEADERSHIP
*The Buyer: CFO, CPO, MD, Board Audit Committee*
*The Question It Answers: "Is the company's money safe — right now?"*

The Leadership Dashboard is the one a CFO opens on Monday morning before the first meeting. It is not a report. It is a risk status.

---

**TOTAL SPEND**
Enterprise-wide committed PO value across all company codes. The single number that starts every board presentation, every analyst briefing, every budget review — and is now live instead of last week's extract.

---

**P2P CYCLE TIME**
*What it shows:* End-to-end days from Purchase Requisition creation to final payment clearance, computed across the full transaction chain.

*The KPI logic:* Joins `pr_dump.created_on` to `payment_dump.posting_date` through the `pr_po_grn_invoice` fact table. Median across all completed cycles in the current financial year.

*Why it matters to the buyer:* Industry benchmark: 30–45 days. Above 60 days signals a broken process — approval delays, GRN backlogs, invoice disputes, or payment hold queues. *Below 20 days* signals something equally concerning: payments clearing too fast, controls being bypassed. Both extremes are red flags. This one number tells the CFO whether the P2P machine is running as designed.

---

**SOD CONFLICT COUNT — The Crown Jewel**
*What it shows:* The total number of Segregation of Duty violations across your entire P2P transaction history, updated with every data upload. Four independent control checks run simultaneously:

| SOD Type | What Is Checked | SAP Data Used |
|---|---|---|
| PO Create vs. Release | Same user raised and approved the PO | `po_dump` × `change_log` (CDHDR field FRGZU) |
| PO vs. GRN | Same user created PO and posted Goods Receipt | `po_dump.created_by` = `grn_dump.created_by` |
| GRN vs. Invoice | Same user posted GRN and verified invoice | `grn_dump.created_by` = `po_invoice_dump.created_by` |
| Invoice vs. Payment | Same user posted invoice and cleared payment | `invoice_dump.created_by` = `payment_dump.created_by` |

*The KPI logic:* Four independent COUNT DISTINCT queries, each joining two tables on the shared purchasing document and matching `created_by` fields. Results summed to total SOD conflict count. Every conflict stored with document number, vendor, user name, SOD type, and date — drillable from the dashboard in one click.

*Why it matters to the buyer:* This is the metric your Big 4 auditors check manually — and charge you for. It is the metric your internal audit team produces quarterly with a two-week exercise. IntelliSource produces it in the time it takes to upload a CSV file.

More importantly: **SAP's own authorisation matrix cannot detect this.** SAP prevents one user from having both "Create PO" and "Release PO" *authorization roles*. It cannot detect when two users share credentials, when a consultant set up a workaround, or when a control failed during a system migration. IntelliSource checks the *actual transaction data* — not the roles. It finds what SAP was never designed to look for.

---

**HIGH-VALUE PO COUNT**
*What it shows:* The number of active POs above a configurable threshold (default ₹1 Cr), with the threshold adjustable by the admin in real time.

*Why it matters to the buyer:* High-value POs should carry additional approval layers, board visibility, and audit trail documentation. This KPI tells leadership how many are active at any point. If the number spikes unexpectedly at quarter-end, someone needs to ask why.

---

**RISK PANEL**
Five risk metrics visible simultaneously — POs Without PR, One-Time Vendors, POs Without Contract, Duplicate Invoices, SOD Conflicts — each drillable to individual document level. This is the panel that tells the CFO: *"Here is where our controls have gaps right now. Here is exactly what to review."*

---

### DASHBOARD 4: VENDOR PERFORMANCE
*The Buyer: Procurement Manager, Vendor Management Team, Supply Chain Head*
*The Question It Answers: "Are our vendors earning the business we give them?"*

Most organisations manage vendor performance through annual reviews and relationship calls. IntelliSource manages it through data — continuously, automatically, and without waiting for a vendor to self-report.

---

**VENDOR DELIVERY LEAD TIME**
*What it shows:* The actual delivery days per vendor versus their committed delivery schedule — computed from real SAP transaction dates, not vendor self-reporting.

*The KPI logic:* Joins `po_delivery_dump.expected_delivery_date` (the scheduled delivery date your team agreed with the vendor at PO creation, from SAP EKET table) to `grn_dump.posting_date` (the actual Goods Receipt date, from MSEG). The difference, averaged per vendor, is their true delivery performance.

*Why it matters to the buyer:* If your vendor's contract says 14-day delivery and IntelliSource shows 23 days average — that is a contract performance conversation backed by SAP data, not a feeling. It is also a renegotiation lever, a tender evaluation input, and an escalation trigger.

---

**TOP VENDOR SPEND**
*What it shows:* Your top 10 vendors ranked by total committed PO value in the current financial year.

*Why it matters to the buyer:* Vendor concentration risk is invisible until it is catastrophic. When your top 3 vendors account for 65% of spend and one of them has a delivery crisis, your entire supply chain is exposed. This ranking makes that exposure visible before the crisis — not during it.

---

**MSME VENDOR TRACKING**
*What it shows:* Which vendors are classified as MSME in the vendor master, and what share of your spend goes to them.

*Why it matters to the buyer:* The MSME Development Act mandates payment within 45 days. Violation triggers interest penalties and potential legal liability. IntelliSource flags MSME status from the vendor master so your AP team never processes an MSME invoice without knowing the compliance clock is running.

---

**VENDOR REPOSITORY**
A live, searchable vendor master: PAN, GSTIN, MSME flag, payment terms, SPOC, service description, vendor type classification. New vendors onboarded here are immediately reflected across every dashboard and report. No parallel data update cycle, no manual master data ticket.

---

### DASHBOARD 5: UTILIZATION
*The Buyer: CFO, Budget Owners, Department Heads, Finance Controller*
*The Question It Answers: "Are we spending the budget we were given — and spending it on the right things?"*

Budget is not a spending permission. It is an accountability instrument. IntelliSource makes every budget owner accountable in real time, not at year-end.

---

**CAPEX UTILIZATION %**
*What it shows:* Capital expenditure consumed versus sanctioned capital budget, by profit center.

*Why it matters to the buyer:* Underutilisation means capital budget expires at year-end — and next year's capital request is weakened because "you didn't spend what you asked for last year." Overutilisation means a board-level budget breach that your Finance Controller is going to explain in the next audit committee meeting. Both require visibility before the quarter closes, not after.

---

**OPEX UTILIZATION %**
*What it shows:* Operational spend versus approved opex budget, by profit center and department.

*Why it matters to the buyer:* Opex overrun is the most common audit finding in large Indian enterprises. Visibility in October means you can intervene. Visibility in March means you are writing the explanation letter.

---

**PROFIT CENTER DRILL-DOWN**
Every profit center in the organisation — mapped to departments, plants, and material groups — with CAPEX/OPEX classification cascading automatically from the master configuration. Department heads see their own position against budget without waiting for a monthly finance report.

---

### THE P2P LIFECYCLE TRACKER + ALERTS
*The Buyer: Compliance Team, Internal Audit, Procurement Operations*
*The Question It Answers: "Where in the process did this transaction go wrong — and when?"*

---

**P2P FUNNEL**
A visual representation of transaction volume at each stage: PR → PO → GRN → Invoice → Payment. Stage drop-offs are the story. 1,200 PRs converted to 480 POs means 720 requisitions never became orders — that is either vendor cancellations, approver delays, or business units giving up on the process. Each number is clickable to the underlying transactions.

---

**ANOMALY EVENT LOG**
Every flagged transaction with its anomaly type, severity, and affected purchase order. Six anomaly patterns detected automatically:

| Anomaly | What It Signals | Severity |
|---|---|---|
| **Split PO** | Multiple POs to same vendor, same day, similar value — classic approval threshold evasion | HIGH |
| **Retrospective PO** | GRN posted before PO created — goods received before procurement approval | MEDIUM |
| **No GRN** | Invoice received, no goods receipt — 3-way match failure | MEDIUM |
| **Price Variance** | Invoice value >20% above vendor's historical average for same material group | HIGH |
| **Maverick Buy** | PO with no backing PR — procurement policy bypass | LOW |
| **Deleted After GRN** | PO cancelled after goods were already received — liability creation | HIGH |

*The business narrative:* Each anomaly type maps to a specific fraud pattern, compliance failure, or process breakdown that your audit team has seen in the field. IntelliSource flags them automatically — not from rule-based alerts that create noise, but from the actual data relationships in your SAP transaction history.

---

**DEDICATED ALERTS PAGE**
A consolidated view of all anomalies, severity-classified (High / Medium / Low), with one-click drill-down to every affected purchase order, vendor, value, and date. This is the screen your compliance team has wanted for years. One place. All flags. Full traceability.

---

## SECTION 4 — THE 60-SECOND PITCH
*Memorise this. Deliver it without looking down.*

---

Here is the conversation that happens in every large enterprise, every month:

Your Finance team runs FBL1N. Your Procurement team runs ME2M. Your audit team runs their own report. Three exports. Three Excel files. Three versions of the truth. And by the time someone VLOOKUPs them together, the payment has already gone.

IntelliSource ends that conversation permanently.

One platform. Five dashboards. Every metric your CFO, CPO, Finance Controller, and Vendor Management team needs — live, from your own SAP data, updated the moment you upload a file.

But here is what clients actually pay for:

IntelliSource finds the things SAP was never designed to show you.

Your authorisation matrix is supposed to prevent one person from raising an invoice *and* clearing the payment. In theory. IntelliSource checks the actual transaction data — every invoice, every payment, every user — and surfaces each violation with a name, a document number, and a date.

One client. First upload. Forty-seven violations. SAP had been running for eleven years. None of them visible.

The CFO escalated all forty-seven to internal audit in the same business day.

That is not a dashboard. That is the governance layer your organisation does not have — and that your auditors are already looking for.

**IntelliSource. From KPMG. The intelligence your SAP investment always promised.**

---

*[Pause after "forty-seven." Let it land.]*

---

## SECTION 5 — COMPETITIVE DIFFERENTIATION: WHERE INTELLISOURCE WINS

### vs. SAP Standard Reports

| The Question | SAP Standard | IntelliSource |
|---|---|---|
| Who created this PO and who released it? | AUT10 + manual comparison | SOD Conflict Count — live, drillable |
| What % of our spend bypassed requisition? | ME2M download + Excel VLOOKUP | Maverick Spend % — live KPI |
| Did we pay the same invoice twice? | Manual FBL1N scan | Duplicate Invoice Detection — before payment clears |
| What is our CAPEX vs. OPEX split? | 2–3 week extraction exercise | Live, auto-classified, line-level |
| End-to-end P2P cycle time? | Impossible from standard reports | P2P Cycle Time KPI — live |
| Which vendor is consistently late? | MB51 + EKET download + Excel | Vendor Delivery Lead Time — by vendor, live |
| Where are our SOD violations? | Not computed natively | 4-type SOD check — all conflicts with names and dates |

### vs. Generic BI Tools (Power BI, Tableau)

Generic BI tools require a data model, a data engineer, a dashboard designer, and 3–6 months of development. They still produce the same static report — just prettier.

IntelliSource comes with the P2P data model built in, pre-configured for SAP field structures, with procurement-specific KPI logic already coded. Upload your SAP data. Dashboards are live in under 90 seconds. No data engineer. No development project. No waiting.

### vs. Doing Nothing

Every year without IntelliSource is a year where:
- Duplicate invoices are found (if ever) by accident
- SOD conflicts accumulate for auditors to find — and charge to remediate
- Maverick spend grows because nobody is measuring it
- Vendor performance is managed by relationship, not data
- CAPEX/OPEX reporting is a manual exercise that nobody trusts

The question is not whether IntelliSource is worth the investment. The question is: **what is the current cost of not having it?**

---

## SECTION 6 — MANAGEMENT Q&A

### On Positioning and Value

**Q: We have SAP. We have a BI team. Why do we need IntelliSource?**

SAP records. BI teams visualise. Neither detects. IntelliSource is the detection layer — the system that looks across every transaction in your SAP history and identifies the specific documents, users, and patterns that represent compliance risk, financial exposure, or process failure. Your BI team builds what business owners ask for. IntelliSource surfaces what nobody thought to ask for — because nobody knew it was there.

**Q: What is the one thing IntelliSource does that nothing else does?**

Real-time, cross-document SOD conflict detection across all four P2P control points — computed from actual transaction data, not from role assignments. No SAP standard report does this. No generic BI tool does this. It requires joining five tables across three SAP modules, comparing creator fields, and applying four independent control logic patterns. IntelliSource does this every time you upload data, in under 90 seconds.

**Q: How is this different from what our internal audit team already does?**

Your internal audit team produces this analysis quarterly or annually, using manual queries and Excel. It takes two to three weeks and one to two analysts. IntelliSource produces the same analysis in under two minutes, every time your data is refreshed. Your internal audit team's time is then freed for investigation and remediation — the work that requires human judgment — rather than data extraction.

### On Data and Security

**Q: Does this require SAP integration or access to our production system?**

No. IntelliSource works entirely on CSV file exports from SAP standard transaction reports — ME2M, MB51, FBL1N, and others your team already produces. There is no connection to your SAP production system, no RFC call, no middleware, no API. The only technical requirement is that your SAP team can run and export five standard reports.

**Q: Where does our data go? Who can see it?**

IntelliSource runs on your infrastructure or a dedicated KPMG-managed cloud environment. Data does not commingle with other clients. Company codes are isolated — a user for Company Code 1001 cannot see Company Code 1002's transactions. The system is designed for multi-entity enterprises with strict data segregation requirements.

**Q: What if our SAP data quality is poor?**

The ETL pipeline handles the most common SAP data quality issues: numeric values stored as text (net_order_value, amount_local_ccy), NULL-safe comparisons, primary key deduplication, and rejection logging for invalid rows. The upload portal shows exactly which rows were rejected and why. Gradual data quality improvement is visible as KPI confidence increases over successive uploads.

### On Investment and Deployment

**Q: What does implementation look like? Who do we need to involve?**

Three people for a single-company pilot: one SAP Functional Consultant (to run the initial extracts), one Finance or Procurement business owner (to validate KPI logic), and one IT contact for infrastructure setup. No SAP Basis team. No ABAP developer. No lengthy IT project. First dashboards live within 3–5 working days of receiving clean data exports.

**Q: What is the ROI case?**

Three independent value streams:

*1. Duplicate Invoice Recovery:* Industry average 0.1–0.5% of AP spend. On ₹500 Cr annual payables: ₹50–250 lakhs. IntelliSource surfaces duplicates before payment clears — the recovery is prevention, not reversal.

*2. Audit Finding Avoidance:* One SOD finding in a Big 4 external audit generates ₹20–80 lakhs in remediation costs, management time, and potential restatement. IntelliSource finds these internally, before the auditor, so the response is a corrective action — not an audit qualification.

*3. Analyst Time:* Replacing 20+ hours/week of manual P2P reporting across Finance and Procurement teams delivers 800–1,000 analyst hours per year back to higher-value work. At a senior analyst cost of ₹40–60 lakhs per year fully loaded, that is a meaningful productivity return.

Most clients see full cost recovery within 12 months — and that is before counting the regulatory exposure avoided.

**Q: Can this scale to multiple company codes and international entities?**

Yes. IntelliSource is built for multi-entity structures. Every dashboard has a company-code filter. The "ALL" consolidated view computes group-level KPIs across every uploaded company code simultaneously. International deployments work with any SAP instance regardless of country version — the data model is based on standard SAP field names (LIFNR, EBELN, BUKRS) that are universal across all SAP localizations.

**Q: What happens after the pilot? What does the pricing model look like?**

The pilot is scoped to a single company code with a defined data set. Full deployment is priced on a combination of company code count, transaction volume, and support tier (self-serve vs. KPMG-managed). KPMG's advisory team can also wrap the platform with a managed services model — ongoing data upload, KPI monitoring, and monthly procurement health report delivered to leadership. Contact the KPMG Procurement Advisory team to scope the right commercial model for your organisation.

---

*IntelliSource — KPMG India*
*P2P Intelligence & Analytics Platform*
*Contact: getdev24@gmail.com*

---
*"The best time to find a procurement control failure is before the auditor does. The second best time is right now."*
