-- IntelliSource P2P — PostgreSQL Schema v2

-- ============================================================
-- STAGING TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS pr_dump (
    id                           SERIAL PRIMARY KEY,
    company_code                 TEXT,
    purchase_requisition         TEXT NOT NULL,
    item_of_requisition          TEXT NOT NULL,
    purchasing_doc_type          TEXT,
    vendor                       TEXT,
    material_group               TEXT,
    material_description         TEXT,
    plant                        TEXT,
    purchasing_group             TEXT,
    order_quantity               TEXT,
    unit_of_measure              TEXT,
    valuation_price              TEXT,
    delivery_date                TEXT,
    release_status               TEXT DEFAULT '',
    release_date                 TEXT,
    requisitioner                TEXT,
    tracking_number              TEXT,
    created_on                   TEXT,
    created_by                   TEXT DEFAULT 'SYSTEM',
    deletion_indicator           TEXT DEFAULT '',
    currency_key                 TEXT DEFAULT 'INR',
    account_assignment_category  TEXT DEFAULT '',
    upload_batch_id              TEXT,
    uploaded_at                  TEXT DEFAULT NOW()::TEXT
);
CREATE INDEX IF NOT EXISTS idx_pr_requisition ON pr_dump(purchase_requisition);
CREATE INDEX IF NOT EXISTS idx_pr_item        ON pr_dump(purchase_requisition, item_of_requisition);
CREATE INDEX IF NOT EXISTS idx_pr_vendor      ON pr_dump(vendor);
CREATE INDEX IF NOT EXISTS idx_pr_release     ON pr_dump(release_status);


CREATE TABLE IF NOT EXISTS po_dump (
    id                        SERIAL PRIMARY KEY,
    company_code              TEXT DEFAULT '1001',
    purchasing_document       TEXT NOT NULL,
    item                      TEXT NOT NULL,
    purch_doc_category        TEXT,
    purchasing_doc_type       TEXT,
    purchasing_org            TEXT,
    purchasing_group          TEXT,
    plant                     TEXT,
    storage_location          TEXT,
    material_group            TEXT,
    material_type             TEXT,
    material_description      TEXT,
    vendor                    TEXT NOT NULL,
    vendor_name               TEXT,
    document_date             TEXT NOT NULL,
    created_on                TEXT,
    created_by                TEXT DEFAULT 'SYSTEM',
    deletion_indicator        TEXT DEFAULT '',
    purchase_requisition      TEXT,
    item_of_requisition       TEXT,
    unit_of_measure           TEXT,
    net_order_price           TEXT,
    order_quantity            TEXT,
    delivered_quantity        TEXT,
    open_quantity             TEXT,
    net_order_value           TEXT NOT NULL,
    delivery_date             TEXT,
    delivery_completed        TEXT DEFAULT '',
    currency_key              TEXT DEFAULT 'INR',
    release_indicator         TEXT DEFAULT '',
    release_strategy          TEXT,
    contract_number           TEXT,
    payment_terms             TEXT,
    capex_opex_flag              TEXT DEFAULT 'OPEX',
    tax_code                     TEXT DEFAULT '',
    period                       TEXT,
    account_assignment_category  TEXT DEFAULT '',
    item_category                TEXT DEFAULT '0',
    gr_based_iv                  TEXT DEFAULT '',
    upload_batch_id              TEXT,
    uploaded_at                  TEXT DEFAULT NOW()::TEXT
);
CREATE INDEX IF NOT EXISTS idx_po_document  ON po_dump(purchasing_document);
CREATE INDEX IF NOT EXISTS idx_po_line      ON po_dump(purchasing_document, item);
CREATE INDEX IF NOT EXISTS idx_po_vendor    ON po_dump(vendor);
CREATE INDEX IF NOT EXISTS idx_po_pr_ref    ON po_dump(purchase_requisition, item_of_requisition);
CREATE INDEX IF NOT EXISTS idx_po_date      ON po_dump(document_date);
CREATE INDEX IF NOT EXISTS idx_po_deletion  ON po_dump(deletion_indicator);
CREATE INDEX IF NOT EXISTS idx_po_delivery  ON po_dump(delivery_completed);
CREATE INDEX IF NOT EXISTS idx_po_org       ON po_dump(purchasing_org);
CREATE INDEX IF NOT EXISTS idx_po_plant     ON po_dump(plant);


CREATE TABLE IF NOT EXISTS po_delivery_dump (
    id                        SERIAL PRIMARY KEY,
    purchasing_document       TEXT NOT NULL,
    item                      TEXT NOT NULL,
    schedule_line             TEXT NOT NULL,
    expected_delivery_date    TEXT NOT NULL,
    scheduled_quantity        TEXT NOT NULL,
    delivered_quantity        TEXT DEFAULT '0',
    open_quantity             TEXT,
    statistical_delivery_date TEXT,
    actual_delivery_date      TEXT,
    creation_date             TEXT NOT NULL,
    upload_batch_id           TEXT,
    uploaded_at               TEXT DEFAULT NOW()::TEXT
);
CREATE INDEX IF NOT EXISTS idx_del_document ON po_delivery_dump(purchasing_document, item);


CREATE TABLE IF NOT EXISTS grn_dump (
    id                    SERIAL PRIMARY KEY,
    purchasing_document   TEXT NOT NULL,
    item                  TEXT NOT NULL,
    material_document     TEXT NOT NULL,
    material_doc_item     TEXT NOT NULL,
    po_history_category   TEXT NOT NULL DEFAULT 'E',
    movement_type         TEXT NOT NULL,
    debit_credit_ind      TEXT NOT NULL,
    posting_date          TEXT NOT NULL,
    entry_date            TEXT NOT NULL,
    plant                 TEXT,
    storage_location      TEXT,
    company_code          TEXT,
    vendor                TEXT,
    created_by            TEXT DEFAULT 'SYSTEM',
    quantity              TEXT NOT NULL,
    amount_local_ccy      TEXT NOT NULL,
    reference_doc         TEXT,
    upload_batch_id       TEXT,
    uploaded_at           TEXT DEFAULT NOW()::TEXT
);
CREATE INDEX IF NOT EXISTS idx_grn_document ON grn_dump(purchasing_document, item);
CREATE INDEX IF NOT EXISTS idx_grn_posting  ON grn_dump(posting_date);
CREATE INDEX IF NOT EXISTS idx_grn_dc       ON grn_dump(debit_credit_ind);
CREATE INDEX IF NOT EXISTS idx_grn_created  ON grn_dump(created_by);


CREATE TABLE IF NOT EXISTS po_invoice_dump (
    id                    SERIAL PRIMARY KEY,
    purchasing_document   TEXT NOT NULL,
    item                  TEXT NOT NULL,
    invoice_doc           TEXT NOT NULL,
    invoice_year          TEXT NOT NULL,
    invoice_doc_item      TEXT NOT NULL,
    po_history_category   TEXT NOT NULL DEFAULT 'Q',
    debit_credit_ind      TEXT NOT NULL,
    posting_date          TEXT NOT NULL,
    entry_date            TEXT NOT NULL,
    created_by            TEXT DEFAULT 'SYSTEM',
    quantity              TEXT NOT NULL,
    amount_local_ccy      TEXT NOT NULL,
    reference_doc         TEXT NOT NULL,
    upload_batch_id       TEXT,
    uploaded_at           TEXT DEFAULT NOW()::TEXT
);
CREATE INDEX IF NOT EXISTS idx_poinv_document ON po_invoice_dump(purchasing_document, item);
CREATE INDEX IF NOT EXISTS idx_poinv_doc      ON po_invoice_dump(invoice_doc, invoice_year);


CREATE TABLE IF NOT EXISTS invoice_dump (
    id                    SERIAL PRIMARY KEY,
    invoice_line_key      TEXT,
    company_code          TEXT DEFAULT '1001',
    invoice_doc           TEXT NOT NULL,
    invoice_year          TEXT NOT NULL,
    vendor                TEXT NOT NULL,
    document_type         TEXT NOT NULL,
    debit_credit_ind      TEXT DEFAULT 'S',
    reverse_invoice       TEXT DEFAULT '',
    vendor_invoice_ref    TEXT,
    vendor_invoice_date   TEXT,
    posting_date          TEXT NOT NULL,
    baseline_date         TEXT,
    days_1                TEXT DEFAULT '30',
    due_date              TEXT,
    created_by            TEXT DEFAULT 'SYSTEM',
    amount_local_ccy      TEXT NOT NULL,
    tax_amount            TEXT DEFAULT '0',
    payment_terms         TEXT,
    payment_block         TEXT DEFAULT '',
    po_reference          TEXT,
    clearing_doc          TEXT,
    reversal_reason       TEXT DEFAULT '',
    currency_key          TEXT DEFAULT 'INR',
    upload_batch_id       TEXT,
    uploaded_at           TEXT DEFAULT NOW()::TEXT
);
CREATE INDEX IF NOT EXISTS idx_inv_vendor   ON invoice_dump(vendor);
CREATE INDEX IF NOT EXISTS idx_inv_doc      ON invoice_dump(invoice_doc, invoice_year);
CREATE INDEX IF NOT EXISTS idx_inv_clearing ON invoice_dump(clearing_doc);
CREATE INDEX IF NOT EXISTS idx_inv_due      ON invoice_dump(due_date);
CREATE INDEX IF NOT EXISTS idx_inv_type     ON invoice_dump(document_type);
CREATE INDEX IF NOT EXISTS idx_inv_line_key ON invoice_dump(invoice_line_key);
CREATE INDEX IF NOT EXISTS idx_inv_dc       ON invoice_dump(debit_credit_ind);
CREATE INDEX IF NOT EXISTS idx_inv_rev      ON invoice_dump(reverse_invoice);


CREATE TABLE IF NOT EXISTS payment_dump (
    id                    SERIAL PRIMARY KEY,
    payment_line_key      TEXT,
    company_code          TEXT DEFAULT '1001',
    payment_doc           TEXT NOT NULL,
    payment_year          TEXT NOT NULL,
    vendor                TEXT NOT NULL,
    document_type         TEXT NOT NULL,
    debit_credit_ind      TEXT DEFAULT 'S',
    posting_date          TEXT NOT NULL,
    clearing_date         TEXT NOT NULL,
    created_by            TEXT DEFAULT 'SYSTEM',
    payment_method        TEXT NOT NULL,
    amount_local_ccy      TEXT NOT NULL,
    discount_taken        TEXT DEFAULT '0',
    cleared_invoice       TEXT NOT NULL,
    bank_reference        TEXT,
    house_bank            TEXT NOT NULL,
    currency_key          TEXT DEFAULT 'INR',
    upload_batch_id       TEXT,
    uploaded_at           TEXT DEFAULT NOW()::TEXT
);
CREATE INDEX IF NOT EXISTS idx_pay_vendor    ON payment_dump(vendor);
CREATE INDEX IF NOT EXISTS idx_pay_date      ON payment_dump(posting_date);
CREATE INDEX IF NOT EXISTS idx_pay_invoice   ON payment_dump(cleared_invoice);
CREATE INDEX IF NOT EXISTS idx_pay_line_key  ON payment_dump(payment_line_key);
CREATE INDEX IF NOT EXISTS idx_pay_dc        ON payment_dump(debit_credit_ind);
CREATE INDEX IF NOT EXISTS idx_pay_created   ON payment_dump(created_by);


CREATE TABLE IF NOT EXISTS vendor_master (
    id                        SERIAL PRIMARY KEY,
    vendor                    TEXT NOT NULL,
    vendor_name               TEXT NOT NULL,
    country                   TEXT NOT NULL,
    city                      TEXT NOT NULL,
    postal_code               TEXT,
    region                    TEXT,
    account_group             TEXT NOT NULL,
    tax_number_pan            TEXT,
    tax_number_gstin          TEXT,
    central_purchasing_block  TEXT DEFAULT '',
    central_posting_block     TEXT DEFAULT '',
    deletion_flag_central     TEXT DEFAULT '',
    company_code              TEXT,
    payment_terms             TEXT,
    payment_block             TEXT DEFAULT '',
    posting_block_cc          TEXT DEFAULT '',
    msme_flag                 TEXT DEFAULT '',
    vendor_type               TEXT DEFAULT 'DOMESTIC',
    upload_batch_id           TEXT,
    uploaded_at               TEXT DEFAULT NOW()::TEXT,
    UNIQUE(vendor, company_code)
);
CREATE INDEX IF NOT EXISTS idx_vm_vendor ON vendor_master(vendor);
CREATE INDEX IF NOT EXISTS idx_vm_block  ON vendor_master(central_purchasing_block, payment_block);
CREATE INDEX IF NOT EXISTS idx_vm_type   ON vendor_master(vendor_type);

ALTER TABLE vendor_master ADD COLUMN IF NOT EXISTS vendor_address      TEXT;
ALTER TABLE vendor_master ADD COLUMN IF NOT EXISTS contact_phone       TEXT;
ALTER TABLE vendor_master ADD COLUMN IF NOT EXISTS contact_email       TEXT;
ALTER TABLE vendor_master ADD COLUMN IF NOT EXISTS spoc_name           TEXT;
ALTER TABLE vendor_master ADD COLUMN IF NOT EXISTS added_by            TEXT;
ALTER TABLE vendor_master ADD COLUMN IF NOT EXISTS service_description TEXT;


CREATE TABLE IF NOT EXISTS change_log (
    id                    SERIAL PRIMARY KEY,
    object_class          TEXT NOT NULL,
    object_id             TEXT NOT NULL,
    change_number         TEXT NOT NULL,
    username              TEXT NOT NULL,
    change_date           TEXT NOT NULL,
    change_time           TEXT,
    tcode                 TEXT NOT NULL,
    table_name            TEXT NOT NULL,
    field_name            TEXT NOT NULL,
    change_indicator      TEXT NOT NULL,
    old_value             TEXT,
    new_value             TEXT,
    upload_batch_id       TEXT,
    uploaded_at           TEXT DEFAULT NOW()::TEXT
);
CREATE INDEX IF NOT EXISTS idx_cl_class     ON change_log(object_class);
CREATE INDEX IF NOT EXISTS idx_cl_object    ON change_log(object_id);
CREATE INDEX IF NOT EXISTS idx_cl_date      ON change_log(change_date);
CREATE INDEX IF NOT EXISTS idx_cl_field     ON change_log(field_name);
CREATE INDEX IF NOT EXISTS idx_cl_indicator ON change_log(change_indicator);


-- ============================================================
-- COMPUTED TABLES (rebuilt on each ETL run)
-- ============================================================

CREATE TABLE IF NOT EXISTS pr_po_grn_invoice (
    id                      SERIAL PRIMARY KEY,
    pr_line_key             TEXT,
    po_line_key             TEXT,
    entity_key              TEXT,
    purchase_requisition    TEXT,
    item_of_requisition     TEXT,
    pr_quantity             REAL,
    pr_value                REAL,
    pr_delivery_date        TEXT,
    pr_release_date         TEXT,
    pr_requisitioner        TEXT,
    purchasing_document     TEXT,
    item                    TEXT,
    vendor                  TEXT,
    vendor_name             TEXT,
    material_group          TEXT,
    material_description    TEXT,
    plant                   TEXT,
    purchasing_group        TEXT,
    purchasing_org          TEXT,
    company_code            TEXT,
    purchasing_doc_type     TEXT,
    po_quantity             REAL,
    po_net_price            REAL,
    po_net_value            REAL,
    po_document_date        TEXT,
    po_delivery_date        TEXT,
    po_deletion_indicator   TEXT,
    po_delivery_completed   TEXT,
    po_release_indicator    TEXT,
    capex_opex_flag         TEXT,
    grn_quantity            REAL,
    grn_amount              REAL,
    grn_posting_date        TEXT,
    invoice_quantity        REAL,
    invoice_amount          REAL,
    invoice_posting_date    TEXT,
    invoice_due_date        TEXT,
    is_maverick             INTEGER DEFAULT 0,
    has_grn_return          INTEGER DEFAULT 0,
    has_credit_memo         INTEGER DEFAULT 0,
    pr_to_po_days           INTEGER,
    po_to_grn_days          INTEGER,
    grn_to_invoice_days     INTEGER,
    invoice_to_payment_days INTEGER,
    total_cycle_days        INTEGER
);
CREATE INDEX IF NOT EXISTS idx_fact_po     ON pr_po_grn_invoice(purchasing_document);
CREATE INDEX IF NOT EXISTS idx_fact_vendor ON pr_po_grn_invoice(vendor);
CREATE INDEX IF NOT EXISTS idx_fact_pr     ON pr_po_grn_invoice(purchase_requisition);
CREATE INDEX IF NOT EXISTS idx_fact_entity ON pr_po_grn_invoice(entity_key);
CREATE INDEX IF NOT EXISTS idx_fact_capex  ON pr_po_grn_invoice(capex_opex_flag);


CREATE TABLE IF NOT EXISTS process_mining_events (
    id                      SERIAL PRIMARY KEY,
    purchasing_document     TEXT NOT NULL,
    item                    TEXT,
    vendor                  TEXT,
    purchase_requisition    TEXT,
    item_of_requisition     TEXT,
    activities              TEXT,
    start_time              TEXT,
    end_time                TEXT,
    variant_class           TEXT DEFAULT 'INCOMPLETE',
    anomaly_flags           TEXT,
    anomaly_count           INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_pme_po      ON process_mining_events(purchasing_document);
CREATE INDEX IF NOT EXISTS idx_pme_variant ON process_mining_events(variant_class);
CREATE INDEX IF NOT EXISTS idx_pme_anomaly ON process_mining_events(anomaly_count);


CREATE TABLE IF NOT EXISTS kpi_results (
    id              SERIAL PRIMARY KEY,
    dashboard       TEXT NOT NULL,
    kpi_code        TEXT NOT NULL,
    company_code    TEXT NOT NULL DEFAULT 'ALL',
    kpi_name        TEXT NOT NULL,
    value_numeric   REAL,
    value_text      TEXT,
    unit            TEXT,
    trend           TEXT,
    computed_at     TEXT DEFAULT NOW()::TEXT,
    UNIQUE(dashboard, kpi_code, company_code)
);
CREATE INDEX IF NOT EXISTS idx_kpi_dash ON kpi_results(dashboard, kpi_code, company_code);


CREATE TABLE IF NOT EXISTS upload_batches (
    batch_id          TEXT PRIMARY KEY,
    filename          TEXT NOT NULL,
    status            TEXT NOT NULL DEFAULT 'PROCESSING',
    dataset_type      TEXT,
    rows_accepted     INTEGER,
    rows_rejected     INTEGER,
    rejection_sample  TEXT,
    error_message     TEXT,
    created_at        TEXT DEFAULT NOW()::TEXT,
    completed_at      TEXT
);


-- ============================================================
-- REFERENCE TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS company_plant_master (
    id            SERIAL PRIMARY KEY,
    plant_key     TEXT,
    company_code  TEXT NOT NULL,
    company_name  TEXT NOT NULL,
    purchasing_org TEXT NOT NULL,
    plant         TEXT NOT NULL,
    plant_name    TEXT NOT NULL,
    parent_company TEXT,
    UNIQUE(company_code, purchasing_org, plant)
);
CREATE INDEX IF NOT EXISTS idx_cpm_co        ON company_plant_master(company_code);
CREATE INDEX IF NOT EXISTS idx_cpm_plant     ON company_plant_master(plant);
CREATE INDEX IF NOT EXISTS idx_cpm_org       ON company_plant_master(purchasing_org);
CREATE INDEX IF NOT EXISTS idx_cpm_plant_key ON company_plant_master(plant_key);


CREATE TABLE IF NOT EXISTS entity_hierarchy (
    id                SERIAL PRIMARY KEY,
    entity_key        TEXT NOT NULL,
    company_code      TEXT NOT NULL,
    company_name      TEXT,
    purchasing_org    TEXT,
    plant             TEXT,
    plant_name        TEXT,
    parent_company    TEXT,
    entity_level      INTEGER DEFAULT 2,
    UNIQUE(entity_key)
);
CREATE INDEX IF NOT EXISTS idx_eh_entity ON entity_hierarchy(entity_key);
CREATE INDEX IF NOT EXISTS idx_eh_parent ON entity_hierarchy(parent_company);


CREATE TABLE IF NOT EXISTS kpi_config (
    config_key    TEXT PRIMARY KEY,
    config_value  TEXT NOT NULL,
    description   TEXT,
    updated_at    TEXT DEFAULT NOW()::TEXT
);

INSERT INTO kpi_config (config_key, config_value, description)
VALUES
  ('HIGH_VALUE_PO_THRESHOLD', '10000000',  'PO value above which is classified as high-value (INR)'),
  ('FY_START_MONTH',          '4',         'Fiscal year start month (4 = April for Indian FY)'),
  ('MAVERICK_PO_THRESHOLD',   '5',         'Alert threshold for maverick PO rate (%)'),
  ('OTIF_TARGET',             '90',        'On-Time In-Full target (%)'),
  ('THREE_WAY_MATCH_TARGET',  '95',        '3-way match success rate target (%)'),
  ('ACTIVE_COMPANY_CODES',    '',          'Comma-separated company codes for financial KPIs (blank = all)')
ON CONFLICT (config_key) DO NOTHING;


-- ============================================================
-- APP TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    user_id    TEXT PRIMARY KEY,
    email      TEXT NOT NULL UNIQUE,
    full_name  TEXT NOT NULL,
    role       TEXT NOT NULL DEFAULT 'Procurement Manager',
    password   TEXT,
    is_active  INTEGER DEFAULT 1,
    created_by TEXT DEFAULT 'admin',
    created_at TEXT DEFAULT NOW()::TEXT
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by TEXT DEFAULT 'admin';

INSERT INTO users (user_id, email, full_name, role, password, is_active, created_by)
VALUES ('00000000-0000-0000-0000-000000000001', 'admin', 'System Admin', 'Admin', '12345678', 1, 'system')
ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email, password = EXCLUDED.password, role = EXCLUDED.role;

CREATE TABLE IF NOT EXISTS actions (
    action_id           SERIAL PRIMARY KEY,
    action_type         TEXT NOT NULL,
    description         TEXT NOT NULL,
    assigned_to         TEXT NOT NULL,
    linked_po           TEXT,
    linked_vendor       TEXT,
    status              TEXT DEFAULT 'OPEN',
    due_date            TEXT,
    created_by          TEXT NOT NULL DEFAULT 'admin',
    created_at          TEXT DEFAULT NOW()::TEXT,
    closed_at           TEXT
);

CREATE TABLE IF NOT EXISTS logged_actions (
    id              SERIAL PRIMARY KEY,
    doc_type        TEXT NOT NULL,
    doc_number      TEXT NOT NULL,
    doc_item        TEXT,
    vendor          TEXT,
    changes         TEXT,
    approver_email  TEXT NOT NULL,
    notes           TEXT,
    status          TEXT DEFAULT 'UNDER_REVIEW',
    created_by      TEXT DEFAULT 'admin',
    created_at      TEXT DEFAULT NOW()::TEXT
);

CREATE TABLE IF NOT EXISTS audit_log (
    log_id      SERIAL PRIMARY KEY,
    user_id     TEXT NOT NULL DEFAULT 'system',
    action      TEXT NOT NULL,
    entity_type TEXT,
    entity_id   TEXT,
    details     TEXT,
    created_at  TEXT DEFAULT NOW()::TEXT
);


-- ============================================================
-- LICENSE USAGE (Utilization dashboard)
-- ============================================================

CREATE TABLE IF NOT EXISTS license_usage (
    id              SERIAL PRIMARY KEY,
    tool_name       TEXT NOT NULL UNIQUE,
    total_licenses  INTEGER NOT NULL,
    active_users    INTEGER NOT NULL,
    annual_cost_inr REAL NOT NULL,
    renewal_date    TEXT NOT NULL,
    material_group  TEXT DEFAULT 'SOFTWARE',
    profit_center   TEXT DEFAULT '',
    license_type    TEXT DEFAULT 'SUBSCRIPTION',
    vendor          TEXT DEFAULT '',
    po_reference    TEXT DEFAULT '',
    uploaded_at     TEXT DEFAULT NOW()::TEXT
);

-- ============================================================
-- UTILIZATION EXTENDED TABLES
-- ============================================================

-- Per-PO category tagging — auto (SYSTEM) or manual (user override)
CREATE TABLE IF NOT EXISTS po_categorization (
    id                  SERIAL PRIMARY KEY,
    purchasing_document TEXT NOT NULL,
    item                TEXT NOT NULL DEFAULT '00010',
    po_category         TEXT NOT NULL DEFAULT 'MATERIAL',
    sub_category        TEXT DEFAULT '',
    capex_opex_flag     TEXT DEFAULT 'OPEX',
    profit_center       TEXT DEFAULT '',
    license_type        TEXT DEFAULT '',
    budget_ref          TEXT DEFAULT '',
    tagged_by           TEXT NOT NULL DEFAULT 'SYSTEM',
    tagged_at           TEXT DEFAULT NOW()::TEXT,
    notes               TEXT DEFAULT '',
    UNIQUE(purchasing_document, item)
);
CREATE INDEX IF NOT EXISTS idx_poc_po       ON po_categorization(purchasing_document, item);
CREATE INDEX IF NOT EXISTS idx_poc_cat      ON po_categorization(po_category);
CREATE INDEX IF NOT EXISTS idx_poc_tagger   ON po_categorization(tagged_by);
CREATE INDEX IF NOT EXISTS idx_poc_pc       ON po_categorization(profit_center);

-- Material licensing costs (royalty, import license, patent fee) per PO item
CREATE TABLE IF NOT EXISTS material_license_cost (
    id                  SERIAL PRIMARY KEY,
    purchasing_document TEXT NOT NULL,
    item                TEXT NOT NULL DEFAULT '00010',
    license_type        TEXT NOT NULL DEFAULT 'ROYALTY',
    license_fee_inr     REAL NOT NULL DEFAULT 0,
    fee_basis           TEXT DEFAULT 'FIXED',
    fee_pct             REAL DEFAULT 0,
    fee_per_unit        REAL DEFAULT 0,
    vendor              TEXT DEFAULT '',
    validity_start      TEXT DEFAULT '',
    validity_end        TEXT DEFAULT '',
    created_by          TEXT DEFAULT 'SYSTEM',
    created_at          TEXT DEFAULT NOW()::TEXT,
    notes               TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_mlc_po      ON material_license_cost(purchasing_document, item);
CREATE INDEX IF NOT EXISTS idx_mlc_type    ON material_license_cost(license_type);

-- Profit center master — maps BUs to company codes
CREATE TABLE IF NOT EXISTS profit_center_master (
    id                 SERIAL PRIMARY KEY,
    profit_center      TEXT NOT NULL UNIQUE,
    pc_name            TEXT NOT NULL,
    company_code       TEXT NOT NULL DEFAULT '',
    responsible_person TEXT DEFAULT '',
    bu_type            TEXT DEFAULT 'CORPORATE',
    cost_center_range  TEXT DEFAULT '',
    is_active          INTEGER DEFAULT 1,
    uploaded_at        TEXT DEFAULT NOW()::TEXT
);
CREATE INDEX IF NOT EXISTS idx_pcm_pc      ON profit_center_master(profit_center);
CREATE INDEX IF NOT EXISTS idx_pcm_co      ON profit_center_master(company_code);

-- Annual budget per profit center per category
CREATE TABLE IF NOT EXISTS pc_budget (
    id             SERIAL PRIMARY KEY,
    profit_center  TEXT NOT NULL DEFAULT 'ALL',
    fiscal_year    TEXT NOT NULL,
    budget_type    TEXT NOT NULL DEFAULT 'TOTAL',
    budget_inr     REAL NOT NULL DEFAULT 0,
    approved_by    TEXT DEFAULT '',
    approved_at    TEXT DEFAULT '',
    created_at     TEXT DEFAULT NOW()::TEXT,
    UNIQUE(profit_center, fiscal_year, budget_type)
);
CREATE INDEX IF NOT EXISTS idx_pcb_pc      ON pc_budget(profit_center, fiscal_year);

-- ── Profit Center Master: extra columns ───────────────────────────────────────
ALTER TABLE profit_center_master ADD COLUMN IF NOT EXISTS default_capex_opex TEXT DEFAULT 'OPEX';
ALTER TABLE profit_center_master ADD COLUMN IF NOT EXISTS dept_code          TEXT DEFAULT '';
ALTER TABLE profit_center_master ADD COLUMN IF NOT EXISTS plant              TEXT DEFAULT '';
ALTER TABLE profit_center_master ADD COLUMN IF NOT EXISTS capex_budget       REAL DEFAULT 0;
ALTER TABLE profit_center_master ADD COLUMN IF NOT EXISTS opex_budget        REAL DEFAULT 0;
ALTER TABLE profit_center_master ADD COLUMN IF NOT EXISTS material_group     TEXT DEFAULT '';

-- ── Seed 40 standard profit centers ──────────────────────────────────────────
INSERT INTO profit_center_master (profit_center, pc_name, company_code, dept_code, plant, material_group, default_capex_opex, bu_type, is_active) VALUES
('1001-FAC-MUM','Facilities — Mumbai',      '1001','FAC','MNAL','9901','OPEX',  'FACILITIES',   1),
('1001-FAC-DEL','Facilities — Delhi North', '1001','FAC','DELP','9901','OPEX',  'FACILITIES',   1),
('1001-FAC-SDL','Facilities — South Delhi', '1001','FAC','SDPL','9901','OPEX',  'FACILITIES',   1),
('1001-FAC-BLR','Facilities — Bengaluru',   '1001','FAC','BLRP','9901','OPEX',  'FACILITIES',   1),
('1001-FAC-HYD','Facilities — Hyderabad',   '1001','FAC','HYDP','9901','OPEX',  'FACILITIES',   1),
('1001-ENG-MUM','Engineering — Mumbai',     '1001','ENG','MNAL','9902','CAPEX', 'ENGINEERING',  1),
('1001-ENG-DEL','Engineering — Delhi North','1001','ENG','DELP','9902','CAPEX', 'ENGINEERING',  1),
('1001-ENG-SDL','Engineering — South Delhi','1001','ENG','SDPL','9902','CAPEX', 'ENGINEERING',  1),
('1001-ENG-BLR','Engineering — Bengaluru',  '1001','ENG','BLRP','9902','CAPEX', 'ENGINEERING',  1),
('1001-ENG-HYD','Engineering — Hyderabad',  '1001','ENG','HYDP','9902','CAPEX', 'ENGINEERING',  1),
('1001-ADM-MUM','Admin & Office — Mumbai',  '1001','ADM','MNAL','9903','OPEX',  'ADMIN',        1),
('1001-ADM-DEL','Admin & Office — Delhi',   '1001','ADM','DELP','9903','OPEX',  'ADMIN',        1),
('1001-ADM-SDL','Admin & Office — S.Delhi', '1001','ADM','SDPL','9903','OPEX',  'ADMIN',        1),
('1001-ADM-BLR','Admin & Office — BLR',     '1001','ADM','BLRP','9903','OPEX',  'ADMIN',        1),
('1001-ADM-HYD','Admin & Office — HYD',     '1001','ADM','HYDP','9903','OPEX',  'ADMIN',        1),
('1001-ITH-MUM','IT Hardware — Mumbai',     '1001','ITH','MNAL','9904','CAPEX', 'IT',           1),
('1001-ITH-DEL','IT Hardware — Delhi',      '1001','ITH','DELP','9904','CAPEX', 'IT',           1),
('1001-ITH-SDL','IT Hardware — S.Delhi',    '1001','ITH','SDPL','9904','CAPEX', 'IT',           1),
('1001-ITH-BLR','IT Hardware — Bengaluru',  '1001','ITH','BLRP','9904','CAPEX', 'IT',           1),
('1001-ITH-HYD','IT Hardware — Hyderabad',  '1001','ITH','HYDP','9904','CAPEX', 'IT',           1),
('1001-ITS-MUM','IT Software — Mumbai',     '1001','ITS','MNAL','9905','OPEX',  'IT',           1),
('1001-ITS-DEL','IT Software — Delhi',      '1001','ITS','DELP','9905','OPEX',  'IT',           1),
('1001-ITS-SDL','IT Software — S.Delhi',    '1001','ITS','SDPL','9905','OPEX',  'IT',           1),
('1001-ITS-BLR','IT Software — Bengaluru',  '1001','ITS','BLRP','9905','OPEX',  'IT',           1),
('1001-ITS-HYD','IT Software — Hyderabad',  '1001','ITS','HYDP','9905','OPEX',  'IT',           1),
('1001-STR-MUM','Strategy & Consulting — Mumbai', '1001','STR','MNAL','9906','OPEX','STRATEGY', 1),
('1001-STR-DEL','Strategy & Consulting — Delhi',  '1001','STR','DELP','9906','OPEX','STRATEGY', 1),
('1001-STR-SDL','Strategy & Consulting — SDL',    '1001','STR','SDPL','9906','OPEX','STRATEGY', 1),
('1001-STR-BLR','Strategy & Consulting — BLR',    '1001','STR','BLRP','9906','OPEX','STRATEGY', 1),
('1001-STR-HYD','Strategy & Consulting — HYD',    '1001','STR','HYDP','9906','OPEX','STRATEGY', 1),
('1001-SCM-MUM','Supply Chain — Mumbai',    '1001','SCM','MNAL','9907','OPEX',  'SUPPLY_CHAIN', 1),
('1001-SCM-DEL','Supply Chain — Delhi',     '1001','SCM','DELP','9907','OPEX',  'SUPPLY_CHAIN', 1),
('1001-SCM-SDL','Supply Chain — S.Delhi',   '1001','SCM','SDPL','9907','OPEX',  'SUPPLY_CHAIN', 1),
('1001-SCM-BLR','Supply Chain — Bengaluru', '1001','SCM','BLRP','9907','OPEX',  'SUPPLY_CHAIN', 1),
('1001-SCM-HYD','Supply Chain — Hyderabad', '1001','SCM','HYDP','9907','OPEX',  'SUPPLY_CHAIN', 1),
('1001-OPS-MUM','Operations — Mumbai',      '1001','OPS','MNAL','9908','OPEX',  'OPERATIONS',   1),
('1001-OPS-DEL','Operations — Delhi',       '1001','OPS','DELP','9908','OPEX',  'OPERATIONS',   1),
('1001-OPS-SDL','Operations — S.Delhi',     '1001','OPS','SDPL','9908','OPEX',  'OPERATIONS',   1),
('1001-OPS-BLR','Operations — Bengaluru',   '1001','OPS','BLRP','9908','OPEX',  'OPERATIONS',   1),
('1001-OPS-HYD','Operations — Hyderabad',   '1001','OPS','HYDP','9908','OPEX',  'OPERATIONS',   1)
ON CONFLICT (profit_center) DO NOTHING;
