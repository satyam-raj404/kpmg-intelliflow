# SKILL.md — IntelliSource P2P Procurement Application

## Overview

IntelliSource is KPMG's centralized Procure-to-Pay (P2P) procurement management and process mining platform. This skill document defines three things:

1. **The P2P lifecycle** — every stage, activity, SAP trigger, ideal path, and anomaly detection rule
2. **The data model** — exact schema DDL for each table, column types, constraints, foreign keys, and which dashboard each table feeds
3. **The ETL pipeline** — how raw CSV/Excel uploads are validated, transformed, loaded into the schema, and automatically propagated to dashboard KPIs

Use this document to build the application backend, design the database, implement the upload module, and wire KPI calculations.

---

## Part 1 — P2P Lifecycle (In Depth)

### 1.1 The 16-Stage Extended Lifecycle

IntelliSource tracks 16 discrete stages in the procurement process. These are NOT 16 separate database tables — they are 16 business events that occur across 9 SAP-sourced datasets.

```
SOURCING PHASE
  Stage 1:  Requirement Analysis     — Business need captured (pre-SAP or custom)
  Stage 2:  Bidding                   — RFP/RFQ published to vendor shortlist
  Stage 3:  RFQ                       — Vendors submit formal quotations
  Stage 4:  Vendor Selection          — Bids scored (TOPSIS / weighted), vendor awarded
  Stage 5:  Vendor Contracting        — Outline agreement / framework contract created

REQUISITION PHASE
  Stage 6:  PR Creation               — Purchase Requisition raised (EBAN)
  Stage 7:  PR Amendment              — PR modified after creation (CDHDR/CDPOS, OC=BANF)
  Stage 8:  PR Approval               — PR released per release strategy (EBAN-FRGZU)

PURCHASE ORDER PHASE
  Stage 9:  PO Creation               — Purchase Order created (EKKO+EKPO)
  Stage 10: PO Amendment              — PO modified after creation (CDHDR/CDPOS, OC=EINKBELEG)
  Stage 11: PO Approval               — PO released per DOA levels (EKKO-FRGKE)

FULFILLMENT PHASE
  Stage 12: GRN Creation              — Goods/services received (EKBE, VGABE='E', SHKZG='S')
  Stage 13: GRN Return                — Goods returned to vendor (EKBE, BWART=122, SHKZG='H')

INVOICING PHASE
  Stage 14: Invoicing                 — Vendor invoice posted (EKBE VGABE='Q' or BSIK/BSAK)
  Stage 15: Invoice Cancellation /    — Credit memo, debit memo, or invoice reversal
            Credit Memo / Debit Memo    (EKBE SHKZG='H' for credit; BSAK type KR/RE reversal)

SETTLEMENT PHASE
  Stage 16: Payment Settlement        — Cash transfer to vendor (BSAK, doc type KZ/ZP)
```

### 1.2 The 8 Standard Process Activities

These are the canonical activities used in process mining event logs. Every P2P transaction gets decomposed into a sequence of these 8 activities.

| Act# | Activity Name | How It's Detected | SAP Source | SAP Filter/Trigger |
|------|----------------------------------------------|-----------------------------------------------|---------------------|---------------------------------------------|
| 1 | Purchase Requisition Creation | New row appears in EBAN | EBAN | `deletion_indicator ≠ 'X'` |
| 2 | Amendments in Purchase Requisitions | CDHDR+CDPOS row where OC=BANF | CDHDR + CDPOS | `object_class = 'BANF'`, `TABNAME = 'EBAN'` |
| 3 | Purchase Requisition Release | EBAN.FRGZU field becomes populated | EBAN | `release_status IN ('X','XX','XXX','XXXX','XXXXX')` |
| 4 | Purchase Order Creation | New row appears in EKKO+EKPO | EKKO + EKPO | `deletion_indicator ≠ 'L'` |
| 5 | Amendments in Purchase Orders | CDHDR+CDPOS row where OC=EINKBELEG | CDHDR + CDPOS | `object_class = 'EINKBELEG'`, `TABNAME IN ('EKKO','EKPO')` |
| 6 | Purchase Order Release | EKKO.FRGKE field becomes populated | EKKO | `release_status IN ('X','XX','XXX','XXXX','XXXXX')` |
| 7 | GRN Creation | New EKBE row with goods receipt | EKBE | `po_history_category = 'E'`, `debit_credit_ind = 'S'` (debit = received) |
| 8 | Invoice Creation | New EKBE row with invoice receipt | EKBE | `po_history_category = 'Q'`, `debit_credit_ind = 'S'` (debit = invoiced) |

**Change Log Detection Rules (Activities 2 and 5)**

For PR amendments (Activity 2), track these CDPOS fields:
- `PREIS` — change in estimated price
- `ERNAM` — change in creator/user
- `LOEKZ` — change in deletion indicator
- `FRGKZ` — change in release indicator
- `AFNAM` — change in requisitioner name
- `MENGE` — change in quantity
- `TXZ01` — change in material description

Relevant SAP transaction codes: `ME22N`, `ME23N`

For PO amendments (Activity 5), track these CDPOS fields:
- `NETWR` — change in net order value
- `NETPR` — change in net order price
- `MATNR` — change in material code
- `LOEKZ` — change in deletion indicator
- `FRGKZ` — change in release indicator
- `FRGZU` — change in release status
- `ERNAM` — change in user
- `MENGE` — change in quantity
- `TXZ01` — change in material description

Relevant SAP transaction code: `ME291N`

For Vendor changes (KPI-related, not an activity), track:
- Object class: `KRED`
- Tables: `LFA1`, `LFBK`, `LFB1`
- Fields: `KTOKK` (account group), `ZTERM` (payment terms)
- Transaction code: `XK01`

### 1.3 Ideal Process Paths (Happy Paths)

These 4 sequences represent compliant P2P flows. Any case that does NOT match one of these is an **outlier variant** — flagged for investigation on the Leadership and Compliance dashboards.

| Path# | Activity Sequence | Description |
|-------|-------------------------------|-----------------------------------------------------------|
| 1 | 1 → 3 → 4 → 6 → 7 → 8 | Clean path: PR created, released, PO created, released, GR, invoice. No amendments. |
| 2 | 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 | Full amendment cycle: both PR and PO were amended before release. |
| 3 | 1 → 3 → 4 → 5 → 6 → 7 → 8 | PO-only amendment: PR was clean, PO required changes. |
| 4 | 1 → 2 → 3 → 4 → 6 → 7 → 8 | PR-only amendment: PR required changes, PO was clean. |

### 1.4 Outlier Variant Detection (Process Anomalies)

These patterns indicate process compliance failures. Each generates a flag stored in `process_mining_events.anomaly_flags`:

| Anomaly Code | Pattern | Business Meaning | Severity |
|--------------------------------------|--------------------------------------------------|----------------------------------------------|----------|
| `MAVERICK_PO` | PO created without upstream PR | Off-process buying; no approval trail | HIGH |
| `PO_BEFORE_PR_RELEASE` | PO creation timestamp < PR release timestamp | Backdated approval; circumvented controls | HIGH |
| `GRN_BEFORE_PO_RELEASE` | GRN posting date < PO release date | Unauthorized receipt; received before approved | HIGH |
| `INVOICE_WITHOUT_GRN` | Invoice exists but no matching GRN | 3-way match failure; paying for undelivered | HIGH |
| `PR_RELEASE_AFTER_PO` | PR released AFTER PO already created | Retrospective approval; rubber-stamping | MEDIUM |
| `PO_RELEASE_MISSING` | PO exists but FRGKE is never populated | PO sent to vendor without formal approval | HIGH |
| `PR_RELEASE_MISSING` | PR exists but FRGZU is never populated | PR never approved but downstream PO exists | HIGH |
| `SPLIT_PO_SUSPECTED` | Multiple POs to same vendor, similar period, individual values below DOA threshold | Deliberately splitting to bypass approval | HIGH |
| `DUPLICATE_PO_SUSPECTED` | Same vendor + same material + same quantity within 7 days | Possible duplicate entry or fraud | MEDIUM |
| `SOD_VIOLATION` | Same user created PR AND released PO | Segregation of Duties breach | HIGH |
| `EXCESSIVE_AMENDMENTS` | >3 amendments on single PO before release | Indecision or specification instability | LOW |
| `DELAYED_GRN` | GRN posting date > expected delivery date + 15 days | Chronic late delivery from vendor | MEDIUM |
| `PRICE_VARIANCE` | Invoice unit price ≠ PO unit price by >5% | Rate deviation; contract not honored | MEDIUM |

### 1.5 P2P Stage-to-Dataset Mapping

Each stage reads from specific datasets. This mapping drives which upload templates feed which dashboard sections.

| Stage(s) | Primary Dataset | Secondary Dataset | Dashboard Fed |
|-----------|-----------------|-------------------|---------------|
| 1-5 (Sourcing) | Custom (pre-SAP) | — | Procurement |
| 6-8 (Requisition) | PR Dump | Change Log (OC=BANF) | Procurement |
| 9-11 (Purchase Order) | PO Dump | Change Log (OC=EINKBELEG) | Procurement, Financial, Leadership |
| 12-13 (Fulfillment) | GRN Dump | PO Delivery Dump | Vendor Performance |
| 14-15 (Invoicing) | PO Invoice Dump + Invoice Dump | — | Financial |
| 16 (Settlement) | Payment Dump | — | Financial |
| Cross-cutting | Vendor Master | — | Vendor Performance, Compliance |

---

## Part 2 — Data Model (Schema DDL)

### 2.1 Design Principles

1. **9 staging tables** mirror the 9 SAP data templates exactly — column names match the CSV headers.
2. **6 computed/materialized tables** store pre-aggregated KPIs, event logs, and anomaly flags — rebuilt on each ETL run.
3. **3 application tables** store users, actions, and audit logs — not part of SAP data flow.
4. **Foreign keys** link datasets via `purchasing_document` (PO number), `purchase_requisition` (PR number), and `vendor` (vendor code).
5. **All monetary values** in INR (column suffix `_inr` where ambiguous). Currency stored alongside for multi-currency support.
6. **Timestamps** stored as TEXT in `YYYY-MM-DD` or `YYYYMMDD` format (matching SAP export convention).

### 2.2 Staging Tables (9 — populated by user uploads)

```sql
-- =============================================================
-- TABLE 1: pr_dump (Purchase Requisition)
-- SAP Source: EBAN
-- Activities: 1 (Creation), 2 (Amendment via change_log), 3 (Release)
-- Dashboard: Procurement (KPIs: PR-to-PO time, Open PR aging)
-- =============================================================
CREATE TABLE pr_dump (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    company_code          TEXT NOT NULL,
    purchase_requisition  TEXT NOT NULL,          -- EBAN-BANFN (PK in business terms)
    item_of_requisition   TEXT NOT NULL,          -- EBAN-BNFPO (line item)
    purchasing_doc_type   TEXT NOT NULL,          -- EBAN-BSART
    vendor                TEXT,                   -- EBAN-LIFNR (suggested/fixed)
    material_group        TEXT NOT NULL,          -- EBAN-MATKL
    material_description  TEXT NOT NULL,          -- EBAN-TXZ01
    plant                 TEXT NOT NULL,          -- EBAN-WERKS
    purchasing_group      TEXT NOT NULL,          -- EBAN-EKGRP
    order_quantity        REAL NOT NULL,          -- EBAN-MENGE
    unit_of_measure       TEXT NOT NULL,          -- EBAN-MEINS
    valuation_price       REAL NOT NULL,          -- EBAN-PREIS (estimated price)
    delivery_date         TEXT NOT NULL,          -- EBAN-LFDAT
    release_status        TEXT NOT NULL DEFAULT '',-- EBAN-FRGZU (X=released)
    release_date          TEXT,                   -- EBAN-FRGDT
    requisitioner         TEXT NOT NULL,          -- EBAN-AFNAM
    tracking_number       TEXT,                   -- EBAN-BEDNR
    created_on            TEXT NOT NULL,          -- EBAN-ERDAT
    created_by            TEXT NOT NULL,          -- EBAN-ERNAM
    deletion_indicator    TEXT NOT NULL DEFAULT '',-- EBAN-LOEKZ (X=deleted)
    currency_key          TEXT NOT NULL DEFAULT 'INR',
    upload_batch_id       TEXT,                   -- links to upload audit trail
    uploaded_at           TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_pr_requisition ON pr_dump(purchase_requisition);
CREATE INDEX idx_pr_vendor ON pr_dump(vendor);
CREATE INDEX idx_pr_release ON pr_dump(release_status);


-- =============================================================
-- TABLE 2: po_dump (Purchase Order — header + line merged)
-- SAP Source: EKKO (header) + EKPO (line) joined on EBELN
-- Activities: 4 (Creation), 5 (Amendment via change_log), 6 (Release)
-- Dashboard: Procurement, Financial, Leadership, Vendor (CORE TABLE)
-- =============================================================
CREATE TABLE po_dump (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    company_code          TEXT NOT NULL,
    purchasing_document   TEXT NOT NULL,          -- EKKO-EBELN (PO number)
    item                  TEXT NOT NULL,          -- EKPO-EBELP (line item)
    purch_doc_category    TEXT,                   -- EKKO-BSTYP (F=PO, K=Contract, A=RFQ)
    purchasing_doc_type   TEXT NOT NULL,          -- EKKO-BSART (NB, ZAN, FO, etc.)
    purchasing_org        TEXT NOT NULL,          -- EKKO-EKORG
    purchasing_group      TEXT NOT NULL,          -- EKKO-EKGRP
    status                TEXT,                   -- derived (Open/Closed)
    plant                 TEXT NOT NULL,          -- EKPO-WERKS
    storage_location      TEXT,                   -- EKPO-LGORT
    material_group        TEXT NOT NULL,          -- EKPO-MATKL
    material_type         TEXT,                   -- EKPO-MTART
    material_description  TEXT NOT NULL,          -- EKPO-TXZ01
    vendor                TEXT NOT NULL,          -- EKKO-LIFNR
    vendor_name           TEXT NOT NULL,          -- LFA1-NAME1 (denormalized)
    vendor_created_on     TEXT,                   -- LFA1-ERDAT
    document_date         TEXT NOT NULL,          -- EKKO-BEDAT
    created_on            TEXT NOT NULL,          -- EKKO-ERDAT
    created_by            TEXT NOT NULL,          -- EKKO-ERNAM
    ekko_deletion_indicator TEXT DEFAULT '',      -- EKKO-LOEKZ (header deletion)
    terms_of_payment      TEXT,                   -- EKKO-ZTERM
    terms_of_payment_desc TEXT,                   -- T052U lookup
    contract_number       TEXT,                   -- EKKO-KONNR (source contract)
    item_delivery_date    TEXT,                   -- EKET-EINDT
    release_group         TEXT,                   -- EKKO-FRGRL
    release_strategy      TEXT,                   -- EKKO-FRGGR
    release_indicator     TEXT,                   -- EKKO-FRGKE
    release_status        TEXT DEFAULT '',        -- EKKO-FRGZU
    release_amount        REAL DEFAULT 0,
    currency_key          TEXT NOT NULL DEFAULT 'INR',
    purchase_requisition  TEXT,                   -- EKPO-BANFN (FK to pr_dump)
    item_of_requisition   TEXT,                   -- EKPO-BNFPO
    exchange_rate         REAL DEFAULT 1.0,       -- EKKO-WKURS
    unit_of_measure       TEXT NOT NULL,          -- EKPO-MEINS
    order_unit            TEXT,                   -- EKPO-BSTME
    price_unit            REAL DEFAULT 1,         -- EKPO-PEINH
    net_order_price       REAL NOT NULL,          -- EKPO-NETPR
    order_quantity        REAL NOT NULL,          -- EKPO-MENGE
    delivered_quantity    REAL DEFAULT 0,          -- EKPO-WEMNG (from EKET)
    open_quantity         REAL,                   -- calculated: order_quantity - delivered_quantity
    gross_order_value     REAL,                   -- EKPO-BRTWR
    net_order_value       REAL NOT NULL,          -- EKPO-NETWR
    po_delivery_date      TEXT,                   -- EKET-EINDT
    deletion_indicator    TEXT DEFAULT '',        -- EKPO-LOEKZ (item deletion: L=deleted)
    tax_code              TEXT,                   -- EKPO-MWSKZ
    item_category         TEXT,                   -- EKPO-PSTYP
    item_category_description TEXT,               -- T163Y lookup
    overdeliv_tolerance   REAL DEFAULT 0,         -- EKPO-UEBTO
    underdel_tolerance    REAL DEFAULT 0,         -- EKPO-UNTTO
    delivery_completed    TEXT DEFAULT '',        -- EKPO-ELIKZ (X=completed)
    aging                 INTEGER,                -- calculated: days since created_on
    po_status             TEXT,                   -- derived: Open/Closed/Deleted
    period                TEXT,                   -- derived: Mon,YYYY for reporting
    upload_batch_id       TEXT,
    uploaded_at           TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_po_document ON po_dump(purchasing_document);
CREATE INDEX idx_po_vendor ON po_dump(vendor);
CREATE INDEX idx_po_pr_ref ON po_dump(purchase_requisition);
CREATE INDEX idx_po_date ON po_dump(document_date);
CREATE INDEX idx_po_deletion ON po_dump(deletion_indicator);
CREATE INDEX idx_po_delivery ON po_dump(delivery_completed);


-- =============================================================
-- TABLE 3: po_delivery_dump (PO Delivery Schedule)
-- SAP Source: EKET
-- Dashboard: Vendor Performance (KPI: OTIF, Delivery Delay)
-- =============================================================
CREATE TABLE po_delivery_dump (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    purchasing_document     TEXT NOT NULL,          -- EKET-EBELN (FK to po_dump)
    item                   TEXT NOT NULL,          -- EKET-EBELP
    schedule_line          TEXT NOT NULL,          -- EKET-ETENR
    expected_delivery_date TEXT NOT NULL,          -- EKET-EINDT
    scheduled_quantity     REAL NOT NULL,          -- EKET-MENGE
    delivered_quantity     REAL DEFAULT 0,         -- EKET-WEMNG
    open_quantity          REAL,                   -- calculated
    statistical_delivery_date TEXT,                -- EKET-SLFDT
    creation_date          TEXT NOT NULL,
    upload_batch_id        TEXT,
    uploaded_at            TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_del_document ON po_delivery_dump(purchasing_document, item);


-- =============================================================
-- TABLE 4: grn_dump (Goods Receipt Note)
-- SAP Source: EKBE filtered by VGABE='E'
-- Activity: 7 (GRN Creation)
-- Dashboard: Vendor Performance, Procurement
-- =============================================================
CREATE TABLE grn_dump (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    purchasing_document   TEXT NOT NULL,          -- EKBE-EBELN (FK to po_dump)
    item                  TEXT NOT NULL,          -- EKBE-EBELP
    material_document     TEXT NOT NULL,          -- EKBE-BELNR (GRN number)
    material_doc_item     TEXT NOT NULL,          -- EKBE-BUZEI
    po_history_category   TEXT NOT NULL DEFAULT 'E', -- must be 'E' for GR
    movement_type         TEXT NOT NULL,          -- EKBE-BWART (101=GR, 102=reversal, 122=return)
    debit_credit_ind      TEXT NOT NULL,          -- EKBE-SHKZG (S=debit/received, H=credit/returned)
    posting_date          TEXT NOT NULL,          -- EKBE-BUDAT
    entry_date            TEXT NOT NULL,          -- EKBE-CPUDT
    quantity              REAL NOT NULL,          -- EKBE-MENGE
    amount_local_ccy      REAL NOT NULL,          -- EKBE-DMBTR (INR)
    reference_doc         TEXT,                   -- EKBE-XBLNR
    upload_batch_id       TEXT,
    uploaded_at           TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_grn_document ON grn_dump(purchasing_document, item);
CREATE INDEX idx_grn_posting ON grn_dump(posting_date);
CREATE INDEX idx_grn_dc ON grn_dump(debit_credit_ind);


-- =============================================================
-- TABLE 5: po_invoice_dump (PO-linked Invoices)
-- SAP Source: EKBE filtered by VGABE='Q'
-- Activity: 8 (Invoice Creation)
-- Dashboard: Financial (KPI: 3-way match)
-- =============================================================
CREATE TABLE po_invoice_dump (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    purchasing_document   TEXT NOT NULL,          -- EKBE-EBELN (FK to po_dump)
    item                  TEXT NOT NULL,          -- EKBE-EBELP
    invoice_doc           TEXT NOT NULL,          -- EKBE-BELNR
    invoice_year          TEXT NOT NULL,          -- EKBE-GJAHR
    invoice_doc_item      TEXT NOT NULL,          -- EKBE-BUZEI
    po_history_category   TEXT NOT NULL DEFAULT 'Q', -- must be 'Q' for IR
    debit_credit_ind      TEXT NOT NULL,          -- S=invoice, H=credit memo
    posting_date          TEXT NOT NULL,          -- EKBE-BUDAT
    entry_date            TEXT NOT NULL,          -- EKBE-CPUDT
    quantity              REAL NOT NULL,          -- EKBE-MENGE
    amount_local_ccy      REAL NOT NULL,          -- EKBE-DMBTR
    reference_doc         TEXT NOT NULL,          -- vendor invoice number
    upload_batch_id       TEXT,
    uploaded_at           TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_poinv_document ON po_invoice_dump(purchasing_document, item);


-- =============================================================
-- TABLE 6: invoice_dump (General invoices incl. non-PO)
-- SAP Source: BSIK (open) + BSAK (cleared), doc type KR/RE
-- Dashboard: Financial (KPI: DPO, on-time rate, aging)
-- =============================================================
CREATE TABLE invoice_dump (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    company_code          TEXT NOT NULL,
    invoice_doc           TEXT NOT NULL,          -- BSIK/BSAK-BELNR
    invoice_year          TEXT NOT NULL,          -- GJAHR
    vendor                TEXT NOT NULL,          -- LIFNR
    document_type         TEXT NOT NULL,          -- BLART (KR or RE)
    vendor_invoice_ref    TEXT NOT NULL,          -- XBLNR
    vendor_invoice_date   TEXT NOT NULL,          -- BLDAT
    posting_date          TEXT NOT NULL,          -- BUDAT
    due_date              TEXT NOT NULL,          -- calculated from ZFBDT + ZBD3T
    amount_local_ccy      REAL NOT NULL,          -- DMBTR (INR)
    tax_amount            REAL DEFAULT 0,         -- WMWST
    payment_terms         TEXT NOT NULL,          -- ZTERM
    payment_block         TEXT DEFAULT '',        -- ZLSPR
    po_reference          TEXT,                   -- EBELN (NULL for non-PO invoices)
    clearing_doc          TEXT,                   -- AUGBL (NULL if unpaid)
    currency_key          TEXT NOT NULL DEFAULT 'INR',
    upload_batch_id       TEXT,
    uploaded_at           TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_inv_vendor ON invoice_dump(vendor);
CREATE INDEX idx_inv_clearing ON invoice_dump(clearing_doc);
CREATE INDEX idx_inv_due ON invoice_dump(due_date);


-- =============================================================
-- TABLE 7: payment_dump (Vendor Payments)
-- SAP Source: BSAK, doc type KZ/ZP
-- Dashboard: Financial (KPI: Total Spend, DPO, on-time rate)
-- =============================================================
CREATE TABLE payment_dump (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    company_code          TEXT NOT NULL,
    payment_doc           TEXT NOT NULL,          -- BSAK-BELNR
    payment_year          TEXT NOT NULL,          -- GJAHR
    vendor                TEXT NOT NULL,          -- LIFNR
    document_type         TEXT NOT NULL,          -- BLART (KZ or ZP)
    posting_date          TEXT NOT NULL,          -- BUDAT
    clearing_date         TEXT NOT NULL,          -- AUGDT
    payment_method        TEXT NOT NULL,          -- ZLSCH (T=transfer, C=cheque)
    amount_local_ccy      REAL NOT NULL,          -- DMBTR (INR)
    discount_taken        REAL DEFAULT 0,         -- SKNTO
    cleared_invoice       TEXT NOT NULL,          -- REBZG (invoice doc cleared)
    bank_reference        TEXT,                   -- UTR / wire ref
    house_bank            TEXT NOT NULL,          -- HBKID
    currency_key          TEXT NOT NULL DEFAULT 'INR',
    upload_batch_id       TEXT,
    uploaded_at           TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_pay_vendor ON payment_dump(vendor);
CREATE INDEX idx_pay_date ON payment_dump(posting_date);
CREATE INDEX idx_pay_invoice ON payment_dump(cleared_invoice);


-- =============================================================
-- TABLE 8: vendor_master (Vendor Master Data)
-- SAP Source: LFA1 (general) + LFB1 (company code)
-- Dashboard: Vendor Performance, Compliance
-- =============================================================
CREATE TABLE vendor_master (
    id                        INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor                    TEXT NOT NULL UNIQUE, -- LFA1-LIFNR
    vendor_name               TEXT NOT NULL,        -- LFA1-NAME1
    country                   TEXT NOT NULL,        -- LFA1-LAND1
    city                      TEXT NOT NULL,        -- LFA1-ORT01
    postal_code               TEXT,                 -- LFA1-PSTLZ
    region                    TEXT,                 -- LFA1-REGIO
    account_group             TEXT NOT NULL,        -- LFA1-KTOKK
    tax_number_pan            TEXT,                 -- LFA1-STCD3 (PAN)
    tax_number_gstin          TEXT,                 -- GSTIN
    central_purchasing_block  TEXT DEFAULT '',      -- LFA1-SPERR (X=blocked)
    central_posting_block     TEXT DEFAULT '',      -- LFA1-SPERM (X=blocked)
    deletion_flag_central     TEXT DEFAULT '',      -- LFA1-LOEVM (X=deleted)
    company_code              TEXT,                 -- LFB1-BUKRS
    payment_terms             TEXT,                 -- LFB1-ZTERM
    payment_block             TEXT DEFAULT '',      -- LFB1-ZAHLS (*=blocked)
    posting_block_cc          TEXT DEFAULT '',      -- LFB1-SPERR (X=blocked)
    upload_batch_id           TEXT,
    uploaded_at               TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_vm_vendor ON vendor_master(vendor);
CREATE INDEX idx_vm_block ON vendor_master(central_purchasing_block, payment_block);


-- =============================================================
-- TABLE 9: change_log (Document Change History)
-- SAP Source: CDHDR (header) + CDPOS (item)
-- Activities: 2 (PR amend), 5 (PO amend), Vendor changes
-- Dashboard: Procurement (amendment rate), Vendor (change freq)
-- =============================================================
CREATE TABLE change_log (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    object_class          TEXT NOT NULL,          -- BANF / EINKBELEG / KRED
    object_id             TEXT NOT NULL,          -- document number changed
    change_number         TEXT NOT NULL,          -- CDHDR-CHANGENR
    username              TEXT NOT NULL,          -- CDHDR-USERNAME
    change_date           TEXT NOT NULL,          -- CDHDR-UDATE
    change_time           TEXT,                   -- CDHDR-UTIME
    tcode                 TEXT NOT NULL,          -- CDHDR-TCODE (ME22N, ME291N, XK01)
    table_name            TEXT NOT NULL,          -- CDPOS-TABNAME (EBAN, EKKO, EKPO, LFA1)
    field_name            TEXT NOT NULL,          -- CDPOS-FNAME (NETPR, MENGE, etc.)
    change_indicator      TEXT NOT NULL,          -- CDPOS-CHNGIND (I/U/D)
    old_value             TEXT,                   -- CDPOS-VALUE_OLD
    new_value             TEXT,                   -- CDPOS-VALUE_NEW
    upload_batch_id       TEXT,
    uploaded_at           TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_cl_class ON change_log(object_class);
CREATE INDEX idx_cl_object ON change_log(object_id);
CREATE INDEX idx_cl_date ON change_log(change_date);
CREATE INDEX idx_cl_field ON change_log(field_name);
```

### 2.3 Computed/Materialized Tables (rebuilt on each ETL run)

```sql
-- =============================================================
-- TABLE 10: pr_po_grn_invoice (Master Fact Table)
-- One row per complete PR→PO→GRN→Invoice chain
-- Powers: ALL operational dashboards
-- Rebuilt by: ETL Step 4 (see Part 3)
-- =============================================================
CREATE TABLE pr_po_grn_invoice (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_requisition    TEXT,
    pr_created_on           TEXT,
    pr_release_date         TEXT,
    pr_creator              TEXT,
    purchasing_document     TEXT NOT NULL,
    po_created_on           TEXT NOT NULL,
    po_release_date         TEXT,
    po_creator              TEXT,
    vendor                  TEXT NOT NULL,
    vendor_name             TEXT,
    net_order_value         REAL,
    currency_key            TEXT,
    first_grn_date          TEXT,
    last_grn_date           TEXT,
    grn_quantity            REAL,
    grn_amount              REAL,
    first_invoice_date      TEXT,
    last_invoice_date       TEXT,
    invoice_quantity        REAL,
    invoice_amount          REAL,
    first_payment_date      TEXT,
    payment_amount          REAL,
    pr_to_po_days           INTEGER,  -- DATEDIFF(po_created_on, pr_created_on)
    po_to_grn_days          INTEGER,  -- DATEDIFF(first_grn_date, po_release_date)
    grn_to_invoice_days     INTEGER,  -- DATEDIFF(first_invoice_date, first_grn_date)
    invoice_to_payment_days INTEGER,  -- DATEDIFF(first_payment_date, first_invoice_date)
    total_cycle_days        INTEGER,  -- DATEDIFF(first_payment_date, pr_created_on)
    is_maverick             INTEGER DEFAULT 0,  -- 1 if PR is NULL
    has_grn_return          INTEGER DEFAULT 0,
    has_credit_memo         INTEGER DEFAULT 0
);


-- =============================================================
-- TABLE 11: process_mining_events (Event Log for Process Mining)
-- One row per activity per case
-- Powers: P2P Lifecycle Tracker, Compliance Center, Leadership alerts
-- Rebuilt by: ETL Step 5
-- =============================================================
CREATE TABLE process_mining_events (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id         TEXT NOT NULL,            -- purchasing_document (PO) as case ID
    activity_number INTEGER NOT NULL,         -- 1-8
    activity_name   TEXT NOT NULL,
    event_timestamp TEXT NOT NULL,
    user_id         TEXT,
    variant_id      INTEGER,                  -- which path this case follows
    variant_class   TEXT,                     -- 'IDEAL' / 'MAINSTREAM' / 'OUTLIER'
    anomaly_flags   TEXT DEFAULT ''           -- comma-separated: MAVERICK_PO,SOD_VIOLATION,...
);

CREATE INDEX idx_pme_case ON process_mining_events(case_id);
CREATE INDEX idx_pme_variant ON process_mining_events(variant_class);


-- =============================================================
-- TABLE 12: kpi_results (Dashboard KPI Cache)
-- One row per KPI per period
-- Powers: ALL dashboard cards (pre-computed for speed)
-- Rebuilt by: ETL Step 6
-- =============================================================
CREATE TABLE kpi_results (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    dashboard       TEXT NOT NULL,    -- 'procurement'/'financial'/'leadership'/'vendor'/'utilization'
    kpi_code        TEXT NOT NULL,    -- 'TOTAL_PO_VALUE_MTD', 'ACTIVE_PO_COUNT', etc.
    kpi_name        TEXT NOT NULL,
    period          TEXT NOT NULL,    -- 'MTD', 'YTD', '2026-04', or 'ALL'
    value_numeric   REAL,
    value_text      TEXT,            -- for non-numeric KPIs like 'Medium' risk
    unit            TEXT,            -- 'INR', '%', 'Days', 'Count', 'Score'
    target          REAL,            -- threshold for RAG coloring
    trend_vs_prior  REAL,           -- % change vs prior period
    computed_at     TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_kpi_dash ON kpi_results(dashboard, kpi_code);
CREATE INDEX idx_kpi_period ON kpi_results(period);


-- =============================================================
-- TABLE 13: upload_batches (Upload Audit Trail)
-- One row per file upload
-- =============================================================
CREATE TABLE upload_batches (
    batch_id        TEXT PRIMARY KEY,         -- UUID
    dataset_type    TEXT NOT NULL,            -- 'pr_dump','po_dump', etc.
    filename        TEXT NOT NULL,
    row_count       INTEGER,
    valid_rows      INTEGER,
    rejected_rows   INTEGER,
    rejection_log   TEXT,                     -- JSON array of {row, field, reason}
    uploaded_by     TEXT NOT NULL,
    uploaded_at     TEXT DEFAULT (datetime('now')),
    status          TEXT DEFAULT 'PROCESSING' -- PROCESSING / COMPLETED / FAILED
);
```

### 2.4 Application Tables

```sql
-- Users (6 demo accounts + extensible)
CREATE TABLE users (
    user_id     TEXT PRIMARY KEY,
    email       TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name   TEXT NOT NULL,
    role        TEXT NOT NULL CHECK(role IN ('procurement_manager','delivery_manager','finance','compliance','cxo','admin')),
    is_active   INTEGER DEFAULT 1,
    created_at  TEXT DEFAULT (datetime('now'))
);

-- Action Management (Kanban board)
CREATE TABLE actions (
    action_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    action_type TEXT NOT NULL,  -- 'RATE_REVISION','VENDOR_NEGOTIATION','COMPLIANCE_AUDIT','RESOURCE_REALLOCATION'
    description TEXT NOT NULL,
    assigned_to TEXT NOT NULL,
    linked_po   TEXT,
    linked_vendor TEXT,
    linked_project TEXT,
    expected_impact_inr REAL,
    actual_impact_inr   REAL,
    status      TEXT DEFAULT 'OPEN' CHECK(status IN ('OPEN','IN_PROGRESS','UNDER_REVIEW','CLOSED')),
    due_date    TEXT,
    created_by  TEXT NOT NULL,
    created_at  TEXT DEFAULT (datetime('now')),
    closed_at   TEXT
);

-- Audit log (every data mutation)
CREATE TABLE audit_log (
    log_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     TEXT NOT NULL,
    action      TEXT NOT NULL,  -- 'UPLOAD','DELETE','KPI_REFRESH','LOGIN','ROLE_SWITCH'
    entity_type TEXT,           -- 'po_dump','vendor_master', etc.
    entity_id   TEXT,
    details     TEXT,           -- JSON with context
    ip_address  TEXT,
    created_at  TEXT DEFAULT (datetime('now'))
);
```

### 2.5 Dashboard-to-Table Mapping (which table feeds which dashboard)

| Dashboard | Primary Tables Read | KPI Count |
|---|---|---|
| Procurement | `po_dump`, `pr_dump`, `change_log`, `kpi_results` | 8 |
| Financial | `payment_dump`, `invoice_dump`, `po_invoice_dump`, `po_dump`, `kpi_results` | 8 |
| Leadership | `po_dump`, `pr_dump`, `payment_dump`, `vendor_master`, `pr_po_grn_invoice`, `kpi_results` | 8 |
| Vendor Performance | `vendor_master`, `po_dump`, `grn_dump`, `po_delivery_dump`, `change_log`, `kpi_results` | 8 |
| Utilization | `po_dump` (material_group filter), `po_delivery_dump`, `kpi_results` | 6 |
| P2P Lifecycle | `process_mining_events`, `pr_po_grn_invoice` | 6 |
| Compliance Center | `process_mining_events` (anomaly_flags), `vendor_master`, `change_log` | — |

---

## Part 3 — ETL Pipeline

### 3.1 Pipeline Overview

When a user uploads a CSV or Excel file through the Data Upload page, the following 6-step pipeline executes automatically:

```
USER UPLOAD (CSV/Excel)
    │
    ▼
Step 1: FILE PARSING (Pandas read_csv / read_excel)
    │   → Detect dataset type from headers
    │   → Generate upload_batch_id (UUID)
    │
    ▼
Step 2: VALIDATION (7 rules per dataset)
    │   → Type checks, mandatory field checks, referential integrity
    │   → Rows pass → staging table
    │   → Rows fail → rejection_log JSON
    │
    ▼
Step 3: STAGING INSERT (INSERT OR REPLACE into staging table)
    │   → Tag every row with upload_batch_id
    │   → Upsert logic: new rows insert, existing rows update
    │
    ▼
Step 4: FACT TABLE REBUILD (pr_po_grn_invoice)
    │   → JOIN pr_dump → po_dump → grn_dump → po_invoice_dump → payment_dump
    │   → Calculate cycle time columns
    │   → Flag mavericks, GRN returns, credit memos
    │
    ▼
Step 5: EVENT LOG GENERATION (process_mining_events)
    │   → For each PO, generate activity sequence
    │   → Match against 4 ideal paths → classify variant
    │   → Detect anomalies → populate anomaly_flags
    │
    ▼
Step 6: KPI COMPUTATION (kpi_results)
    │   → Run all 38 KPI formulas
    │   → Store results with period, trend vs prior
    │   → Dashboard reads from kpi_results (fast)
    │
    ▼
DASHBOARD AUTO-REFRESH (WebSocket push or polling)
```

### 3.2 Step 1 — File Parsing & Dataset Detection

```python
# Pseudocode for dataset type detection
DATASET_SIGNATURES = {
    'pr_dump':          ['purchase_requisition', 'item_of_requisition', 'requisitioner'],
    'po_dump':          ['purchasing_document', 'item', 'net_order_value', 'vendor'],
    'po_delivery_dump': ['purchasing_document', 'schedule_line', 'expected_delivery_date'],
    'grn_dump':         ['material_document', 'po_history_category', 'movement_type'],
    'po_invoice_dump':  ['invoice_doc', 'po_history_category', 'quantity'],
    'invoice_dump':     ['invoice_doc', 'document_type', 'due_date', 'clearing_doc'],
    'payment_dump':     ['payment_doc', 'payment_method', 'cleared_invoice'],
    'vendor_master':    ['vendor', 'vendor_name', 'account_group', 'central_purchasing_block'],
    'change_log':       ['object_class', 'object_id', 'field_name', 'old_value', 'new_value'],
}

def detect_dataset(df_columns):
    """Match uploaded columns against known signatures. Return dataset name or UNKNOWN."""
    columns_lower = {c.lower().strip() for c in df_columns}
    best_match, best_score = None, 0
    for dataset, signature in DATASET_SIGNATURES.items():
        score = sum(1 for s in signature if s in columns_lower)
        if score > best_score:
            best_match, best_score = dataset, score
    if best_score >= 3:  # minimum 3 signature columns must match
        return best_match
    return 'UNKNOWN'
```

**Column name normalization**: Strip whitespace, lowercase, replace spaces with underscores, strip quotes. Map common SAP aliases (e.g., `EBELN` → `purchasing_document`, `BANFN` → `purchase_requisition`, `LIFNR` → `vendor`).

### 3.3 Step 2 — Validation Rules (per dataset)

Every dataset runs through 7 validation checks. Rows that fail are logged but NOT inserted.

| Rule# | Rule | Applied To | Logic |
|-------|------|-----------|-------|
| 1 | Mandatory field not null | All datasets | Check all mandatory columns (defined in schema NOT NULL) are present and non-empty |
| 2 | Data type check | All datasets | Numeric fields parse as float, dates match YYYY-MM-DD or YYYYMMDD pattern |
| 3 | Value range check | po_dump | `net_order_value >= 0`, `order_quantity > 0` |
| 4 | Referential integrity — vendor | po_dump, grn_dump, invoice_dump, payment_dump | `vendor` must exist in `vendor_master` (warn, don't reject) |
| 5 | Referential integrity — PO | grn_dump, po_invoice_dump | `purchasing_document` must exist in `po_dump` |
| 6 | Filter field enforcement | grn_dump | `po_history_category` must = 'E'; po_invoice_dump must = 'Q' |
| 7 | Debit/credit indicator | grn_dump, po_invoice_dump | `debit_credit_ind` must be 'S' or 'H' only |

**Validation for specific field values (from Base Tables Information):**

| Dataset | Field | Valid Values | Business Meaning |
|---|---|---|---|
| PO_Dump | deletion_indicator | `L` = deleted | Exclude from active PO counts |
| PO_Dump | release_status | `X`, `XX`, `XXX`, `XXXX`, `XXXXX` | Multi-level approval completion |
| PO_Dump | delivery_completed | `X` = completed | Exclude from open PO aging |
| PR_Dump | deletion_indicator | `X` = deleted | Exclude from active PR counts |
| PR_Dump | release_status | `X`, `XX`, `XXX`, `XXXX`, `XXXXX` | Multi-level release |
| GRN_Dump | debit_credit_ind | `S` = received (debit), `H` = returned (credit) | Direction of goods movement |
| Invoice_Dump | debit_credit_ind | `S` = invoiced (debit), `H` = credit memo | Direction of financial posting |
| Vendor_Master | central_purchasing_block | `X` = blocked | Vendor cannot receive new POs |
| Vendor_Master | payment_block | `*` = blocked | Vendor payments frozen |
| Vendor_Master | central_posting_block | `X` = blocked | No financial postings allowed |
| Vendor_Master | posting_block (CC) | `X` = blocked | Company-code level posting block |

### 3.4 Step 3 — Staging Insert

```python
# Pseudocode for upsert logic
def load_to_staging(df, dataset_type, batch_id, db_connection):
    """Insert validated rows into the staging table. Upsert on natural key."""
    
    NATURAL_KEYS = {
        'pr_dump':          ['purchase_requisition', 'item_of_requisition'],
        'po_dump':          ['purchasing_document', 'item'],
        'po_delivery_dump': ['purchasing_document', 'item', 'schedule_line'],
        'grn_dump':         ['material_document', 'material_doc_item'],
        'po_invoice_dump':  ['invoice_doc', 'invoice_doc_item'],
        'invoice_dump':     ['invoice_doc', 'invoice_year'],
        'payment_dump':     ['payment_doc', 'payment_year'],
        'vendor_master':    ['vendor'],
        'change_log':       ['object_class', 'object_id', 'change_number', 'field_name'],
    }
    
    df['upload_batch_id'] = batch_id
    natural_key = NATURAL_KEYS[dataset_type]
    
    # DELETE existing rows matching same natural key, then INSERT new
    # This ensures latest upload overwrites previous data
    for _, row in df.iterrows():
        where_clause = ' AND '.join(f"{k} = ?" for k in natural_key)
        db_connection.execute(
            f"DELETE FROM {dataset_type} WHERE {where_clause}",
            [row[k] for k in natural_key]
        )
    
    df.to_sql(dataset_type, db_connection, if_exists='append', index=False)
```

### 3.5 Step 4 — Fact Table Rebuild

```sql
-- Rebuild pr_po_grn_invoice by joining all staging tables
DELETE FROM pr_po_grn_invoice;

INSERT INTO pr_po_grn_invoice (
    purchase_requisition, pr_created_on, pr_release_date, pr_creator,
    purchasing_document, po_created_on, po_release_date, po_creator,
    vendor, vendor_name, net_order_value, currency_key,
    first_grn_date, last_grn_date, grn_quantity, grn_amount,
    first_invoice_date, last_invoice_date, invoice_quantity, invoice_amount,
    first_payment_date, payment_amount,
    pr_to_po_days, po_to_grn_days, grn_to_invoice_days,
    invoice_to_payment_days, total_cycle_days,
    is_maverick, has_grn_return, has_credit_memo
)
SELECT
    po.purchase_requisition,
    pr.created_on AS pr_created_on,
    pr.release_date AS pr_release_date,
    pr.created_by AS pr_creator,
    po.purchasing_document,
    po.created_on AS po_created_on,
    -- find PO release date from change_log where FRGKE changed
    (SELECT MAX(cl.change_date) FROM change_log cl
     WHERE cl.object_id = po.purchasing_document
       AND cl.object_class = 'EINKBELEG'
       AND cl.field_name = 'FRGZU') AS po_release_date,
    po.created_by AS po_creator,
    po.vendor,
    po.vendor_name,
    SUM(po.net_order_value) AS net_order_value,
    po.currency_key,
    MIN(grn.posting_date) AS first_grn_date,
    MAX(grn.posting_date) AS last_grn_date,
    SUM(CASE WHEN grn.debit_credit_ind = 'S' THEN grn.quantity ELSE 0 END) AS grn_quantity,
    SUM(CASE WHEN grn.debit_credit_ind = 'S' THEN grn.amount_local_ccy ELSE 0 END) AS grn_amount,
    MIN(inv.posting_date) AS first_invoice_date,
    MAX(inv.posting_date) AS last_invoice_date,
    SUM(CASE WHEN inv.debit_credit_ind = 'S' THEN inv.quantity ELSE 0 END) AS invoice_quantity,
    SUM(CASE WHEN inv.debit_credit_ind = 'S' THEN inv.amount_local_ccy ELSE 0 END) AS invoice_amount,
    MIN(pay.posting_date) AS first_payment_date,
    SUM(pay.amount_local_ccy) AS payment_amount,
    -- Cycle time calculations
    CAST(julianday(po.created_on) - julianday(pr.created_on) AS INTEGER) AS pr_to_po_days,
    NULL AS po_to_grn_days,  -- calculated post-insert
    NULL AS grn_to_invoice_days,
    NULL AS invoice_to_payment_days,
    NULL AS total_cycle_days,
    -- Flags
    CASE WHEN po.purchase_requisition IS NULL OR po.purchase_requisition = '' THEN 1 ELSE 0 END AS is_maverick,
    CASE WHEN EXISTS (SELECT 1 FROM grn_dump g WHERE g.purchasing_document = po.purchasing_document AND g.debit_credit_ind = 'H') THEN 1 ELSE 0 END,
    CASE WHEN EXISTS (SELECT 1 FROM po_invoice_dump i WHERE i.purchasing_document = po.purchasing_document AND i.debit_credit_ind = 'H') THEN 1 ELSE 0 END
FROM po_dump po
LEFT JOIN pr_dump pr ON po.purchase_requisition = pr.purchase_requisition
    AND po.item_of_requisition = pr.item_of_requisition
LEFT JOIN grn_dump grn ON po.purchasing_document = grn.purchasing_document AND po.item = grn.item
LEFT JOIN po_invoice_dump inv ON po.purchasing_document = inv.purchasing_document AND po.item = inv.item
LEFT JOIN (
    SELECT p.cleared_invoice, MIN(p.posting_date) AS posting_date, SUM(p.amount_local_ccy) AS amount_local_ccy
    FROM payment_dump p
    GROUP BY p.cleared_invoice
) pay ON inv.invoice_doc = pay.cleared_invoice
WHERE po.deletion_indicator != 'L'
GROUP BY po.purchasing_document;
```

### 3.6 Step 5 — Event Log Generation

For each purchasing_document (case), generate one row per activity in chronological order:

```python
def generate_events(db):
    """Build process_mining_events from staging tables."""
    db.execute("DELETE FROM process_mining_events")
    
    # For each PO, determine which activities occurred and when
    pos = db.execute("SELECT DISTINCT purchasing_document FROM po_dump WHERE deletion_indicator != 'L'").fetchall()
    
    for (po_number,) in pos:
        events = []
        
        # Activity 1: PR Creation
        pr = db.execute("""SELECT created_on, created_by FROM pr_dump
            WHERE purchase_requisition = (SELECT purchase_requisition FROM po_dump WHERE purchasing_document = ? LIMIT 1)
            LIMIT 1""", (po_number,)).fetchone()
        if pr:
            events.append((1, 'Purchase Requisition Creation', pr[0], pr[1]))
        
        # Activity 2: PR Amendments
        pr_amendments = db.execute("""SELECT change_date, username FROM change_log
            WHERE object_class = 'BANF'
              AND object_id = (SELECT purchase_requisition FROM po_dump WHERE purchasing_document = ? LIMIT 1)
            ORDER BY change_date""", (po_number,)).fetchall()
        for (dt, user) in pr_amendments:
            events.append((2, 'Amendments in Purchase Requisitions', dt, user))
        
        # Activity 3: PR Release
        pr_release = db.execute("""SELECT release_date FROM pr_dump
            WHERE purchase_requisition = (SELECT purchase_requisition FROM po_dump WHERE purchasing_document = ? LIMIT 1)
              AND release_status != ''
            LIMIT 1""", (po_number,)).fetchone()
        if pr_release and pr_release[0]:
            events.append((3, 'Purchase Requisition Release', pr_release[0], None))
        
        # Activity 4: PO Creation
        po = db.execute("SELECT created_on, created_by FROM po_dump WHERE purchasing_document = ? LIMIT 1", (po_number,)).fetchone()
        if po:
            events.append((4, 'Purchase Orders Creation', po[0], po[1]))
        
        # Activity 5: PO Amendments
        po_amendments = db.execute("""SELECT change_date, username FROM change_log
            WHERE object_class = 'EINKBELEG' AND object_id = ?
            ORDER BY change_date""", (po_number,)).fetchall()
        for (dt, user) in po_amendments:
            events.append((5, 'Amendments in Purchase Orders', dt, user))
        
        # Activity 6: PO Release
        po_release = db.execute("""SELECT MAX(change_date) FROM change_log
            WHERE object_class = 'EINKBELEG' AND object_id = ? AND field_name IN ('FRGZU','FRGKE')""",
            (po_number,)).fetchone()
        if po_release and po_release[0]:
            events.append((6, 'Purchase Order Release', po_release[0], None))
        
        # Activity 7: GRN
        grns = db.execute("""SELECT posting_date FROM grn_dump
            WHERE purchasing_document = ? AND debit_credit_ind = 'S'
            ORDER BY posting_date LIMIT 1""", (po_number,)).fetchone()
        if grns:
            events.append((7, 'GRN Creation', grns[0], None))
        
        # Activity 8: Invoice
        invoices = db.execute("""SELECT posting_date FROM po_invoice_dump
            WHERE purchasing_document = ? AND debit_credit_ind = 'S'
            ORDER BY posting_date LIMIT 1""", (po_number,)).fetchone()
        if invoices:
            events.append((8, 'Invoice Creation', invoices[0], None))
        
        # Sort events by timestamp
        events.sort(key=lambda e: e[2] or '9999-99-99')
        
        # Determine variant
        activity_sequence = tuple(e[0] for e in events)
        IDEAL_PATHS = {
            (1,3,4,6,7,8): 'IDEAL',
            (1,2,3,4,5,6,7,8): 'IDEAL',
            (1,3,4,5,6,7,8): 'IDEAL',
            (1,2,3,4,6,7,8): 'IDEAL',
        }
        variant_class = IDEAL_PATHS.get(activity_sequence, 'OUTLIER')
        
        # Detect anomalies
        anomalies = detect_anomalies(events, po_number, db)
        
        # Insert events
        for (act_num, act_name, timestamp, user) in events:
            db.execute("""INSERT INTO process_mining_events
                (case_id, activity_number, activity_name, event_timestamp, user_id, variant_class, anomaly_flags)
                VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (po_number, act_num, act_name, timestamp, user, variant_class, ','.join(anomalies)))


def detect_anomalies(events, po_number, db):
    """Check for process compliance anomalies."""
    anomalies = []
    act_nums = [e[0] for e in events]
    act_times = {e[0]: e[2] for e in events}
    
    # MAVERICK_PO: Activity 4 exists but Activity 1 does not
    if 4 in act_nums and 1 not in act_nums:
        anomalies.append('MAVERICK_PO')
    
    # PO_BEFORE_PR_RELEASE: PO created before PR released
    if 4 in act_times and 3 in act_times and act_times[4] < act_times[3]:
        anomalies.append('PO_BEFORE_PR_RELEASE')
    
    # GRN_BEFORE_PO_RELEASE: GRN before PO approval
    if 7 in act_times and 6 in act_times and act_times[7] < act_times[6]:
        anomalies.append('GRN_BEFORE_PO_RELEASE')
    
    # INVOICE_WITHOUT_GRN: Invoice exists but no GRN
    if 8 in act_nums and 7 not in act_nums:
        anomalies.append('INVOICE_WITHOUT_GRN')
    
    # PO_RELEASE_MISSING: PO exists but never released
    if 4 in act_nums and 6 not in act_nums:
        anomalies.append('PO_RELEASE_MISSING')
    
    # PR_RELEASE_MISSING: PR exists but never released
    if 1 in act_nums and 3 not in act_nums:
        anomalies.append('PR_RELEASE_MISSING')
    
    # SOD_VIOLATION: Same user created PR and released PO
    pr_creator = next((e[3] for e in events if e[0] == 1), None)
    po_releaser = db.execute("""SELECT username FROM change_log
        WHERE object_class = 'EINKBELEG' AND object_id = ? AND field_name IN ('FRGZU','FRGKE')
        ORDER BY change_date DESC LIMIT 1""", (po_number,)).fetchone()
    if pr_creator and po_releaser and pr_creator == po_releaser[0]:
        anomalies.append('SOD_VIOLATION')
    
    # EXCESSIVE_AMENDMENTS: >3 PO amendments
    amendment_count = sum(1 for e in events if e[0] == 5)
    if amendment_count > 3:
        anomalies.append('EXCESSIVE_AMENDMENTS')
    
    return anomalies
```

### 3.7 Step 6 — KPI Computation

All 38 KPIs are computed and stored in `kpi_results`. Here are the SQL statements for the 5 dashboards:

**Procurement Dashboard (8 KPIs):**
```sql
-- KPI P1: Total PO Value (MTD)
INSERT INTO kpi_results (dashboard, kpi_code, kpi_name, period, value_numeric, unit)
SELECT 'procurement', 'TOTAL_PO_VALUE_MTD', 'Total PO Value (MTD)', 'MTD',
    SUM(net_order_value), 'INR'
FROM po_dump
WHERE deletion_indicator != 'L'
  AND document_date >= strftime('%Y-%m-01', 'now');

-- KPI P2: Active PO Count
INSERT INTO kpi_results (dashboard, kpi_code, kpi_name, period, value_numeric, unit)
SELECT 'procurement', 'ACTIVE_PO_COUNT', 'Active PO Count', 'CURRENT',
    COUNT(DISTINCT purchasing_document), 'Count'
FROM po_dump
WHERE delivery_completed != 'X' AND deletion_indicator != 'L';

-- KPI P3: High-Value PO Count (threshold: net_order_value > 10000000 i.e. 1 Cr)
INSERT INTO kpi_results (dashboard, kpi_code, kpi_name, period, value_numeric, unit, target)
SELECT 'procurement', 'HIGH_VALUE_PO_COUNT', 'High-Value PO Count', 'CURRENT',
    COUNT(DISTINCT purchasing_document), 'Count', 0
FROM po_dump
WHERE net_order_value > 10000000 AND deletion_indicator != 'L';

-- KPI P4: Avg PR-to-PO Conversion Time
INSERT INTO kpi_results (dashboard, kpi_code, kpi_name, period, value_numeric, unit, target)
SELECT 'procurement', 'PR_TO_PO_DAYS', 'Avg PR-to-PO Time', 'ALL',
    AVG(pr_to_po_days), 'Days', 5
FROM pr_po_grn_invoice
WHERE pr_to_po_days IS NOT NULL AND pr_to_po_days >= 0;

-- KPI P5: PO Cycle Time (Creation to Release)
INSERT INTO kpi_results (dashboard, kpi_code, kpi_name, period, value_numeric, unit, target)
SELECT 'procurement', 'PO_CYCLE_TIME', 'PO Cycle Time', 'ALL',
    AVG(CAST(julianday(po_release_date) - julianday(po_created_on) AS REAL)), 'Days', 3
FROM pr_po_grn_invoice
WHERE po_release_date IS NOT NULL;

-- KPI P6: PO Deletion Frequency (MTD)
INSERT INTO kpi_results (dashboard, kpi_code, kpi_name, period, value_numeric, unit, target)
SELECT 'procurement', 'PO_DELETION_MTD', 'PO Deletions (MTD)', 'MTD',
    COUNT(DISTINCT purchasing_document), 'Count', 5
FROM po_dump
WHERE deletion_indicator = 'L'
  AND document_date >= strftime('%Y-%m-01', 'now');

-- KPI P7: PO Amendment Rate
INSERT INTO kpi_results (dashboard, kpi_code, kpi_name, period, value_numeric, unit, target)
SELECT 'procurement', 'PO_AMENDMENT_RATE', 'PO Amendment Rate', 'ALL',
    CAST(COUNT(DISTINCT cl.object_id) AS REAL) * 100.0 /
        NULLIF(COUNT(DISTINCT po.purchasing_document), 0), '%', 15
FROM po_dump po
LEFT JOIN change_log cl ON cl.object_id = po.purchasing_document AND cl.object_class = 'EINKBELEG';

-- KPI P8: Open PR Aging (>7 days, no PO)
INSERT INTO kpi_results (dashboard, kpi_code, kpi_name, period, value_numeric, unit, target)
SELECT 'procurement', 'OPEN_PR_AGING', 'Open PRs > 7 Days', 'CURRENT',
    COUNT(DISTINCT pr.purchase_requisition), 'Count', 10
FROM pr_dump pr
WHERE pr.release_status IN ('X','XX','XXX','XXXX','XXXXX')
  AND pr.deletion_indicator != 'X'
  AND julianday('now') - julianday(pr.release_date) > 7
  AND pr.purchase_requisition NOT IN (
      SELECT DISTINCT purchase_requisition FROM po_dump WHERE purchase_requisition IS NOT NULL
  );
```

The same pattern applies for Financial (8), Leadership (8), Vendor (8), and Utilization (6) KPIs — all SQL-based, all writing to `kpi_results`, all reading from the 9 staging tables.

### 3.8 Dashboard Auto-Refresh

After Step 6 completes:
1. Set `upload_batches.status = 'COMPLETED'`
2. Push WebSocket event `{ type: 'KPI_REFRESH', batch_id: '...', dataset: 'po_dump' }`
3. Frontend receives event → re-fetches `GET /api/kpi/{dashboard}` → updates KPI cards and charts
4. Log to `audit_log`: `action='KPI_REFRESH', entity_type='kpi_results'`

Total pipeline execution time target: < 30 seconds for 100K rows.

### 3.9 Upload API Endpoint

```
POST /api/upload
Content-Type: multipart/form-data
Authorization: Bearer <JWT>

Body: file=<CSV or XLSX>

Response 200:
{
    "batch_id": "uuid-here",
    "dataset_detected": "po_dump",
    "total_rows": 97712,
    "valid_rows": 97680,
    "rejected_rows": 32,
    "rejection_sample": [
        {"row": 145, "field": "net_order_value", "reason": "Cannot parse as number: 'N/A'"},
        {"row": 8823, "field": "vendor", "reason": "Mandatory field is empty"}
    ],
    "kpi_refresh_status": "COMPLETED",
    "dashboards_updated": ["procurement", "financial", "leadership", "vendor"]
}
```

---

## Quick Reference

| What | Where |
|------|-------|
| P2P 16 stages | Part 1.1 |
| 8 standard activities | Part 1.2 |
| Change log field tracking | Part 1.2 (sub-tables) |
| 4 ideal paths | Part 1.3 |
| 13 anomaly detection rules | Part 1.4 |
| 9 staging table DDL | Part 2.2 |
| Computed table DDL (fact + events + KPIs) | Part 2.3 |
| Dashboard-to-table mapping | Part 2.5 |
| ETL 6-step pipeline | Part 3.1 |
| Dataset auto-detection | Part 3.2 |
| 7 validation rules | Part 3.3 |
| Field value rules (from Base Tables) | Part 3.3 (second table) |
| Upsert logic | Part 3.4 |
| Fact table rebuild SQL | Part 3.5 |
| Event log generation code | Part 3.6 |
| KPI computation SQL (Procurement example) | Part 3.7 |
| Upload API contract | Part 3.9 |
