# Utilization Dashboard — KPI Reference Sheet

> All SQL shown with resolved filter constants:
> - `NOT_DELETED` = `(deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))`
> - `CAPEX_FLAG` = `UPPER(COALESCE(capex_opex_flag,'OPEX')) = 'CAPEX'`
> - `OPEX_FLAG`  = `UPPER(COALESCE(capex_opex_flag,'OPEX')) = 'OPEX'`
> - `{FY}` = `'YYYY-04-01'` (Indian Fiscal Year, April 1 start)
> - `{CC}` = `AND company_code = '100X'` (omitted when ALL)

---

## Section 1 — Core CAPEX / OPEX KPIs

### U1 — Total CAPEX Spend (YTD)
| Field | Value |
|---|---|
| KPI Code | `CAPEX_SPEND_YTD` |
| Unit | INR |
| Display | ₹X.XX Cr |
| Source Table | `po_dump` |

**Logic:** Sum of net order value for all active CAPEX-flagged POs from FY start to date.

```sql
SELECT SUM(CAST(net_order_value AS REAL))
FROM po_dump
WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))
  AND document_date >= '2024-04-01'
  AND UPPER(COALESCE(capex_opex_flag,'OPEX')) = 'CAPEX';
```

---

### U2 — Total OPEX Spend (YTD)
| Field | Value |
|---|---|
| KPI Code | `OPEX_SPEND_YTD` |
| Unit | INR |
| Display | ₹X.XX Cr |
| Source Table | `po_dump` |

**Logic:** Sum of net order value for all active OPEX-flagged POs from FY start to date.

```sql
SELECT SUM(CAST(net_order_value AS REAL))
FROM po_dump
WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))
  AND document_date >= '2024-04-01'
  AND UPPER(COALESCE(capex_opex_flag,'OPEX')) = 'OPEX';
```

---

### U3 — CAPEX as % of Total Spend
| Field | Value |
|---|---|
| KPI Code | `CAPEX_PCT` |
| Unit | % |
| Source | Computed from U1 + U2 |

**Logic:** Derived in Python. No separate SQL.

```python
total_spend = CAPEX_SPEND_YTD + OPEX_SPEND_YTD
CAPEX_PCT = round(CAPEX_SPEND_YTD / total_spend * 100, 1)
```

---

### U4 — OPEX as % of Total Spend
| Field | Value |
|---|---|
| KPI Code | `OPEX_PCT` |
| Unit | % |
| Source | Computed from U1 + U2 |

```python
OPEX_PCT = round(OPEX_SPEND_YTD / total_spend * 100, 1)
```

---

### U5 — CAPEX PO Count (YTD)
| Field | Value |
|---|---|
| KPI Code | `CAPEX_PO_COUNT` |
| Unit | count |
| Source Table | `po_dump` |

**Logic:** Distinct PO count for CAPEX-flagged, active POs in current FY.

```sql
SELECT COUNT(DISTINCT purchasing_document)
FROM po_dump
WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))
  AND document_date >= '2024-04-01'
  AND UPPER(COALESCE(capex_opex_flag,'OPEX')) = 'CAPEX';
```

---

### U6 — OPEX PO Count (YTD)
| Field | Value |
|---|---|
| KPI Code | `OPEX_PO_COUNT` |
| Unit | count |
| Source Table | `po_dump` |

```sql
SELECT COUNT(DISTINCT purchasing_document)
FROM po_dump
WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))
  AND document_date >= '2024-04-01'
  AND UPPER(COALESCE(capex_opex_flag,'OPEX')) = 'OPEX';
```

---

### U7 — Average CAPEX PO Value
| Field | Value |
|---|---|
| KPI Code | `CAPEX_AVG_PO_VALUE` |
| Unit | INR |
| Source Table | `po_dump` |

**Logic:** Average value across all active CAPEX POs (all-time, not FY-filtered).

```sql
SELECT AVG(CAST(net_order_value AS REAL))
FROM po_dump
WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))
  AND UPPER(COALESCE(capex_opex_flag,'OPEX')) = 'CAPEX';
```

---

### U8 — Average OPEX PO Value
| Field | Value |
|---|---|
| KPI Code | `OPEX_AVG_PO_VALUE` |
| Unit | INR |
| Source Table | `po_dump` |

```sql
SELECT AVG(CAST(net_order_value AS REAL))
FROM po_dump
WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))
  AND UPPER(COALESCE(capex_opex_flag,'OPEX')) = 'OPEX';
```

---

### U9 — CAPEX Pending Delivery Value
| Field | Value |
|---|---|
| KPI Code | `CAPEX_PENDING_VALUE` |
| Unit | INR |
| Source Table | `po_dump` |

**Logic:** CAPEX POs where goods not yet fully delivered (`delivery_completed` is blank).

```sql
SELECT SUM(CAST(net_order_value AS REAL))
FROM po_dump
WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))
  AND UPPER(COALESCE(capex_opex_flag,'OPEX')) = 'CAPEX'
  AND (delivery_completed IS NULL OR delivery_completed = '');
```

---

### U10 — OPEX Pending Delivery Value
| Field | Value |
|---|---|
| KPI Code | `OPEX_PENDING_VALUE` |
| Unit | INR |
| Source Table | `po_dump` |

```sql
SELECT SUM(CAST(net_order_value AS REAL))
FROM po_dump
WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))
  AND UPPER(COALESCE(capex_opex_flag,'OPEX')) = 'OPEX'
  AND (delivery_completed IS NULL OR delivery_completed = '');
```

---

## Section 2 — Category & Plant Breakdown KPIs (JSON)

### U11 — CAPEX by Category
| Field | Value |
|---|---|
| KPI Code | `CAPEX_BY_CATEGORY` |
| Unit | json |
| Used For | Dept-wise filter on Utilization dashboard |

**Logic:** Top 6 material groups by CAPEX spend. Returns JSON array.

```sql
SELECT material_group,
       SUM(CAST(net_order_value AS REAL)) AS value,
       COUNT(DISTINCT purchasing_document) AS po_count
FROM po_dump
WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))
  AND UPPER(COALESCE(capex_opex_flag,'OPEX')) = 'CAPEX'
GROUP BY material_group
ORDER BY value DESC
LIMIT 6;
```

**Output shape:**
```json
[
  { "mg": "9902", "name": "Electrical Equip.", "value": 1250000000.0, "po_count": 42 },
  { "mg": "9904", "name": "IT Hardware",       "value":  980000000.0, "po_count": 31 }
]
```

**Material Group Names:**
| Code | Name |
|------|------|
| 9901 | Civil Works |
| 9902 | Electrical Equip. |
| 9903 | Office Supplies |
| 9904 | IT Hardware |
| 9905 | IT Software |
| 9906 | Consulting |
| 9907 | Logistics |
| 9908 | Maintenance |

---

### U12 — OPEX by Category
| Field | Value |
|---|---|
| KPI Code | `OPEX_BY_CATEGORY` |
| Unit | json |

```sql
SELECT material_group,
       SUM(CAST(net_order_value AS REAL)) AS value,
       COUNT(DISTINCT purchasing_document) AS po_count
FROM po_dump
WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))
  AND UPPER(COALESCE(capex_opex_flag,'OPEX')) = 'OPEX'
GROUP BY material_group
ORDER BY value DESC
LIMIT 6;
```

---

### U13 — CAPEX / OPEX by Plant
| Field | Value |
|---|---|
| KPI Code | `CAPEX_OPEX_BY_PLANT` |
| Unit | json |
| Used For | Grouped bar chart on Utilization dashboard |

**Logic:** All active POs grouped by plant, split into CAPEX and OPEX values.

```sql
SELECT plant,
       SUM(CASE WHEN UPPER(COALESCE(capex_opex_flag,'OPEX')) = 'CAPEX'
           THEN CAST(net_order_value AS REAL) ELSE 0 END) AS capex,
       SUM(CASE WHEN UPPER(COALESCE(capex_opex_flag,'OPEX')) = 'OPEX'
           THEN CAST(net_order_value AS REAL) ELSE 0 END) AS opex
FROM po_dump
WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))
GROUP BY plant
ORDER BY (capex + opex) DESC;
```

**Output shape:**
```json
[
  { "plant": "1001", "capex": 2500000000.0, "opex": 1800000000.0, "total": 4300000000.0 },
  { "plant": "1002", "capex": 1200000000.0, "opex": 2100000000.0, "total": 3300000000.0 }
]
```

---

## Section 3 — Materials KPIs

### MAT1 — Material Delivery Utilization %
| Field | Value |
|---|---|
| KPI Code | `MAT_DELIV_UTIL_RATE` |
| Unit | % |
| Source Tables | `po_dump`, `grn_dump`, `po_categorization` |

**Logic:** GRN quantity received ÷ PO ordered quantity × 100. Only movement type 101 (goods receipt), debit entries. Excludes software POs.

```sql
SELECT SUM(CAST(COALESCE(NULLIF(g.quantity,''),'0') AS REAL))   AS grn_qty,
       SUM(CAST(COALESCE(NULLIF(p.order_quantity,''),'0') AS REAL)) AS po_qty
FROM po_dump p
JOIN grn_dump g
  ON p.purchasing_document = g.purchasing_document
  AND p.item = g.item
LEFT JOIN po_categorization c
  ON p.purchasing_document = c.purchasing_document
  AND p.item = c.item
WHERE g.movement_type = '101'
  AND g.debit_credit_ind = 'S'
  AND (p.deletion_indicator IS NULL OR p.deletion_indicator NOT IN ('L','X'))
  AND (c.po_category IS NULL OR c.po_category = 'MATERIAL');

-- Python: del_util = round(grn_qty / po_qty * 100, 1)
```

---

### MAT2 — Delivery Completed PO %
| Field | Value |
|---|---|
| KPI Code | `MAT_DELIVERY_COMPLETE_PCT` |
| Unit | % |
| Source Table | `po_dump` |

**Logic:** % of active POs in current FY where SAP delivery-complete flag (`delivery_completed = 'X'`) is set.

```sql
SELECT COUNT(CASE WHEN delivery_completed = 'X' THEN 1 END) * 100.0
       / NULLIF(COUNT(*), 0)
FROM po_dump
WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))
  AND document_date >= '2024-04-01';
```

---

### MAT3 — Open PO Value Not GRN'd (Cr)
| Field | Value |
|---|---|
| KPI Code | `MAT_OPEN_PO_VALUE` |
| Unit | INR Cr |
| Source Table | `pr_po_grn_invoice` (fact table) |

**Logic:** Sum of (PO value − GRN amount) for POs where delivery is less than 95% complete.

```sql
SELECT SUM(f.po_net_value - COALESCE(f.grn_amount, 0))
FROM pr_po_grn_invoice f
WHERE f.po_deletion_indicator NOT IN ('L','X')
  AND COALESCE(f.grn_amount, 0) < f.po_net_value * 0.95
  AND f.po_net_value > 0;

-- Display: value / 1e7 = Crores
```

---

### MAT4 — Material CAPEX Spend YTD (Cr)
| Field | Value |
|---|---|
| KPI Code | `MAT_CAPEX_SPEND` |
| Unit | INR Cr |
| Source Tables | `po_dump`, `po_categorization` |

**Logic:** CAPEX spend only for POs explicitly categorized as `po_category = 'MATERIAL'` in po_categorization.

```sql
SELECT SUM(CAST(p.net_order_value AS REAL))
FROM po_dump p
JOIN po_categorization c
  ON p.purchasing_document = c.purchasing_document
  AND p.item = c.item
WHERE c.po_category = 'MATERIAL'
  AND c.capex_opex_flag = 'CAPEX'
  AND (p.deletion_indicator IS NULL OR p.deletion_indicator NOT IN ('L','X'))
  AND p.document_date >= '2024-04-01';
```

---

### MAT5 — Material OPEX Spend YTD (Cr)
| Field | Value |
|---|---|
| KPI Code | `MAT_OPEX_SPEND` |
| Unit | INR Cr |

Same as MAT4 with `capex_opex_flag = 'OPEX'`.

---

### MAT6 — Material Licensing Cost Total (Cr)
| Field | Value |
|---|---|
| KPI Code | `MAT_LICENSE_COST_TOT` |
| Unit | INR Cr |
| Source Tables | `material_license_cost`, `po_dump` |

**Logic:** Sum of license fees from material license cost table joined to active POs.

```sql
SELECT SUM(mlc.license_fee_inr)
FROM material_license_cost mlc
JOIN po_dump p
  ON mlc.purchasing_document = p.purchasing_document
  AND mlc.item = p.item
WHERE (p.deletion_indicator IS NULL OR p.deletion_indicator NOT IN ('L','X'));
```

---

### MAT7 — Material License Cost Breakdown
| Field | Value |
|---|---|
| KPI Code | `MAT_LICENSE_BREAKDOWN` |
| Unit | json |

```sql
SELECT mlc.license_type,
       SUM(mlc.license_fee_inr) AS total_fee
FROM material_license_cost mlc
JOIN po_dump p
  ON mlc.purchasing_document = p.purchasing_document
  AND mlc.item = p.item
WHERE (p.deletion_indicator IS NULL OR p.deletion_indicator NOT IN ('L','X'))
GROUP BY mlc.license_type;
```

---

### MAT8 — 3-Way Match Rate (Materials %)
| Field | Value |
|---|---|
| KPI Code | `MAT_3WAY_MATCH` |
| Unit | % |
| Source Tables | `pr_po_grn_invoice`, `po_categorization` |

**Logic:** % of material POs where invoice amount is within 5% of GRN amount (3-way match pass).

```sql
SELECT
    COUNT(CASE
        WHEN f.grn_amount > 0
         AND ABS(f.invoice_amount - f.grn_amount) / NULLIF(f.grn_amount, 0) < 0.05
        THEN 1 END) * 100.0
    / NULLIF(COUNT(CASE WHEN f.grn_amount > 0 THEN 1 END), 0)
FROM pr_po_grn_invoice f
LEFT JOIN po_categorization c
  ON f.purchasing_document = c.purchasing_document
  AND f.item = c.item
WHERE f.po_deletion_indicator NOT IN ('L','X')
  AND (c.po_category IS NULL OR c.po_category = 'MATERIAL');
```

---

### MAT9 — Vendor GRN Fill Rate (JSON)
| Field | Value |
|---|---|
| KPI Code | `MAT_VENDOR_FILL_RATE` |
| Unit | json |
| Used For | Bar chart — vendor delivery performance |

**Logic:** GRN qty ÷ PO ordered qty per vendor. Top 8 vendors by GRN volume.

```sql
SELECT p.vendor_name,
       SUM(CAST(COALESCE(NULLIF(g.quantity,''),'0') AS REAL))      AS grn_qty,
       SUM(CAST(COALESCE(NULLIF(p.order_quantity,''),'0') AS REAL)) AS po_qty
FROM po_dump p
JOIN grn_dump g
  ON p.purchasing_document = g.purchasing_document
  AND p.item = g.item
WHERE g.movement_type = '101'
  AND g.debit_credit_ind = 'S'
  AND (p.deletion_indicator IS NULL OR p.deletion_indicator NOT IN ('L','X'))
GROUP BY p.vendor_name
HAVING SUM(CAST(COALESCE(NULLIF(p.order_quantity,''),'0') AS REAL)) > 0
ORDER BY grn_qty DESC
LIMIT 8;

-- Python: fill_pct = round(grn_qty / po_qty * 100, 1)
```

---

### MAT10 — Material Spend by Category (JSON)
| Field | Value |
|---|---|
| KPI Code | `MAT_CAT_BREAKDOWN` |
| Unit | json |
| Used For | Category spend table on dashboard |

```sql
SELECT COALESCE(c.sub_category, p.material_group, 'OTHER') AS cat,
       SUM(CAST(p.net_order_value AS REAL)) AS spend,
       COUNT(DISTINCT p.purchasing_document) AS po_count
FROM po_dump p
LEFT JOIN po_categorization c
  ON p.purchasing_document = c.purchasing_document
  AND p.item = c.item
WHERE (p.deletion_indicator IS NULL OR p.deletion_indicator NOT IN ('L','X'))
  AND p.document_date >= '2024-04-01'
  AND (c.po_category IS NULL OR c.po_category = 'MATERIAL')
GROUP BY cat
ORDER BY spend DESC
LIMIT 8;
```

---

## Section 4 — Filter Logic (Dept-wise)

The dept-wise filter on the Utilization dashboard works **client-side** using pre-loaded `CAPEX_BY_CATEGORY` and `OPEX_BY_CATEGORY` JSON from `kpi_results`.

**Filter pattern (TypeScript):**
```typescript
function _deptSpend(kpiData, dept) {
  if (!kpiData || dept === "ALL") return null;
  const capexCat = parse("CAPEX_BY_CATEGORY").find(c => c.mg === dept);
  const opexCat  = parse("OPEX_BY_CATEGORY").find(c => c.mg === dept);
  return {
    capex:       capexCat?.value ?? 0,
    opex:        opexCat?.value ?? 0,
    capexPct:    ...,
    opexPct:     ...,
    capexPoCount: capexCat?.po_count ?? 0,
    opexPoCount:  opexCat?.po_count ?? 0,
  };
}
```

**Dept filter maps to material_group codes:**
| Dept Label | material_group |
|-----------|---------------|
| Civil Works | 9901 |
| Electrical | 9902 |
| Office | 9903 |
| IT Hardware | 9904 |
| IT Software | 9905 |
| Consulting | 9906 |
| Logistics | 9907 |
| Maintenance | 9908 |

---

## Summary Table

| # | KPI Code | KPI Name | Unit | Table(s) | FY Filtered |
|---|----------|----------|------|----------|-------------|
| U1 | `CAPEX_SPEND_YTD` | Total CAPEX Spend (YTD) | INR | po_dump | Yes |
| U2 | `OPEX_SPEND_YTD` | Total OPEX Spend (YTD) | INR | po_dump | Yes |
| U3 | `CAPEX_PCT` | CAPEX % of Total | % | Derived | Yes |
| U4 | `OPEX_PCT` | OPEX % of Total | % | Derived | Yes |
| U5 | `CAPEX_PO_COUNT` | CAPEX PO Count (YTD) | count | po_dump | Yes |
| U6 | `OPEX_PO_COUNT` | OPEX PO Count (YTD) | count | po_dump | Yes |
| U7 | `CAPEX_AVG_PO_VALUE` | Avg CAPEX PO Value | INR | po_dump | No |
| U8 | `OPEX_AVG_PO_VALUE` | Avg OPEX PO Value | INR | po_dump | No |
| U9 | `CAPEX_PENDING_VALUE` | CAPEX Pending Delivery | INR | po_dump | No |
| U10 | `OPEX_PENDING_VALUE` | OPEX Pending Delivery | INR | po_dump | No |
| U11 | `CAPEX_BY_CATEGORY` | CAPEX by Material Group | json | po_dump | No |
| U12 | `OPEX_BY_CATEGORY` | OPEX by Material Group | json | po_dump | No |
| U13 | `CAPEX_OPEX_BY_PLANT` | CAPEX/OPEX by Plant | json | po_dump | No |
| M1 | `MAT_DELIV_UTIL_RATE` | Material Delivery Utilization % | % | po_dump, grn_dump | No |
| M2 | `MAT_DELIVERY_COMPLETE_PCT` | Delivery Completed PO % | % | po_dump | Yes |
| M3 | `MAT_OPEN_PO_VALUE` | Open PO Value Not GRN'd | INR Cr | pr_po_grn_invoice | No |
| M4 | `MAT_CAPEX_SPEND` | Material CAPEX Spend YTD | INR Cr | po_dump, po_categorization | Yes |
| M5 | `MAT_OPEX_SPEND` | Material OPEX Spend YTD | INR Cr | po_dump, po_categorization | Yes |
| M6 | `MAT_LICENSE_COST_TOT` | Material Licensing Cost Total | INR Cr | material_license_cost, po_dump | No |
| M7 | `MAT_LICENSE_BREAKDOWN` | License Cost by Type | json | material_license_cost, po_dump | No |
| M8 | `MAT_3WAY_MATCH` | 3-Way Match Rate (Materials) | % | pr_po_grn_invoice, po_categorization | No |
| M9 | `MAT_VENDOR_FILL_RATE` | Vendor GRN Fill Rate | json | po_dump, grn_dump | No |
| M10 | `MAT_CAT_BREAKDOWN` | Material Spend by Category | json | po_dump, po_categorization | Yes |
