# Utilization Dashboard — Software & Materials Extension

## Summary

Extended the CAPEX/OPEX Utilization dashboard with two new sections:
**Software License Utilization** and **Materials Utilization**.

---

## Schema Changes (`backend/schema.sql`)

### Extended `license_usage`
Added columns: `profit_center`, `license_type`, `vendor`, `po_reference`.

### New Tables

| Table | Purpose |
|---|---|
| `po_categorization` | Per-PO/item manual or SYSTEM-tagged category, CAPEX/OPEX flag, profit center, license type |
| `material_license_cost` | Royalty / import license / patent fees per PO item (SAP equiv: KONV ZLIC/ZROY) |
| `profit_center_master` | Profit center → company, BU type, responsible person |
| `pc_budget` | Profit center annual budget (CAPEX/OPEX) with approval metadata |

`po_categorization` uses `UNIQUE(purchasing_document, item)` and a `tagged_by` column to protect manual user overrides from SYSTEM auto-tags.

---

## Backend Changes (`backend/services/kpi_engine.py`)

### `_auto_categorize(conn)`
- Runs before software/materials KPI computation inside `_utilization()`
- Keyword-regex scans `material_description` against 8 patterns
- Inserts into `po_categorization` with `tagged_by='SYSTEM'`
- **Never overwrites rows tagged by a user** (`WHERE tagged_by='SYSTEM'` in the ON CONFLICT clause)
- Categories: SOFTWARE (SUBSCRIPTION, PERPETUAL, MAINTENANCE, ERP_LICENSE, IT_TOOL), MATERIAL (ROYALTY, IMPORT_LIC, CAPEX_ASSET)

### `_utilization_software(conn, FY)`
KPI codes generated:

| Code | Description | Unit |
|---|---|---|
| `SW_LIC_UTIL_RATE` | Avg license utilization rate across all tools | % |
| `SW_UNDERUTIL_COUNT` | Tools with utilization < 70% | count |
| `SW_TOTAL_LICENSES` | Total licensed seats | seats |
| `SW_ACTIVE_USERS` | Total active license users | users |
| `SW_UNUSED_SEATS` | Unused seats (total − active) | seats |
| `SW_ANNUAL_COST` | Total annual SW license cost | INR Cr |
| `SW_COST_PER_USER` | Annual cost ÷ active users | INR |
| `SW_WASTED_COST` | Cost of under-utilized tools (< 70%) | INR Cr |
| `SW_RENEWAL_90D` | Licenses expiring within 90 days | count |
| `SW_TOOL_BREAKDOWN` | Per-tool: seats, util%, cost, risk level | JSON |
| `SW_CAPEX_SPEND` | SW CAPEX spend YTD (perpetual/one-time) | INR Cr |
| `SW_OPEX_SPEND` | SW OPEX spend YTD (subscriptions/SaaS) | INR Cr |
| `SW_VENDOR_CONC` | Top SW vendor share of spend | % |
| `SW_VENDOR_BREAKDOWN` | SW spend by vendor | JSON |

Data source: `license_usage` table (uploaded via /upload page) + `po_categorization` JOINed with `po_dump`.

### `_utilization_materials(conn, FY)`
KPI codes generated:

| Code | Description | Unit |
|---|---|---|
| `MAT_DELIV_UTIL_RATE` | GRN qty received ÷ PO ordered qty | % |
| `MAT_DELIVERY_COMPLETE_PCT` | % of material POs marked delivery-complete | % |
| `MAT_OPEN_PO_VALUE` | PO value not yet GRN'd (> 5% outstanding) | INR Cr |
| `MAT_CAPEX_SPEND` | Material CAPEX spend YTD | INR Cr |
| `MAT_OPEX_SPEND` | Material OPEX spend YTD | INR Cr |
| `MAT_LICENSE_COST_TOT` | Total royalty + import license + patent fees | INR Cr |
| `MAT_LICENSE_BREAKDOWN` | License cost by type (royalty/import/patent) | JSON |
| `MAT_3WAY_MATCH` | Invoice ≈ GRN ≈ PO within 5% tolerance | % |
| `MAT_VENDOR_FILL_RATE` | GRN qty ÷ PO qty per vendor | JSON |
| `MAT_CAT_BREAKDOWN` | Material spend by sub-category or material group | JSON |

Data sources: `po_dump`, `grn_dump`, `po_categorization`, `material_license_cost`, `pr_po_grn_invoice`.

---

## Frontend Changes (`kpmg-intelliflow/src/routes/utilization.tsx`)

### `SoftwareSection` component
- KPI bar: Avg Util Rate, Under-Util Tools, Unused Seats, Wasted Cost, Renewals in 90d
- Secondary row: Annual Cost, Cost/User, Vendor Concentration
- CAPEX/OPEX split row for SW POs
- **Radial gauge** — license utilization rate (RadialBarChart)
- **Tool breakdown table** — per-tool util%, unused seats, cost, risk badge (HIGH/MEDIUM/LOW)
- **SW Vendor spend bar chart** (horizontal)

### `MaterialsSection` component
- KPI bar: Delivery Util Rate, Delivery Complete %, 3-Way Match, Open PO Value, Licensing Cost
- CAPEX/OPEX split row for material POs
- **Vendor fill rate chart** — fill % per vendor, color-coded (green ≥ 90%, amber ≥ 70%, red < 70%)
- **Category spend chart** — spend by sub-category or material group (horizontal bar + legend)
- **License cost breakdown** — cost by type (royalty/import/patent) vertical bar chart

---

## Auto-Categorization Logic

Priority order for determining `po_category` and `capex_opex_flag`:

1. **Manual user override** (`tagged_by != 'SYSTEM'`) — never overwritten
2. **SYSTEM auto-tag** from `material_description` keyword scan
3. **Existing `capex_opex_flag`** on `po_dump` row (SAP-sourced)

### Keyword Rules

| Pattern | Category | Sub | CAPEX/OPEX |
|---|---|---|---|
| SAAS, SUBSCRIPTION, CLOUD LICENSE, ANNUAL/MONTHLY LICENSE | SOFTWARE | SUBSCRIPTION | OPEX |
| PERPETUAL LICENSE, ONE-TIME LICENSE | SOFTWARE | PERPETUAL | CAPEX |
| SOFTWARE MAINTENANCE, AMC, SUPPORT LICENSE | SOFTWARE | MAINTENANCE | OPEX |
| SAP LICENSE, ERP LICENSE, ORACLE LICENSE | SOFTWARE | ERP_LICENSE | CAPEX |
| MICROSOFT, ADOBE, SALESFORCE, JIRA, GITHUB, LICENSE KEY | SOFTWARE | IT_TOOL | OPEX |
| ROYALTY, LICENSED MATERIAL, PATENT FEE, IP FEE | MATERIAL | ROYALTY | OPEX |
| IMPORT LICENSE, CUSTOMS LICENSE, DGFT, IEC | MATERIAL | IMPORT_LIC | OPEX |
| MACHINERY, EQUIPMENT, TURBINE, PLANT ASSET | MATERIAL | CAPEX_ASSET | CAPEX |

---

## Profit Center Derivation (5-Level)

1. User override in `po_categorization.profit_center`
2. `po_dump.profit_center` (CSV column if present)
3. Material group → `profit_center_master` mapping
4. Plant default from `company_plant_master`
5. Company-level fallback

---

## Data Flow

```
CSV Upload (/upload)
    ↓
po_dump (raw SAP PO data)
    ↓
_auto_categorize()  ←── keyword scan material_description
    ↓
po_categorization (SYSTEM tags, preserves manual)
    ↓
_utilization_software()   ← license_usage + categorized SW POs
_utilization_materials()  ← grn_dump + material POs + material_license_cost
    ↓
kpi_results (utilization dashboard)
    ↓
utilization.tsx → SoftwareSection + MaterialsSection
```
