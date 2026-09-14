# IntelliSource P2P — Simplified Data Model Review

> **What this document is:** A clean, stripped-down version of the P2P data model with only the tables and fields that are truly needed. Every cut is explained. Every kept field has a purpose.

---

## What Was Cut and Why

| Removed | Reason |
|---------|--------|
| Tracking Key as Primary Key | Caused collisions. Two POs for same vendor same day = same key. Replaced with actual document numbers. |
| BUYER_GROUP table | One lookup field. Did not need its own table. Kept as plain text on PO. |
| DOCUMENT_TYPE table | Same — one text field on PO is enough. |
| ITEM_TYPE table | One text field on PO_LINE is enough. |
| MOVEMENT_TYPE table | One text field on GOODS_RECEIPT is enough. |
| TAX_CODE table | One text field on PO_LINE is enough. |
| RELEASE_GROUP table | Merged into two plain text fields on PO. |
| RELEASE_STRATEGY table | Same. |
| PLANT table | Plant name and country kept as text fields directly on PO_LINE. |
| DELIVERY_SCHEDULE table | Moved `expected_delivery_date` and `planned_qty` into PO_LINE. Separate table added complexity without benefit for core KPIs. |
| VENDOR_MASTER_CC | Fields moved directly into VENDOR table. The separate entity was referenced but never defined. |

---

## The Simplified Model — 14 Tables Total

```
SOURCE TABLES (8)         COMPUTED TABLES (3)       APP TABLES (3)
────────────────          ──────────────────         ──────────────
VENDOR                    P2P_LIFECYCLE              ACTIONS
REQUISITION               PROCESS_EVENTS             UPLOAD_LOG
PURCHASE_ORDER            KPI_CACHE                  AUDIT_LOG
PO_LINE
GOODS_RECEIPT
INVOICE
PAYMENT
CHANGE_LOG
```

One reference table kept: **PAYMENT_TERMS** (because net_days is used in DPO formula and due date calculation — cannot be a text field).

One reference table kept: **USER** (needed for SOD checks and audit trail).

---

## Table-by-Table — What Each Table Holds and Why

---

### 1. VENDOR
**What it is:** One row per supplier. Master record. Everything else links back here.

**Fields kept:**
- `vendor_id` — the unique code (PK). Example: `732880`
- `vendor_name` — legal name
- `country`, `city`, `postal_code`, `region` — location
- `account_type` — Domestic / Foreign / One-Time
- `tax_number_pan` — 10-character India PAN number *(kept separate from GSTIN)*
- `tax_number_gstin` — 15-character GSTIN number *(these two cannot share one field — different lengths and compliance uses)*
- `purchasing_blocked` — Y = cannot receive new orders
- `payment_blocked` — Y = payments frozen
- `deleted` — Y = removed from system
- `company_code` — which legal entity this vendor belongs to (from SAP LFB1)
- `payment_terms_id` → FK to PAYMENT_TERMS
- `payment_block_cc` — company-code level payment block
- `onboard_date` — when vendor was added
- `onboarded_by` → FK to USER

**Fields removed from original:**
- `tracking_key` as PK → replaced by `vendor_id`
- `period` → not stored; calculated on-the-fly in dashboards

**KPIs this feeds:**
- Active Vendor Count, Blocked Vendor Count, Vendor Compliance Rate, Vendor Change Frequency

---

### 2. REQUISITION
**What it is:** A purchase request raised internally before any supplier is involved.

**Fields kept:**
- `pr_id` — PR document number (PK). Example: `10003478`
- `pr_line` — line item within the PR
- `description` — what is being requested
- `category` — material or service category (text field, no separate lookup table)
- `plant` — where goods are needed (text field)
- `quantity` — how many units
- `estimated_price` — price estimate per unit
- `required_by` — date goods or services are needed
- `created_on` — date PR was created *(used as start of PR_TO_PO_DAYS clock)*
- `created_by` → FK to USER *(used in SOD check)*
- `release_status` — Pending / Released / Rejected
- `release_date` — date PR was approved *(used in OPEN_PR_AGING KPI)*
- `release_by` → FK to USER *(who approved — needed for SOD check)*
- `deleted` — Y = PR cancelled
- `buyer_group` — which procurement team raised this (text field)
- `suggested_vendor_id` → FK to VENDOR *(optional preferred supplier)*

**Fields removed from original:**
- `tracking_key` as PK → replaced by `pr_id + pr_line`
- `converted_to_po_id` → **removed entirely** because one PR can generate many POs. Link goes the other way: PO_LINE points back to REQUISITION.
- `release_strategy` reference table → simplified to text fields `release_status` and `release_by`

**KPIs this feeds:**
- PR to PO Days, Open PR Aging, PR Release Missing (anomaly), SOD Violation (anomaly)

---

### 3. PURCHASE_ORDER
**What it is:** The official order sent to a supplier. Header-level information only (who, when, approval status).

**Fields kept:**
- `po_id` — PO document number (PK). Example: `2000001883`
- `company_code` — which legal entity is buying
- `vendor_id` → FK to VENDOR
- `buyer_group` — which procurement team (text field)
- `buyer_org` — purchasing organization (text field)
- `payment_terms_id` → FK to PAYMENT_TERMS
- `document_type` — Standard PO / Framework / Contract (text field)
- `document_date` — date PO was created *(KPI: PO_CYCLE_TIME start, MTD filters)*
- `created_on` — system creation date *(different from document_date — document_date can be backdated)*
- `created_by` → FK to USER
- `release_status` — Pending / Released
- `release_date` — date PO was approved *(KPI: PO_CYCLE_TIME end)*
- `release_by` → FK to USER *(who approved — needed for SOD check)*
- `deleted` — Y = PO cancelled *(KPI: PO_DELETION_MTD)*

**Fields removed from original:**
- `tracking_key` as PK → replaced by `po_id`
- `release_group`, `release_strategy` reference FKs → simplified to `release_status` and `release_by`

**Why document_date AND created_on both stay:**
- `document_date` — user-entered, can be backdated (e.g., Monday's PO entered Tuesday with Monday's date)
- `created_on` — system-stamped, cannot be changed, tamper-evident
- Backdating is a compliance flag. You need both to detect it.

**KPIs this feeds:**
- Total PO Value MTD, Active PO Count, PO Deletion MTD, PO Cycle Time, PO Amendment Rate, Maverick Buying Rate

---

### 4. PO_LINE
**What it is:** Each line item within a PO. One PO can have many lines (different products, quantities, prices).

**Fields kept:**
- `po_id` → FK to PURCHASE_ORDER *(composite PK with line_id)*
- `line_id` — line number (composite PK)
- `pr_id` → FK to REQUISITION *(link back to originating PR — this is the correct place for this link)*
- `pr_line` — originating PR line number
- `description` — what is being ordered
- `category` — material/service category (text)
- `plant` — delivery location (text)
- `item_type` — Standard / Service / Limit (text) *(important: Service items do not need GRN)*
- `quantity` — units ordered
- `unit_price` — price per unit *(baseline for PRICE_VARIANCE check)*
- `net_value` — total line value = quantity × unit_price *(KPI: TOTAL_PO_VALUE_MTD)*
- `tax_code` — GST tax code (text)
- `expected_delivery_date` — planned delivery date *(moved here from DELIVERY_SCHEDULE)*
- `planned_qty` — quantity expected by that date *(moved here from DELIVERY_SCHEDULE)*
- `delivered_qty` — quantity received so far *(updated when GRN is posted)*
- `delivery_complete` — Y = all goods received *(KPI: ACTIVE_PO_COUNT)*
- `deleted` — Y = line cancelled

**What moved here from the original model:**
- `expected_delivery_date` and `planned_qty` from DELIVERY_SCHEDULE table (entire table eliminated)

**Why DELIVERY_SCHEDULE was removed:**
- For standard POs, each line has one delivery date. The separate table added joins with no benefit.
- Scheduling agreements (multiple delivery dates per line) are an edge case — handle separately if needed later.

**KPIs this feeds:**
- Total PO Value MTD, Active PO Count, High-Value PO Count, OTIF, Price Variance, Quantity Variance

---

### 5. GOODS_RECEIPT (GRN)
**What it is:** Record of goods or services physically received against a PO line.

**Fields kept:**
- `grn_id` — GRN document number (PK)
- `grn_line` — line within GRN document
- `po_id` → FK to PURCHASE_ORDER
- `po_line` → FK to PO_LINE
- `movement_type` — 101 = receive, 102 = reversal, 122 = return (text)
- `direction` — In = received, Out = returned
- `po_history_category` — must be `E` for goods receipt *(used to distinguish from Invoice in combined SAP extract)*
- `receipt_date` — date goods were received *(KPI: DELAYED_GRN, OTIF)*
- `entry_date` — date entered in system *(can differ from receipt_date)*
- `quantity` — quantity received or returned
- `value` — value in local currency (INR)
- `vendor_invoice_ref` — vendor's delivery note or invoice reference

**Fields removed from original:**
- `tracking_key` as PK → replaced by `grn_id + grn_line`
- `period` → calculated on-the-fly

**KPIs this feeds:**
- OTIF Rate, Average Delivery Delay, GRN Return Rate, 3-Way Match

---

### 6. INVOICE
**What it is:** What the vendor billed you. Can be a regular invoice, a credit memo (reversal), or a debit memo.

**Fields kept:**
- `invoice_id` — invoice document number (PK)
- `invoice_line` — line within invoice
- `po_id` → FK to PURCHASE_ORDER *(null for non-PO invoices)*
- `po_line` → FK to PO_LINE *(null for non-PO invoices)*
- `vendor_id` → FK to VENDOR *(direct link — covers non-PO invoices too)*
- `po_history_category` — must be `Q` for invoice *(distinguishes from GRN in SAP extract)*
- `vendor_invoice_ref` — vendor's own invoice number *(links to GRN for 3-way match)*
- `invoice_date` — date invoice was posted
- `due_date` — date payment is due *(ADDED — essential for DPO and on-time payment rate)*
- `quantity` — invoiced quantity *(KPI: 3-way match quantity check)*
- `value` — invoiced amount *(KPI: PRICE_VARIANCE, total invoice amount)*
- `tax_amount` — GST/tax portion of invoice
- `direction` — Invoice / Credit Memo
- `payment_terms_id` → FK to PAYMENT_TERMS *(used to calculate due_date)*
- `payment_block` — is this invoice blocked from payment?
- `cleared_by_payment_id` → FK to PAYMENT *(null until paid)*
- `entry_date` — date entered in system

**Key addition vs original model:**
- `due_date` — was missing. Without it, DPO and On-Time Payment Rate both return wrong numbers.
- `vendor_id` direct FK — covers non-PO invoices (rent, utilities, subscriptions)
- `po_history_category` — needed to split SAP's combined transaction history into GRN vs Invoice

**KPIs this feeds:**
- 3-Way Match Rate, Price Variance Rate, DPO, On-Time Payment Rate, Open Invoice Aging

---

### 7. PAYMENT
**What it is:** The actual cash transfer to a vendor. Clears one or more invoices.

**Fields kept:**
- `payment_id` — payment document number (PK)
- `vendor_id` → FK to VENDOR
- `company_code` — which entity made the payment
- `payment_date` — date payment was made *(KPI: DPO, Invoice-to-Payment Days)*
- `clearing_date` — date invoice was formally cleared *(can differ from payment_date in SAP)*
- `cleared_invoice_id` → FK to INVOICE *(which invoice this payment clears)*
- `amount` — net amount paid *(KPI: TOTAL_SPEND_YTD = actual cash out)*
- `discount_taken` — early payment discount claimed
- `payment_method` — Bank Transfer / RTGS / Cheque
- `bank_reference` — UTR or wire reference number
- `house_bank` — which bank account was used

**Fields removed from original:**
- `tracking_key` as PK → replaced by `payment_id`

**Important clarification on Total Spend:**
- `SUM(payment.amount)` = **Actual Spend** (cash paid out)
- `SUM(po_line.net_value)` = **Committed Spend** (what was ordered)
- These are different numbers. Both are useful. They should be two separate KPIs, not one.

**KPIs this feeds:**
- Total Actual Spend YTD, DPO, On-Time Payment Rate, Invoice-to-Payment Days, Discount Capture Rate

---

### 8. CHANGE_LOG
**What it is:** An audit record of every edit made to a PR, PO, or Vendor record.

**Fields kept:**
- `change_id` — unique change record number (PK)
- `document_type` — PR / PO / Vendor *(what kind of document was changed)*
- `pr_id` → FK to REQUISITION *(null unless document_type = PR)*
- `po_id` → FK to PURCHASE_ORDER *(null unless document_type = PO)*
- `vendor_id` → FK to VENDOR *(null unless document_type = Vendor)*
- `changed_by` → FK to USER
- `change_date` — date of change
- `change_time` — time of change
- `action_code` — SAP transaction used (ME22N, ME29N, XK01)
- `table_changed` — which database table was edited (EBAN, EKKO, EKPO, LFA1)
- `field_changed` — which field was changed (NETPR, MENGE, FRGZU, etc.)
- `old_value` — value before change
- `new_value` — value after change *(KPI: PRICE_VARIANCE detection)*
- `change_type` — Insert / Update / Delete

**Key design fix vs original:**
- Original had one polymorphic `document_id FK → REQUISITION or PURCHASE_ORDER or VENDOR` — impossible to enforce at DB level.
- Fixed to three separate nullable FKs: `pr_id`, `po_id`, `vendor_id`. Exactly one is filled per row.

**KPIs this feeds:**
- PO Amendment Rate, Excessive Amendments (anomaly), Vendor Change Frequency, SOD Violation (anomaly)

---

### 9. PAYMENT_TERMS *(kept as reference table)*
**What it is:** Lookup table for payment term codes and their net day values.

**Why this cannot be a text field:**
- `net_days` is used in a formula: `due_date = invoice_date + net_days`
- If payment terms is just text like "NET30", the formula cannot run without parsing the string.

**Fields:**
- `terms_id` — code like NET30, N045, IMMD (PK)
- `description` — plain text like "Net 30 Days"
- `net_days` — integer number of days until payment is due

---

### 10. USER *(kept as reference table)*
**What it is:** Every person or system account in the application.

**Why this cannot be a text field:**
- `created_by`, `release_by`, `changed_by` all reference this table.
- SOD checks compare user IDs across tables — need a single source of truth.

**Fields:**
- `user_id` — login username (PK)
- `full_name` — display name
- `account_status` — Active / Locked / Expired *(KPI: inactive user compliance)*
- `user_type` — Human / System / Background
- `valid_to` — account expiry date
- `last_login` — last active date

---

### 11. P2P_LIFECYCLE *(computed — rebuilt on every upload)*
**What it is:** One pre-joined row per PO that shows the complete journey from PR to Payment with all cycle times calculated.

**Why it exists:**
- Dashboard KPIs need to join 5 tables (PR → PO → GRN → Invoice → Payment) on every page load.
- Pre-computing this once per upload makes dashboards fast.

**Key fields:**
- `po_id` PK
- `pr_id` — null if maverick buy
- `vendor_id`
- All 5 dates: `pr_created_on`, `pr_release_date`, `po_created_on`, `po_release_date`, `first_receipt_date`, `first_invoice_date`, `first_payment_date`
- All cycle time integers: `pr_to_po_days`, `po_to_receipt_days`, `receipt_to_invoice_days`, `invoice_to_payment_days`, `total_cycle_days`
- All flag integers: `is_maverick` (1/0), `has_return` (1/0), `has_credit_memo` (1/0)
- `po_value`, `receipt_amount`, `invoice_amount`, `payment_amount`

**How cycle times are calculated:**

| Field | Formula |
|-------|---------|
| `pr_to_po_days` | PO `document_date` − PR `created_on` |
| `po_to_receipt_days` | First GRN `receipt_date` − PO `release_date` |
| `receipt_to_invoice_days` | First Invoice `invoice_date` − First GRN `receipt_date` |
| `invoice_to_payment_days` | Payment `payment_date` − Invoice `due_date` *(not invoice_date)* |
| `total_cycle_days` | Payment `payment_date` − PR `created_on` |

---

### 12. PROCESS_EVENTS *(computed — rebuilt on every upload)*
**What it is:** One row per step per PO. Tracks which of the 8 steps happened, when, and whether anything went wrong.

**Key fields:**
- `po_id` FK, `step_number` (1–8), `step_name`, `step_date`, `done_by`
- `path_type` — Ideal / Outlier

**Anomaly flags moved to separate table ANOMALY_FLAGS:**
- `po_id`, `anomaly_code`, `severity`, `detected_at`
- One row per violation — no comma-separated text

**Why anomaly flags need their own table:**
- Searching `WHERE anomaly_code = 'SOD_VIOLATION'` runs on an indexed column — fast.
- Searching `WHERE anomaly_flags LIKE '%SOD_VIOLATION%'` on a text field scans every row — slow and error-prone.

---

### 13. KPI_CACHE *(computed — rebuilt on every upload)*
**What it is:** Pre-calculated KPI values. Dashboards read from here only.

**Primary key fix:** `(dashboard, kpi_code, period)` — all three together.
Without `period` in the PK, you can only store one time period per KPI (e.g., cannot store both MTD and YTD for the same KPI).

**Fields:**
- `dashboard` — procurement / financial / leadership / vendor
- `kpi_code` — e.g., TOTAL_PO_VALUE_MTD
- `period` — MTD / YTD / Current / All
- `kpi_name` — readable label
- `value` — the number
- `unit` — INR / % / Days / Count
- `target` — threshold for Red/Amber/Green colouring
- `change_pct` — % change vs prior period
- `last_updated` — when recalculated

---

### 14. ACTIONS *(app table)*
**What it is:** Kanban-style action cards for the procurement team to track follow-up tasks.

**Fields kept — with two additions:**
- `action_id` PK (auto-increment)
- `action_type` — Rate Revision / Vendor Negotiation / Compliance Audit
- `description`
- `assigned_to` → FK to USER
- `created_by` → FK to USER *(was missing in original — who created this action?)*
- `created_at` *(was missing in original)*
- `linked_po_id` → FK to PURCHASE_ORDER *(optional)*
- `linked_vendor_id` → FK to VENDOR *(optional)*
- `expected_saving`, `actual_saving`
- `status` — Open / In Progress / Under Review / Closed
- `due_date`, `closed_at`

---

## The Complete Relationship Map (Plain English)

```
VENDOR ──────────────── supplies ──────────────────► PURCHASE_ORDER
VENDOR ──────────────── receives payment from ─────► PAYMENT
VENDOR ──────────────── master data changes in ────► CHANGE_LOG

REQUISITION ──────────── becomes lines in ─────────► PO_LINE (via pr_id on PO_LINE)
REQUISITION ──────────── changes tracked in ────────► CHANGE_LOG

PURCHASE_ORDER ────────── has many lines in ────────► PO_LINE
PURCHASE_ORDER ────────── has goods received in ────► GOODS_RECEIPT
PURCHASE_ORDER ────────── has invoices in ──────────► INVOICE
PURCHASE_ORDER ────────── changes tracked in ───────► CHANGE_LOG

PO_LINE ──────────────── has goods received in ─────► GOODS_RECEIPT
PO_LINE ──────────────── has invoices in ───────────► INVOICE

INVOICE ──────────────── cleared by ───────────────► PAYMENT

USER ──────────────────── creates/approves all documents
PAYMENT_TERMS ────────── sets due date rules for VENDOR + INVOICE + PURCHASE_ORDER
```

---

## All KPI Formulas (Plain Language)

### Procurement Dashboard

| KPI | Formula | Source Tables |
|-----|---------|--------------|
| Total PO Value (MTD) | Sum of all PO line net values where document_date is in current month and line not deleted | PO_LINE + PURCHASE_ORDER |
| Active PO Count | Count of distinct POs where delivery_complete = N and deleted = N | PURCHASE_ORDER + PO_LINE |
| High-Value PO Count | Count of POs where total line value > 1 Crore (10,000,000) and not deleted | PO_LINE |
| PR to PO Days | Average of (PO document_date − PR created_on) for linked PR/PO pairs | P2P_LIFECYCLE |
| PO Approval Cycle | Average of (PO release_date − PO document_date) for released POs | PURCHASE_ORDER |
| PO Deletions (MTD) | Count of POs where deleted = Y and document_date is in current month | PURCHASE_ORDER |
| PO Amendment Rate | Count of POs with change log entries ÷ total POs × 100 | PURCHASE_ORDER + CHANGE_LOG |
| Open PR Aging | Count of released PRs with no linked PO after 7+ days, not deleted | REQUISITION + PO_LINE |

### Financial Dashboard

| KPI | Formula | Source Tables |
|-----|---------|--------------|
| Committed Spend (YTD) | Sum of PO line net values for current fiscal year, not deleted | PO_LINE + PURCHASE_ORDER |
| Actual Spend (YTD) | Sum of all payments made in current fiscal year | PAYMENT |
| 3-Way Match Rate | Count of PO lines where GRN qty ≥ Invoice qty AND price difference < 5% ÷ total invoiced lines × 100 | PO_LINE + GOODS_RECEIPT + INVOICE |
| Invoice Cycle Time | Average of (Invoice date − GRN receipt date) | P2P_LIFECYCLE |
| Payment On-Time Rate | Count of payments made on or before invoice due date ÷ total payments × 100 | PAYMENT + INVOICE |
| DPO (Days Payable Outstanding) | Average of (payment_date − invoice due_date) — positive = paid late, negative = paid early | PAYMENT + INVOICE |
| Open Invoice Aging | Sum of invoice values where cleared_by_payment_id is null, grouped by age bucket (0-30, 31-60, 61-90, 90+ days) | INVOICE |
| Discount Capture Rate | Sum of discount_taken ÷ (Sum of discount_taken + missed discounts) × 100 | PAYMENT + INVOICE |

### Leadership Dashboard

| KPI | Formula | Source Tables |
|-----|---------|--------------|
| Total Actual Spend YTD | Sum of all payments in current year | PAYMENT |
| Maverick Buying Rate | Count of POs with no upstream PR ÷ total POs × 100 | P2P_LIFECYCLE |
| End-to-End Cycle Time | Average of total_cycle_days | P2P_LIFECYCLE |
| Vendor Concentration | Sum of net values for top 5 vendors ÷ total net value × 100 | PO_LINE + PURCHASE_ORDER |
| Process Compliance Rate | Count of POs with path_type = Ideal ÷ total POs × 100 | PROCESS_EVENTS |
| Active Anomaly Count | Count of distinct POs with any entry in ANOMALY_FLAGS | ANOMALY_FLAGS |
| High-Risk Financial Exposure | Sum of PO line values for POs flagged as MAVERICK or SOD_VIOLATION or SPLIT_PO | PO_LINE + ANOMALY_FLAGS |
| Blocked Vendor Spend | Sum of PO line values where vendor purchasing_blocked = Y | PO_LINE + PURCHASE_ORDER + VENDOR |

### Vendor Dashboard

| KPI | Formula | Source Tables |
|-----|---------|--------------|
| OTIF Rate | Count of GRNs where receipt_date ≤ expected_delivery_date AND quantity ≥ planned_qty ÷ total GRNs × 100 | GOODS_RECEIPT + PO_LINE |
| Active Vendor Count | Count of vendors where deleted = N and purchasing_blocked = N and has open PO | VENDOR + PURCHASE_ORDER |
| Blocked Vendor Count | Count of vendors where purchasing_blocked = Y or payment_blocked = Y | VENDOR |
| GRN Return Rate | Sum of returned quantity ÷ Sum of received quantity × 100, per vendor | GOODS_RECEIPT |
| Average Delivery Delay | Average of (receipt_date − expected_delivery_date) where receipt_date > expected_delivery_date only | GOODS_RECEIPT + PO_LINE |
| Vendor Change Frequency | Count of change log entries where document_type = Vendor, last 90 days, per vendor | CHANGE_LOG |
| 3-Way Match Rate | Count of invoiced PO lines where GRN quantity ≥ invoice quantity AND price variance < 5% ÷ total invoiced lines × 100 | PO_LINE + GOODS_RECEIPT + INVOICE |
| Price Variance Rate | Count of invoiced lines where (invoice unit price − PO unit price) ÷ PO unit price > 5% ÷ total invoiced lines × 100 | INVOICE + PO_LINE |

---

## All 13 Anomaly Detection Rules

These run after every data upload and write results to the ANOMALY_FLAGS table.

| Rule | Severity | How It Is Detected |
|------|----------|--------------------|
| **Maverick PO** | HIGH | PO exists with no linked PR (no rows in PO_LINE have a pr_id for this PO) |
| **PO Before PR Approved** | HIGH | PO document_date is earlier than the source PR release_date |
| **Receipt Before PO Approved** | HIGH | GRN receipt_date is earlier than PO release_date |
| **Invoice Without Receipt** | HIGH | Invoice exists for PO line but no GOODS_RECEIPT exists — **skip this check if item_type = Service** |
| **PO Never Approved** | HIGH | PO exists but release_status is still Pending (release_date is null) |
| **PR Never Approved** | HIGH | PR has a linked PO but PR release_status is still Pending |
| **SOD Violation** | HIGH | PR created_by = PO release_by (same person raised the need and approved the order) OR PR created_by = PR release_by (person approved their own PR) |
| **PO Splitting Suspected** | HIGH | Multiple POs to same vendor in same month, each individually below approval threshold, but sum is above threshold |
| **Duplicate PO Suspected** | MEDIUM | Same vendor + same description + same quantity, two POs within 7 days |
| **PR Approved After PO Created** | MEDIUM | PR release_date is later than PO document_date (approval was retrospective) |
| **Late Delivery (15+ days)** | MEDIUM | GRN receipt_date is more than 15 days after PO_LINE expected_delivery_date |
| **Price Mismatch** | MEDIUM | (Invoice value ÷ Invoice quantity − PO unit_price) ÷ PO unit_price > 5% |
| **Too Many Amendments** | LOW | More than 3 CHANGE_LOG entries for same PO before release_date |

**Note on Invoice Without Receipt:**
If `item_type = Service` or `item_type = Limit`, no GRN is expected — services are confirmed via Service Entry Sheet, not goods receipt. Do NOT flag these as anomalies.

---

## ETL Pipeline — 7 Steps

```
Step 1 — File Upload
  User uploads CSV or Excel
  System reads column headers and identifies which table the file belongs to
  A unique batch ID is created and saved to UPLOAD_LOG

Step 2 — Validation
  Mandatory fields must not be empty
  Numbers must be numbers, dates must be valid dates
  Vendor ID must exist in VENDOR table
  PO ID must exist in PURCHASE_ORDER (for GRN, Invoice, Payment files)
  Rows that fail → logged in UPLOAD_LOG with reason
  Rows that pass → move to Step 3

Step 3 — Load Into Source Tables
  Each row is inserted or updated using its natural key
  Natural keys: po_id+line_id for PO_LINE, grn_id+grn_line for GRN, etc.
  If same natural key already exists, the old row is replaced

Step 4 — Rebuild P2P_LIFECYCLE
  For each PO, join: PR → PO → GRN → Invoice → Payment
  Calculate all 5 cycle time columns
  Set the 3 flag columns: is_maverick, has_return, has_credit_memo

Step 5 — Rebuild PROCESS_EVENTS + ANOMALY_FLAGS
  For each PO, determine which of the 8 steps happened and when
  Sort steps by date to get the actual sequence
  Compare sequence against the 4 correct process paths
  Mark as Ideal or Outlier
  Run all 13 anomaly rules — write violations to ANOMALY_FLAGS table

Step 6 — Recompute KPI_CACHE
  Run all 32 KPI formulas across 4 dashboards
  Write results to KPI_CACHE with period, value, target, and trend
  Dashboards only ever read from KPI_CACHE — no live queries on source tables

Step 7 — Notify Dashboards
  Signal dashboards to refresh their KPI cards (WebSocket push or polling)
  Mark UPLOAD_LOG batch status as Completed
  Write entry to AUDIT_LOG
```

---

## The 4 Correct Process Paths

A PO that does not match one of these is marked Outlier in PROCESS_EVENTS.

| Path | Steps | When It Applies |
|------|-------|----------------|
| 1 | PR Created → PR Approved → PO Created → PO Approved → Goods Received → Invoice Posted | Cleanest path — no edits needed |
| 2 | PR Created → PR Amended → PR Approved → PO Created → PO Amended → PO Approved → Goods Received → Invoice Posted | Both PR and PO needed changes before approval |
| 3 | PR Created → PR Approved → PO Created → PO Amended → PO Approved → Goods Received → Invoice Posted | Only the PO needed changes |
| 4 | PR Created → PR Amended → PR Approved → PO Created → PO Approved → Goods Received → Invoice Posted | Only the PR needed changes |

---

## Summary — What Changed From the Original Model

| Area | Original Problem | Fix Applied |
|------|-----------------|-------------|
| Primary Keys | Tracking key caused collisions | Real document numbers used as PKs |
| DELIVERY_SCHEDULE table | Separate table with one delivery date per line — unnecessary join | Merged into PO_LINE as two fields |
| 9 reference tables | Most had one field — over-engineered | Collapsed to text fields on parent tables |
| VENDOR_MASTER_CC | Referenced but never defined | Fields moved directly into VENDOR |
| converted_to_po_id on REQUISITION | Scalar FK breaks for split PRs | Removed — link goes via PO_LINE.pr_id |
| KPI_CACHE PK | Only kpi_code — cannot store multiple periods | PK changed to (dashboard, kpi_code, period) |
| RELEASE_STRATEGY PK | strategy_id alone — allows cross-group duplicates | Composite PK (group_id, strategy_id) |
| anomaly_flags text field | Comma-separated text — slow and fragile | Normalized to ANOMALY_FLAGS table |
| DPO formula | Used invoice_date — wrong | Changed to use due_date |
| 3-way match formula | Checked price only | Added quantity check |
| SOD check | Only one of three violations detected | Three checks: PR-approver, PO-approver, PR-creator vs PO-approver |
| Total Spend ambiguity | PO value labeled as "spend" | Split into Committed Spend (PO) and Actual Spend (Payment) |
| ACTIONS table | Missing created_by and created_at | Both fields added |
| Invoice Without Receipt | Fired for service POs incorrectly | Skip check when item_type = Service |
| due_date | Not in INVOICE or PAYMENT | Added to INVOICE; calculated from invoice_date + payment terms |
