# IntelliSource P2P Data Model

**Version:** 2.0 | **Dashboards:** Procurement, Financial, Leadership, Vendor, Utilization
**Tables:** 22 | **KPIs:** 38 | **Source:** IntelliSource Reference Schema v2

---

## What This Model Does

Captures every step of Procure-to-Pay — from raising a purchase request to paying the vendor. Also covers upstream sourcing (RFQ & Bidding) and budget controls.

**Four data domains:**
- **P2P Core** — standard buy-to-pay flow (9 tables)
- **Sourcing** — RFQ events, supplier bids, award decisions (6 tables)
- **Budget** — budget allocation and spend control (4 tables)
- **Analytics** — computed insights for dashboards (3 tables)

---

## Tracking Key System

Every record gets a composite key using `@` as separator. Downstream stages chain the parent key so you can trace lineage end-to-end.

| Stage | Key Format | Example |
|-------|-----------|---------|
| Vendor | `VENDOR@{vendor_id}@{onboard_date}@{period}` | `VENDOR@V732880@2020-01-15@Jan-2020` |
| PR | `PR@{purchasing_group}@{created_date}@{period}` | `PR@SER@2024-01-10@Jan-2024` |
| PO | `PO@{vendor_id}@{document_date}@{period}` | `PO@V732880@2024-01-15@Jan-2024` |
| GRN | `GRN@{parent_po_key}@{posting_date}` | `GRN@PO@V732880@2024-01-15@Jan-2024@2024-02-10` |
| PO Invoice | `PINV@{parent_po_key}@{posting_date}` | `PINV@PO@V732880@2024-01-15@Jan-2024@2024-02-15` |
| Invoice | `INV@{vendor_id}@{posting_date}@{period}` | `INV@V732880@2024-02-15@Feb-2024` |
| Payment | `PAY@{vendor_id}@{posting_date}@{period}` | `PAY@V732880@2024-03-01@Mar-2024` |
| Change | `CHG@{object_class}@{object_id}@{change_date}` | `CHG@EINKBELEG@2000001883@2024-01-20` |
| RFQ | `RFQ@{rfq_type}@{created_date}@{period}` | `RFQ@OPEN@2024-01-05@Jan-2024` |
| Bid | `BID@{rfq_id}@{supplier_id}@{submitted_date}` | `BID@RFQ001@V732880@2024-01-20` |
| Award | `AWARD@{rfq_id}@{supplier_id}@{award_date}` | `AWARD@RFQ001@V732880@2024-01-25` |
| Budget | `BUDGET@{fiscal_year}@{owner_id}@{period}` | `BUDGET@FY2024@OWN001@Jan-2024` |

---

## Domain 1 — P2P Core (9 Tables)

### 1. VENDOR_MASTER
Master record for every supplier. All other tables reference this.

| Column | Type | Meaning |
|--------|------|---------|
| vendor | VARCHAR(10) PK | Unique vendor code |
| vendor_name | VARCHAR(35) | Vendor legal name |
| country | VARCHAR(3) | Country code (e.g. IN) |
| city | VARCHAR(35) | City |
| postal_code | VARCHAR(10) | ZIP / PIN code |
| region | VARCHAR(3) | State code (e.g. KA) |
| account_group | VARCHAR(4) | Vendor classification |
| tax_number_pan | VARCHAR(10) | PAN / tax ID |
| tax_number_gstin | VARCHAR(15) | GSTIN (15-digit GST number) |
| central_purchasing_block | CHAR(1) | X = blocked from creating POs |
| central_posting_block | CHAR(1) | X = blocked from posting |
| deletion_flag_central | CHAR(1) | X = vendor marked for deletion |
| company_code | VARCHAR(4) | Company code |
| payment_terms | VARCHAR(4) | Default payment terms (e.g. N030) |
| payment_block | CHAR(1) | * = payment blocked |
| posting_block_cc | CHAR(1) | X = CC posting blocked |
| tracking_key | VARCHAR(100) | Composite tracking key |

**KPI use:** compliance rate, payment block count, change frequency

---

### 2. PURCHASE_REQUISITION (PR)
Internal request to buy something. First step of P2P.

| Column | Type | Meaning |
|--------|------|---------|
| purchase_requisition | VARCHAR(10) PK | PR document number |
| item_of_requisition | VARCHAR(5) | Line item number |
| purchasing_doc_type | VARCHAR(4) | PR type code |
| vendor | VARCHAR(10) FK→VENDOR | Suggested vendor |
| material_group | VARCHAR(9) | Category code |
| material_description | VARCHAR(100) | What is being requested |
| plant | VARCHAR(4) | Delivery location |
| purchasing_group | VARCHAR(3) | Buyer team code |
| order_quantity | DECIMAL(13,3) | Quantity requested |
| unit_of_measure | VARCHAR(3) | Unit (EA, KG, etc.) |
| valuation_price | DECIMAL(11,2) | Estimated price per unit |
| delivery_date | DATE | Required by date |
| release_status | VARCHAR(8) | X = approved |
| release_date | DATE | When PR was approved |
| requisitioner | VARCHAR(12) | Who raised the PR |
| tracking_number | VARCHAR(20) | External reference |
| tracking_key | VARCHAR(100) | Composite tracking key |

**KPI use:** PR-to-PO conversion time, open PR aging, maverick PO detection

---

### 3. PURCHASE_ORDER (PO)
Formal commitment to a vendor. Core of P2P — links PR upstream, GRN/Invoice downstream.

| Column | Type | Meaning |
|--------|------|---------|
| purchasing_document | VARCHAR(10) PK | PO number |
| item | VARCHAR(5) | PO line item |
| purchasing_doc_type | VARCHAR(4) | PO type (ZAN=Service) |
| purchasing_org | VARCHAR(4) | Purchasing organization |
| purchasing_group | VARCHAR(3) | Buyer team |
| vendor | VARCHAR(10) FK→VENDOR | Vendor code |
| vendor_name | VARCHAR(35) | Vendor name |
| document_date | DATE | PO creation date |
| plant | VARCHAR(4) | Receiving plant |
| material_group | VARCHAR(9) | Category |
| material_description | VARCHAR(100) | What is being ordered |
| order_quantity | DECIMAL(13,3) | Ordered quantity |
| unit_of_measure | VARCHAR(3) | Unit |
| net_order_price | DECIMAL(11,2) | Price per unit |
| net_order_value | DECIMAL(15,2) | Total line value |
| tax_code | VARCHAR(2) | GST tax code |
| purchase_requisition | VARCHAR(10) FK→PR | Source PR number |
| release_indicator | CHAR(1) | X = PO approved |
| release_strategy | VARCHAR(8) | Approval workflow code |
| delivery_completed | CHAR(1) | X = fully delivered |
| deletion_indicator | CHAR(1) | L = cancelled |
| tracking_key | VARCHAR(100) | Composite tracking key |

**KPI use:** total spend, active PO count, high-value PO, amendment rate, maverick rate

---

### 4. PO_DELIVERY_SCHEDULE
Committed delivery dates per PO line — used to measure on-time delivery.

| Column | Type | Meaning |
|--------|------|---------|
| purchasing_document | VARCHAR(10) FK→PO | PO number |
| item | VARCHAR(5) | PO line |
| schedule_line | VARCHAR(4) PK | Schedule line number |
| expected_delivery_date | DATE | Committed delivery date |
| scheduled_quantity | DECIMAL(13,3) | Expected quantity |
| delivered_quantity | DECIMAL(13,3) | Quantity received |
| open_quantity | DECIMAL(13,3) | Still pending |
| actual_delivery_date | DATE | Date goods arrived (from GRN) |
| statistical_delivery_date | DATE | Baseline date |
| creation_date | DATE | When schedule was created |

**KPI use:** OTIF rate, delivery delay

---

### 5. GOODS_RECEIPT (GRN)
Record of goods or services actually received against a PO.

| Column | Type | Meaning |
|--------|------|---------|
| purchasing_document | VARCHAR(10) FK→PO | PO number |
| item | VARCHAR(5) | PO line |
| material_document | VARCHAR(10) PK | GRN document number |
| material_doc_item | VARCHAR(4) | GRN line |
| po_history_category | CHAR(1) | Always E for goods receipt |
| movement_type | VARCHAR(3) | 101=GR, 122=Return |
| debit_credit_ind | CHAR(1) | S=GR posted, H=reversed |
| posting_date | DATE | Effective receipt date |
| entry_date | DATE | Date entered |
| quantity | DECIMAL(13,3) | Quantity received |
| amount_local_ccy | DECIMAL(13,2) | Value received |
| reference_doc | VARCHAR(16) | Vendor delivery note |
| tracking_key | VARCHAR(100) | Composite tracking key |

**KPI use:** OTIF, quantity variance, 3-way match

---

### 6. PO_INVOICE
Invoice posted directly against a PO. Used for 3-way match (PO qty = GRN qty = Invoice qty).

| Column | Type | Meaning |
|--------|------|---------|
| purchasing_document | VARCHAR(10) FK→PO | PO number |
| item | VARCHAR(5) | PO line |
| invoice_doc | VARCHAR(10) PK | Invoice document number |
| invoice_year | VARCHAR(4) | Fiscal year |
| invoice_doc_item | VARCHAR(4) | Invoice line |
| po_history_category | CHAR(1) | Always Q for invoice |
| debit_credit_ind | CHAR(1) | S=Invoice, H=Credit memo |
| posting_date | DATE | Invoice posting date |
| entry_date | DATE | Date entered |
| quantity | DECIMAL(13,3) | Invoiced quantity |
| amount_local_ccy | DECIMAL(13,2) | Invoice amount |
| reference_doc | VARCHAR(16) | Vendor invoice reference |
| tracking_key | VARCHAR(100) | Composite tracking key |

**KPI use:** 3-way match success rate

---

### 7. INVOICE
All vendor invoices including non-PO invoices (utilities, rentals, professional fees).

| Column | Type | Meaning |
|--------|------|---------|
| invoice_doc | VARCHAR(10) PK | Invoice document number |
| invoice_year | VARCHAR(4) | Fiscal year |
| vendor | VARCHAR(10) FK→VENDOR | Vendor code |
| document_type | VARCHAR(2) | KR=PO invoice, RE=Non-PO |
| vendor_invoice_ref | VARCHAR(16) | Vendor's invoice number |
| vendor_invoice_date | DATE | Date on vendor's invoice |
| posting_date | DATE | SAP posting date |
| due_date | DATE | Payment due date |
| amount_local_ccy | DECIMAL(15,2) | Invoice total |
| tax_amount | DECIMAL(13,2) | GST amount |
| payment_terms | VARCHAR(4) | Payment terms |
| payment_block | CHAR(1) | Blank=open, A=blocked |
| po_reference | VARCHAR(10) FK→PO | Linked PO (if any) |
| clearing_doc | VARCHAR(10) FK→PAYMENT | Payment document (if paid) |
| tracking_key | VARCHAR(100) | Composite tracking key |

**KPI use:** total spend YTD, invoice cycle time, open aging, DPO

---

### 8. PAYMENT
Actual cash payment made to a vendor. Final step of P2P.

| Column | Type | Meaning |
|--------|------|---------|
| payment_doc | VARCHAR(10) PK | Payment document number |
| payment_year | VARCHAR(4) | Fiscal year |
| vendor | VARCHAR(10) FK→VENDOR | Vendor code |
| document_type | VARCHAR(2) | KZ=Manual, ZP=Auto |
| posting_date | DATE | Payment date |
| clearing_date | DATE | Date invoice was cleared |
| payment_method | CHAR(1) | T=Transfer, S=SWIFT, C=Cheque |
| amount_local_ccy | DECIMAL(15,2) | Amount paid |
| discount_taken | DECIMAL(13,2) | Early payment discount captured |
| cleared_invoice | VARCHAR(10) FK→INVOICE | Invoice this clears |
| bank_reference | VARCHAR(30) | UTR / bank reference |
| house_bank | VARCHAR(5) | Paying bank ID |
| tracking_key | VARCHAR(100) | Composite tracking key |

**KPI use:** on-time payment rate, DPO, discount capture rate

---

### 9. CHANGE_LOG
Audit trail of every change to PR, PO, or Vendor records.

| Column | Type | Meaning |
|--------|------|---------|
| change_number | VARCHAR(10) PK | Change document number |
| object_class | VARCHAR(15) | BANF=PR, EINKBELEG=PO, KRED=Vendor |
| object_id | VARCHAR(20) | Document that was changed |
| username | VARCHAR(12) | Who made the change |
| change_date | DATE | Date of change |
| change_time | TIME | Time of change |
| tcode | VARCHAR(20) | System transaction used |
| table_name | VARCHAR(30) | Which table was changed |
| field_name | VARCHAR(30) | Which field was changed |
| change_indicator | CHAR(1) | I=Insert, U=Update, D=Delete |
| old_value | VARCHAR(255) | Value before change |
| new_value | VARCHAR(255) | Value after change |

**KPI use:** amendment rate, vendor change frequency, anomaly detection

---

## Domain 2 — Sourcing (6 Tables)

Pre-PO sourcing: sending RFQs, collecting bids, awarding contracts.

### 10. RFQ_EVENT
The overall Request for Quotation sent to multiple vendors.
**Tracking key:** `RFQ@{rfq_type}@{created_date}@{period}`

| Column | Type | Meaning |
|--------|------|---------|
| rfq_id | VARCHAR(15) PK | Unique RFQ identifier |
| event_title | VARCHAR(200) | What is being sourced |
| event_type | VARCHAR(20) | Open/Closed/Limited/Reverse-Auction |
| status | VARCHAR(20) | Draft/Published/Closed/Awarded |
| category | VARCHAR(9) | Material group |
| created_by | VARCHAR(12) | Procurement officer |
| created_date | DATE | When RFQ was created |
| publish_date | DATE | When sent to suppliers |
| close_date | DATE | Bid submission deadline |
| currency | VARCHAR(5) | Bid currency |
| budget_estimate | DECIMAL(15,2) | Internal budget estimate |
| awarded_po | VARCHAR(10) FK→PO | PO created after award |
| tracking_key | VARCHAR(100) | Composite tracking key |

---

### 11. RFQ_LINE
Individual items within an RFQ — what is being sourced at line level.

| Column | Type | Meaning |
|--------|------|---------|
| rfq_id | VARCHAR(15) FK→RFQ_EVENT | Parent RFQ |
| line_id | VARCHAR(5) PK | Line number |
| material_group | VARCHAR(9) | Category |
| description | VARCHAR(200) | What is being sourced |
| quantity | DECIMAL(13,3) | Required quantity |
| unit_of_measure | VARCHAR(3) | Unit |
| budget_estimate | DECIMAL(11,2) | Budget per unit |
| required_delivery_date | DATE | When needed |

---

### 12. RFQ_SUPPLIER_INVITE
Tracks which vendors were invited and whether they responded.

| Column | Type | Meaning |
|--------|------|---------|
| rfq_id | VARCHAR(15) FK→RFQ_EVENT | Parent RFQ |
| supplier_id | VARCHAR(10) FK→VENDOR | Invited vendor |
| invited_date | DATE | When invitation was sent |
| response_status | VARCHAR(20) | Pending/Accepted/Declined |
| participation_flag | CHAR(1) | Y=bid submitted, N=did not bid |
| submission_deadline | DATE | Vendor deadline |

---

### 13. BID_SUBMISSION
A vendor's complete bid response (header level — total value).
**Tracking key:** `BID@{rfq_id}@{supplier_id}@{submitted_date}`

| Column | Type | Meaning |
|--------|------|---------|
| bid_id | VARCHAR(15) PK | Unique bid identifier |
| rfq_id | VARCHAR(15) FK→RFQ_EVENT | Which RFQ |
| supplier_id | VARCHAR(10) FK→VENDOR | Bidding vendor |
| bid_version | INTEGER | 1=original, 2+ = revision |
| submitted_datetime | DATETIME | Submission timestamp |
| submission_status | VARCHAR(20) | Submitted/Withdrawn/Revised |
| currency | VARCHAR(5) | Bid currency |
| total_bid_value | DECIMAL(15,2) | Total bid amount |
| tracking_key | VARCHAR(100) | Composite tracking key |

---

### 14. BID_LINE
Line-level pricing in a vendor's bid (one row per RFQ line).

| Column | Type | Meaning |
|--------|------|---------|
| bid_id | VARCHAR(15) FK→BID_SUBMISSION | Parent bid |
| rfq_id | VARCHAR(15) FK→RFQ_EVENT | RFQ reference |
| line_id | VARCHAR(5) FK→RFQ_LINE | Which RFQ line |
| unit_price | DECIMAL(11,2) | Vendor quoted price per unit |
| lead_time_days | INTEGER | Promised delivery lead time |
| technical_compliance | CHAR(1) | Y=meets spec, N=exception |

---

### 15. AWARD_DECISION
Final decision — which vendor won the RFQ and for how much.
**Tracking key:** `AWARD@{rfq_id}@{supplier_id}@{award_date}`

| Column | Type | Meaning |
|--------|------|---------|
| award_id | VARCHAR(15) PK | Award record identifier |
| rfq_id | VARCHAR(15) FK→RFQ_EVENT | Which RFQ |
| awarded_supplier_id | VARCHAR(10) FK→VENDOR | Winning vendor |
| award_datetime | DATETIME | When award was made |
| award_status | VARCHAR(20) | Awarded/Pending/Cancelled |
| awarded_value | DECIMAL(15,2) | Final awarded amount |
| currency | VARCHAR(5) | Currency |
| justification | VARCHAR(500) | Reason for selection |
| tracking_key | VARCHAR(100) | Composite tracking key |

---

## Domain 3 — Budget (4 Tables)

### 16. BUDGET_HEADER
Top-level budget for a fiscal year and owner (dept / project / BU).
**Tracking key:** `BUDGET@{fiscal_year}@{owner_id}@{period}`

| Column | Type | Meaning |
|--------|------|---------|
| budget_id | VARCHAR(15) PK | Unique budget identifier |
| fiscal_year | VARCHAR(4) | Fiscal year (e.g. FY2024) |
| status | VARCHAR(20) | Draft/Approved/Frozen |
| owner_id | VARCHAR(12) | Budget owner |
| currency | VARCHAR(5) | Budget currency |
| total_budget_amount | DECIMAL(15,2) | Sum of all allocations |
| approved_date | DATE | When budget was approved |
| tracking_key | VARCHAR(100) | Composite tracking key |

---

### 17. BUDGET_DIMENSION
Defines what each budget bucket covers (BU + cost center + project + category).

| Column | Type | Meaning |
|--------|------|---------|
| budget_id | VARCHAR(15) FK→BUDGET_HEADER | Parent budget |
| dimension_key_id | VARCHAR(20) PK | Unique dimension ID |
| business_unit_id | VARCHAR(10) | Business unit |
| cost_center_id | VARCHAR(10) | Cost center |
| project_id | VARCHAR(20) | Project code |
| category_id | VARCHAR(9) | Material group (maps to PO) |

---

### 18. BUDGET_ALLOCATION
Amount allocated to each dimension. Supports revisions via version numbers.

| Column | Type | Meaning |
|--------|------|---------|
| budget_id | VARCHAR(15) FK→BUDGET_HEADER | Parent budget |
| dimension_key_id | VARCHAR(20) FK→BUDGET_DIMENSION | Which bucket |
| version_number | INTEGER | 1=Original, 2=Revision |
| budget_amount | DECIMAL(15,2) | Allocated amount |
| allocated_date | DATE | When set |
| allocated_by | VARCHAR(12) | Who set this |

---

### 19. BUDGET_CONTROL_RULES
Rules that govern what happens when spend nears or exceeds budget.

| Column | Type | Meaning |
|--------|------|---------|
| budget_id | VARCHAR(15) FK→BUDGET_HEADER | Which budget |
| check_stage | VARCHAR(10) | PR / PO / Invoice — when check fires |
| control_type | VARCHAR(20) | Hard=block, Soft=warn, Advisory=log |
| tolerance_percent | DECIMAL(5,2) | Allowed overage % |
| active_flag | CHAR(1) | Y=active, N=disabled |

---

## Domain 4 — Analytics (3 Tables)

### 20. P2P_LIFECYCLE
One row per PO summarizing the complete timeline from PR to Payment.

| Column | Type | Meaning |
|--------|------|---------|
| po_id | VARCHAR(10) PK | PO number |
| vendor_id | VARCHAR(10) | Vendor code |
| pr_date | DATE | PR creation date |
| po_date | DATE | PO creation date |
| scheduled_delivery_date | DATE | Committed delivery date |
| grn_date | DATE | Goods received date |
| invoice_date | DATE | Invoice posted date |
| payment_date | DATE | Payment made date |
| pr_to_po_days | INTEGER | Days: PR to PO |
| po_to_grn_days | INTEGER | Days: PO to GRN |
| grn_to_invoice_days | INTEGER | Days: GRN to Invoice |
| invoice_to_payment_days | INTEGER | Days: Invoice to Payment |
| total_cycle_days | INTEGER | Days: PR to Payment |
| delivery_delay_days | INTEGER | Days late vs scheduled |
| process_path | VARCHAR(20) | IDEAL_1/2/3/4 or OUTLIER |
| anomaly_count | INTEGER | Anomalies flagged |

---

### 21. ANOMALY_FLAGS
Each anomaly detected — one row per instance.

| Column | Type | Meaning |
|--------|------|---------|
| flag_id | VARCHAR(20) PK | Unique flag ID |
| po_id | VARCHAR(10) FK→PO | PO with the anomaly |
| anomaly_code | VARCHAR(30) | Code (see table below) |
| detected_date | DATE | When flagged |
| severity | VARCHAR(10) | HIGH / MEDIUM / LOW |
| description | VARCHAR(500) | Human-readable explanation |

| Anomaly Code | What It Means | Severity |
|-------------|---------------|---------|
| SPLIT_PO | PO split across vendors to stay under approval threshold | HIGH |
| PRICE_CHANGE | Unit price changed after PO release | HIGH |
| QTY_INCREASE | Quantity increased after PO release | MEDIUM |
| LATE_GRN | GRN posted > 30 days after PO date | MEDIUM |
| NO_PR | PO created without a PR (maverick buying) | HIGH |
| VENDOR_BLOCK | PO raised against a blocked vendor | HIGH |
| DUPLICATE_INV | Same invoice amount posted twice | HIGH |
| BACKDATED_PO | PO document date is earlier than PR date | MEDIUM |
| EXCESS_GRN | Goods received exceed ordered quantity | MEDIUM |
| PAYMENT_BEFORE_GRN | Payment made before goods received | HIGH |
| ROUND_AMOUNT | Suspiciously round invoice value | LOW |
| SINGLE_SOURCE | No RFQ done for high-value PO | MEDIUM |
| FREQ_AMENDMENT | More than 3 changes on single PO | MEDIUM |

---

### 22. KPI_SUMMARY
Pre-computed KPI results — one row per KPI per period, stored for fast dashboard queries.

| Column | Type | Meaning |
|--------|------|---------|
| kpi_id | VARCHAR(30) PK | KPI code + period |
| dashboard | VARCHAR(20) | Procurement/Financial/Leadership/Vendor/Utilization |
| kpi_name | VARCHAR(100) | KPI display name |
| period | VARCHAR(10) | Mon-YYYY |
| kpi_value | DECIMAL(15,4) | Computed value |
| unit | VARCHAR(20) | INR / % / Days / Count |
| threshold | VARCHAR(50) | Target or limit |
| status | VARCHAR(10) | GREEN / AMBER / RED |

---

## KPI Definitions — All 5 Dashboards

### Dashboard 1: Procurement (8 KPIs)
**Users:** Procurement Managers | **Refresh:** Weekly

| # | KPI | Formula | Target |
|---|-----|---------|--------|
| P1 | Total PO Value MTD | SUM(PO.net_order_value) WHERE document_date IN current month AND deletion_indicator <> 'L' | — |
| P2 | Active PO Count | COUNT(DISTINCT PO.purchasing_document) WHERE delivery_completed <> 'X' AND deletion_indicator <> 'L' | — |
| P3 | High-Value PO Count | COUNT(DISTINCT PO) WHERE net_order_value > 10,000,000 AND deletion_indicator <> 'L' | Configurable |
| P4 | PR-to-PO Conversion Time | AVG(DATEDIFF(PO.document_date, PR.delivery_date)) WHERE PO.purchase_requisition = PR.purchase_requisition | <= 5 days |
| P5 | PO Cycle Time (Create to Approve) | AVG(DATEDIFF(release_date, document_date)) WHERE release_indicator = 'X' | <= 3 days |
| P6 | PO Deletion Rate MTD | COUNT(PO) WHERE deletion_indicator = 'L' AND document_date IN current month | <= 5/month |
| P7 | PO Amendment Rate | COUNT(DISTINCT changed POs) / COUNT(DISTINCT all POs) x 100 | < 15% |
| P8 | Open PR Aging > 7 days | COUNT(PR) WHERE release_status='X' AND days since release > 7 AND no matching PO exists | <= 10 PRs |

---

### Dashboard 2: Financial (8 KPIs)
**Users:** Finance Team | **Refresh:** Monthly

| # | KPI | Formula | Target |
|---|-----|---------|--------|
| F1 | Total Spend YTD | SUM(INVOICE.amount_local_ccy) WHERE posting_date in fiscal year | Within budget |
| F2 | Budget Utilization % | (Total Spend YTD / Total Budget Allocated) x 100 | <= 100% |
| F3 | Three-Way Match Rate | COUNT(invoices where PO qty = GRN qty = Invoice qty) / COUNT(all PO invoices) x 100 | > 95% |
| F4 | Invoice Processing Time | AVG(DATEDIFF(INVOICE.posting_date, INVOICE.vendor_invoice_date)) | <= 5 days |
| F5 | Payment On-Time Rate | COUNT(PAYMENT where paid on or before due_date) / COUNT(all PAYMENT) x 100 | > 90% |
| F6 | Days Payable Outstanding | AVG(DATEDIFF(PAYMENT.posting_date, INVOICE.posting_date)) | Per policy |
| F7 | Open Invoice Aging | SUM(INVOICE.amount_local_ccy) WHERE clearing_doc IS NULL (unpaid) | Minimize |
| F8 | Early Payment Discount Capture | SUM(PAYMENT.discount_taken) / SUM(eligible discount amount) x 100 | > 80% |

---

### Dashboard 3: Leadership (8 KPIs)
**Users:** CXO / Leadership | **Refresh:** Monthly

| # | KPI | Formula | Target |
|---|-----|---------|--------|
| L1 | Portfolio Gross Margin % | (Total Revenue - Total Cost) / Total Revenue x 100 | Benchmarked |
| L2 | Total Procurement Value YTD | SUM(PO.net_order_value) WHERE document_date in fiscal year | Within plan |
| L3 | Strategic Risk Index | Weighted: vendor concentration 40% + anomaly rate 30% + compliance gap 30% | < 0.30 |
| L4 | Cost Savings Realized YTD | SUM((PR.valuation_price - PO.net_order_price) x PO.order_quantity) WHERE savings > 0 | Maximize |
| L5 | Vendor Concentration Risk | SUM(top-3 vendors spend) / SUM(all vendors spend) x 100 | < 40% |
| L6 | Maverick PO Rate | COUNT(PO where purchase_requisition IS NULL) / COUNT(all PO) x 100 | < 5% |
| L7 | End-to-End P2P Cycle Time | AVG(P2P_LIFECYCLE.total_cycle_days) | <= 30 days |
| L8 | Procurement ROI | (Cost Savings + Efficiency Gains) / Procurement Function Cost x 100 | > 300% |

---

### Dashboard 4: Vendor (8 KPIs)
**Users:** Procurement Managers | **Refresh:** Monthly

| # | KPI | Formula | Target |
|---|-----|---------|--------|
| V1 | Total Active Vendors | COUNT(VENDOR where purchasing_block blank AND deletion_flag blank) | Track trend |
| V2 | Compliance Pass Rate | COUNT(fully compliant vendors) / COUNT(all vendors) x 100 | > 95% |
| V3 | OTIF Rate | COUNT(GRN where on-time AND full qty) / COUNT(all GRN) x 100 | > 85% |
| V4 | Average Delivery Delay | AVG(GRN.posting_date - expected_delivery_date) WHERE late only | <= 3 days |
| V5 | Quantity Variance Rate | COUNT(GRN where received < 97% of scheduled) / COUNT(all GRN) x 100 | < 5% |
| V6 | Vendor Spend Share % | SUM(PO.net_order_value) per vendor / SUM(all PO spend) x 100 | Top-10 ranked |
| V7 | Payment Block Vendor Count | COUNT(VENDOR where payment_block = '*') | 0 ideal |
| V8 | Vendor Change Frequency | COUNT(CHANGE_LOG where object_class='KRED') per vendor per period | <= 2/month |

---

### Dashboard 5: Utilization (6 KPIs)
**Users:** IT / Resource Managers | **Refresh:** Monthly

| # | KPI | Formula | Target |
|---|-----|---------|--------|
| U1 | Total IT Spend YTD | SUM(PO.net_order_value) WHERE material_group IN (IT, CLOUD, LICENSE, SOFTWARE) in fiscal year | Within IT budget |
| U2 | License Utilization Rate | (Active Users / Total Licenses from PO) x 100 — needs license system feed | > 80% |
| U3 | Cost Per Active User | Annual license cost per tool / Active users per tool | Benchmarked |
| U4 | Underutilized License Count | COUNT(tools where License Utilization Rate < 50%) | <= 5 tools |
| U5 | Upcoming Renewals 60 days | COUNT(PO where expected_delivery_date within 60 days AND IT category) | Tracked |
| U6 | Potential Monthly Savings | SUM(annual_cost x (1 - utilization_rate)) / 12 WHERE utilization < 80% | Maximize |

---

## Process Mining — Ideal Paths

| Path | Step Sequence | When Used |
|------|--------------|-----------|
| IDEAL_1 | PR → PO → GRN → Invoice → Payment | Standard goods purchase |
| IDEAL_2 | PR → PO → Invoice → Payment | Service PO (no GRN required) |
| IDEAL_3 | RFQ → BID → AWARD → PO → GRN → Invoice → Payment | Strategic / high-value sourcing |
| IDEAL_4 | PR → PO → GRN → PO_Invoice (3-way match) → Payment | Full 3-way match flow |

Any PO not matching one of these = **OUTLIER** — anomaly rules are applied.

---

## ETL Pipeline

| Step | Action | Output |
|------|--------|--------|
| 1. Upload | User uploads CSV or Excel extract | Raw files in staging |
| 2. Detect | System maps file to table by column headers | File → table assignment |
| 3. Validate | Check mandatory columns, types, date formats | Validation report |
| 4. Load | Insert into source tables | Row counts per table |
| 5. Lifecycle | Join PR + PO + GRN + Invoice + Payment per PO | P2P_LIFECYCLE populated |
| 6. Events | Generate one event row per P2P activity | PROCESS_EVENTS populated |
| 7. KPIs | Run KPI formulas, store results | KPI_SUMMARY populated |
| 8. Anomalies | Check 13 anomaly rules, flag outliers | ANOMALY_FLAGS populated |

---

## Source → Table Mapping

| File / Extract | Loads Into |
|----------------|-----------|
| PR extract | PURCHASE_REQUISITION |
| PO extract (header + line) | PURCHASE_ORDER |
| Delivery schedule | PO_DELIVERY_SCHEDULE |
| GRN extract | GOODS_RECEIPT |
| PO Invoice | PO_INVOICE |
| General Invoice | INVOICE |
| Payment extract | PAYMENT |
| Vendor master | VENDOR_MASTER |
| Change log | CHANGE_LOG |
| RFQ export | RFQ_EVENT + RFQ_LINE + RFQ_SUPPLIER_INVITE |
| Bid data | BID_SUBMISSION + BID_LINE + AWARD_DECISION |
| Budget export | BUDGET_HEADER + BUDGET_DIMENSION + BUDGET_ALLOCATION + BUDGET_CONTROL_RULES |
