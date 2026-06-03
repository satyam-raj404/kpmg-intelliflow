# Vendor Performance Dashboard — KPI SQL Queries

SAP source tables: `08_Vendor_Master` → `vendor_master`, `02_PO_Dump` → `po_dump`,  
`03_PO_Delivery_Dump` → `po_delivery_dump`, `04_GRN_Dump` → `grn_dump`, `09_Change_Log` → `change_log`

**5 Block Flags for Active Vendor status:**

| Field | Table | SAP Field | Blocked Value |
|-------|-------|-----------|---------------|
| `central_purchasing_block` | vendor_master | LFA1-SPERR | `X` |
| `central_posting_block` | vendor_master | LFA1-SPERM | `X` |
| `deletion_flag_central` | vendor_master | LFA1-LOEVM | `X` |
| `payment_block` | vendor_master | LFB1-ZAHLS | `*` |
| `posting_block_cc` | vendor_master | LFB1-SPERR | `X` |

---

## KPI 1 — Total Active Vendors

**Business question:** How many vendors are currently active?  
**Target:** —  **Unit:** Count

```sql
-- All 5 block flags must be clear for a vendor to be active
SELECT COUNT(DISTINCT vendor) AS active_vendor_count
FROM vendor_master
WHERE (central_purchasing_block IS NULL OR central_purchasing_block NOT IN ('X'))
  AND (central_posting_block    IS NULL OR central_posting_block    NOT IN ('X'))
  AND (deletion_flag_central    IS NULL OR deletion_flag_central    NOT IN ('X'))
  AND (payment_block            IS NULL OR payment_block            NOT IN ('*'))
  AND (posting_block_cc         IS NULL OR posting_block_cc         NOT IN ('X'));
```

---

## KPI 2 — Vendor Compliance Rate & Breakdown

**Business question:** What % of vendors are fully compliant? What is the active/non-active/type mix?  
**Target:** > 95%  **Unit:** % + breakdown counts

```sql
-- Compliance Rate: vendors with all 5 blocks clear / total
SELECT
    COUNT(CASE WHEN (central_purchasing_block IS NULL OR central_purchasing_block NOT IN ('X'))
                AND (central_posting_block   IS NULL OR central_posting_block   NOT IN ('X'))
                AND (deletion_flag_central   IS NULL OR deletion_flag_central   NOT IN ('X'))
                AND (payment_block           IS NULL OR payment_block           NOT IN ('*'))
                AND (posting_block_cc        IS NULL OR posting_block_cc        NOT IN ('X'))
               THEN 1 END) * 100.0
    / NULLIF(COUNT(*), 0) AS compliance_rate_pct
FROM vendor_master;

-- Vendor Breakdown (active / blocked / type / MSME)
SELECT
    SUM(CASE WHEN (central_purchasing_block IS NULL OR central_purchasing_block NOT IN ('X'))
              AND (central_posting_block   IS NULL OR central_posting_block   NOT IN ('X'))
              AND (deletion_flag_central   IS NULL OR deletion_flag_central   NOT IN ('X'))
              AND (payment_block           IS NULL OR payment_block           NOT IN ('*'))
              AND (posting_block_cc        IS NULL OR posting_block_cc        NOT IN ('X'))
             THEN 1 ELSE 0 END)           AS active_count,
    SUM(CASE WHEN central_purchasing_block = 'X'
               OR payment_block           = '*'
               OR central_posting_block   = 'X'
               OR posting_block_cc        = 'X'
               OR deletion_flag_central   = 'X'
             THEN 1 ELSE 0 END)           AS blocked_count,
    SUM(CASE WHEN UPPER(COALESCE(vendor_type,'')) = 'ONE_TIME'      THEN 1 ELSE 0 END) AS one_time,
    SUM(CASE WHEN UPPER(COALESCE(vendor_type,'')) = 'DOMESTIC'      THEN 1 ELSE 0 END) AS domestic,
    SUM(CASE WHEN UPPER(COALESCE(vendor_type,'')) = 'INTERNATIONAL' THEN 1 ELSE 0 END) AS international,
    SUM(CASE WHEN msme_flag IN ('M', 'S')                           THEN 1 ELSE 0 END) AS msme_count,
    COUNT(*) AS total
FROM vendor_master;
-- vendor_type: DOMESTIC / INTERNATIONAL / ONE_TIME (LFA1 account group derived)
-- msme_flag:   M = Micro, S = Small enterprise
```

---

## KPI 3 — On-Time Delivery Rate (OTIF)

**Business question:** What % of fully-delivered POs were received on or before the expected date?  
**Target:** > 90%  **Unit:** %

```sql
-- Numerator:   delivery-completed PO lines with GRN on or before expected delivery date
-- Denominator: all delivery-completed PO lines (delivery_completed = 'X')
-- CRITICAL: Both numerator and denominator must filter delivery_completed='X'
--           to keep the rate between 0–100%

SELECT
    COUNT(DISTINCT CASE
        WHEN grn.posting_date <= pod.expected_delivery_date
        THEN po.purchasing_document || '|' || po.item
    END) * 100.0
    / NULLIF(COUNT(DISTINCT po.purchasing_document || '|' || po.item), 0)
    AS otif_rate_pct
FROM po_dump po
JOIN po_delivery_dump pod
  ON pod.purchasing_document = po.purchasing_document
 AND pod.item               = po.item
JOIN grn_dump grn
  ON grn.purchasing_document = po.purchasing_document
 AND grn.item               = po.item
 AND grn.debit_credit_ind   = 'S'
WHERE po.delivery_completed = 'X';
-- delivery_completed = EKPO-ELIKZ ('X' = vendor confirmed all items delivered)
-- expected_delivery_date = EKET-EINDT (delivery schedule line date)
-- GRN posting_date = EKBE-BUDAT (goods receipt posting date)
-- debit_credit_ind = 'S' filters out GRN returns (H = return to vendor)
```

---

## KPI 4 — Average Delivery Delay

**Business question:** By how many days is delivery typically late?  
**Target:** ≤ 3 days  **Unit:** Days

```sql
-- Late deliveries only (posting_date > expected_delivery_date)
-- Grouped across all vendors; can be extended with GROUP BY grn.purchasing_document → po.vendor

SELECT AVG(
    julianday(grn.posting_date) - julianday(pod.expected_delivery_date)
) AS avg_delivery_delay_days
FROM po_delivery_dump pod
JOIN grn_dump grn
  ON grn.purchasing_document = pod.purchasing_document
 AND grn.item               = pod.item
WHERE grn.debit_credit_ind = 'S'
  AND grn.posting_date > pod.expected_delivery_date;
-- Only includes late deliveries (positive delay)
-- early/on-time deliveries excluded to avoid diluting the delay metric

-- Per-vendor breakdown:
SELECT po.vendor, po.vendor_name,
       AVG(julianday(grn.posting_date) - julianday(pod.expected_delivery_date)) AS avg_delay,
       COUNT(*) AS late_deliveries
FROM po_dump po
JOIN po_delivery_dump pod ON pod.purchasing_document = po.purchasing_document AND pod.item = po.item
JOIN grn_dump grn ON grn.purchasing_document = po.purchasing_document AND grn.item = po.item
WHERE grn.debit_credit_ind = 'S' AND grn.posting_date > pod.expected_delivery_date
GROUP BY po.vendor, po.vendor_name
ORDER BY avg_delay DESC;
```

---

## KPI 5 — Quantity Variance Rate

**Business question:** What % of PO lines show short-supply vs ordered quantity?  
**Target:** < 5%  **Unit:** %

```sql
-- Uses net GRN quantity: SUM(S receipts) - SUM(H returns) per PO line
-- Already computed in pr_po_grn_invoice.grn_quantity (fact table)
-- No tolerance threshold — any shortfall counts as variance

SELECT
    COUNT(CASE
        WHEN COALESCE(f.grn_quantity, 0) < CAST(f.po_quantity AS REAL)
        THEN 1
    END) * 100.0
    / NULLIF(COUNT(CASE WHEN f.grn_quantity IS NOT NULL THEN 1 END), 0)
    AS qty_variance_rate_pct
FROM pr_po_grn_invoice f
WHERE f.purchasing_document IS NOT NULL
  AND f.po_quantity IS NOT NULL AND f.po_quantity > 0;
-- grn_quantity = net of debit_credit_ind: S quantities - H (return) quantities
-- Multiple GRNs per PO line are automatically summed in the fact table

-- Direct calculation (without fact table):
SELECT
    COUNT(CASE WHEN net.net_grn_qty < po.order_quantity THEN 1 END) * 100.0
    / NULLIF(COUNT(*), 0) AS qty_variance_rate_pct
FROM po_dump po
JOIN (
    SELECT purchasing_document, item,
           SUM(CASE WHEN debit_credit_ind = 'S' THEN CAST(quantity AS REAL)
                    WHEN debit_credit_ind = 'H' THEN -CAST(quantity AS REAL)
                    ELSE 0 END) AS net_grn_qty
    FROM grn_dump
    GROUP BY purchasing_document, item
) net ON net.purchasing_document = po.purchasing_document AND net.item = po.item
WHERE po.deletion_indicator IS NULL OR po.deletion_indicator NOT IN ('L', 'X');
```

---

## KPI 6 — Vendor Spend Share (Top 10)

**Business question:** What share of total procurement spend goes to each vendor?  
**Target:** Top vendor < 20%  **Unit:** % + INR

```sql
-- Top-10 vendors by PO net_order_value share
SELECT
    po.vendor,
    COALESCE(vm.vendor_name, po.vendor_name, po.vendor) AS vendor_name,
    SUM(CAST(po.net_order_value AS REAL))               AS spend_inr,
    SUM(CAST(po.net_order_value AS REAL)) * 100.0
        / NULLIF(SUM(SUM(CAST(po.net_order_value AS REAL))) OVER (), 0) AS spend_share_pct
FROM po_dump po
LEFT JOIN vendor_master vm ON po.vendor = vm.vendor
WHERE po.deletion_indicator IS NULL OR po.deletion_indicator NOT IN ('L', 'X')
GROUP BY po.vendor, vendor_name
ORDER BY spend_inr DESC
LIMIT 10;
-- net_order_value = EKPO-NETWR (PO line item net value in INR)
-- Threshold alert: any single vendor > 20% of total spend = concentration risk
```

---

## KPI 9 — MSME Vendor Count

**Business question:** How many active vendors are Micro or Small enterprises?  
**Target:** —  **Unit:** Count

```sql
SELECT COUNT(*) AS msme_vendor_count
FROM vendor_master
WHERE msme_flag IN ('M', 'S')
  AND (deletion_flag_central IS NULL OR deletion_flag_central = '');
-- msme_flag = 'M' → Micro Enterprise (MSMED Act)
-- msme_flag = 'S' → Small Enterprise (MSMED Act)
-- Excludes vendors with central deletion flag set
```

---

## Removed KPIs

| KPI | Reason |
|-----|--------|
| KPI 7 — Payment Block Vendors | Redundant with KPI 2 (VENDOR_BREAKDOWN.blocked count covers this) |
| KPI 8 — Vendor Master Change Frequency | Operational log; no KRED records in current dataset |

---

## SAP Field Mapping

| Column (DB) | SAP Field | Table | Meaning |
|-------------|-----------|-------|---------|
| `central_purchasing_block` | SPERR | LFA1 | `X` = vendor blocked for purchasing |
| `central_posting_block` | SPERM | LFA1 | `X` = blocked for financial postings |
| `deletion_flag_central` | LOEVM | LFA1 | `X` = vendor marked for deletion |
| `payment_block` | ZAHLS | LFB1 | `*` = payment blocked for company code |
| `posting_block_cc` | SPERR | LFB1 | `X` = posting blocked at company-code level |
| `vendor_type` | Derived from KTOKK | LFA1 | DOMESTIC / INTERNATIONAL / ONE_TIME |
| `msme_flag` | Custom field | LFA1 | M = Micro, S = Small enterprise |
| `expected_delivery_date` | EINDT | EKET | Scheduled delivery date per schedule line |
| `delivery_completed` | ELIKZ | EKPO | `X` = all items fully delivered |
| `debit_credit_ind` | SHKZG | EKBE | `S` = goods received, `H` = goods returned |
| `posting_date` (GRN) | BUDAT | EKBE | Actual date goods were posted in SAP |
| `object_class` (change_log) | OBJECTCLAS | CDHDR | `KRED` = vendor master change |
