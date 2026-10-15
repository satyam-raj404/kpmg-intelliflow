# IntelliSource — SAP Functional & Query Logic Documentation

> P2P Procurement Analytics | SAP MM + FI Integration Reference
> Target Audience: SAP Functional Consultants, ABAP Developers, Business Analysts

---

## 1. SAP P2P Process Overview

The Procure-to-Pay (P2P) cycle in SAP covers the full procurement lifecycle:

```
PR (Purchase Requisition)
    ↓  ME21N / ME59N
PO (Purchase Order)
    ↓  MIGO
GRN (Goods Receipt Note / Material Document)
    ↓  MIR7 / MIRO
Invoice (Logistics Invoice Verification)
    ↓  F110 / F-53
Payment (Outgoing Payment)
```

### SAP Transaction Codes Mapped to Tables

| SAP Transaction | Table in IntelliSource | Description |
|----------------|------------------------|-------------|
| ME2M / ME2N | `po_dump` | Purchase Order report |
| ME5A | `pr_dump` | Purchase Requisition list |
| MB51 / MIGO | `grn_dump` | Material Documents (GRN) |
| MIR6 / MIR7 | `po_invoice_dump` | Invoice overview |
| F110 / FBL1N | `payment_dump` | Payment documents |
| XK03 / MK03 | `vendor_master` | Vendor master data |

---

## 2. Data Model: SAP Fields → IntelliSource Columns

### `po_dump` (SAP Table: EKKO + EKPO)

| SAP Field | SAP Name | IntelliSource Column | Description |
|-----------|----------|----------------------|-------------|
| EBELN | Purchasing Document | `purchasing_document` | PO number (10 digits) |
| EBELP | Item Number | `item` | PO line item (5 digits) |
| LIFNR | Vendor | `vendor` | Vendor account number |
| NAME1 | Vendor Name | `vendor_name` | From LFA1 join |
| NETWR | Net Order Value | `net_order_value` | Stored as TEXT — always CAST |
| BEDAT | Document Date | `document_date` | PO creation date |
| LOEKZ | Deletion Indicator | `deletion_indicator` | L=item deleted, X=header deleted |
| ELIKZ | Delivery Completed | `delivery_completed` | X = fully delivered |
| FRGKE | Release Indicator | `release_indicator` | Release strategy status |
| TXZ01 | Short Text | `material_description` | Line item description |
| MATKL | Material Group | `material_group` | e.g. 9902=CAPEX, 9904=OPEX IT |
| BUKRS | Company Code | `company_code` | 1001/1002/1003 |
| WERKS | Plant | `plant` | Manufacturing/office location |

**Critical SQL Pattern — Active POs:**
```sql
WHERE deletion_indicator NOT IN ('L', 'X')
  OR deletion_indicator IS NULL
```

**Critical SQL Pattern — Safe Value Cast:**
```sql
CAST(COALESCE(NULLIF(net_order_value, ''), '0') AS REAL)
```

---

### `pr_dump` (SAP Table: EBAN)

| SAP Field | SAP Name | IntelliSource Column |
|-----------|----------|----------------------|
| BANFN | Purchase Requisition | `purchase_requisition` |
| BNFPO | Requisition Item | `item_of_requisition` |
| TXZ01 | Short Text | `material_description` |
| MENGE | Quantity | `order_quantity` |
| MEINS | Unit of Measure | `unit_of_measure` |
| FRGST | Release Status | `release_status` |
| FRGDT | Release Date | `release_date` |
| BADAT / AEDAT | Created On | `created_on` |
| BUKRS | Company Code | `company_code` |
| LOEKZ | Deletion Indicator | `deletion_indicator` |

---

### `grn_dump` (SAP Table: MKPF + MSEG)

| SAP Field | SAP Name | IntelliSource Column |
|-----------|----------|----------------------|
| MBLNR | Material Document | `mat_doc` |
| EBELN | Purchasing Document | `purchasing_document` |
| MENGE | Quantity | `quantity` |
| BUDAT | Posting Date | `posting_date` |

---

### `po_invoice_dump` (SAP Table: RBKP + RSEG)

| SAP Field | SAP Name | IntelliSource Column |
|-----------|----------|----------------------|
| BELNR | Invoice Doc | `invoice_doc` |
| EBELN | Purchasing Document | `purchasing_document` |
| WRBTR | Amount Local CCY | `amount_local_ccy` |
| BLDAT | Invoice Date | `invoice_date` |

---

### `payment_dump` (SAP Table: BKPF + BSEG)

| SAP Field | SAP Name | IntelliSource Column |
|-----------|----------|----------------------|
| BELNR | Payment Document | `payment_doc` |
| LIFNR | Vendor | `vendor` |
| WRBTR | Amount | `amount` |
| BUDAT | Payment Date | `payment_date` |
| EBELN | Purchasing Document | `purchasing_document` |

---

### `vendor_master` (SAP Table: LFA1 + LFB1)

| SAP Field | SAP Name | IntelliSource Column |
|-----------|----------|----------------------|
| LIFNR | Vendor | `vendor` |
| NAME1 | Name | `name1` |
| SPERR | Posting Block | `posting_block_cc` |
| — | MSME Flag | `msme_flag` | Custom extension — not native SAP |

---

## 3. P2P Fact Table Logic (`fact_builder.py`)

The `pr_po_grn_invoice` table is the central analytics table. It joins all P2P stages and computes cycle times.

### Build Logic (Simplified)

```sql
-- Step 1: Link PR → PO via EKPO.BANFN
SELECT pr.purchase_requisition, po.purchasing_document,
       po.vendor, po.vendor_name, po.company_code,
       -- PR to PO cycle time
       DATEDIFF(po.document_date, pr.release_date) AS pr_to_po_days

FROM pr_dump pr
JOIN po_dump po ON po.purchasing_document IN (
    SELECT purchasing_document FROM po_dump WHERE /* pr reference */
)

-- Step 2: Join GRN (first posting per PO)
LEFT JOIN (
    SELECT purchasing_document, MIN(posting_date) AS grn_posting_date
    FROM grn_dump GROUP BY purchasing_document
) grn ON grn.purchasing_document = po.purchasing_document

-- Step 3: Join Invoice (first invoice per PO)
LEFT JOIN (
    SELECT purchasing_document, MIN(invoice_date) AS invoice_posting_date,
           SUM(CAST(amount_local_ccy AS REAL)) AS invoice_amount
    FROM po_invoice_dump GROUP BY purchasing_document
) inv ON inv.purchasing_document = po.purchasing_document

-- Step 4: Join Payment
LEFT JOIN (
    SELECT purchasing_document, MIN(payment_date) AS payment_date
    FROM payment_dump GROUP BY purchasing_document
) pay ON pay.purchasing_document = po.purchasing_document
```

### Cycle Time Columns

| Column | SAP Equivalent | Formula |
|--------|---------------|---------|
| `pr_to_po_days` | — | PO date − PR release date |
| `po_to_grn_days` | — | First GRN posting − PO date |
| `grn_to_invoice_days` | — | Invoice date − GRN posting date |
| `invoice_to_payment_days` | — | Payment date − Invoice date |
| `total_cycle_days` | — | Payment date − PR release date |

### Maverick Buying Flag
```sql
is_maverick = (purchase_requisition IS NULL OR purchase_requisition = '')
-- PO exists but no linked PR = maverick buy (bypassed requisition process)
```

---

## 4. Process Mining Events (`event_generator.py`)

Anomaly detection runs after every data upload. Flags are stored in `process_mining_events`.

### Anomaly Flag Definitions

| Flag | SAP Context | Detection Logic |
|------|-------------|-----------------|
| `SPLIT_PO` | ME21N — split award | Multiple POs to same vendor, same day, similar value (<10% variance), same material group |
| `RETRO_PO` | MIGO before ME21N | GRN posting date < PO document date |
| `NO_GRN` | MIGO missing | PO has invoice but no GRN in grn_dump |
| `PRICE_VARIANCE` | ME21N vs. info record | Order value deviates >20% from vendor's historical average for same material group |
| `MAVERICK_BUY` | BANFN empty in EKPO | PO has no linked purchase requisition |
| `DELETED_AFTER_GRN` | LOEKZ after BUDAT | PO deletion indicator set after GRN was posted (retrospective cancellation) |

### Severity Mapping

| Flag | Severity | Risk |
|------|----------|------|
| `SPLIT_PO` | HIGH | Circumvents value threshold approvals |
| `DELETED_AFTER_GRN` | HIGH | Goods received but PO cancelled — liability risk |
| `PRICE_VARIANCE` | HIGH | Potential fraud or pricing error |
| `NO_GRN` | MEDIUM | Invoice without goods receipt — 3-way match failure |
| `RETRO_PO` | MEDIUM | Goods received before PO approval — compliance issue |
| `MAVERICK_BUY` | LOW | Procurement policy bypass |

---

## 5. CAPEX / OPEX Classification Logic

### Default Classification by Material Group (SAP MATKL)

| Material Group | Classification | SAP Context |
|----------------|---------------|-------------|
| `9902` | CAPEX | Capital equipment |
| `9904` | CAPEX | IT hardware / infrastructure |
| `IT`, `CLOUD`, `LICENSE`, `SOFTWARE`, `SAAS` | OPEX | IT operating expenditure |
| All others | OPEX | Default operational spend |

### Classification Hierarchy

```
1. Manual override by user (tagged_by = 'USER')  ← highest priority, never overwritten
2. Profit Center default_capex_opex flag          ← overrides SYSTEM tags
3. Material group default                         ← lowest priority (SYSTEM tag)
```

### po_categorization Table

```sql
CREATE TABLE po_categorization (
    purchasing_document TEXT,
    item               TEXT,
    capex_opex_flag    TEXT,  -- 'CAPEX' or 'OPEX'
    profit_center      TEXT,
    tagged_by          TEXT,  -- 'SYSTEM' or 'USER'
    tagged_at          TEXT,
    tagged_by_user     TEXT
);
```

**Cascade Query (on Profit Center flag change):**
```sql
-- Only update SYSTEM-tagged rows — protects manual tags
UPDATE po_categorization
SET capex_opex_flag = 'CAPEX'   -- or 'OPEX'
WHERE profit_center = 'PC-FAC-01'
  AND tagged_by = 'SYSTEM';
```

---

## 6. Profit Center Master (`profit_center_master`)

### Table Structure

```sql
CREATE TABLE profit_center_master (
    id                 SERIAL PRIMARY KEY,
    profit_center      TEXT UNIQUE NOT NULL,   -- e.g. PC-FAC-01
    pc_name            TEXT,                   -- e.g. Facilities - Plant 1001
    company_code       TEXT DEFAULT '1001',    -- BUKRS
    dept_code          TEXT,                   -- FAC/ENG/ADM/ITH/ITS/STR/SCM/OPS
    plant              TEXT,                   -- WERKS
    material_group     TEXT,                   -- MATKL
    default_capex_opex TEXT DEFAULT 'OPEX',
    capex_budget       REAL DEFAULT 0,
    opex_budget        REAL DEFAULT 0,
    bu_type            TEXT DEFAULT 'CORPORATE',
    responsible_person TEXT,
    is_active          INTEGER DEFAULT 1
);
```

### Actual Spend Query (GET /profit-centers)

```sql
SELECT pcm.*,
    COALESCE(SUM(CASE WHEN p.capex_opex_flag = 'CAPEX'
        THEN CAST(p.net_order_value AS REAL) ELSE 0 END), 0) AS actual_capex,
    COALESCE(SUM(CASE WHEN p.capex_opex_flag = 'OPEX'
        THEN CAST(p.net_order_value AS REAL) ELSE 0 END), 0) AS actual_opex
FROM profit_center_master pcm
LEFT JOIN po_dump p
    ON p.plant = pcm.plant
    AND p.material_group = pcm.material_group
WHERE pcm.is_active = 1
GROUP BY pcm.id
ORDER BY (actual_capex + actual_opex) DESC;
```

**Note:** SAP `po_dump` has no explicit `profit_center` column. Profit center is derived by the **plant × material_group** combination matching `profit_center_master`. This mirrors SAP CO account assignment logic.

---

## 7. KPI Query Reference

### Procurement KPIs

**P1 — Total PO Value (MTD)**
```sql
SELECT SUM(CAST(net_order_value AS REAL))
FROM po_dump
WHERE deletion_indicator NOT IN ('L', 'X')
  AND COALESCE(created_on, document_date) >= '{MTD_START}';
-- MTD_START = first day of current month
```

**P2 — Total PO Value (FY)**
```sql
SELECT SUM(CAST(net_order_value AS REAL))
FROM po_dump
WHERE deletion_indicator NOT IN ('L', 'X')
  AND COALESCE(created_on, document_date) >= '{FY_START}';
-- FY_START = April 1 of current fiscal year (Indian FY)
```

**P3 — Average PO Value**
```sql
SELECT AVG(CAST(COALESCE(NULLIF(net_order_value,''),'0') AS REAL))
FROM po_dump
WHERE deletion_indicator NOT IN ('L', 'X');
```

**P4 — PO Count (MTD)**
```sql
SELECT COUNT(DISTINCT purchasing_document)
FROM po_dump
WHERE deletion_indicator NOT IN ('L', 'X')
  AND COALESCE(created_on, document_date) >= '{MTD_START}';
```

**P5 — High Value POs (> threshold)**
```sql
SELECT COUNT(DISTINCT purchasing_document)
FROM po_dump
WHERE CAST(COALESCE(NULLIF(net_order_value,''),'0') AS REAL) > {HIGH_VALUE_THRESHOLD}
  AND deletion_indicator NOT IN ('L', 'X');
```

**P6 — PR to PO Conversion Rate**
```sql
SELECT
    COUNT(DISTINCT purchasing_document) FILTER (WHERE purchase_requisition IS NOT NULL)
    / NULLIF(COUNT(DISTINCT purchasing_document), 0)::REAL * 100
FROM pr_po_grn_invoice;
```

**P7 — Avg PR to PO Days**
```sql
SELECT ROUND(AVG(pr_to_po_days::numeric), 1)
FROM pr_po_grn_invoice
WHERE pr_to_po_days IS NOT NULL AND pr_to_po_days >= 0;
```

---

### Financial KPIs

**F1 — Total Invoice Value (FY)**
```sql
SELECT SUM(CAST(COALESCE(NULLIF(amount_local_ccy,''),'0') AS REAL))
FROM po_invoice_dump
WHERE invoice_date >= '{FY_START}';
```

**F2 — Total Payments Made (FY)**
```sql
SELECT SUM(CAST(COALESCE(NULLIF(amount,''),'0') AS REAL))
FROM payment_dump
WHERE payment_date >= '{FY_START}';
```

**F3 — Pending Invoice Value (3-way match gap)**
```sql
SELECT SUM(CAST(COALESCE(NULLIF(amount_local_ccy,''),'0') AS REAL))
FROM po_invoice_dump inv
WHERE NOT EXISTS (
    SELECT 1 FROM payment_dump pay
    WHERE pay.purchasing_document = inv.purchasing_document
);
```

**F4 — CAPEX Spend (FY)**
```sql
SELECT SUM(CAST(COALESCE(NULLIF(net_order_value,''),'0') AS REAL))
FROM po_dump
WHERE capex_opex_flag = 'CAPEX'
  AND deletion_indicator NOT IN ('L', 'X')
  AND COALESCE(created_on, document_date) >= '{FY_START}';
```

**F5 — OPEX Spend (FY)**
```sql
SELECT SUM(CAST(COALESCE(NULLIF(net_order_value,''),'0') AS REAL))
FROM po_dump
WHERE capex_opex_flag = 'OPEX'
  AND deletion_indicator NOT IN ('L', 'X')
  AND COALESCE(created_on, document_date) >= '{FY_START}';
```

---

### Vendor KPIs

**V1 — Active Vendor Count**
```sql
SELECT COUNT(DISTINCT vendor)
FROM po_dump
WHERE deletion_indicator NOT IN ('L', 'X')
  AND COALESCE(created_on, document_date) >= '{FY_START}';
```

**V2 — Blocked Vendor Count**
```sql
SELECT COUNT(*)
FROM vendor_master
WHERE posting_block_cc IS NOT NULL AND posting_block_cc != '';
```

**V3 — MSME Vendor Count**
```sql
SELECT COUNT(*)
FROM vendor_master
WHERE msme_flag = 'X' OR msme_flag = '1' OR msme_flag = 'true';
```

**V4 — Top 10 Vendors by Spend**
```sql
SELECT vm.vendor, vm.name1,
    COUNT(DISTINCT p.purchasing_document) as po_count,
    SUM(CAST(COALESCE(NULLIF(p.net_order_value,''),'0') AS REAL)) as total_spend
FROM vendor_master vm
JOIN po_dump p ON p.vendor = vm.vendor
WHERE p.deletion_indicator NOT IN ('L', 'X')
GROUP BY vm.vendor, vm.name1
ORDER BY total_spend DESC
LIMIT 10;
```

**V5 — Vendor Concentration (Top 5 vendor % of total)**
```sql
WITH top5 AS (
    SELECT SUM(CAST(COALESCE(NULLIF(net_order_value,''),'0') AS REAL)) as top5_spend
    FROM po_dump
    WHERE vendor IN (
        SELECT vendor FROM po_dump
        WHERE deletion_indicator NOT IN ('L','X')
        GROUP BY vendor
        ORDER BY SUM(CAST(COALESCE(NULLIF(net_order_value,''),'0') AS REAL)) DESC
        LIMIT 5
    )
    AND deletion_indicator NOT IN ('L','X')
),
total AS (
    SELECT SUM(CAST(COALESCE(NULLIF(net_order_value,''),'0') AS REAL)) as total_spend
    FROM po_dump WHERE deletion_indicator NOT IN ('L','X')
)
SELECT ROUND((top5.top5_spend / NULLIF(total.total_spend, 0) * 100)::numeric, 1)
FROM top5, total;
```

---

### Utilization KPIs

**U1 — CAPEX % of Total**
```sql
SELECT ROUND(
    SUM(CASE WHEN capex_opex_flag='CAPEX'
        THEN CAST(COALESCE(NULLIF(net_order_value,''),'0') AS REAL) ELSE 0 END)
    / NULLIF(SUM(CAST(COALESCE(NULLIF(net_order_value,''),'0') AS REAL)),0) * 100
    ::numeric, 1)
FROM po_dump
WHERE deletion_indicator NOT IN ('L','X');
```

**U2 — Spend by Plant (Breakdown)**
```sql
SELECT plant,
    SUM(CAST(COALESCE(NULLIF(net_order_value,''),'0') AS REAL)) as total_spend,
    SUM(CASE WHEN capex_opex_flag='CAPEX'
        THEN CAST(COALESCE(NULLIF(net_order_value,''),'0') AS REAL) ELSE 0 END) as capex,
    SUM(CASE WHEN capex_opex_flag='OPEX'
        THEN CAST(COALESCE(NULLIF(net_order_value,''),'0') AS REAL) ELSE 0 END) as opex
FROM po_dump
WHERE deletion_indicator NOT IN ('L','X')
GROUP BY plant
ORDER BY total_spend DESC;
```

**U3 — Spend by Material Group (Dept-wise)**
```sql
SELECT material_group,
    SUM(CASE WHEN capex_opex_flag='CAPEX'
        THEN CAST(COALESCE(NULLIF(net_order_value,''),'0') AS REAL) ELSE 0 END) as capex,
    SUM(CASE WHEN capex_opex_flag='OPEX'
        THEN CAST(COALESCE(NULLIF(net_order_value,''),'0') AS REAL) ELSE 0 END) as opex
FROM po_dump
WHERE deletion_indicator NOT IN ('L','X')
GROUP BY material_group
ORDER BY (capex + opex) DESC;
```

---

### Leadership KPIs

**L1 — Total Procurement Spend (FY)**
```sql
SELECT SUM(CAST(COALESCE(NULLIF(net_order_value,''),'0') AS REAL))
FROM po_dump
WHERE deletion_indicator NOT IN ('L','X')
  AND COALESCE(created_on, document_date) >= '{FY_START}';
```

**L2 — Compliance Rate (POs with PR)**
```sql
SELECT ROUND(
    COUNT(*) FILTER (WHERE purchase_requisition IS NOT NULL AND purchase_requisition != '')
    / NULLIF(COUNT(*), 0)::REAL * 100
    ::numeric, 1)
FROM pr_po_grn_invoice;
```

**L3 — 3-Way Match Rate (PO + GRN + Invoice)**
```sql
SELECT ROUND(
    COUNT(*) FILTER (
        WHERE grn_posting_date IS NOT NULL AND grn_posting_date != ''
        AND invoice_posting_date IS NOT NULL AND invoice_posting_date != ''
    ) / NULLIF(COUNT(*), 0)::REAL * 100
    ::numeric, 1)
FROM pr_po_grn_invoice
WHERE purchasing_document IS NOT NULL;
```

---

## 8. SAP Integration Roadmap

### Current State: File-Based Integration
Data flows from SAP via CSV exports → IntelliSource upload → PostgreSQL.

```
SAP                    IntelliSource
─────────────────────  ──────────────────────
ME2M (PO report)   →   po_dump CSV upload
ME5A (PR report)   →   pr_dump CSV upload
MB51 (GRN report)  →   grn_dump CSV upload
MIR6 (Invoice)     →   po_invoice_dump CSV
FBL1N (Payments)   →   payment_dump CSV
XK03 (Vendor)      →   vendor_master CSV
```

### Future State: Real-Time Integration Options

**Option 1 — SAP OData Services (Recommended)**
- Expose standard SAP OData v4 services: `MM_PUR_PO_MAINT_V2_SRV`, `API_PURCHASEREQ_PROCESS_SRV`
- IntelliSource backend polls via scheduled job or event-driven webhook
- No ABAP development required — uses SAP Gateway standard services

**Option 2 — ABAP Function Module / RFC**
- Custom ABAP FM reads EKKO/EKPO/EBAN/MKPF/MSEG
- Called via `pyrfc` library from Python backend
- Best for complex joins not exposed via OData

**Option 3 — SAP Event Mesh (BTP)**
- SAP Business Technology Platform event mesh
- PO/GRN events published on change → consumed by IntelliSource webhook
- Real-time, no polling — best for production

**Option 4 — Database Link (HANA / Oracle)**
- Direct SQL via HANA ODBC or Oracle transparent gateway
- Read EKKO, EKPO, EBAN, MKPF, MSEG, BKPF, BSEG directly
- Fastest but requires DBA setup and network access to SAP DB

---

## 9. Value Units

All monetary values in IntelliSource are stored as raw SAP values (INR by default).

Display convention in UI:
- Values ≥ 1 Crore: displayed as `₹X.XX Cr`
- Values < 1 Crore: displayed as `₹X.XX L` (Lakhs)
- KPI engine divides by `1e7` for Cr display

```python
actual_capex = round(raw_value / 1e7, 2)  # convert to Crores
```

---

## 10. Indian Fiscal Year Logic

SAP FY in Indian entities typically runs April 1 → March 31.

```python
# Determine FY start
d = date.fromisoformat(ref_date)
fy_start_year = d.year if d.month >= 4 else d.year - 1
FY_START = f"{fy_start_year}-04-01"

# Example: ref_date = 2024-07-15
# fy_start_year = 2024
# FY_START = "2024-04-01"  (FY 2024-25)

# Example: ref_date = 2024-01-15
# fy_start_year = 2023
# FY_START = "2023-04-01"  (FY 2023-24)
```

KPIs use `ref_date = MAX(document_date)` from `po_dump` as the anchor date, not `GETDATE()`, to support historical data analysis.
