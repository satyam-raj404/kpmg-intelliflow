# Session History — Procurement Dashboard KPI Changes
**Date:** 2026-06-03 to 2026-06-05  
**Branch:** Aryan  
**Scope:** Procurement Dashboard KPI engine overhaul (P4–P12) + 2 new KPIs  

---

## Files Modified

| File | Changes |
|---|---|
| `backend/services/kpi_engine.py` | P4, P5, P6, P7, P8, P9, P10, P11, P12 rewrites |
| `backend/services/fact_builder.py` | PR↔PO join key, pr_to_po_days formula, PR deletion filter |
| `backend/services/parser.py` | `table_key` added to change_log signature |
| `backend/database.py` | Migration: `ALTER TABLE change_log ADD COLUMN table_key` |
| `backend/routers/p2p.py` | `/p2p/po-deletions` ordering changed to `created_on` |
| `backend/schema.sql` | Reference only — no changes made |
| `kpmg-intelliflow/src/routes/dashboard.tsx` | KPI cards, chart components, layout updates |

---

## KPI 4 — Average PR to PO Conversion Time

### Change Directions
1. Join PO Dump and PR Dump on 3 keys: Company Code + Purchase Requisition Number (EBAN-BANFN / EKPO-BANFN) + Item Number (EBAN-BNFPO / EKPO-BNFPO)
2. Date calculation: PO Creation Date (EKKO-ERDAT) minus PR Requisition Date (EBAN-ERDAT). Average of this difference in days.
3. Exclude deleted PRs where Deletion Indicator (EBAN-LOEKZ) = `'X'`

### Files Changed
- `backend/services/fact_builder.py` — Added `company_code` to PR↔PO JOIN; changed date formula from COALESCE fallbacks to strict `created_on`; added `deletion_indicator != 'X'` filter on PR
- `backend/services/kpi_engine.py` — P4 now reads from `pr_po_grn_invoice.pr_to_po_days` (fact table)

### SQL (Fact Builder — computes pr_to_po_days per line)
```sql
LEFT JOIN pr_dump pr
    ON po.company_code         = pr.company_code
   AND po.purchase_requisition = pr.purchase_requisition
   AND po.item_of_requisition  = pr.item_of_requisition

-- pr_to_po_days column:
CASE WHEN pr.created_on IS NOT NULL AND pr.created_on != ''
          AND po.created_on IS NOT NULL AND po.created_on != ''
     THEN CAST(julianday(po.created_on) - julianday(pr.created_on) AS INTEGER)
     ELSE NULL END

WHERE (po.deletion_indicator IS NULL OR po.deletion_indicator NOT IN ('L', 'X'))
  AND (pr.deletion_indicator IS NULL OR pr.deletion_indicator != 'X')
```

### SQL (KPI Engine — averages the fact table)
```sql
SELECT AVG(CAST(pr_to_po_days AS REAL))
FROM pr_po_grn_invoice
WHERE pr_to_po_days IS NOT NULL
  AND pr_to_po_days >= 0
  AND purchase_requisition IS NOT NULL
  AND purchasing_document  IS NOT NULL
```

---

## KPI 5 — PO Cycle Time (Creation to Approval)

### Change Directions
1. `release_indicator` and `new_value` must use `LIKE 'X%'` not `= 'X'` (multi-level approval: X, XX, XXX...)
2. `change_indicator` must be `IN ('E', 'U')` — E = initial entry, U = update; both valid
3. `field_name` narrowed to `= 'FRGZU'` only (FRGKE excluded — unreliable)
4. Release indicator on po_dump must be `LIKE 'X%'` not `= 'X'`
5. Deleted POs excluded: `deletion_indicator NOT IN ('L', 'X')` on every po_dump query

### SQL
```sql
SELECT AVG(CAST(julianday(cl.change_date) - julianday(po.created_on) AS REAL))
FROM po_dump po
JOIN change_log cl
  ON cl.object_id        = po.purchasing_document
 AND cl.object_class     = 'EINKBELEG'
 AND cl.field_name       = 'FRGZU'
 AND cl.change_indicator IN ('E', 'U')
 AND cl.new_value        LIKE 'X%'
WHERE po.release_indicator LIKE 'X%'
  AND (po.deletion_indicator IS NULL OR po.deletion_indicator NOT IN ('L', 'X'))
  AND po.created_on IS NOT NULL AND po.created_on != ''
```

---

## KPI 6 — PO Deletion Frequency (MTD)

### Change Directions
1. Use `created_on` (EKKO-ERDAT) instead of `document_date` (BEDAT) for date filtering
2. Count at item level: `DISTINCT purchasing_document || '|' || item` (EKPO-LOEKZ is item-level field)
3. Shown as both KPI card and monthly bar chart (`PODeletionTrend`)
4. `PODeletionMonitor` detail table subtitle updated to "line items"

### SQL
```sql
-- KPI Card
SELECT COUNT(DISTINCT purchasing_document || '|' || item)
FROM po_dump
WHERE deletion_indicator = 'L'
  AND COALESCE(NULLIF(created_on, ''), document_date) >= '<MTD_START>'

-- Monthly Trend (chart)
SELECT strftime('%Y-%m', COALESCE(NULLIF(created_on, ''), document_date)) AS month,
       COUNT(DISTINCT purchasing_document || '|' || item) AS deleted_lines
FROM po_dump
WHERE deletion_indicator = 'L'
  AND COALESCE(NULLIF(created_on, ''), document_date) >= '<12_MONTHS_AGO>'
GROUP BY month
```

---

## KPI 7 — PO Amendment Rate

### Change Directions
1. `change_indicator` extended to `IN ('E', 'U')` — E = initial entry, U = update
2. `field_name` changed from broad exclusion to explicit `IN ('MATNR', 'NETPR', 'NETWR', 'MENGE')` — Material, Net Order Price, Net Order Value, Quantity
3. Join to `po_dump` added on `object_id = purchasing_document` + company code via po_dump
4. Item-level match via `CDPOS-TABKEY`: rightmost 5 chars = EBELP stripped of leading zeros. NULL fallback when `table_key` not uploaded
5. Denominator changed to item level: `COUNT(DISTINCT purchasing_document || '|' || item)`
6. `table_key` column added to `change_log` schema via migration-safe `ALTER TABLE` in `database.py`

### SQL
```sql
-- Numerator
SELECT COUNT(DISTINCT po.purchasing_document || '|' || po.item)
FROM po_dump po
JOIN change_log cl
  ON  cl.object_id        = po.purchasing_document
 AND  cl.object_class     = 'EINKBELEG'
 AND  cl.change_indicator IN ('E', 'U')
 AND  cl.field_name       IN ('MATNR', 'NETPR', 'NETWR', 'MENGE')
 AND  (cl.table_key IS NULL OR cl.table_key = ''
       OR CAST(SUBSTR(cl.table_key, -5) AS INTEGER) = CAST(po.item AS INTEGER))
WHERE (po.deletion_indicator IS NULL OR po.deletion_indicator NOT IN ('L', 'X'))

-- Denominator
SELECT COUNT(DISTINCT purchasing_document || '|' || item) FROM po_dump
WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L', 'X'))
```

**Field mapping for `field_name`:**

| Business Label | SAP Field | `field_name` value |
|---|---|---|
| Material | EKPO-MATNR | `MATNR` |
| Net Order Price | EKPO-NETPR | `NETPR` |
| Net Order Value | EKPO-NETWR | `NETWR` |
| Quantity | EKPO-MENGE | `MENGE` |

---

## KPI 8 — Open PO Aging (replaced Open PR Aging)

### Change Directions
1. Completely replaced: Open PR Aging → Open PO Aging
2. Open PO definition: `delivery_completed` blank + `order_quantity ≠ delivered_quantity` + not deleted
3. Aging = `julianday(ref_date) − julianday(po_delivery_dump.expected_delivery_date)`; only positive delays
4. Bucket distribution stored as JSON for bar chart: 1-30d, 31-60d, 61-90d, 90+d
5. New `POAgingBuckets` bar chart component with escalating amber→dark red colors per bucket
6. Dashboard card p4 now shows "Open PO Aging" replacing "Open PR Aging"

### SQL
```sql
-- Total Count
SELECT COUNT(DISTINCT po.purchasing_document || '|' || po.item)
FROM po_dump po
JOIN po_delivery_dump pod ON pod.purchasing_document = po.purchasing_document AND pod.item = po.item
WHERE (po.delivery_completed IS NULL OR po.delivery_completed = '')
  AND (po.deletion_indicator IS NULL OR po.deletion_indicator NOT IN ('L', 'X'))
  AND CAST(po.order_quantity AS REAL) != CAST(COALESCE(NULLIF(po.delivered_quantity,''),'0') AS REAL)
  AND pod.expected_delivery_date IS NOT NULL AND pod.expected_delivery_date != ''
  AND julianday('<ref_date>') - julianday(pod.expected_delivery_date) > 0

-- Bucket Distribution
SELECT
    COUNT(DISTINCT CASE WHEN delay BETWEEN 1  AND 30  THEN key END) AS "1-30d",
    COUNT(DISTINCT CASE WHEN delay BETWEEN 31 AND 60  THEN key END) AS "31-60d",
    COUNT(DISTINCT CASE WHEN delay BETWEEN 61 AND 90  THEN key END) AS "61-90d",
    COUNT(DISTINCT CASE WHEN delay > 90               THEN key END) AS "90+d"
FROM (
    SELECT po.purchasing_document || '|' || po.item AS key,
           CAST(julianday('<ref_date>') - julianday(pod.expected_delivery_date) AS INTEGER) AS delay
    FROM po_dump po JOIN po_delivery_dump pod
      ON pod.purchasing_document = po.purchasing_document AND pod.item = po.item
    WHERE -- same filters as above
)
```

---

## KPI 9 — Total PO Value (YTD)

### Change Directions
- Date filter changed from `document_date` (BEDAT) to `COALESCE(NULLIF(created_on,''), document_date)` — use creation date (EKKO-ERDAT) with fallback. Consistent with P1 and P6.
- SUM already at item level (EKPO-NETWR per line) — no grain change needed.

### SQL
```sql
SELECT SUM(CAST(net_order_value AS REAL))
FROM po_dump
WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L', 'X'))
  AND COALESCE(NULLIF(created_on, ''), document_date) >= '<FY_START>'
```

---

## KPI 10 — PO Line Count (YTD)

### Change Directions
1. `COUNT(*)` → `COUNT(DISTINCT purchasing_document || '|' || item)` — explicit item level, prevents overcounting duplicates
2. Date filter changed from `document_date` to `COALESCE(NULLIF(created_on,''), document_date)` — same as P9

### SQL
```sql
SELECT COUNT(DISTINCT purchasing_document || '|' || item)
FROM po_dump
WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L', 'X'))
  AND COALESCE(NULLIF(created_on, ''), document_date) >= '<FY_START>'
```

---

## KPI 11 — Approved PR Count (NEW)

### Change Directions
New KPI. Displays as fraction: `Approved / Total` (e.g. `342 / 415`). Header level — approval is a document-level event.

- **Total**: `COUNT(DISTINCT purchase_requisition)` excluding deleted PRs (`EBAN-LOEKZ = 'X'`)
- **Approved**: same + `release_status LIKE 'X%'` (`EBAN-FRGZU` — any single or multi-level release)

### SQL
```sql
-- Total Active PRs
SELECT COUNT(DISTINCT purchase_requisition) FROM pr_dump
WHERE (deletion_indicator IS NULL OR deletion_indicator = '')

-- Approved PRs
SELECT COUNT(DISTINCT purchase_requisition) FROM pr_dump
WHERE (deletion_indicator IS NULL OR deletion_indicator = '')
  AND release_status LIKE 'X%'
```

**SAP field mapping:**

| Column | SAP Table | SAP Field | Meaning |
|---|---|---|---|
| `purchase_requisition` | EBAN | BANFN | PR document number |
| `deletion_indicator` | EBAN | LOEKZ | `X` = soft-deleted |
| `release_status` | EBAN | FRGZU | `X`/`XX`/`XXX`... = released at n levels |

---

## KPI 12 — Approved PO Count (NEW)

### Change Directions
New KPI. Displays as fraction: `Approved / Total` (e.g. `750 / 890`). Header level.

- **Total**: `COUNT(DISTINCT purchasing_document)` excluding deleted POs (`EKPO-LOEKZ IN ('L','X')`)
- **Approved**: same + `release_indicator LIKE 'X%'` (`EKKO-FRGKE` — any single or multi-level release)

### SQL
```sql
-- Total Active POs
SELECT COUNT(DISTINCT purchasing_document) FROM po_dump
WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L', 'X'))

-- Approved POs
SELECT COUNT(DISTINCT purchasing_document) FROM po_dump
WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L', 'X'))
  AND release_indicator LIKE 'X%'
```

**SAP field mapping:**

| Column | SAP Table | SAP Field | Meaning |
|---|---|---|---|
| `purchasing_document` | EKKO | EBELN | PO document number |
| `deletion_indicator` | EKPO | LOEKZ | `L` = item deleted, `X` = header cancelled |
| `release_indicator` | EKKO | FRGKE | `X`/`XX`/`XXX`... = released at n levels |

---

## Schema Audit Summary (P1–P8)

All KPI joins verified against `schema.sql`. Findings:

| KPI | Status | Notes |
|---|---|---|
| P1 Total PO Value MTD | ✓ | `created_on`, `net_order_value`, `document_date` all exist |
| P2 Active PO Count | ✓ | Header level intentional |
| P3 High-Value PO Count | ✓ | CAST needed on TEXT field |
| P4 PR-to-PO Days | ✓ | Reads `pr_po_grn_invoice.pr_to_po_days`; fact_builder uses 3-key join |
| P5 PO Approval Cycle | ✓ | Efficiency note: Cartesian product (items × changes) doesn't distort AVG since `created_on` is header-level |
| P6 PO Deletion MTD | ✓ | Item level, `created_on` date |
| P7 PO Amendment Rate | ✓ | `table_key` added via migration |
| P8 Open PO Aging | ✓ | Joins `po_delivery_dump` on `purchasing_document + item` |

---

## Dashboard Layout Changes

| Row | Before | After |
|---|---|---|
| Row 1 | 4 lg cards (grid-cols-4) | Unchanged |
| Row 2 | 6 md cards (grid-cols-6) | 8 md cards (grid-cols-8) |
| Charts | POValueTrend, POCountAndMaverick | + POAgingBuckets, + PODeletionTrend |
| Table | PODeletionMonitor | Unchanged (subtitle updated to "line items") |

### New Frontend Components Added
- `PODeletionTrend` — bar chart, monthly deleted line items, danger color
- `POAgingBuckets` — 4-bar chart with escalating amber→dark red per delay bucket

---

## Key SAP Field Reference (All KPIs)

| Concept | SAP Table | SAP Field | DB Column |
|---|---|---|---|
| PR number | EBAN | BANFN | `purchase_requisition` |
| PR item | EBAN | BNFPO | `item_of_requisition` |
| PR deletion | EBAN | LOEKZ | `deletion_indicator` (`X`=deleted) |
| PR release status | EBAN | FRGZU | `release_status` |
| PR creation date | EBAN | ERDAT | `created_on` |
| PO number | EKKO | EBELN | `purchasing_document` |
| PO item | EKPO | EBELP | `item` |
| PO deletion (item) | EKPO | LOEKZ | `deletion_indicator` (`L`=deleted) |
| PO release indicator | EKKO | FRGKE | `release_indicator` |
| PO creation date | EKKO | ERDAT | `created_on` |
| PO document date | EKKO | BEDAT | `document_date` |
| PO delivery complete | EKPO | ELIKZ | `delivery_completed` (`X`=complete) |
| Change log doc ref | CDHDR | OBJECTID | `object_id` |
| Change log field | CDPOS | FNAME | `field_name` |
| Change log table key | CDPOS | TABKEY | `table_key` (added via migration) |
| Schedule delivery date | EKET | EINDT | `expected_delivery_date` |
