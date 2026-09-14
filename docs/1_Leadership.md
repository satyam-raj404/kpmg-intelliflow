# Leadership Dashboard — KPI Formulas & SQL Queries

## Dataset Sources
| Code | Dataset | Table |
|------|---------|-------|
| `01_PR_Dump` | Purchase Requisitions | `pr_dump` |
| `02_PO_Dump` | Purchase Orders | `po_dump` |
| `03_PO_Delivery_Dump` | PO Delivery Schedule | `po_delivery_dump` |
| `04_GRN_Dump` | Goods Receipt Notes | `grn_dump` |
| `05_PO_Invoice_Dump` | PO-Invoice linking | `po_invoice_dump` |
| `06_Invoice_Dump` | Vendor Invoices | `invoice_dump` |
| `07_Payment_Dump` | Payment Postings | `payment_dump` |
| `08_Vendor_Master` | Vendor Master Data | `vendor_master` |
| `09_Change_Log` | Document Change Log | `change_log` |
| `pr_po_grn_invoice` | Fact table (ETL-built) | `pr_po_grn_invoice` |

---

## KPI: L1 — TOTAL_SPEND_YTD
- **KPI Code:** `TOTAL_SPEND_YTD`
- **Name:** Total Procurement Value (YTD)
- **Unit:** INR
- **Business Question:** What's the total committed procurement spend YTD?
- **Formula:** `SUM(02_PO_Dump.net_order_value)` WHERE `document_date` between FY-start and today AND `deletion_indicator` NOT 'L'
- **SQL:**
```sql
SELECT SUM(CAST(net_order_value AS REAL))
FROM po_dump
WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))
  AND document_date >= {FY}
```

---

## KPI: L2 — MAVERICK_BUY_RATE
- **KPI Code:** `MAVERICK_BUY_RATE`
- **Name:** Maverick PO Rate (%)
- **Unit:** %
- **Business Question:** What % of POs were created without an upstream PR?
- **Formula:** `(COUNT(POs WHERE purchase_requisition IS NULL) / COUNT(all POs)) × 100`
- **SQL:**
```sql
SELECT COUNT(CASE WHEN is_maverick = 1 THEN 1 END) * 100.0
       / NULLIF(COUNT(*), 0)
FROM pr_po_grn_invoice
WHERE purchasing_document IS NOT NULL
```
- **Threshold:** < 5%

---

## KPI: L3 — E2E_CYCLE_TIME
- **KPI Code:** `E2E_CYCLE_TIME`
- **Name:** End-to-End P2P Cycle (days)
- **Unit:** days
- **Business Question:** How long from PR release to payment on average?
- **Formula:** `AVG(PR release_date → Payment clearing_date)` from fact table
- **SQL:**
```sql
SELECT AVG(CAST(total_cycle_days AS REAL))
FROM pr_po_grn_invoice
WHERE total_cycle_days IS NOT NULL AND total_cycle_days > 0
```
- **Threshold:** ≤ 45 days

---

## KPI: L4 — VENDOR_CONCENTRATION
- **KPI Code:** `VENDOR_CONCENTRATION`
- **Name:** Top-3 Vendor Spend Concentration (%)
- **Unit:** %
- **Business Question:** What % of total spend goes to our top 3 vendors?
- **Formula:** `(SUM(top 3 vendors' net_order_value) / SUM(all vendors' net_order_value)) × 100`
- **SQL:**
```sql
SELECT SUM(sub.spend) * 100.0 / NULLIF(
    (SELECT SUM(CAST(net_order_value AS REAL)) FROM po_dump
     WHERE deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X')), 0)
FROM (
    SELECT SUM(CAST(net_order_value AS REAL)) AS spend
    FROM po_dump
    WHERE deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X')
    GROUP BY vendor
    ORDER BY spend DESC LIMIT 3
) sub
```
- **Threshold:** < 40%

---

## KPI: L5 — NEGOTIATION_SAVINGS
- **KPI Code:** `NEGOTIATION_SAVINGS`
- **Name:** Negotiation Savings YTD
- **Unit:** INR
- **Business Question:** How much have we saved through negotiation?
- **Formula:** `SUM((PR valuation_price − PO net_order_price) × PO quantity)` WHERE result > 0
- **SQL:**
```sql
SELECT SUM((CAST(f.pr_value AS REAL) - CAST(f.po_net_price AS REAL))
           * CAST(f.po_quantity AS REAL))
FROM pr_po_grn_invoice f
WHERE f.pr_value    IS NOT NULL
  AND f.po_net_price IS NOT NULL
  AND (CAST(f.pr_value AS REAL) - CAST(f.po_net_price AS REAL)) > 0
```

---

## KPI: L6 — SUPPLY_RISK_SCORE
- **KPI Code:** `SUPPLY_RISK_SCORE`
- **Name:** Supply Chain Risk Score
- **Unit:** score (0-100)
- **Business Question:** What's the composite risk score across compliance, vendor concentration, and process anomalies?
- **Formula:** `0.4 × vendor_concentration_pct + 0.3 × maverick_pct + 0.3 × anomaly_rate_pct`
- **SQL (anomaly rate sub-query):**
```sql
SELECT COUNT(*) FROM process_mining_events WHERE anomaly_count > 0
```
- **Anomalies include:** PO without PR, Same Approver for PO and PR, Process maverick rate
- **Band:** Low (< 30) / Medium (30-60) / High (> 60)

---

## KPI: L7 — SOD_CONFLICT_COUNT
- **KPI Code:** `SOD_CONFLICT_COUNT`
- **Name:** SOD Conflict Count
- **Unit:** count
- **Business Question:** How many POs where PR creator also approved the PO?
- **Formula:** Count of POs where `change_log.username = pr_dump.requisitioner` AND `change_log.field_name IN ('FRGZU','FRGKE')` AND `new_value = 'X'`
- **SQL:**
```sql
SELECT COUNT(DISTINCT po.purchasing_document)
FROM po_dump po
JOIN pr_dump pr
    ON po.purchase_requisition = pr.purchase_requisition
   AND po.item_of_requisition  = pr.item_of_requisition
JOIN change_log cl
    ON cl.object_id      = po.purchasing_document
   AND cl.object_class   = 'EINKBELEG'
   AND cl.field_name     IN ('FRGZU','FRGKE')
   AND cl.change_indicator = 'U'
   AND cl.new_value      = 'X'
   AND cl.username       = pr.requisitioner
WHERE po.purchase_requisition IS NOT NULL
```

---

## KPI: L8 — PO_GRN_CONVERSION_RATE
- **KPI Code:** `PO_GRN_CONVERSION_RATE`
- **Name:** PO→GRN Conversion Rate (%)
- **Unit:** %
- **Business Question:** What % of PO lines have been goods-receipted?
- **Formula:** `(COUNT(PO lines with GRN) / COUNT(all PO lines)) × 100`
- **SQL:**
```sql
-- Denominator
SELECT COUNT(DISTINCT purchasing_document || '|' || item)
FROM pr_po_grn_invoice
WHERE purchasing_document IS NOT NULL

-- Numerator
SELECT COUNT(DISTINCT purchasing_document || '|' || item)
FROM pr_po_grn_invoice
WHERE purchasing_document IS NOT NULL AND grn_posting_date IS NOT NULL
```

---

## KPI: L9 — DUPLICATE_INVOICE_COUNT
- **KPI Code:** `DUPLICATE_INVOICE_COUNT`
- **Name:** Duplicate Invoice Count
- **Unit:** count
- **Business Question:** How many invoices appear to be duplicates (same vendor + amount + date)?
- **Formula:** `COUNT(all invoices) − COUNT(DISTINCT vendor + amount + posting_date)`
- **SQL:**
```sql
SELECT COUNT(*) - COUNT(DISTINCT vendor || '|' || amount_local_ccy || '|' || posting_date)
FROM invoice_dump
WHERE document_type IN ('RE','KR')
```

---

## KPI: L10 — HIGH_VALUE_PO_COUNT
- **KPI Code:** `HIGH_VALUE_PO_COUNT`
- **Name:** High-Value PO Count
- **Unit:** count
- **Business Question:** How many POs exceed the configurable high-value threshold?
- **Formula:** `COUNT(DISTINCT PO WHERE net_order_value > threshold)` — threshold configurable via UI
- **SQL:**
```sql
SELECT COUNT(DISTINCT purchasing_document)
FROM po_dump
WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))
  AND CAST(net_order_value AS REAL) > {high_value_threshold}
```

---

## KPI: L11a — PR_AMOUNT_YTD
- **KPI Code:** `PR_AMOUNT_YTD`
- **Name:** PR Amount (YTD)
- **Unit:** INR
- **Business Question:** What's the total value of purchase requisitions YTD?
- **Formula:** `SUM(PR valuation_price)` YTD, excluding deleted PRs
- **SQL:**
```sql
SELECT SUM(CAST(valuation_price AS REAL))
FROM pr_dump
WHERE (deletion_indicator IS NULL OR deletion_indicator = '')
  AND release_date >= {FY}
```

---

## KPI: L11b — PR_LINE_COUNT_YTD
- **KPI Code:** `PR_LINE_COUNT_YTD`
- **Name:** PR Line Count (YTD)
- **Unit:** count
- **Formula:** `COUNT(DISTINCT PR lines)` YTD, excluding deleted PRs
- **SQL:**
```sql
SELECT COUNT(DISTINCT purchase_requisition || '|' || item_of_requisition)
FROM pr_dump
WHERE (deletion_indicator IS NULL OR deletion_indicator = '')
  AND release_date >= {FY}
```

---

## KPI: L11c — PO_LINE_COUNT_YTD
- **KPI Code:** `PO_LINE_COUNT_YTD`
- **Name:** PO Line Count (YTD)
- **Unit:** count
- **SQL:**
```sql
SELECT COUNT(*)
FROM po_dump
WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))
  AND document_date >= {FY}
```

---

## KPI: L11d — ONE_TIME_VENDOR_COUNT
- **KPI Code:** `ONE_TIME_VENDOR_COUNT`
- **Name:** One-Time Vendor Count
- **Unit:** count
- **SQL:**
```sql
SELECT COUNT(*) FROM vendor_master
WHERE UPPER(vendor_type) = 'ONE_TIME'
```

---

## KPI: L11e — PO_NO_CONTRACT_COUNT
- **KPI Code:** `PO_NO_CONTRACT_COUNT`
- **Name:** PO Lines without Contract
- **Unit:** count
- **SQL:**
```sql
SELECT COUNT(*) FROM po_dump
WHERE (contract_number IS NULL OR contract_number = '')
  AND (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))
```

---

## JSON: L12 — SUMMARY_COUNTS
- **KPI Code:** `SUMMARY_COUNTS`
- **Name:** P2P Summary Counts
- **Unit:** json
- **Fields:**
```json
{
  "approved_pr":           "",
  "approved_po":           "Release",
  "grn_lines":             "",
  "invoice_lines":         "RE/KR",
  "payments":              "",
  "po_without_pr":         "",
  "one_time_vendors":      "",
  "po_no_contract":        "",
  "duplicate_invoices":    "",
  "sod_conflicts":         ""
}
```
- **SQL (approved PR count):**
```sql
SELECT COUNT(DISTINCT purchase_requisition || '|' || item_of_requisition)
FROM pr_dump WHERE release_status IN ('X','XX','XXX','XXXX','XXXXX')
```
- **SQL (approved PO count):**
```sql
SELECT COUNT(DISTINCT purchasing_document || '|' || item)
FROM po_dump WHERE release_indicator = 'X' AND (deletion_indicator IS NULL OR deletion_indicator = '')
```
- **SQL (GRN lines count):**
```sql
SELECT COUNT(*) FROM grn_dump WHERE debit_credit_ind = 'S'
```
- **SQL (invoice lines count):**
```sql
SELECT COUNT(*) FROM invoice_dump WHERE document_type IN ('RE','KR') AND CAST(amount_local_ccy AS REAL) > 0
```
- **SQL (payments count):**
```sql
SELECT COUNT(*) FROM payment_dump
```
- **SQL (POs without PR):**
```sql
SELECT COUNT(DISTINCT purchasing_document) FROM po_dump
WHERE (purchase_requisition IS NULL OR purchase_requisition = '')
  AND (deletion_indicator IS NULL OR deletion_indicator = '')
```
- **SQL (one-time vendors):**
```sql
SELECT COUNT(*) FROM vendor_master WHERE UPPER(vendor_type) = 'ONE_TIME'
```
- **SQL (POs without contract):**
```sql
SELECT COUNT(*) FROM po_dump
WHERE (contract_number IS NULL OR contract_number = '')
  AND (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))
```

---

## Chart: Monthly Spend Trend
- **Chart Component:** `SpendTrend` — ComposedChart (Area + Lines)
- **Endpoint:** `GET /charts/leadership` → `series.monthly`
- **SQL:**
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

---

## Chart: Invoice Summary by Vendor
- **Chart Component:** `InvoiceByVendor` — Horizontal BarChart (top 10)
- **Endpoint:** `GET /charts/leadership` → `series.invoice_by_vendor`
- **SQL:**
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

---

## Chart: Invoice Summary by Vendor Type
- **Chart Component:** `InvoiceByVendorType` — Cards with progress indicators
- **Endpoint:** `GET /charts/leadership` → `series.invoice_by_vendor_type`
- **SQL:**
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

---

## Chart: Aging of Open PR Lines
- **Chart Component:** `PrAging` — BarChart (4 age buckets)
- **Endpoint:** `GET /charts/leadership` → `series.pr_aging`
- **SQL:**
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

---

## Chart: PR Quantity by Product (Material Group)
- **Chart Component:** `PrQuantityByProduct` — Horizontal BarChart
- **Endpoint:** `GET /charts/leadership` → `series.pr_qty_by_material`
- **SQL:**
```sql
SELECT material_group,
       SUM(CAST(order_quantity AS REAL)) AS total_qty,
       COUNT(DISTINCT purchase_requisition || '|' || item_of_requisition) AS pr_lines
FROM pr_dump
WHERE (deletion_indicator IS NULL OR deletion_indicator = '')
  AND material_group IS NOT NULL
  AND material_group != ''
GROUP BY material_group ORDER BY total_qty DESC LIMIT 10
```

---

## Chart: Invoice vs Payment Trend
- **Chart Component:** `InvoiceVsPayment` — ComposedChart (grouped bars)
- **Endpoint:** `GET /charts/leadership` → `series.invoice_vs_payment`
- **SQL (invoice monthly):**
```sql
SELECT strftime('%Y-%m', posting_date) AS month,
       SUM(CAST(amount_local_ccy AS REAL)) AS total
FROM invoice_dump
WHERE document_type IN ('RE','KR')
  AND CAST(amount_local_ccy AS REAL) > 0
  AND posting_date >= {cutoff}
GROUP BY month ORDER BY month
```
- **SQL (payment monthly):**
```sql
SELECT strftime('%Y-%m', posting_date) AS month,
       SUM(CAST(amount_local_ccy AS REAL)) AS total
FROM payment_dump
WHERE posting_date >= {cutoff}
GROUP BY month ORDER BY month
```

---

## Chart: CAPEX vs OPEX Split
- **Chart Component:** `CapexOpexBreakdown` — Horizontal BarChart + stat cards
- **Endpoint:** KPI `CAPEX_OPEX_SPLIT` (JSON value_text), computed in `_utilization()`

---

## Risk Indicators (Composite)
- **Chart Component:** `RiskIndicators` — Horizontal BarChart
- **Metrics:** VENDOR_CONCENTRATION, MAVERICK_BUY_RATE, SUPPLY_RISK_SCORE, SOD_CONFLICT_COUNT

---

## Summary Counts Panel
- **Chart Component:** `SummaryCountsPanel` — Grid of stat cards
- **Endpoint:** KPI `SUMMARY_COUNTS` (JSON value_text)
- **10 metrics displayed:** Approved PRs, Approved POs, GRN Lines, Invoice Lines, Payments, POs Without PR, One-Time Vendors, POs Without Contract, Duplicate Invoices, SOD Conflicts

---

## Configuration Parameters
| Key | Default | Description |
|-----|---------|-------------|
| `HIGH_VALUE_PO_THRESHOLD` | `10000000` (₹1Cr) | Threshold for high-value PO flagging, configurable via UI |
| `FY_START_MONTH` | `4` (April) | Indian fiscal year start month |

## File Reference
- **Backend implementation:** `backend/services/kpi_engine.py` — `_leadership()` function (line ~396)
- **Frontend implementation:** `kpmg-intelliflow/src/routes/leadership.tsx`
- **Chart data API:** `backend/services/kpi_engine.py` — `compute_chart_data()` leadership section (line ~998)
