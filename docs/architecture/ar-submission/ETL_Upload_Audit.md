# IntelliSource — ETL & Upload Audit Report
**Scope:** Complete analysis of upload pipeline, ETL flow, KPI data requirements  
**Files Audited:** routers/upload.py · services/etl.py · services/parser.py · services/validator.py · services/loader.py · services/fact_builder.py · services/event_generator.py · services/kpi_engine.py · schema.sql  
**Date:** Jul 2026

---

## 1. Upload Pipeline — End-to-End Flow

```
POST /api/upload
    │
    ├── read file bytes (max 50 MB)
    ├── create upload_batches record (status=PROCESSING)
    ├── schedule ETL in ThreadPoolExecutor
    └── return { batch_id, status: "PROCESSING" }  ← immediate response

Background Thread (_etl_worker):
    │
    ├── parse_file()          → read CSV/XLSX, normalize columns, detect dataset type
    ├── validate()            → mandatory fields, numeric checks, enum rules, dedup
    ├── load()                → upsert into staging table (DELETE + INSERT by natural key)
    ├── build_entity_hierarchy() → rebuild from company_plant_master
    ├── build_facts()         → rebuild pr_po_grn_invoice fact table
    ├── generate_events()     → rebuild process_mining_events + anomaly flags
    ├── compute_all()         → run all 45 KPIs, store in kpi_results
    └── UPDATE upload_batches SET status=COMPLETED/FAILED

Frontend polls GET /api/upload/{batch_id} every 2 seconds
SSE /api/stream broadcasts UPLOAD_PROGRESS + KPI_REFRESH events
```

---

## 2. Dataset Auto-Detection

Parser reads minimum 3 signature columns to identify the dataset type.  
Dataset type determined by **column names** — not filename. You can name the file anything.

| # | Dataset Type | Signature Columns (min 3 must be present) |
|---|---|---|
| 01 | `pr_dump` | purchase_requisition · item_of_requisition · requisitioner · valuation_price |
| 02 | `po_dump` | purchasing_document · item · net_order_value · vendor · vendor_name |
| 03 | `po_delivery_dump` | purchasing_document · schedule_line · expected_delivery_date · scheduled_quantity |
| 04 | `grn_dump` | material_document · po_history_category · movement_type · debit_credit_ind |
| 05 | `po_invoice_dump` | invoice_doc · po_history_category · invoice_doc_item · debit_credit_ind |
| 06 | `invoice_dump` | invoice_doc · document_type · clearing_doc · vendor_invoice_ref |
| 07 | `payment_dump` | payment_doc · payment_method · cleared_invoice · clearing_date |
| 08 | `vendor_master` | vendor · vendor_name · account_group · central_purchasing_block |
| 09 | `change_log` | object_class · object_id · change_number · field_name · change_indicator |
| 10 | `company_plant_master` | company_code · purchasing_org · plant · plant_name |

> **Column aliases supported:** SAP field names auto-mapped to canonical names.  
> e.g. `EBELN` → `purchasing_document`, `LIFNR` → `vendor`, `DMBTR` → `amount_local_ccy`  
> Full alias table: 60+ SAP field codes in `services/parser.py` SAP_ALIASES dict.

---

## 3. What Data Must Be Uploaded for All KPIs to Compute

### 3.1 Mandatory — KPIs return NULL without these

| Priority | File | KPIs Affected if Missing |
|---|---|---|
| **1** | `po_dump` | ALL procurement KPIs (P1–P18), ALL leadership KPIs (L1–L18), vendor delivery, utilization CAPEX/OPEX — this is the backbone of every dashboard |
| **2** | `invoice_dump` | ALL financial KPIs (F1, F4–F18) — payment timing, 3-way match, CAPEX vs OPEX from invoice side |
| **3** | `payment_dump` | Payment KPIs (F5–F11) — on-time payment, early payment, payment before GRN anomaly, total payments YTD |
| **4** | `vendor_master` | ALL vendor KPIs (V1–V18) — blocked vendor flag, MSME compliance, vendor type classification |

### 3.2 Important — Specific KPIs will be zero or inaccurate without these

| Priority | File | KPIs Affected if Missing |
|---|---|---|
| **5** | `pr_dump` | P10 Open PR Aging · P11 PR-to-PO Conversion Rate · P12 PR-to-PO Cycle Days · L3 Maverick Spend Rate (maverick detection requires PR to determine PO has no upstream requisition) · Orphan PR tracking in fact table |
| **6** | `grn_dump` | P8 On-Time Delivery Rate (OTIF) · F2 3-Way Match Rate · anomaly: THREE_WAY_MISMATCH · PAYMENT_BEFORE_GRN · GRN_WITHOUT_PO · po_to_grn_days cycle time |
| **7** | `po_invoice_dump` | F2 3-Way Match Rate · invoice_to_payment_days · grn_to_invoice_days cycle time · links PO lines to invoices in fact table |
| **8** | `po_delivery_dump` | P8 OTIF · po_delivery_date in fact table · LATE_DELIVERY anomaly |
| **9** | `change_log` | P5 PO Amendment Rate · P6 Approval Cycle Time · LONG_APPROVAL anomaly · SOD_CONFLICT detection |

### 3.3 Optional — Company hierarchy and filtering

| File | Effect if Missing |
|---|---|
| `company_plant_master` | entity_hierarchy will be empty · company dropdown filter won't show plant/org hierarchy · KPIs still compute for company_code values found in po_dump |

### 3.4 NOT Uploadable via /api/upload — Require Separate Seeding

| Table | Populated By | KPIs Affected |
|---|---|---|
| `license_usage` | `seed_utilization_data.py` (manual seed script) | ALL SW_ utilization KPIs (SW_LIC_UTIL_RATE · SW_UNDERUTIL_COUNT · SW_ANNUAL_COST etc.) — these will return NULL with empty table |
| `po_categorization` | Auto-computed by KPI engine keyword match on material_group | SW_CAPEX_SPEND · SW_OPEX_SPEND — seeded by KPI engine on upload trigger |
| `kpi_config` | Seeded by schema.sql INSERT ON CONFLICT DO NOTHING | HIGH_VALUE_PO_THRESHOLD · ACTIVE_COMPANY_CODES — defaults exist, no upload needed |
| `profit_center_master` | No upload route — direct DB insert only | No KPIs currently depend on this |
| `pc_budget` | No upload route — direct DB insert only | No KPIs currently depend on this |

---

## 4. Recommended Upload Order

Upload in this exact sequence to avoid referential integrity warnings and ensure full fact table build:

```
1.  vendor_master          ← upload first — PO validator checks vendor presence
2.  po_dump                ← backbone — all other tables reference purchasing_document
3.  pr_dump                ← needed before fact_builder for PR-to-PO join
4.  po_delivery_dump       ← delivery schedule for PO lines
5.  grn_dump               ← GRN against PO lines
6.  po_invoice_dump        ← invoice matching to PO lines
7.  invoice_dump           ← AP invoice register (links to po_invoice_dump)
8.  payment_dump           ← payment against invoices
9.  change_log             ← PO amendment history
10. company_plant_master   ← (optional) company/plant hierarchy for filtering
```

> Each upload triggers full ETL for THAT file only, then rebuilds the entire fact table and recomputes all KPIs.  
> You must upload ALL files for complete KPI coverage — one upload is NOT enough.

---

## 5. Mandatory Fields Per Dataset

Fields that cause row rejection if empty:

### pr_dump
```
purchase_requisition, item_of_requisition, material_group,
material_description, order_quantity, delivery_date, requisitioner
```

### po_dump
```
purchasing_document, item, vendor, vendor_name,
document_date, material_group, material_description,
order_quantity, net_order_value
```

### po_delivery_dump
```
purchasing_document, item, schedule_line,
expected_delivery_date, scheduled_quantity, creation_date
```

### grn_dump
```
purchasing_document, item, material_document, material_doc_item,
po_history_category, movement_type, debit_credit_ind,
posting_date, entry_date, quantity, amount_local_ccy
```
> `po_history_category` MUST be `"E"` (GRN). `debit_credit_ind` MUST be `"S"` (debit) or `"H"` (credit/return).

### po_invoice_dump
```
purchasing_document, item, invoice_doc, invoice_year, invoice_doc_item,
po_history_category, debit_credit_ind, posting_date, entry_date,
quantity, amount_local_ccy
```
> `po_history_category` MUST be `"Q"` (invoice). `debit_credit_ind` MUST be `"S"` or `"H"`.

### invoice_dump
```
invoice_doc, invoice_year, vendor, document_type,
posting_date, amount_local_ccy
```
> `due_date` optional — auto-computed from `baseline_date + days_1` if not present.

### payment_dump
```
payment_doc, payment_year, vendor, document_type,
posting_date, clearing_date, payment_method,
amount_local_ccy, cleared_invoice, house_bank
```

### vendor_master
```
vendor, vendor_name, country, city, account_group
```

### change_log
```
object_class, object_id, change_number, username,
change_date, tcode, table_name, field_name, change_indicator
```

### company_plant_master
```
company_code, company_name, purchasing_org, plant, plant_name
```

---

## 6. Validation Rules Summary

| Rule | Behaviour |
|---|---|
| Mandatory field empty | Row REJECTED — logged to rejection_sample |
| Numeric field non-parseable | Row REJECTED |
| PO value or quantity < 0 | Row REJECTED |
| GRN/Invoice: purchasing_document not in po_dump | Row ACCEPTED with WARN (allows upload before po_dump) |
| grn_dump: po_history_category not "E" | Row REJECTED |
| po_invoice_dump: po_history_category not "Q" | Row REJECTED |
| Duplicate composite key within upload | Second occurrence REJECTED |
| Duplicate composite key already in DB | Row ACCEPTED with WARN (upsert will overwrite) |

---

## 7. Fact Table Build Logic

`pr_po_grn_invoice` is rebuilt from scratch on every upload (`DELETE FROM pr_po_grn_invoice` first).

**What makes a row in the fact table:**
- One row per `(purchasing_document, item)` from `po_dump`
- LEFT JOIN to `pr_dump` (via purchase_requisition + item_of_requisition)
- LEFT JOIN to `po_delivery_dump` (delivery schedule)
- LEFT JOIN to `grn_dump` (aggregate GRN quantity/amount by debit_credit_ind)
- LEFT JOIN to `po_invoice_dump` (aggregate invoice quantity/amount)
- Subquery into `invoice_dump` + `payment_dump` for due_date and payment timing

**Maverick flag logic:**
```sql
is_maverick = 1 WHERE po.purchase_requisition IS NULL OR po.purchase_requisition = ''
```
So: if `po_dump.purchase_requisition` is blank/null → the PO is maverick.  
This means `capex_opex_flag` on `po_dump` drives CAPEX/OPEX split — default is `'OPEX'` if not provided.

**Orphan PRs** (released PRs with no matching PO) are inserted as separate fact rows with `is_maverick = 0`.

---

## 8. CAPEX vs OPEX Classification

KPIs F13 (CAPEX Spend) and F14 (OPEX Spend) depend entirely on `capex_opex_flag` in `po_dump`.

| Behaviour | Detail |
|---|---|
| Default if not in upload | `'OPEX'` (schema default) |
| Valid values | `'CAPEX'` or `'OPEX'` |
| How to provide | Include `capex_opex_flag` column in po_dump CSV |
| SAP alias | No SAP standard field — custom column, must be added during SAP export |

> **If ALL POs have `capex_opex_flag = 'OPEX'` (default), CAPEX KPIs will return 0.**

---

## 9. Bugs Found in Upload Pipeline

### BUG-1: `asyncio.get_event_loop()` — Deprecated Pattern
**Location:** `routers/upload.py:69`  
**Code:**
```python
loop = asyncio.get_event_loop()
loop.run_in_executor(_executor, _etl_worker, content, filename, batch_id)
```
**Problem:** In Python 3.10+, `get_event_loop()` inside an `async def` will work but emit `DeprecationWarning`. The Future returned by `run_in_executor` is not awaited — if the executor queue is full, the exception is silently dropped.  
**Fix:**
```python
loop = asyncio.get_running_loop()
loop.run_in_executor(_executor, _etl_worker, content, filename, batch_id)
```

---

### BUG-2: `BackgroundTasks` Parameter Declared But Never Used
**Location:** `routers/upload.py:47-70`  
**Code:**
```python
async def upload_file(
    background_tasks: BackgroundTasks,   # ← declared
    file: UploadFile = File(...),
):
    ...
    loop.run_in_executor(...)            # ← used instead of background_tasks.add_task()
```
**Problem:** FastAPI injects `BackgroundTasks` but the code bypasses it and uses `run_in_executor` directly. The two patterns are not equivalent: `BackgroundTasks.add_task()` runs after response is sent and is managed by FastAPI's lifecycle; `run_in_executor` in a `ThreadPoolExecutor` runs immediately and is not tied to the request lifecycle.  
**Effect:** Minor — both work, but `BackgroundTasks` is the idiomatic FastAPI approach and plays better with shutdown handling.  
**Fix (optional):**
```python
# Option A: use FastAPI BackgroundTasks (simpler)
background_tasks.add_task(_etl_worker, content, filename, batch_id)

# Option B: keep ThreadPoolExecutor but remove unused param
async def upload_file(file: UploadFile = File(...)):
```

---

### BUG-3: Unused `asyncio.new_event_loop()` in Worker Thread
**Location:** `routers/upload.py:21`  
**Code:**
```python
def _etl_worker(file_bytes: bytes, filename: str, batch_id: str) -> None:
    loop = asyncio.new_event_loop()   # ← created
    ...
    finally:
        loop.close()                  # ← closed, but never set or used
```
**Problem:** `loop` is created and closed but never passed to `asyncio.set_event_loop()` or used for any async calls. Dead code. `_etl_worker` is fully synchronous.  
**Fix:**
```python
def _etl_worker(file_bytes: bytes, filename: str, batch_id: str) -> None:
    # Remove loop creation/closure entirely
    try:
        run_etl(file_bytes, filename, batch_id, progress_cb=_progress)
        ...
    except Exception as exc:
        ...
```

---

### BUG-4: `broadcast()` Called from Non-Async Thread — Thread Safety Risk
**Location:** `routers/upload.py:24-26, 28-32`  
**Problem:** `broadcast()` from `routers/events.py` is called inside a `ThreadPoolExecutor` thread. If `broadcast` uses an `asyncio.Queue` or any `async` construct it will fail silently or raise. Needs verification that `broadcast` is thread-safe.  
**Check:** Inspect `routers/events.py` to confirm `broadcast` uses a thread-safe queue (`queue.Queue` not `asyncio.Queue`).

---

### BUG-5: `company_plant_master` Not Shown in Frontend Upload Guide
**Location:** `kpmg-intelliflow/src/routes/upload.tsx:14-24`  
**Problem:** `DATASET_GUIDE` lists 9 datasets — `company_plant_master` is missing. Users cannot easily know this file is supported or what columns it requires.  
**Impact:** Multi-company hierarchy (`entity_hierarchy`) never gets built for most users. Company dropdown filter in dashboards won't show plant-level hierarchy.

---

### BUG-6: `capex_opex_flag` Has No Upload Documentation
**Problem:** CAPEX vs OPEX split (KPIs F13, F14, utilization dashboard) depends on `capex_opex_flag` in `po_dump`. This is not a standard SAP field — it must be added manually during SAP export. No UI documentation exists explaining this.  
**Impact:** All CAPEX KPIs show 0 unless `capex_opex_flag = 'CAPEX'` rows are present.

---

## 10. KPI Coverage by Data Availability

| Dashboard | po_dump only | + vendor_master | + pr_dump + grn + invoice | + payment | + change_log | FULL (all 9 files) |
|---|---|---|---|---|---|---|
| **Procurement** | ~50% | ~55% | ~85% | ~90% | 100% | 100% |
| **Financial** | 20% | 20% | 60% | 90% | 90% | 100% |
| **Leadership** | ~60% | ~70% | ~85% | 95% | 95% | 100% |
| **Vendor** | ~40% | ~80% | ~90% | ~90% | ~90% | 100% |
| **Utilization** | ~30% | ~30% | ~50% | ~60% | ~60% | ~70%* |

> *Utilization at 70% max because `license_usage` table (SW_ KPIs) requires separate seed — not uploadable via /api/upload.

---

## 11. Quick Reference — Minimum Viable Upload for Each Dashboard

| Goal | Minimum files needed |
|---|---|
| Procurement Dashboard (basic) | `po_dump` |
| Procurement Dashboard (full) | `po_dump` + `pr_dump` + `po_delivery_dump` + `change_log` |
| Financial Dashboard (basic) | `po_dump` + `invoice_dump` |
| Financial Dashboard (full) | `po_dump` + `pr_dump` + `grn_dump` + `po_invoice_dump` + `invoice_dump` + `payment_dump` |
| Vendor Dashboard | `po_dump` + `vendor_master` |
| Leadership Dashboard | `po_dump` + `vendor_master` + `invoice_dump` + `payment_dump` |
| Anomaly Detection (full 12) | ALL 9 files |
| Utilization (basic CAPEX/OPEX) | `po_dump` with `capex_opex_flag` column populated |
| Utilization (SW_ license KPIs) | Run `seed_utilization_data.py` separately — NOT via upload |
