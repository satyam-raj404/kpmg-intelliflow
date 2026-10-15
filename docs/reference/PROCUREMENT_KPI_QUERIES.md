# Procurement Dashboard — KPI SQL Queries

SAP source tables: `01_PR_Dump` → `pr_dump`, `02_PO_Dump` → `po_dump`, `09_Change_Log` → `change_log`

All queries use `ref_date` = MAX(document_date) from po_dump (latest data date) and `MTD` = first day of ref_date's month.  
Monetary unit: INR. Threshold `HIGH_VALUE_THRESHOLD` stored in `kpi_config` (default ₹1,00,00,000).

---

## KPI 1 — Total PO Value (MTD)

**Business question:** What is the total spend committed in POs this month?  
**Target:** —  **Unit:** INR

```sql
SELECT SUM(CAST(net_order_value AS REAL)) AS total_po_value_mtd
FROM po_dump
WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L', 'X'))
  AND created_on >= strftime('%Y-%m-01', :ref_date);
-- created_on = EKKO-ERDAT (PO creation date)
-- Excludes: deletion_indicator = 'L' (item deleted) or 'X'
```

---

## KPI 2 — Active PO Count

**Business question:** How many POs are currently open?  
**Target:** —  **Unit:** Count

```sql
SELECT COUNT(DISTINCT purchasing_document) AS active_po_count
FROM po_dump
WHERE (delivery_completed IS NULL OR delivery_completed = '')
  AND (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L', 'X'));
-- delivery_completed = EKPO-ELIKZ ('X' = fully delivered/closed)
-- No date filter — captures all currently open POs
```

---

## KPI 3 — High-Value PO Count

**Business question:** How many POs exceed the high-value threshold?  
**Target:** Configurable (default ₹1 Cr)  **Unit:** Count

```sql
-- Threshold stored in kpi_config table (user-configurable via Admin → Settings)
SELECT COUNT(DISTINCT purchasing_document) AS high_value_po_count
FROM po_dump
WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L', 'X'))
  AND CAST(net_order_value AS REAL) > :high_value_threshold;
-- net_order_value = EKPO-NETWR (line item net value in INR)
-- To change threshold: UPDATE kpi_config SET config_value = '5000000' WHERE config_key = 'HIGH_VALUE_PO_THRESHOLD';
```

---

## KPI 4 — Average PR-to-PO Conversion Time

**Business question:** How long does it take to convert a PR into a PO?  
**Target:** ≤ 5 days  **Unit:** Days

```sql
-- Item-level calculation (PR item → first PO item)
-- PR:PO is one-to-many at header level; take MIN(PO created_on) per PR line
SELECT AVG(CAST(min_po_days AS REAL)) AS avg_pr_to_po_days
FROM (
    SELECT
        pr.purchase_requisition,
        pr.item_of_requisition,
        MIN(CAST(
            julianday(po.created_on) - julianday(pr.created_on)
        AS INTEGER)) AS min_po_days
    FROM pr_dump pr
    JOIN po_dump po
      ON po.purchase_requisition = pr.purchase_requisition
     AND po.item_of_requisition  = pr.item_of_requisition
    WHERE (po.deletion_indicator IS NULL OR po.deletion_indicator NOT IN ('L', 'X'))
      AND pr.created_on IS NOT NULL AND pr.created_on != ''
      AND po.created_on IS NOT NULL AND po.created_on != ''
    GROUP BY pr.purchase_requisition, pr.item_of_requisition
)
WHERE min_po_days >= 0;
-- pr.created_on = EBAN-ERDAT (PR requisition date)
-- po.created_on = EKKO-ERDAT (PO creation date)
-- MIN() per PR item ensures we use the first PO when a PR spawns multiple POs
```

---

## KPI 5 — PO Cycle Time (Creation → Approval)

**Business question:** How long does it take to get a PO approved?  
**Target:** ≤ 3 days  **Unit:** Days

```sql
-- Approval date sourced from change_log: FRGZU or FRGKE field changed to 'X'
SELECT AVG(CAST(
    julianday(cl.change_date) - julianday(po.created_on)
AS REAL)) AS avg_po_cycle_days
FROM po_dump po
JOIN change_log cl
  ON cl.object_id        = po.purchasing_document
 AND cl.object_class     = 'EINKBELEG'
 AND cl.field_name       IN ('FRGZU', 'FRGKE')
 AND cl.change_indicator  = 'U'
 AND cl.new_value         = 'X'
WHERE po.release_indicator = 'X'
  AND po.created_on IS NOT NULL AND po.created_on != '';
-- po.created_on  = EKKO-ERDAT (PO creation timestamp)
-- cl.change_date = CDHDR-UDATE (date approval stamp was set)
-- change_indicator = 'U' ensures only actual field updates (not inserts/deletes)
```

---

## KPI 6 — PO Deletion Frequency (MTD)

**Business question:** How many POs were deleted/cancelled this month?  
**Target:** ≤ 5 per month  **Unit:** Count

```sql
SELECT COUNT(DISTINCT purchasing_document) AS po_deletion_count_mtd
FROM po_dump
WHERE deletion_indicator = 'L'
  AND document_date >= strftime('%Y-%m-01', :ref_date);
-- deletion_indicator = EKPO-LOEKZ ('L' = line item deletion flag set)
-- document_date = EKKO-BEDAT (document date, used for MTD filter)
```

---

## KPI 7 — PO Amendment Rate

**Business question:** What % of POs were modified after creation?  
**Target:** < 15%  **Unit:** %

```sql
-- Amendments only: change_indicator = 'U' (Update)
-- Excludes: 'I' (Insert = initial creation), 'D' (Delete = deletion event)
-- Excludes release/approval field changes: FRGZU, FRGKE, FRGRL, FRGGR
-- Captures meaningful changes: NETWR, NETPR, MATNR, MENGE, TXZ01, ERNAM, LOEKZ

SELECT
    CAST(amended.cnt AS REAL) * 100.0 / NULLIF(total.cnt, 0) AS po_amendment_rate_pct
FROM (
    SELECT COUNT(DISTINCT cl.object_id) AS cnt
    FROM change_log cl
    WHERE cl.object_class      = 'EINKBELEG'
      AND cl.change_indicator   = 'U'
      AND cl.field_name NOT IN ('FRGZU', 'FRGKE', 'FRGRL', 'FRGGR')
) amended,
(
    SELECT COUNT(DISTINCT purchasing_document) AS cnt
    FROM po_dump
    WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L', 'X'))
) total;
-- object_class = 'EINKBELEG' targets PO change records in CDHDR/CDPOS
-- Denominator: all active (non-deleted) POs
```

---

## KPI 8 — Open PR Aging (> 7 days)

**Business question:** How many PRs are stuck without PO conversion?  
**Target:** ≤ 10 PR lines  **Unit:** Count

```sql
-- Item-level check: PR item has no corresponding PO item
-- PR:PO is one-to-many at header; checking at item level avoids false negatives
-- Age measured from PR created_on (EBAN-ERDAT), not release_date

SELECT COUNT(DISTINCT pr.purchase_requisition || '|' || pr.item_of_requisition) AS open_pr_aging_count
FROM pr_dump pr
WHERE pr.release_status IN ('X', 'XX', 'XXX', 'XXXX', 'XXXXX')
  AND (pr.deletion_indicator IS NULL OR pr.deletion_indicator = '')
  AND pr.created_on IS NOT NULL AND pr.created_on != ''
  AND julianday(:ref_date) - julianday(pr.created_on) > 7
  AND NOT EXISTS (
      SELECT 1 FROM po_dump po
      WHERE po.purchase_requisition = pr.purchase_requisition
        AND po.item_of_requisition  = pr.item_of_requisition
        AND (po.deletion_indicator IS NULL OR po.deletion_indicator NOT IN ('L', 'X'))
  );
-- release_status IN ('X'...'XXXXX') = PR fully released per multi-level strategy
-- NOT EXISTS ensures item has no active PO (PR Qty != PO Qty at item level)
-- :ref_date = MAX(document_date) from po_dump, avoids all-zero on historical data
```

---

## Parameter Reference

| Parameter | Source | Default | How to Change |
|-----------|--------|---------|---------------|
| `:ref_date` | `MAX(po_dump.document_date)` | Today | Auto-detected on each ETL run |
| `MTD` start | `strftime('%Y-%m-01', ref_date)` | 1st of current month | Derived from ref_date |
| `FY` start | April 1 of current/prior year | Indian FY | Derived from ref_date |
| `:high_value_threshold` | `kpi_config WHERE config_key='HIGH_VALUE_PO_THRESHOLD'` | `10000000` (₹1 Cr) | `UPDATE kpi_config SET config_value='<amount>' WHERE config_key='HIGH_VALUE_PO_THRESHOLD'` |

## SAP Field Mapping

| Column (DB) | SAP Field | Table | Meaning |
|-------------|-----------|-------|---------|
| `created_on` | ERDAT | EKKO / EBAN | Document creation date |
| `document_date` | BEDAT | EKKO | PO document date |
| `deletion_indicator` | LOEKZ | EKPO | Item deletion: `L` = deleted |
| `delivery_completed` | ELIKZ | EKPO | `X` = fully delivered/closed |
| `release_indicator` | FRGKE | EKKO | PO release/approval status |
| `release_status` | FRGZU | EKKO / EBAN | Multi-level release accumulator |
| `net_order_value` | NETWR | EKPO | Line item net value (INR) |
| `purchase_requisition` | BANFN | EKPO / EBAN | PR number (FK) |
| `item_of_requisition` | BNFPO | EKPO / EBAN | PR line item (FK) |
| `object_class` (change_log) | OBJECTCLAS | CDHDR | `EINKBELEG`=PO, `BANF`=PR |
| `change_indicator` (change_log) | CHNGIND | CDPOS | `I`=Insert, `U`=Update, `D`=Delete |
