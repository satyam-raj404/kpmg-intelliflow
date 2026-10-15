# Financial Dashboard — KPI SQL Reference

All KPIs computed in `backend/services/kpi_engine.py → _financial()`.  
Company filter: `_cc_sql` = `company_code IN ('xxxx')` or `1=1` (all).  
Stored in `kpi_results` table with `dashboard='financial'` and `company_code` dimension.

---

## F1 — Total Spend YTD (`TOTAL_SPEND_YTD`)

**Logic:** Sum of all invoice values (RE + KR + RN) YTD, D/C signed, both cancellation methods applied.

**Cancellation method (a):** Exclude invoice_doc values that appear as `reverse_invoice` anywhere, and exclude reversal docs themselves.  
**Cancellation method (b):** Exclude (company_code, vendor, vendor_invoice_ref) groups where net amount = 0.

```sql
WITH cancelled AS (
    SELECT DISTINCT reverse_invoice AS doc
    FROM   invoice_dump
    WHERE  reverse_invoice IS NOT NULL AND reverse_invoice != ''
),
net_nonzero AS (
    SELECT company_code || '|' || vendor || '|' || vendor_invoice_ref AS grp
    FROM   invoice_dump
    WHERE  vendor_invoice_ref IS NOT NULL AND vendor_invoice_ref != ''
    GROUP  BY company_code, vendor, vendor_invoice_ref
    HAVING ABS(SUM(CAST(amount_local_ccy AS REAL))) > 0.005
)
SELECT SUM(
    CAST(amount_local_ccy AS REAL)
    * CASE WHEN debit_credit_ind = 'S' THEN 1.0 ELSE -1.0 END
)
FROM   invoice_dump
WHERE  document_type IN ('RE','KR','RN')
  AND  posting_date >= {FY}
  AND  {_cc_sql}
  AND  invoice_doc NOT IN (SELECT doc FROM cancelled)
  AND  (reverse_invoice IS NULL OR reverse_invoice = '')
  AND  (
       vendor_invoice_ref IS NULL OR vendor_invoice_ref = ''
       OR company_code || '|' || vendor || '|' || vendor_invoice_ref
          IN (SELECT grp FROM net_nonzero)
  )
```

**Unit:** INR | **Verified:** ✅

---

## F2 — Invoice Cancellation Rate (`INVOICE_CANCELLATION_RATE`)

**Logic:** Distinct RN (cancellation) documents ÷ distinct all invoice documents × 100.

```sql
SELECT
    COUNT(DISTINCT CASE WHEN document_type = 'RN' THEN invoice_doc END) * 100.0
    / NULLIF(COUNT(DISTINCT invoice_doc), 0)
FROM invoice_dump
WHERE {_cc_sql}
```

**Unit:** % | **Verified:** ✅  
**Note:** No FY date filter — counts across all time. `RN` = SAP cancellation document type.

---

## F3 — 3-Way Match Success Rate (`THREE_WAY_MATCH_RATE`)

**Logic:** PO lines with all 3 legs within ±5% tolerance ÷ total PO lines with invoice × 100.  
- **Materials** (material_type not blank): qty-based comparison  
- **Services** (material_type blank/NULL): amount-based comparison

```sql
WITH po AS (
    SELECT company_code, purchasing_document, item,
           CAST(order_quantity  AS REAL) AS po_qty,
           CAST(net_order_value AS REAL) AS po_amt,
           CASE WHEN material_type IS NOT NULL AND material_type != ''
                THEN 'MATERIAL' ELSE 'SERVICE' END AS item_type
    FROM po_dump
    WHERE {_cc_sql}
      AND (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))
),
grn AS (
    SELECT purchasing_document, item,
           SUM(CAST(quantity         AS REAL)
               * CASE WHEN debit_credit_ind = 'S' THEN 1.0 ELSE -1.0 END) AS grn_qty,
           SUM(CAST(amount_local_ccy AS REAL)
               * CASE WHEN debit_credit_ind = 'S' THEN 1.0 ELSE -1.0 END) AS grn_amt
    FROM grn_dump
    GROUP BY purchasing_document, item
),
inv AS (
    SELECT purchasing_document, item,
           SUM(CAST(quantity         AS REAL)
               * CASE WHEN debit_credit_ind = 'S' THEN 1.0 ELSE -1.0 END) AS inv_qty,
           SUM(CAST(amount_local_ccy AS REAL)
               * CASE WHEN debit_credit_ind = 'S' THEN 1.0 ELSE -1.0 END) AS inv_amt
    FROM po_invoice_dump
    GROUP BY purchasing_document, item
),
combined AS (
    SELECT po.item_type, po.po_qty, po.po_amt,
           COALESCE(grn.grn_qty, 0) AS grn_qty,
           COALESCE(grn.grn_amt, 0) AS grn_amt,
           COALESCE(inv.inv_qty, 0) AS inv_qty,
           COALESCE(inv.inv_amt, 0) AS inv_amt
    FROM po
    JOIN      inv ON inv.purchasing_document = po.purchasing_document
                  AND inv.item               = po.item
    LEFT JOIN grn ON grn.purchasing_document = po.purchasing_document
                  AND grn.item               = po.item
)
SELECT
    COUNT(CASE
        WHEN item_type = 'MATERIAL'
          AND ABS(grn_qty - po_qty)  / NULLIF(ABS(po_qty),  0) <= 0.05
          AND ABS(inv_qty - po_qty)  / NULLIF(ABS(po_qty),  0) <= 0.05
          AND ABS(inv_qty - grn_qty) / NULLIF(ABS(grn_qty), 0) <= 0.05
        THEN 1
        WHEN item_type = 'SERVICE'
          AND ABS(grn_amt - po_amt)  / NULLIF(ABS(po_amt),  0) <= 0.05
          AND ABS(inv_amt - po_amt)  / NULLIF(ABS(po_amt),  0) <= 0.05
          AND ABS(inv_amt - grn_amt) / NULLIF(ABS(grn_amt), 0) <= 0.05
        THEN 1
    END) * 100.0
    / NULLIF(COUNT(*), 0)
FROM combined
```

**Unit:** % | **Verified:** ✅  
**Note:** GRN join is LEFT JOIN — a PO line with no GRN records grn_qty/amt = 0, which fails the tolerance check (correctly not matched). ±5% tolerance agreed in design session.

---

## F4 — Invoice Processing Cycle Time (`INVOICE_PROCESSING_DAYS`)

**Logic:** AVG(payment clearing_date − vendor_invoice_date) for all cleared, non-cancelled invoices.

**Join:** `payment_dump.cleared_invoice = invoice_dump.invoice_doc` + company_code + vendor  
**Note:** `invoice_dump.clearing_doc` ≠ `payment_dump.payment_doc` (different SAP number ranges in source data). Functional link is via `cleared_invoice`.

```sql
WITH cancelled_inv AS (
    SELECT DISTINCT reverse_invoice AS doc
    FROM   invoice_dump
    WHERE  reverse_invoice IS NOT NULL AND reverse_invoice != ''
),
valid_inv AS (
    SELECT company_code, vendor, invoice_doc, vendor_invoice_date
    FROM   invoice_dump
    WHERE  {_cc_sql}
      AND  vendor_invoice_date IS NOT NULL
      AND  (reverse_invoice IS NULL OR reverse_invoice = '')
      AND  invoice_doc NOT IN (SELECT doc FROM cancelled_inv)
),
noncancelled_pay AS (
    SELECT company_code, vendor, payment_doc
    FROM   payment_dump
    GROUP  BY company_code, vendor, payment_doc
    HAVING ABS(SUM(
        CAST(amount_local_ccy AS REAL)
        * CASE WHEN debit_credit_ind = 'S' THEN 1.0 ELSE -1.0 END
    )) > 0.005
),
valid_pay AS (
    SELECT pd.company_code, pd.vendor, pd.clearing_date, pd.cleared_invoice
    FROM   payment_dump pd
    JOIN   noncancelled_pay nc
      ON   nc.payment_doc  = pd.payment_doc
     AND   nc.company_code = pd.company_code
     AND   nc.vendor       = pd.vendor
    WHERE  pd.debit_credit_ind = 'S'
)
SELECT AVG(julianday(vp.clearing_date) - julianday(vi.vendor_invoice_date))
FROM   valid_inv vi
JOIN   valid_pay vp
  ON   vp.cleared_invoice = vi.invoice_doc
 AND   vp.company_code   = vi.company_code
 AND   vp.vendor         = vi.vendor
WHERE  vp.clearing_date IS NOT NULL
```

**Unit:** days | **Verified:** ✅ (with note on join key)

---

## F5 — On-Time Payment Rate (`ON_TIME_PAYMENT_RATE`)

**Logic:** Invoices where clearing_date = due_date ÷ total cleared invoices × 100.  
On-time = paid exactly on due date. due_date loaded directly from invoice_dump column.

```sql
WITH cancelled_inv AS (
    SELECT DISTINCT reverse_invoice AS doc
    FROM   invoice_dump
    WHERE  reverse_invoice IS NOT NULL AND reverse_invoice != ''
),
valid_inv AS (
    SELECT company_code, vendor, invoice_doc, due_date
    FROM   invoice_dump
    WHERE  {_cc_sql}
      AND  due_date IS NOT NULL AND due_date != ''
      AND  (reverse_invoice IS NULL OR reverse_invoice = '')
      AND  invoice_doc NOT IN (SELECT doc FROM cancelled_inv)
),
noncancelled_pay AS (
    SELECT company_code, vendor, payment_doc
    FROM   payment_dump
    GROUP  BY company_code, vendor, payment_doc
    HAVING ABS(SUM(
        CAST(amount_local_ccy AS REAL)
        * CASE WHEN debit_credit_ind = 'S' THEN 1.0 ELSE -1.0 END
    )) > 0.005
),
valid_pay AS (
    SELECT pd.company_code, pd.vendor, pd.clearing_date, pd.cleared_invoice
    FROM   payment_dump pd
    JOIN   noncancelled_pay nc
      ON   nc.payment_doc  = pd.payment_doc
     AND   nc.company_code = pd.company_code
     AND   nc.vendor       = pd.vendor
    WHERE  pd.debit_credit_ind = 'S'
)
SELECT COUNT(CASE WHEN vp.clearing_date = vi.due_date THEN 1 END) * 100.0
       / NULLIF(COUNT(*), 0)
FROM   valid_inv vi
JOIN   valid_pay vp
  ON   vp.cleared_invoice = vi.invoice_doc
 AND   vp.company_code   = vi.company_code
 AND   vp.vendor         = vi.vendor
WHERE  vp.clearing_date IS NOT NULL
```

**Unit:** % | **Verified:** ✅  
**Note:** On-time = `clearing_date = due_date` (exact equality, confirmed in F8 spec review).

---

## F7 — Open Invoice Aging (`OPEN_INVOICE_VALUE`)

**Logic:** Unpaid invoices (clearing_doc IS NULL), cancelled removed, bucketed by (today − due_date).  
Stored as: `value_numeric` = total open amount, `value_text` = JSON bucket breakdown for chart.

**Buckets:** not_yet_due | 0-10d | 10-20d | 20-30d | 30-60d | 60-90d | 90+d

```sql
WITH open_inv AS (
    SELECT
        CAST(amount_local_ccy AS REAL)
            * CASE WHEN debit_credit_ind = 'S' THEN 1.0 ELSE -1.0 END AS signed_amt,
        CAST(julianday('now') - julianday(due_date) AS INTEGER) AS days_overdue
    FROM invoice_dump
    WHERE (clearing_doc IS NULL OR clearing_doc = '')
      AND {_cc_sql}
      AND document_type IN ('RE','KR')
      AND due_date IS NOT NULL AND due_date != ''
      AND (reverse_invoice IS NULL OR reverse_invoice = '')
      AND invoice_doc NOT IN (
          SELECT DISTINCT reverse_invoice FROM invoice_dump
          WHERE reverse_invoice IS NOT NULL AND reverse_invoice != ''
      )
)
SELECT
    SUM(CASE WHEN days_overdue <   0              THEN signed_amt ELSE 0 END),  -- not_yet_due
    SUM(CASE WHEN days_overdue BETWEEN  0 AND  9  THEN signed_amt ELSE 0 END),  -- 0-10d
    SUM(CASE WHEN days_overdue BETWEEN 10 AND 19  THEN signed_amt ELSE 0 END),  -- 10-20d
    SUM(CASE WHEN days_overdue BETWEEN 20 AND 29  THEN signed_amt ELSE 0 END),  -- 20-30d
    SUM(CASE WHEN days_overdue BETWEEN 30 AND 59  THEN signed_amt ELSE 0 END),  -- 30-60d
    SUM(CASE WHEN days_overdue BETWEEN 60 AND 89  THEN signed_amt ELSE 0 END),  -- 60-90d
    SUM(CASE WHEN days_overdue >= 90              THEN signed_amt ELSE 0 END),  -- 90+d
    SUM(signed_amt)                                                              -- total
FROM open_inv
```

**Unit:** INR | **Verified:** ✅

---

## F8 — Payment Timing Breakdown (`EARLY/ON_TIME/LATE_PAYMENT_COUNT` + `PAYMENT_TIMING_SUMMARY`)

**Logic:** Classify each cleared invoice as early / on-time / late based on day_diff = clearing_date − due_date.  
- Early: day_diff < 0 (cleared before due date)  
- On-time: day_diff = 0 (cleared exactly on due date)  
- Late: day_diff > 0 (cleared after due date)

Produces 4 KPI rows: EARLY_PAYMENT_COUNT, ON_TIME_PAYMENT_COUNT, LATE_PAYMENT_COUNT, PAYMENT_TIMING_SUMMARY (JSON).

```sql
WITH cancelled_inv AS (
    SELECT DISTINCT reverse_invoice AS doc
    FROM   invoice_dump
    WHERE  reverse_invoice IS NOT NULL AND reverse_invoice != ''
),
valid_inv AS (
    SELECT company_code, vendor, invoice_doc, due_date
    FROM   invoice_dump
    WHERE  {_cc_sql}
      AND  document_type IN ('RE','KR')
      AND  due_date IS NOT NULL AND due_date != ''
      AND  (reverse_invoice IS NULL OR reverse_invoice = '')
      AND  invoice_doc NOT IN (SELECT doc FROM cancelled_inv)
),
noncancelled_pay AS (
    SELECT company_code, vendor, payment_doc
    FROM   payment_dump
    GROUP  BY company_code, vendor, payment_doc
    HAVING ABS(SUM(
        CAST(amount_local_ccy AS REAL)
        * CASE WHEN debit_credit_ind = 'S' THEN 1.0 ELSE -1.0 END
    )) > 0.005
),
valid_pay AS (
    SELECT pd.company_code, pd.vendor, pd.clearing_date, pd.cleared_invoice
    FROM   payment_dump pd
    JOIN   noncancelled_pay nc
      ON   nc.payment_doc  = pd.payment_doc
     AND   nc.company_code = pd.company_code
     AND   nc.vendor       = pd.vendor
    WHERE  pd.debit_credit_ind = 'S'
),
joined AS (
    SELECT CAST(julianday(vp.clearing_date) - julianday(vi.due_date) AS INTEGER) AS day_diff
    FROM   valid_inv vi
    JOIN   valid_pay vp
      ON   vp.cleared_invoice = vi.invoice_doc
     AND   vp.company_code   = vi.company_code
     AND   vp.vendor         = vi.vendor
    WHERE  vp.clearing_date IS NOT NULL
)
SELECT
    COUNT(CASE WHEN day_diff <  0 THEN 1 END),             -- early_count
    COUNT(CASE WHEN day_diff =  0 THEN 1 END),             -- ontime_count
    COUNT(CASE WHEN day_diff >  0 THEN 1 END),             -- late_count
    AVG(CASE  WHEN day_diff <  0 THEN ABS(day_diff) END),  -- avg_days_early
    AVG(CASE  WHEN day_diff >  0 THEN day_diff      END),  -- avg_days_late
    COUNT(*)                                                -- total
FROM joined
```

**Unit:** count | **Verified:** ✅  
**JSON shape (PAYMENT_TIMING_SUMMARY):**
```json
{ "early": 48, "on_time": 14, "late": 18, "total": 80, "avg_days_early": 2.6, "avg_days_late": 16.8 }
```

---

## F10 — Total Payments YTD (`TOTAL_PAYMENTS_YTD`)

**Logic:** Sum of all payment_dump amounts this FY.

```sql
SELECT SUM(CAST(amount_local_ccy AS REAL))
FROM payment_dump
WHERE posting_date >= {FY}
```

**Unit:** INR | **Verified:** ✅

---

## F11 — Payment-to-PO Ratio (`PAYMENT_TO_PO_RATIO`)

**Logic:** Total Payments YTD ÷ Total PO Value YTD × 100.

```sql
-- Numerator: F10 (TOTAL_PAYMENTS_YTD)
-- Denominator:
SELECT SUM(CAST(net_order_value AS REAL))
FROM po_dump
WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))
  AND document_date >= {FY}
```

**Unit:** % | **Verified:** ✅

---

## F_PR — Approved PR Count YTD (`APPROVED_PR_COUNT`)

**Logic:** Distinct approved PR line items (release_status = X/XX/.../XXXXX) this FY, company filtered.

```sql
SELECT COUNT(DISTINCT purchase_requisition || '|' || item_of_requisition)
FROM pr_dump
WHERE release_status IN ('X','XX','XXX','XXXX','XXXXX')
  AND (deletion_indicator IS NULL OR deletion_indicator = '')
  AND release_date >= {FY}
  AND {_cc_sql}
```

**Unit:** count | **Verified:** ✅  
**Note:** `pr_dump.company_code` must be populated in CSV for company filter to work (currently NULL in test data — all 134 PRs show under ALL company only).

---

## Common Patterns

### Fiscal Year (Indian FY, April start)
```
FY = '{year}-04-01'   where year = ref_year if month >= 4 else ref_year - 1
```

### Cancellation removal (invoices)
```sql
-- Method A: exclude originals that were reversed
invoice_doc NOT IN (SELECT DISTINCT reverse_invoice FROM invoice_dump WHERE reverse_invoice IS NOT NULL AND reverse_invoice != '')
AND (reverse_invoice IS NULL OR reverse_invoice = '')

-- Method B: exclude net-zero groups by cc+vendor+reference
GROUP BY company_code, vendor, vendor_invoice_ref HAVING ABS(SUM(amount)) > 0.005
```

### Reversed payment removal
```sql
noncancelled_pay AS (
    SELECT company_code, vendor, payment_doc
    FROM payment_dump
    GROUP BY company_code, vendor, payment_doc
    HAVING ABS(SUM(amount * CASE WHEN debit_credit_ind='S' THEN 1 ELSE -1 END)) > 0.005
)
```

### Invoice ↔ Payment join
```sql
-- Correct link (clearing_doc ≠ payment_doc in source data):
payment_dump.cleared_invoice = invoice_dump.invoice_doc
AND payment_dump.company_code = invoice_dump.company_code
AND payment_dump.vendor = invoice_dump.vendor
```

### Company code filter
```sql
-- Single company: company_code IN ('1001')
-- All companies:  1=1
```
