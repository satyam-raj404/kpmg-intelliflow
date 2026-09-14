# IntelliSource P2P — Leadership Dashboard

## KPI Definitions, Formulas & SQL Queries

**Dashboard:** Leadership (`/leadership`)
**Target users:** CXO / C-Suite / Executive Management
**Refresh:** On every data upload (auto-recompute)
**Backend KPI codes:** `dashboard = 'leadership'` in `kpi_results` table

---

## KPI Summary Table

| # | KPI Code | KPI Name | Unit | Target |
|---|----------|----------|------|--------|
| L1 | `TOTAL_SPEND_YTD` | Total Procurement Value (YTD) | INR | — |
| L1b | `TOTAL_PO_COUNT_YTD` | Total PO Count (YTD) | count | — |
| L_GRN | `GRN_COUNT_YTD` | GRN Count (YTD) | count | — |
| L_GRN | `GRN_VALUE_YTD` | GRN Value (YTD) | INR | — |
| L_INV | `INVOICE_COUNT_YTD` | Invoice Count (YTD) | count | — |
| L_INV | `INVOICE_VALUE_YTD` | Invoice Value (YTD) | INR | — |
| L_INV_TYPE | `INVOICE_BY_VENDOR_TYPE` | Invoice Summary by Vendor Type | JSON | — |
| L2 | `MAVERICK_BUY_RATE` | Maverick PO Rate | % | < 5% |
| L3 | `E2E_CYCLE_TIME` | End-to-End P2P Cycle Time | days | ≤ 45d |
| L4 | `VENDOR_CONCENTRATION` | Top-3 Vendor Concentration | % | < 40% |
| L4b | `SINGLE_SOURCE_COUNT` | Single Source Procurement Count | count | Minimize |
| L4b | `SINGLE_SOURCE_VALUE` | Single Source Procurement Value | INR | Minimize |
| L5 | `NEGOTIATION_SAVINGS` | Negotiation Savings YTD | INR | Maximize |
| L6 | `SUPPLY_RISK_SCORE` | Supply Chain Risk Score | score 0-100 | Low |
| L7a | `SOD_PO_CREATE_RELEASE` | SOD: PO Create vs Release | count | 0 |
| L7b | `SOD_PO_GRN` | SOD: PO vs GRN | count | 0 |
| L7c | `SOD_GRN_INVOICE` | SOD: GRN vs Invoice | count | 0 |
| L7d | `SOD_INVOICE_PAYMENT` | SOD: Invoice vs Payment | count | 0 |
| L7 | `SOD_CONFLICT_COUNT` | SOD Conflict Count (All) | count | 0 |
| L8 | `PO_GRN_CONVERSION_RATE` | PO to GRN Conversion Rate | % | > 80% |
| L9 | `DUPLICATE_INVOICE_COUNT` | Duplicate Invoice Count | count | 0 |
| L9b | `DUPLICATE_PO_COUNT` | Duplicate PO Count | count | 0 |
| L10 | `HIGH_VALUE_PO_COUNT` | High-Value PO Count | count | Configurable |
| L11a | `PR_AMOUNT_YTD` | PR Amount (YTD) | INR | — |
| L11b | `PR_LINE_COUNT_YTD` | PR Line Count (YTD) | count | — |
| L11c | `PO_LINE_COUNT_YTD` | PO Line Count (YTD) | count | — |
| L11d | `ONE_TIME_VENDOR_COUNT` | One-Time Vendor Count | count | Minimize |
| L11e | `PO_NO_CONTRACT_COUNT` | PO Lines without Contract | count | Minimize |
| L12 | `SUMMARY_COUNTS` | P2P Summary Counts | JSON | — |

---

## Detailed KPI Definitions

### L1 — Total Procurement Value YTD + PO Count YTD

**Business question:** What is the total committed procurement spend and PO count this fiscal year?

**SAP source:** `EKPO-NETWR` via `po_dump`

```sql
SELECT
    SUM(CAST(net_order_value AS REAL)),
    COUNT(DISTINCT purchasing_document),
    COUNT(DISTINCT CASE WHEN release_indicator LIKE 'X%'
                        THEN purchasing_document END),
    COUNT(DISTINCT CASE WHEN (release_indicator IS NULL OR release_indicator = '')
                        THEN purchasing_document END)
FROM po_dump
WHERE (deletion_indicator IS NULL OR deletion_indicator <> 'L')
  AND created_on >= {FY}    -- '{FY_YEAR}-04-01' (Indian FY)
  AND created_on <= date('now')
```

**Stored KPIs:**
- `TOTAL_SPEND_YTD` — value_numeric = SUM(net_order_value); value_text = JSON `{value, total_count, released_count, non_released_count}`
- `TOTAL_PO_COUNT_YTD` — value_numeric = COUNT(DISTINCT purchasing_document); value_text = same JSON

---

### L_GRN — GRN Count + Value YTD

**Business question:** How many goods receipt documents were posted this fiscal year?

**SAP source:** `MSEG` (`EKBE` with `VGABE='E'`) via `grn_dump`; `movement_type = '101'`

```sql
SELECT
    COUNT(DISTINCT material_document),
    SUM(CAST(amount_local_ccy AS REAL)
        * CASE WHEN debit_credit_ind = 'S' THEN 1.0 ELSE -1.0 END)
FROM grn_dump
WHERE movement_type = '101'
  AND posting_date >= {FY}
```

**Stored KPIs:**
- `GRN_COUNT_YTD` — value_numeric = COUNT(DISTINCT material_document)
- `GRN_VALUE_YTD` — value_numeric = SUM(amount × dc_sign)

---

### L_INV — Invoice Count + Value YTD

**Business question:** How many valid invoices were posted this fiscal year (excluding reversals)?

**SAP source:** `BSIK/BSAK` via `invoice_dump`; `document_type IN ('RE','KR')`

```sql
WITH cancelled AS (
    SELECT DISTINCT reverse_invoice AS doc
    FROM   invoice_dump
    WHERE  reverse_invoice IS NOT NULL AND reverse_invoice != ''
)
SELECT
    COUNT(DISTINCT invoice_doc),
    SUM(CAST(amount_local_ccy AS REAL)
        * CASE WHEN debit_credit_ind = 'S' THEN 1.0 ELSE -1.0 END)
FROM invoice_dump
WHERE document_type IN ('RE','KR')
  AND posting_date >= {FY}
  AND invoice_doc NOT IN (SELECT doc FROM cancelled)
  AND (reverse_invoice IS NULL OR reverse_invoice = '')
```

**Stored KPIs:**
- `INVOICE_COUNT_YTD` — value_numeric = COUNT(DISTINCT invoice_doc)
- `INVOICE_VALUE_YTD` — value_numeric = SUM(amount × dc_sign)

---

### L_INV_TYPE — Invoice Summary by Vendor Type

**Business question:** How do invoices break down by vendor type (DOMESTIC / INTERNATIONAL / ONE_TIME)?

**Logic:** Join `invoice_dump` with `vendor_master` → group by `company_code`, `vendor_type` → count invoices, sum amounts. Removes reversed invoices. Uses `debit_credit_ind` for amount signs.

```sql
SELECT i.company_code,
       COALESCE(v.vendor_type, 'UNKNOWN') AS vendor_type,
       COUNT(DISTINCT i.invoice_doc) AS invoice_count,
       SUM(CAST(i.amount_local_ccy AS REAL)
           * CASE WHEN i.debit_credit_ind = 'S' THEN 1.0 ELSE -1.0 END) AS total_amount
FROM invoice_dump i
LEFT JOIN vendor_master v ON i.vendor = v.vendor
WHERE i.document_type IN ('RE','KR')
  AND (i.reverse_invoice IS NULL OR i.reverse_invoice = '')
  AND i.invoice_doc NOT IN (
      SELECT DISTINCT reverse_invoice FROM invoice_dump
      WHERE reverse_invoice IS NOT NULL AND reverse_invoice != ''
  )
GROUP BY i.company_code, v.vendor_type
ORDER BY i.company_code, total_amount DESC
```

**Stored KPI:** `INVOICE_BY_VENDOR_TYPE` — value_text = JSON array of `{company_code, vendor_type, invoice_count, total_amount}`

---

### L2 — Maverick PO Rate

**Business question:** What % of POs were created without an upstream approved PR?

**SAP source:** `EKPO-BANFN` NULL = no PR reference

**Target:** < 5%

```sql
SELECT COUNT(CASE WHEN is_maverick = 1 THEN 1 END) * 100.0
       / NULLIF(COUNT(*), 0)
FROM pr_po_grn_invoice
WHERE purchasing_document IS NOT NULL
```

**Note:** `is_maverick = 1` is set in `pr_po_grn_invoice` fact table where `po_dump.purchase_requisition IS NULL`.

**Stored KPI:** `MAVERICK_BUY_RATE` — value_numeric = %

---

### L3 — End-to-End P2P Cycle Time

**Business question:** How many days from PR approval to final payment (or GRN for unmatched POs)?

**SAP sources:** `EBAN-FRGDT` (PR release), `BSAK-BUDAT` (payment posting)

**Target:** ≤ 45 days

```sql
SELECT AVG(CAST(total_cycle_days AS REAL))
FROM pr_po_grn_invoice
WHERE total_cycle_days IS NOT NULL AND total_cycle_days > 0
```

**Computation in fact table:**
- `total_cycle_days = julianday(first_payment_date) - julianday(pr_release_date)`
- Falls back to `julianday(grn_posting_date) - julianday(po_document_date)` for POs without payment.

**Stored KPI:** `E2E_CYCLE_TIME` — value_numeric = days

---

### L4 — Vendor Concentration Risk (Top-3)

**Business question:** What % of total spend goes to the top 3 vendors?

**SAP source:** `EKPO-NETWR` grouped by `EKKO-LIFNR`

**Target:** < 40%  |  High concentration = single-supplier dependency risk

```sql
-- Total spend (denominator)
SELECT SUM(CAST(net_order_value AS REAL)) FROM po_dump
WHERE (deletion_indicator IS NULL OR deletion_indicator <> 'L')

-- Top-10 vendors (spend descending)
SELECT po.vendor,
       COALESCE(vm.vendor_name, po.vendor_name, po.vendor) AS name,
       SUM(CAST(po.net_order_value AS REAL)) AS spend
FROM po_dump po
LEFT JOIN vendor_master vm ON po.vendor = vm.vendor
WHERE (po.deletion_indicator IS NULL OR po.deletion_indicator <> 'L')
GROUP BY po.vendor
ORDER BY spend DESC
LIMIT 10
```

**Computation:** Top-3 spend / total spend × 100.

**Stored KPI:** `VENDOR_CONCENTRATION` — value_numeric = concentration %; value_text = JSON `{concentration_pct, vendors: [{vendor, name, spend, share_pct}]}`

---

### L4b — Single Source Procurement

**Business question:** Which company + material combinations have only one supplier (supply dependency risk)?

**Logic:** Group PO lines by `(company_code, material_description)`, flag groups with `COUNT(DISTINCT vendor) = 1`.

```sql
-- Aggregate count + value
SELECT COUNT(*), SUM(total_value)
FROM (
    SELECT company_code, material_description,
           SUM(CAST(net_order_value AS REAL)) AS total_value
    FROM po_dump
    WHERE (deletion_indicator IS NULL OR deletion_indicator <> 'L')
      AND material_description IS NOT NULL AND material_description != ''
    GROUP BY company_code, material_description
    HAVING COUNT(DISTINCT vendor) = 1
)

-- Top-20 single-source items (detail)
WITH ss AS (
    SELECT po.company_code, po.material_description,
           MIN(po.vendor) AS vendor_code,
           SUM(CAST(po.net_order_value AS REAL)) AS total_value
    FROM po_dump po
    WHERE (po.deletion_indicator IS NULL OR po.deletion_indicator <> 'L')
      AND po.material_description IS NOT NULL AND po.material_description != ''
    GROUP BY po.company_code, po.material_description
    HAVING COUNT(DISTINCT po.vendor) = 1
)
SELECT ss.company_code, ss.material_description, ss.vendor_code,
       COALESCE(vm.vendor_name, ss.vendor_code) AS vendor_name,
       ROUND(ss.total_value, 2)
FROM ss
LEFT JOIN vendor_master vm ON ss.vendor_code = vm.vendor
ORDER BY ss.total_value DESC
LIMIT 20
```

**Stored KPIs:**
- `SINGLE_SOURCE_COUNT` — value_numeric = count of single-source combinations; value_text = JSON detail
- `SINGLE_SOURCE_VALUE` — value_numeric = total single-source spend

---

### L5 — Negotiation Savings YTD

**Business question:** How much was saved via price negotiation vs PR estimated price?

**Formula:** `SUM((PR.valuation_price - PO.net_order_price) × PO.order_quantity) WHERE savings > 0`

**SAP sources:** `EBAN-PREIS` (PR valuation price), `EKPO-NETPR` (PO net price)

```sql
SELECT SUM((CAST(f.pr_value AS REAL) - CAST(f.po_net_price AS REAL))
           * CAST(f.po_quantity AS REAL))
FROM pr_po_grn_invoice f
WHERE f.pr_value    IS NOT NULL
  AND f.po_net_price IS NOT NULL
  AND (CAST(f.pr_value AS REAL) - CAST(f.po_net_price AS REAL)) > 0
```

**Stored KPI:** `NEGOTIATION_SAVINGS` — value_numeric = INR

---

### L6 — Strategic Risk Index

**Business question:** Composite risk score across compliance, concentration, and process anomalies.

**Formula:** `0.4 × vendor_concentration + 0.3 × maverick_rate + 0.3 × anomaly_rate`

**Bands:** 0-30 = Low, 30-50 = Medium, 50+ = High

```sql
-- Components:
-- conc_pct = VENDOR_CONCENTRATION (L4)
-- mav_pct  = MAVERICK_BUY_RATE (L2)
-- anom_pct = (anomaly_count > 0 events / total events) × 100

SELECT COUNT(*) FROM process_mining_events WHERE anomaly_count > 0
SELECT COUNT(*) FROM process_mining_events

-- risk_score = 0.4 * conc_pct + 0.3 * mav_pct + 0.3 * anom_pct
```

**Anomalies included:** MAVERICK_BUY, SOD_VIOLATION, BACKDATED_PO, SPLIT_PO, VENDOR_BLOCK, DUPLICATE_INVOICE, PAYMENT_BEFORE_GRN, and all other anomaly types tracked in `process_mining_events`.

**Stored KPI:** `SUPPLY_RISK_SCORE` — value_numeric = score 0-100

---

### L7a — SOD: PO Create vs Release

**Business question:** How many POs were released (approved) by the same user who created them?

**Detection:** PO `created_by` matches `change_log.username` who set `FRGZU='X'` (release approval).

**SAP sources:** `EKKO-ERNAM` (created by), `CDHDR-USERNAME` (release approval user)

**Target:** 0 — Zero tolerance

```sql
SELECT COUNT(DISTINCT po.purchasing_document)
FROM po_dump po
JOIN change_log cl
    ON cl.object_id = po.purchasing_document
WHERE cl.object_class      = 'EINKBELEG'
  AND cl.table_name        = 'EKKO'
  AND cl.field_name        = 'FRGZU'
  AND cl.change_indicator  IN ('E','U')
  AND cl.new_value         = 'X'
  AND cl.username          = po.created_by
  AND (po.deletion_indicator IS NULL OR po.deletion_indicator = '')
```

**Stored KPI:** `SOD_PO_CREATE_RELEASE` — value_numeric = count

---

### L7b — SOD: PO vs GRN

**Business question:** How many PO lines were received (GRN) by the same user who created the PO?

**Detection:** PO `created_by` matches GRN `created_by` on same (purchasing_document, item).

```sql
SELECT COUNT(DISTINCT po.purchasing_document || '|' || po.item)
FROM po_dump po
JOIN grn_dump grn
    ON grn.purchasing_document = po.purchasing_document
   AND grn.item               = po.item
WHERE po.created_by = grn.created_by
  AND (po.deletion_indicator IS NULL OR po.deletion_indicator = '')
  AND grn.debit_credit_ind = 'S'
```

**Stored KPI:** `SOD_PO_GRN` — value_numeric = count

---

### L7c — SOD: GRN vs Invoice

**Business question:** How many GRNs were invoiced by the same user who recorded the goods receipt?

**Detection:** GRN `created_by` matches Invoice (PO-linked) `created_by` on same (purchasing_document, item).

```sql
SELECT COUNT(DISTINCT grn.material_document)
FROM grn_dump grn
JOIN po_invoice_dump inv
    ON inv.purchasing_document = grn.purchasing_document
   AND inv.item               = grn.item
WHERE grn.created_by = inv.created_by
  AND grn.debit_credit_ind  = 'S'
  AND inv.debit_credit_ind  = 'S'
```

**Stored KPI:** `SOD_GRN_INVOICE` — value_numeric = count

---

### L7d — SOD: Invoice vs Payment

**Business question:** How many invoices were paid by the same user who posted the invoice?

**Detection:** Invoice `created_by` matches Payment `created_by` on (company_code, vendor, cleared_invoice). Excludes cancelled invoices and reversals.

```sql
SELECT COUNT(DISTINCT i.invoice_doc)
FROM invoice_dump i
JOIN payment_dump p
    ON p.company_code    = i.company_code
   AND p.vendor          = i.vendor
   AND p.cleared_invoice = i.invoice_doc
WHERE i.created_by = p.created_by
  AND i.document_type IN ('RE','KR')
  AND (i.reverse_invoice IS NULL OR i.reverse_invoice = '')
  AND i.invoice_doc NOT IN (
      SELECT DISTINCT reverse_invoice FROM invoice_dump
      WHERE reverse_invoice IS NOT NULL AND reverse_invoice != ''
  )
  AND p.debit_credit_ind = 'S'
```

**Stored KPI:** `SOD_INVOICE_PAYMENT` — value_numeric = count

---

### L7 — SOD Conflict Count (All)

**Combined total** of all 4 SOD scenarios above.

```python
s7_total = s7a + s7b + s7c + s7d
```

**Stored KPI:** `SOD_CONFLICT_COUNT` — value_numeric = sum of all 4 SOD counts

---

### L8 — PO to GRN Conversion Rate

**Business question:** What % of PO lines have a confirmed goods receipt?

**Target:** > 80%

```sql
-- Denominator: all PO lines
SELECT COUNT(DISTINCT purchasing_document || '|' || item)
FROM pr_po_grn_invoice
WHERE purchasing_document IS NOT NULL

-- Numerator: PO lines with GRN
SELECT COUNT(DISTINCT purchasing_document || '|' || item)
FROM pr_po_grn_invoice
WHERE purchasing_document IS NOT NULL AND grn_posting_date IS NOT NULL
```

**Computation:** (with_GRN / total) × 100

**Stored KPI:** `PO_GRN_CONVERSION_RATE` — value_numeric = %

---

### L9 — Duplicate Invoice Count

**Business question:** How many system invoice documents are duplicates of each other (same vendor reference, amount, vendor, date)?

**Detection:** Groups by `(company_code, vendor_invoice_ref, amount_local_ccy, vendor, posting_date)`; counts excess documents beyond the first per group. Cancelled invoices are excluded.

```sql
SELECT SUM(cnt - 1) FROM (
    SELECT COUNT(DISTINCT invoice_doc) AS cnt
    FROM invoice_dump
    WHERE document_type IN ('RE','KR')
      AND (reverse_invoice IS NULL OR reverse_invoice = '')
      AND invoice_doc NOT IN (
          SELECT DISTINCT reverse_invoice FROM invoice_dump
          WHERE reverse_invoice IS NOT NULL AND reverse_invoice != ''
      )
    GROUP BY company_code, vendor_invoice_ref,
             CAST(amount_local_ccy AS REAL),
             vendor, posting_date
    HAVING COUNT(DISTINCT invoice_doc) > 1
)
```

**Stored KPI:** `DUPLICATE_INVOICE_COUNT` — value_numeric = excess count

---

### L9b — Duplicate PO Count

**Business question:** How many system PO documents are duplicates of each other (same company, material, vendor, amount, qty, date)?

**Detection:** Groups by `(company_code, material_group, vendor, net_order_value, order_quantity, document_date)`; counts excess documents beyond the first per group. Deleted POs excluded.

```sql
SELECT SUM(cnt - 1) FROM (
    SELECT COUNT(DISTINCT purchasing_document) AS cnt
    FROM po_dump
    WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))
    GROUP BY company_code, material_group, vendor,
             CAST(net_order_value AS REAL),
             CAST(order_quantity AS REAL),
             document_date
    HAVING COUNT(DISTINCT purchasing_document) > 1
)
```

**Stored KPI:** `DUPLICATE_PO_COUNT` — value_numeric = excess count

---

### L10 — High-Value PO Count

**Business question:** How many POs exceed the configurable high-value threshold?

**Threshold:** Stored in `kpi_config.HIGH_VALUE_PO_THRESHOLD` — editable from Leadership dashboard header.

**Default:** ₹1 Crore (10,000,000 INR)

```sql
SELECT COUNT(DISTINCT purchasing_document)
FROM po_dump
WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))
  AND CAST(net_order_value AS REAL) > {high_value_threshold}
```

**Stored KPI:** `HIGH_VALUE_PO_COUNT` — value_numeric = count

---

### L11a — PR Amount YTD

**Business question:** What is the estimated procurement value from approved PRs this fiscal year?

**SAP source:** `EBAN-PREIS` (valuation price per unit); note: this is estimated value, not committed spend.

```sql
SELECT SUM(CAST(valuation_price AS REAL))
FROM pr_dump
WHERE (deletion_indicator IS NULL OR deletion_indicator = '')
  AND release_date >= {FY}
```

**Stored KPI:** `PR_AMOUNT_YTD` — value_numeric = INR

---

### L11b — PR Line Count YTD

**Business question:** How many PR line items were approved this fiscal year?

```sql
SELECT COUNT(DISTINCT purchase_requisition || '|' || item_of_requisition)
FROM pr_dump
WHERE (deletion_indicator IS NULL OR deletion_indicator = '')
  AND release_date >= {FY}
```

**Stored KPI:** `PR_LINE_COUNT_YTD` — value_numeric = count

---

### L11c — PO Line Count YTD

**Business question:** How many PO line items were created this fiscal year?

```sql
SELECT COUNT(*)
FROM po_dump
WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))
  AND document_date >= {FY}
```

**Stored KPI:** `PO_LINE_COUNT_YTD` — value_numeric = count

---

### L11d — One-Time Vendor Count

**Business question:** How many one-time / CPD vendors exist (bypassing vendor master controls)?

**SAP account group:** CPEN (one-time accounts)

```sql
SELECT COUNT(*) FROM vendor_master
WHERE UPPER(vendor_type) = 'ONE_TIME'
```

**Stored KPI:** `ONE_TIME_VENDOR_COUNT` — value_numeric = count

---

### L11e — PO Lines without Contract

**Business question:** How many PO lines have no contract reference (unmanaged / off-contract spend)?

**SAP source:** `EKKO-KONNR` (contract number) NULL or blank = no contract

```sql
SELECT COUNT(*) FROM po_dump
WHERE (contract_number IS NULL OR contract_number = '')
  AND (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))
```

**Stored KPI:** `PO_NO_CONTRACT_COUNT` — value_numeric = count

---

### L12 — SUMMARY_COUNTS (JSON)

**Business question:** Quick snapshot of key P2P pipeline stage counts for the Leadership dashboard header.

**Returns:** JSON object with 10 keys:

```sql
approved_pr       = SELECT COUNT(DISTINCT purchase_requisition || '|' || item_of_requisition)
                    FROM pr_dump WHERE release_status IN ('X','XX','XXX','XXXX','XXXXX')

approved_po       = SELECT COUNT(DISTINCT purchasing_document || '|' || item)
                    FROM po_dump WHERE release_indicator = 'X'
                      AND (deletion_indicator IS NULL OR deletion_indicator = '')

grn_lines         = SELECT COUNT(*) FROM grn_dump WHERE debit_credit_ind = 'S'

invoice_lines     = SELECT COUNT(*) FROM invoice_dump
                    WHERE document_type IN ('RE','KR') AND CAST(amount_local_ccy AS REAL) > 0

payments          = SELECT COUNT(*) FROM payment_dump

po_without_pr     = SELECT COUNT(DISTINCT purchasing_document) FROM po_dump
                    WHERE (purchase_requisition IS NULL OR purchase_requisition = '')
                      AND (deletion_indicator IS NULL OR deletion_indicator = '')

one_time_vendors  = SELECT COUNT(*) FROM vendor_master WHERE UPPER(vendor_type) = 'ONE_TIME'

po_no_contract    = SELECT COUNT(*) FROM po_dump
                    WHERE (contract_number IS NULL OR contract_number = '')
                      AND (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))

duplicate_invoices = value of DUPLICATE_INVOICE_COUNT (L9)

sod_conflicts     = value of SOD_CONFLICT_COUNT (L7 combined total)
```

**Stored KPI:** `SUMMARY_COUNTS` — value_text = JSON with all 10 keys

---

## Chart Data Series

**Endpoint:** `GET /api/charts/leadership`

**Returns:** `{type: "leadership_multi", monthly, invoice_by_vendor, invoice_by_vendor_type, pr_aging, pr_qty_by_material, invoice_vs_payment}`

### Chart 1 — Monthly Spend Trend

```sql
SELECT strftime('%Y-%m', document_date) AS month,
       SUM(CAST(net_order_value AS REAL)) AS spend,
       SUM(CASE WHEN UPPER(COALESCE(capex_opex_flag,'OPEX'))='CAPEX'
                THEN CAST(net_order_value AS REAL) ELSE 0 END) AS capex,
       SUM(CASE WHEN UPPER(COALESCE(capex_opex_flag,'OPEX'))='OPEX'
                THEN CAST(net_order_value AS REAL) ELSE 0 END) AS opex
FROM po_dump
WHERE document_date >= {cutoff}
  AND (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))
GROUP BY month ORDER BY month
```

### Chart 2 — Invoice Summary by Vendor (Top 10)

```sql
SELECT i.vendor, COALESCE(v.vendor_name, i.vendor) AS vendor_name,
       SUM(CAST(i.amount_local_ccy AS REAL)) AS total_amount,
       COUNT(*) AS invoice_count
FROM invoice_dump i
LEFT JOIN vendor_master v ON i.vendor = v.vendor
WHERE i.document_type IN ('RE','KR')
  AND CAST(i.amount_local_ccy AS REAL) > 0
  AND i.posting_date >= {cutoff}
GROUP BY i.vendor ORDER BY total_amount DESC LIMIT 10
```

### Chart 3 — Invoice Summary by Vendor Type

```sql
SELECT COALESCE(v.vendor_type, 'UNKNOWN') AS vendor_type,
       SUM(CAST(i.amount_local_ccy AS REAL)) AS total_amount,
       COUNT(*) AS invoice_count
FROM invoice_dump i
LEFT JOIN vendor_master v ON i.vendor = v.vendor
WHERE i.document_type IN ('RE','KR')
  AND CAST(i.amount_local_ccy AS REAL) > 0
  AND i.posting_date >= {cutoff}
GROUP BY vendor_type ORDER BY total_amount DESC
```

### Chart 4 — Aging of Open PR Lines

```sql
SELECT
    SUM(CASE WHEN julianday('{ref_date}') - julianday(COALESCE(release_date, created_on)) <= 7
             THEN 1 ELSE 0 END) AS b0_7,
    SUM(CASE WHEN julianday('{ref_date}') - julianday(COALESCE(release_date, created_on)) BETWEEN 8 AND 30
             THEN 1 ELSE 0 END) AS b8_30,
    SUM(CASE WHEN julianday('{ref_date}') - julianday(COALESCE(release_date, created_on)) BETWEEN 31 AND 60
             THEN 1 ELSE 0 END) AS b31_60,
    SUM(CASE WHEN julianday('{ref_date}') - julianday(COALESCE(release_date, created_on)) > 60
             THEN 1 ELSE 0 END) AS b61p
FROM pr_dump
WHERE (deletion_indicator IS NULL OR deletion_indicator = '')
  AND release_status IN ('X','XX','XXX','XXXX','XXXXX')
  AND NOT EXISTS (
      SELECT 1 FROM po_dump po
      WHERE po.purchase_requisition = pr_dump.purchase_requisition
        AND po.item_of_requisition  = pr_dump.item_of_requisition
  )
```

**Note:** `ref_date` = latest `po_dump.document_date` (not `now`) for correct historical data handling.

### Chart 5 — PR Quantity by Material Group (Top 10)

```sql
SELECT material_group,
       SUM(CAST(order_quantity AS REAL)) AS total_qty,
       COUNT(DISTINCT purchase_requisition || '|' || item_of_requisition) AS pr_lines
FROM pr_dump
WHERE (deletion_indicator IS NULL OR deletion_indicator = '')
  AND material_group IS NOT NULL AND material_group != ''
GROUP BY material_group ORDER BY total_qty DESC LIMIT 10
```

### Chart 6 — Invoice vs Payment (Monthly Comparison)

```sql
-- Invoice monthly amounts
SELECT strftime('%Y-%m', posting_date) AS month,
       SUM(CAST(amount_local_ccy AS REAL)) AS total
FROM invoice_dump
WHERE document_type IN ('RE','KR')
  AND CAST(amount_local_ccy AS REAL) > 0
  AND posting_date >= {cutoff}
GROUP BY month ORDER BY month

-- Payment monthly amounts
SELECT strftime('%Y-%m', posting_date) AS month,
       SUM(CAST(amount_local_ccy AS REAL)) AS total
FROM payment_dump
WHERE posting_date >= {cutoff}
GROUP BY month ORDER BY month
```

The two series are merged on month to produce `invoice_vs_payment` with `{month, invoice_amount, payment_amount}`.

---

## KPI Configuration

Thresholds stored in `kpi_config` table, editable from Leadership dashboard header:

| Config Key | Default | Description |
|------------|---------|-------------|
| `HIGH_VALUE_PO_THRESHOLD` | 10000000 (₹1 Cr) | PO value above which is "high-value" |
| `FY_START_MONTH` | 4 | April = start of Indian fiscal year |

**API to update threshold:**
```
PUT /api/kpi-config/HIGH_VALUE_PO_THRESHOLD
Body: {"value": "20000000"}   # ₹2 Cr
```

Triggers full KPI recompute on save.

---

## Data Sources Mapping

| KPI | SAP Table | CSV File | Key Fields |
|-----|-----------|----------|------------|
| PO Value | EKPO | 02_PO_Dump.csv | net_order_value, created_by, deletion_indicator |
| PR | EBAN | 01_PR_Dump.csv | valuation_price, order_quantity, release_date |
| GRN | EKBE (VGABE=E) | 04_GRN_Dump.csv | quantity, posting_date, movement_type, created_by |
| PO Invoice | RBKP/RSEG | 05_PO_Invoice_Dump.csv | quantity, amount_local_ccy, created_by |
| Invoice | BSIK/BSAK | 06_Invoice_Dump.csv | amount_local_ccy, document_type, created_by, reverse_invoice |
| Payment | BSAK | 07_Payment_Dump.csv | amount_local_ccy, clearing_date, cleared_invoice, created_by |
| Vendor Master | LFA1 | 08_Vendor_Master.csv | vendor, vendor_name, vendor_type, payment_block |
| Change Log | CDHDR/CDPOS | 09_Change_Log.csv | username, field_name, new_value, change_indicator |
| Process Events | — (computed) | — | anomaly_count from process_mining_events |

---

## Schema Changes for SOD Detection

The following columns were added to enable Segregation of Duties (SOD) conflict detection:

| Table | Column Added | Purpose |
|-------|-------------|---------|
| `grn_dump` | `created_by TEXT` | Track who recorded the goods receipt |
| `po_invoice_dump` | `created_by TEXT` | Track who posted the invoice against PO |
| `invoice_dump` | `created_by TEXT` | Track who posted the invoice |
| `payment_dump` | `created_by TEXT` | Track who made the payment |

These columns map to SAP's `ERNAM` field in the respective tables (`MSEG-ERNAM`, `RBKP-ERNAM`, `BSIK-ERNAM`, `REGUP-ERNAM`).

---

*Generated: 2026-06-04 | IntelliSource P2P v2 | All SQL queries reflect actual `_leadership()` implementation in `kpi_engine.py`*
