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
    user_id     TEXT PRIMARY KEY,
    email       TEXT NOT NULL UNIQUE,
    full_name   TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT 'procurement_manager',
    is_active   INTEGER DEFAULT 1,
    created_at  TEXT DEFAULT NOW()::TEXT
);

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
    uploaded_at     TEXT DEFAULT NOW()::TEXT
);
