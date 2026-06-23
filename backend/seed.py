"""
Seed script — run during Vercel build or local dev setup.
Generates strategic P2P data and loads all 9 staging tables + reference tables.
"""
import sys
import os
from pathlib import Path

# ── Ensure backend is on path ──────────────────────────────────────────────
BACKEND_DIR = Path(__file__).parent
sys.path.insert(0, str(BACKEND_DIR))

# ── Generate fresh data ────────────────────────────────────────────────────
print("[seed] Generating strategic P2P data...")
import subprocess
gen_script = BACKEND_DIR.parent / "_gen_data.py"
if gen_script.exists():
    subprocess.run([sys.executable, str(gen_script)], check=True)
    print("[seed] Data generated.")
else:
    print(f"[seed] WARNING: {gen_script} not found. Using existing data files.")

# ── Init DB schema ─────────────────────────────────────────────────────────
from database import init_db, get_connection
init_db()
print("[seed] Schema initialized.")

conn = get_connection()

# ── Load all CSV files ─────────────────────────────────────────────────────
from services.parser import parse_file
from services.validator import validate
from services.loader import load
from services.fact_builder import build_facts, build_entity_hierarchy
from services.event_generator import generate_events
from services.kpi_engine import compute_all

DATA_DIR = BACKEND_DIR.parent / "data"
BATCH_ID = "seed_batch_001"

FILE_ORDER = [
    "08_Vendor_Master.csv",       # must come first (FK reference)
    "01_PR_Dump.csv",
    "02_PO_Dump.csv",
    "03_PO_Delivery_Dump.csv",
    "04_GRN_Dump.csv",
    "05_PO_Invoice_Dump.csv",
    "06_Invoice_Dump.csv",
    "07_Payment_Dump.csv",
    "09_Change_Log.csv",
    "company_plant_master.csv",
]

total_loaded = 0
for fname in FILE_ORDER:
    fpath = DATA_DIR / fname
    if not fpath.exists():
        print(f"  [seed] SKIP {fname} — not found")
        continue

    file_bytes = fpath.read_bytes()
    try:
        df, dataset_type = parse_file(file_bytes, fname)
        valid_df, rejections = validate(df, dataset_type, conn)
        rows = load(valid_df, dataset_type, conn, BATCH_ID)
        total_loaded += rows
        print(f"  [seed] {fname:<35s} {rows:>4} rows -> {dataset_type}")
        hard_rej = [r for r in rejections if not r.get("warn_only")]
        if hard_rej:
            print(f"         {len(hard_rej)} rejected: {hard_rej[:3]}")
    except Exception as e:
        print(f"  [seed] ERROR {fname}: {e}")
        import traceback; traceback.print_exc()

print(f"\n[seed] Total rows loaded: {total_loaded}")

# ── Seed license_usage for Utilization dashboard ───────────────────────────
LICENSE_TOOLS = [
    ("SAP S/4HANA",        500,  410, 18_50_00_000, "2024-06-30", "9905"),
    ("Microsoft 365 E3",   800,  780,  9_20_00_000, "2024-03-31", "9905"),
    ("Salesforce CRM",     250,  110,  6_40_00_000, "2023-12-31", "9905"),
    ("ServiceNow ITSM",    300,  275,  4_50_00_000, "2024-09-30", "9905"),
    ("Tableau Desktop",    120,   38,  2_80_00_000, "2024-03-31", "9905"),
    ("Oracle DB Ent.",      80,   72, 12_00_00_000, "2025-06-30", "9905"),
    ("Jira Software",      600,  592,  1_80_00_000, "2024-06-30", "9905"),
    ("Adobe Creative CC",  100,   62,  3_20_00_000, "2024-01-31", "9905"),
    ("Zoom Meetings",      700,  645,  1_40_00_000, "2023-12-31", "9905"),
    ("GitHub Enterprise",  400,  388,  2_60_00_000, "2024-06-30", "9905"),
]

for tool, total, active, annual, renewal, mg in LICENSE_TOOLS:
    conn.execute("""
        INSERT INTO license_usage
            (tool_name, total_licenses, active_users, annual_cost_inr, renewal_date, material_group)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT (tool_name) DO UPDATE SET
            total_licenses  = EXCLUDED.total_licenses,
            active_users    = EXCLUDED.active_users,
            annual_cost_inr = EXCLUDED.annual_cost_inr,
            renewal_date    = EXCLUDED.renewal_date,
            material_group  = EXCLUDED.material_group
    """, (tool, total, active, annual, renewal, mg))
print("[seed] License usage data seeded.")

conn.commit()

# ── Rebuild computed tables + KPIs ─────────────────────────────────────────
print("[seed] Building entity hierarchy...")
build_entity_hierarchy(conn)

print("[seed] Building fact table...")
build_facts(conn)

print("[seed] Generating process mining events...")
generate_events(conn)

print("[seed] Computing KPIs...")
compute_all(conn)

conn.commit()
print("[seed] Seed complete.\n")
