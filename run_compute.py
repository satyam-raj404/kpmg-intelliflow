"""Directly trigger compute_all on the live PostgreSQL database."""
import sys, os
sys.path.insert(0, "backend")

from pathlib import Path
env = Path(".env")
if env.exists():
    for l in env.read_text().splitlines():
        if "=" in l and not l.startswith("#"):
            k, v = l.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

from database import get_connection, init_db
from services.kpi_engine import compute_all

print("Initialising DB schema...")
init_db()

print("Running compute_all...")
conn = get_connection()
compute_all(conn)
conn.commit()
print("Done.")

# Report utilization KPIs
rows = conn.execute(
    "SELECT kpi_code, value_numeric, value_text, unit FROM kpi_results WHERE dashboard='utilization' ORDER BY kpi_code"
).fetchall()
print(f"\n{'KPI Code':<35} {'Value':>14} {'Unit':>10}")
print("-" * 65)
for r in rows:
    v = r[1]
    vt = r[2] or ""
    val = f"{v:.2f}" if v is not None else (f"[JSON {len(vt)}ch]" if vt else "--")
    print(f"{r[0]:<35} {val:>14} {r[3] or '':>10}")
print(f"\nTotal utilization KPIs: {len(rows)}")
