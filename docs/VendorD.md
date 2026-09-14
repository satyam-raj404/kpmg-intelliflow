# Vendor Dashboard — KPI Documentation

> **Status**: Completed  
> **File**: `backend/services/kpi_engine.py`  
> **Function**: `def _vendor(conn, FY, MTD, cc_cfg="", company_code="ALL")`  
> **DB Table**: `kpi_results` with `dashboard='vendor'`

---

## V1 — Active Vendor Count

Vendors with all 5 blocking indicators clear.

```sql
SELECT COUNT(DISTINCT vendor)
FROM vendor_master
WHERE (central_purchasing_block IS NULL OR central_purchasing_block NOT IN ('X'))
  AND (central_posting_block    IS NULL OR central_posting_block    NOT IN ('X'))
  AND (deletion_flag_central    IS NULL OR deletion_flag_central    NOT IN ('X'))
  AND (payment_block            IS NULL OR payment_block            NOT IN ('*'))
  AND (posting_block_cc         IS NULL OR posting_block_cc         NOT IN ('X'))
```

- Output: single numeric count
- Unit: `count`

---

## V2 — Vendor Type Breakdown (JSON)

Categorises vendors into active, blocked, one-time, domestic, international, MSME.

```sql
SELECT
    SUM(CASE WHEN (central_purchasing_block IS NULL OR central_purchasing_block='')
               AND (deletion_flag_central IS NULL OR deletion_flag_central='')
               AND (payment_block IS NULL OR payment_block='') THEN 1 ELSE 0 END),
    SUM(CASE WHEN central_purchasing_block='X' OR payment_block='*'
                  OR central_posting_block='X' THEN 1 ELSE 0 END),
    SUM(CASE WHEN vendor_type='ONE_TIME'      THEN 1 ELSE 0 END),
    SUM(CASE WHEN vendor_type='DOMESTIC'      THEN 1 ELSE 0 END),
    SUM(CASE WHEN vendor_type='INTERNATIONAL' THEN 1 ELSE 0 END),
    SUM(CASE WHEN msme_flag IN ('M','S')      THEN 1 ELSE 0 END),
    COUNT(*)
FROM vendor_master
```

- Output: JSON `{"active": N, "blocked": N, "one_time": N, "domestic": N, "international": N, "msme": N, "total": N}`
- Unit: `json`

---

## V3 — Vendor Delivery Lead Time (days)

Average days from PO `delivery_date` to first GRN `entry_date` per vendor.

**Vendor-wise detail (top 25 by avg_days):**
```sql
WITH grn_first AS (
    SELECT purchasing_document, item,
           MIN(entry_date) AS first_grn_date
    FROM grn_dump
    WHERE debit_credit_ind = 'S'
      AND entry_date IS NOT NULL AND entry_date != ''
    GROUP BY purchasing_document, item
)
SELECT po.vendor,
       COALESCE(vm.vendor_name, po.vendor_name, po.vendor) AS vendor_name,
       ROUND(AVG(julianday(gf.first_grn_date) - julianday(po.delivery_date)), 1) AS avg_days,
       COUNT(*) AS po_lines
FROM po_dump po
JOIN grn_first gf ON gf.purchasing_document = po.purchasing_document
                 AND gf.item               = po.item
LEFT JOIN vendor_master vm ON po.vendor = vm.vendor
WHERE (po.deletion_indicator IS NULL OR po.deletion_indicator NOT IN ('L','X'))
  AND po.delivery_date IS NOT NULL AND po.delivery_date != ''
  AND {_cc_sql}
GROUP BY po.vendor, vendor_name
ORDER BY avg_days DESC
LIMIT 25
```

**Overall average:**
```sql
WITH grn_first AS (
    SELECT purchasing_document, item,
           MIN(entry_date) AS first_grn_date
    FROM grn_dump
    WHERE debit_credit_ind = 'S'
      AND entry_date IS NOT NULL AND entry_date != ''
    GROUP BY purchasing_document, item
)
SELECT ROUND(AVG(julianday(gf.first_grn_date) - julianday(po.delivery_date)), 1)
FROM po_dump po
JOIN grn_first gf ON gf.purchasing_document = po.purchasing_document
                 AND gf.item               = po.item
WHERE (po.deletion_indicator IS NULL OR po.deletion_indicator NOT IN ('L','X'))
  AND po.delivery_date IS NOT NULL AND po.delivery_date != ''
  AND {_cc_sql}
```

- `value_numeric`: overall avg days
- `value_text`: JSON array `[{"vendor", "name", "avg_days", "po_lines"}, ...]`
- Unit: `days`

---

## V4 — Average Delivery Delay with Buckets (days, late only)

Delay = first GRN `creation_date` − `expected_delivery_date` (positive only).  
Counts at item level. Deleted POs excluded.

```sql
WITH grn_first AS (
    SELECT purchasing_document, item,
           MIN(creation_date) AS first_grn_date
    FROM grn_dump
    WHERE debit_credit_ind = 'S'
      AND creation_date IS NOT NULL AND creation_date != ''
    GROUP BY purchasing_document, item
),
delays AS (
    SELECT pod.purchasing_document, pod.item,
           julianday(gf.first_grn_date)
           - julianday(pod.expected_delivery_date) AS delay_days
    FROM po_delivery_dump pod
    JOIN grn_first gf
      ON gf.purchasing_document = pod.purchasing_document
     AND gf.item               = pod.item
    JOIN po_dump po
      ON po.purchasing_document = pod.purchasing_document
     AND po.item               = pod.item
    WHERE pod.expected_delivery_date IS NOT NULL
      AND pod.expected_delivery_date != ''
      AND (po.deletion_indicator IS NULL
           OR po.deletion_indicator NOT IN ('L','X'))
      AND julianday(gf.first_grn_date)
        - julianday(pod.expected_delivery_date) > 0
)
SELECT
    COUNT(*)                                        AS total_items,
    ROUND(AVG(delay_days), 1)                       AS avg_delay,
    SUM(CASE WHEN delay_days <= 10  THEN 1 ELSE 0 END) AS b_0_10,
    SUM(CASE WHEN delay_days > 10  AND delay_days <= 30  THEN 1 ELSE 0 END) AS b_10_30,
    SUM(CASE WHEN delay_days > 30  AND delay_days <= 60  THEN 1 ELSE 0 END) AS b_30_60,
    SUM(CASE WHEN delay_days > 60  AND delay_days <= 90  THEN 1 ELSE 0 END) AS b_60_90,
    SUM(CASE WHEN delay_days > 90  THEN 1 ELSE 0 END) AS b_90_plus
FROM delays
```

- `value_numeric`: avg delay days
- `value_text`: JSON `{"total_delayed_items": N, "buckets": {"0-10 days": N, "10-30 days": N, "30-60 days": N, "60-90 days": N, "90+ days": N}}`
- Unit: `days`

---

## V5 — Quantity Variance Rate (%)

Percentage of PO items where net GRN quantity < 95% of PO order quantity.

```sql
SELECT COUNT(CASE
    WHEN COALESCE(f.grn_quantity, 0) < CAST(f.po_quantity AS REAL) * 0.95
    THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0)
FROM pr_po_grn_invoice f
WHERE f.purchasing_document IS NOT NULL
  AND f.po_quantity IS NOT NULL
```

- Output: single numeric percentage
- Unit: `%`

---

## V_DELIVERY_EXPECTED — Vendor Delivery Expected Days (avg)

Average days from `expected_delivery_date` (po_delivery_dump) to first GRN `creation_date`, per vendor.

**Vendor-wise detail:**
```sql
WITH grn_first AS (
    SELECT purchasing_document, item,
           MIN(creation_date) AS first_grn_date
    FROM grn_dump
    WHERE debit_credit_ind = 'S'
      AND creation_date IS NOT NULL AND creation_date != ''
    GROUP BY purchasing_document, item
),
vendor_delivery AS (
    SELECT po.vendor,
           COALESCE(vm.vendor_name, po.vendor_name, po.vendor) AS vendor_name,
           julianday(gf.first_grn_date)
           - julianday(pod.expected_delivery_date) AS diff_days,
           pod.purchasing_document,
           pod.item
    FROM po_delivery_dump pod
    JOIN grn_first gf
      ON gf.purchasing_document = pod.purchasing_document
     AND gf.item               = pod.item
    JOIN po_dump po
      ON po.purchasing_document = pod.purchasing_document
     AND po.item               = pod.item
    LEFT JOIN vendor_master vm ON po.vendor = vm.vendor
    WHERE pod.expected_delivery_date IS NOT NULL
      AND pod.expected_delivery_date != ''
      AND (po.deletion_indicator IS NULL
           OR po.deletion_indicator NOT IN ('L','X'))
)
SELECT vendor, vendor_name,
       ROUND(AVG(diff_days), 1) AS avg_days,
       COUNT(*) AS po_lines
FROM vendor_delivery
GROUP BY vendor, vendor_name
ORDER BY avg_days DESC
```

**Overall average:**
```sql
WITH grn_first AS (
    SELECT purchasing_document, item,
           MIN(creation_date) AS first_grn_date
    FROM grn_dump
    WHERE debit_credit_ind = 'S'
      AND creation_date IS NOT NULL AND creation_date != ''
    GROUP BY purchasing_document, item
)
SELECT ROUND(AVG(julianday(gf.first_grn_date)
          - julianday(pod.expected_delivery_date)), 1)
FROM po_delivery_dump pod
JOIN grn_first gf
  ON gf.purchasing_document = pod.purchasing_document
 AND gf.item               = pod.item
JOIN po_dump po
  ON po.purchasing_document = pod.purchasing_document
 AND po.item               = pod.item
WHERE pod.expected_delivery_date IS NOT NULL
  AND pod.expected_delivery_date != ''
  AND (po.deletion_indicator IS NULL
       OR po.deletion_indicator NOT IN ('L','X'))
```

- `value_numeric`: overall avg days
- `value_text`: JSON array `[{"vendor", "vendor_name", "avg_days", "po_lines"}, ...]`
- Unit: `days`

---

## V6 — Top-10 Vendors by Spend Share (JSON)

Top 10 vendors ranked by total PO net order value, with spend and share percentage.

```sql
SELECT SUM(CAST(net_order_value AS REAL)) FROM po_dump
WHERE deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X')
```

```sql
SELECT po.vendor,
       COALESCE(vm.vendor_name, po.vendor_name, po.vendor) AS name,
       SUM(CAST(po.net_order_value AS REAL)) AS spend
FROM po_dump po
LEFT JOIN vendor_master vm ON po.vendor = vm.vendor
WHERE po.deletion_indicator IS NULL OR po.deletion_indicator NOT IN ('L','X')
GROUP BY po.vendor
ORDER BY spend DESC
LIMIT 10
```

- `value_numeric`: None
- `value_text`: JSON array `[{"vendor", "name", "spend", "share_pct"}, ...]`
- Unit: `json`

---

## V7 — Blocked Vendor Count

Vendors with any blocking indicator set.

```sql
SELECT COUNT(DISTINCT vendor) FROM vendor_master
WHERE central_purchasing_block = 'X'
   OR central_posting_block    = 'X'
   OR payment_block            = '*'
   OR posting_block_cc         = 'X'
```

- Output: single numeric count
- Unit: `count`

---

## V8 — MSME Vendor Count

Vendors flagged as Micro, Small, or Medium Enterprise.

```sql
SELECT COUNT(*) FROM vendor_master WHERE msme_flag IN ('M','S')
```

- Output: single numeric count
- Unit: `count`

---

## V9 — Vendor Compliance Rate (%)

Percentage of vendors with all 5 blocking indicators clear.

```sql
SELECT COUNT(*) FROM vendor_master
WHERE (central_purchasing_block IS NULL OR central_purchasing_block = '')
  AND (central_posting_block    IS NULL OR central_posting_block    = '')
  AND (deletion_flag_central    IS NULL OR deletion_flag_central    = '')
  AND (payment_block            IS NULL OR payment_block            = '')
  AND (posting_block_cc         IS NULL OR posting_block_cc         = '')
```

```sql
SELECT COUNT(*) FROM vendor_master
```

- Formula: `(compliant / total) × 100`
- Output: single numeric percentage
- Unit: `%`

---

## V10 — Vendor Master Changes MTD

Distinct vendors whose master record was modified this month.

```sql
SELECT COUNT(DISTINCT object_id)
FROM change_log
WHERE object_class = 'KRED'
  AND change_date >= {MTD}
```

- `MTD` = first day of current month (derived from `ref_date`)
- Output: single numeric count
- Unit: `count`

---

## V_AMENDMENT_RATE — Vendor Details Amendment Rate (%)

Percentage of active (unblocked) vendors whose critical master fields were created or updated.

**Numerator** — unique vendors with critical-field changes:
```sql
SELECT COUNT(DISTINCT object_id)
FROM change_log
WHERE object_class = 'KRED'
  AND table_name IN ('LFA1', 'LFB1', 'LFBK')
  AND LOWER(field_name) IN (
      'name', 'bank account details', 'payment terms',
      'gst number', 'vat number', 'tax number', 'address'
  )
  AND change_indicator IN ('E', 'U')
```

**Denominator** — active (unblocked) vendors:
```sql
SELECT COUNT(DISTINCT vendor) FROM vendor_master
WHERE (central_purchasing_block IS NULL OR central_purchasing_block = '')
  AND (central_posting_block    IS NULL OR central_posting_block    = '')
  AND (payment_block            IS NULL OR payment_block            = '')
  AND (deletion_flag_central    IS NULL OR deletion_flag_central    = '')
```

- Formula: `(amended_vendors / active_vendors) × 100`
- Output: single numeric percentage
- Unit: `%`

---

## Chart Data — `compute_chart_data(dashboard="vendor")`

### Monthly OTIF Trend
```sql
SELECT strftime('%Y-%m', grn.posting_date) AS month,
       COUNT(CASE WHEN grn.posting_date <= pod.expected_delivery_date THEN 1 END) * 100.0
       / NULLIF(COUNT(*), 0) AS otif_pct,
       COUNT(*) AS deliveries
FROM grn_dump grn
JOIN po_delivery_dump pod ON grn.purchasing_document = pod.purchasing_document
  AND grn.item = pod.item
WHERE grn.debit_credit_ind = 'S' AND grn.posting_date >= {cutoff}
GROUP BY month ORDER BY month
```

### Compliance Donut
```sql
SELECT
    COUNT(CASE WHEN (central_purchasing_block IS NULL OR central_purchasing_block='')
                AND (payment_block IS NULL OR payment_block='')
                AND (deletion_flag_central IS NULL OR deletion_flag_central='')
               THEN 1 END) AS active,
    COUNT(CASE WHEN central_purchasing_block='X' OR central_posting_block='X' THEN 1 END) AS purchase_blocked,
    COUNT(CASE WHEN payment_block='*' THEN 1 END) AS payment_blocked,
    COUNT(CASE WHEN deletion_flag_central='X' THEN 1 END) AS deleted,
    COUNT(*) AS total
FROM vendor_master
```

### Vendor Type Breakdown
```sql
SELECT vendor_type, COUNT(*) AS cnt
FROM vendor_master
GROUP BY vendor_type ORDER BY cnt DESC
```
