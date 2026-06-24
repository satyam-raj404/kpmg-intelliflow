"""Startup seed — loads sample CSVs from data/ into Neon on first deploy.

Called by render.yaml startCommand before uvicorn.
Skipped if po_dump already has rows (idempotent).
Never crashes — server must start even if seed fails.
"""
import os
import sys
from pathlib import Path

# Load .env if present (local dev only — Render uses env vars directly)
_env_file = Path(__file__).resolve().parent.parent / ".env"
if _env_file.exists():
    try:
        from dotenv import load_dotenv
        load_dotenv(_env_file)
    except ImportError:
        for _line in _env_file.read_text().splitlines():
            if "=" in _line and not _line.startswith("#"):
                _k, _v = _line.split("=", 1)
                os.environ.setdefault(_k.strip(), _v.strip())

# Absolute path to data/ folder (one level above backend/)
DATA_DIR = Path(__file__).resolve().parent.parent / "data"

# Load order: masters first, then P2P transaction flow
SEED_FILES = [
    "company_plant_master.csv",
    "08_Vendor_Master.csv",
    "01_PR_Dump.csv",
    "02_PO_Dump.csv",
    "03_PO_Delivery_Dump.csv",
    "04_GRN_Dump.csv",
    "05_PO_Invoice_Dump.csv",
    "06_Invoice_Dump.csv",
    "07_Payment_Dump.csv",
    "09_Change_Log.csv",
    # BID_Data, Budget_Master, RFQ skipped — no recognised dataset signature in parser
]

LICENSE_TOOLS = [
    ("SAP S/4HANA",        500,  410, 185000000, "2024-06-30", "9905"),
    ("Microsoft 365 E3",   800,  780,  92000000, "2024-03-31", "9905"),
    ("Salesforce CRM",     250,  110,  64000000, "2023-12-31", "9905"),
    ("ServiceNow ITSM",    300,  275,  45000000, "2024-09-30", "9905"),
    ("Tableau Desktop",    120,   38,  28000000, "2024-03-31", "9905"),
    ("Oracle DB Ent.",      80,   72, 120000000, "2025-06-30", "9905"),
    ("Jira Software",      600,  592,  18000000, "2024-06-30", "9905"),
    ("Adobe Creative CC",  100,   62,  32000000, "2024-01-31", "9905"),
    ("Zoom Meetings",      700,  645,  14000000, "2023-12-31", "9905"),
    ("GitHub Enterprise",  400,  388,  26000000, "2024-06-30", "9905"),
]


def _already_seeded(conn) -> bool:
    try:
        row = conn.execute("SELECT COUNT(*) AS cnt FROM po_dump").fetchone()
        return (row["cnt"] if row else 0) > 0
    except Exception:
        return False


def _seed_licenses(conn) -> None:
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
    conn.commit()
    print("[seed] License usage seeded.")


def main() -> None:
    from database import init_db, get_connection
    from services.parser import parse_file
    from services.validator import validate
    from services.loader import load
    from services.fact_builder import build_facts, build_entity_hierarchy
    from services.event_generator import generate_events
    from services.kpi_engine import compute_all

    print("[seed] Initialising schema…")
    init_db()

    conn = get_connection()

    if _already_seeded(conn):
        print("[seed] Data already present — skipping CSV load.")
        return

    if not DATA_DIR.exists():
        print(f"[seed] data/ not found at {DATA_DIR} — skipping.", file=sys.stderr)
        return

    print(f"[seed] Seeding from {DATA_DIR}")
    batch_id = "seed_batch_001"
    total = 0

    for fname in SEED_FILES:
        fpath = DATA_DIR / fname
        if not fpath.exists():
            print(f"[seed] SKIP  {fname} (not found)")
            continue
        try:
            df, dataset_type = parse_file(fpath.read_bytes(), fname)
            valid_df, rejections = validate(df, dataset_type, conn)
            rows = load(valid_df, dataset_type, conn, batch_id)
            total += rows
            print(f"[seed] OK    {fname:<35s}  {rows:>5} rows  ({dataset_type})")
            hard = [r for r in rejections if not r.get("warn_only")]
            if hard:
                print(f"             {len(hard)} rejected: {hard[:2]}")
        except Exception as exc:
            print(f"[seed] FAIL  {fname}: {exc}", file=sys.stderr)

    conn.commit()
    print(f"[seed] {total} total rows loaded.")

    _seed_licenses(conn)

    print("[seed] Rebuilding entity hierarchy…")
    build_entity_hierarchy(conn)

    print("[seed] Building fact table…")
    build_facts(conn)

    print("[seed] Generating process events…")
    generate_events(conn)

    print("[seed] Computing KPIs…")
    compute_all(conn)

    conn.commit()
    print("[seed] Seed complete.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"[seed] Unhandled error: {exc}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        # Exit 0 — don't block uvicorn startup
        sys.exit(0)
