"""
One-shot migration: add new columns to license_usage and create the 4 new Utilization tables.
Safe to run multiple times (idempotent).
"""
import os, sys
from pathlib import Path

env = Path(__file__).parent.parent / ".env"
if env.exists():
    for l in env.read_text().splitlines():
        if "=" in l and not l.startswith("#"):
            k, v = l.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

import psycopg

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://postgres:1234@localhost:5432/intellisource")
conn = psycopg.connect(DATABASE_URL)
conn.autocommit = True

def run(sql):
    try:
        conn.execute(sql)
        return True
    except Exception as e:
        print(f"  skip: {e}")
        return False

# ── Extend license_usage ───────────────────────────────────────────────────────
print("Extending license_usage...")
run("ALTER TABLE license_usage ADD COLUMN IF NOT EXISTS profit_center   TEXT DEFAULT ''")
run("ALTER TABLE license_usage ADD COLUMN IF NOT EXISTS license_type    TEXT DEFAULT 'SUBSCRIPTION'")
run("ALTER TABLE license_usage ADD COLUMN IF NOT EXISTS vendor          TEXT DEFAULT ''")
run("ALTER TABLE license_usage ADD COLUMN IF NOT EXISTS po_reference    TEXT DEFAULT ''")
print("  ✓ license_usage extended")

# ── Create po_categorization ──────────────────────────────────────────────────
print("Creating po_categorization...")
run("""
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
)
""")
run("CREATE INDEX IF NOT EXISTS idx_poc_po     ON po_categorization(purchasing_document, item)")
run("CREATE INDEX IF NOT EXISTS idx_poc_cat    ON po_categorization(po_category)")
run("CREATE INDEX IF NOT EXISTS idx_poc_tagger ON po_categorization(tagged_by)")
run("CREATE INDEX IF NOT EXISTS idx_poc_pc     ON po_categorization(profit_center)")
print("  ✓ po_categorization ready")

# ── Create material_license_cost ──────────────────────────────────────────────
print("Creating material_license_cost...")
run("""
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
)
""")
run("CREATE INDEX IF NOT EXISTS idx_mlc_po   ON material_license_cost(purchasing_document, item)")
run("CREATE INDEX IF NOT EXISTS idx_mlc_type ON material_license_cost(license_type)")
print("  ✓ material_license_cost ready")

# ── Create profit_center_master ───────────────────────────────────────────────
print("Creating profit_center_master...")
run("""
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
)
""")
run("CREATE INDEX IF NOT EXISTS idx_pcm_pc ON profit_center_master(profit_center)")
run("CREATE INDEX IF NOT EXISTS idx_pcm_co ON profit_center_master(company_code)")
print("  ✓ profit_center_master ready")

# ── Create pc_budget ──────────────────────────────────────────────────────────
print("Creating pc_budget...")
run("""
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
)
""")
run("CREATE INDEX IF NOT EXISTS idx_pcb_pc ON pc_budget(profit_center, fiscal_year)")
print("  ✓ pc_budget ready")

conn.close()
print("\n✅ Migration complete. Now run: python backend/seed_utilization_data.py")
