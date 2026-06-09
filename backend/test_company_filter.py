"""Test company-wise KPI filter."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from database import get_connection
conn = get_connection()

print("=== Company codes in data ===")
for t in ["po_dump","invoice_dump","grn_dump","payment_dump","pr_dump","vendor_master"]:
    try:
        rows = conn.execute(f"SELECT DISTINCT company_code, COUNT(*) FROM {t} GROUP BY company_code").fetchall()
        print(f"  {t}: {[(r[0],r[1]) for r in rows]}")
    except Exception as e:
        print(f"  {t}: ERROR {e}")

print()
print("=== kpi_config ACTIVE_COMPANY_CODES ===")
rows = conn.execute("SELECT config_key, config_value FROM kpi_config WHERE config_key LIKE '%COMPANY%'").fetchall()
for r in rows:
    print(f"  {r[0]} = {r[1]!r}")

print()
print("=== Test: _cc_sql logic ===")
# Simulate what kpi_engine does
cc_cfg = ""
cc_codes = [c.strip() for c in cc_cfg.split(",") if c.strip()]
cc_sql_all = "1=1"
print(f"  cc_cfg='' => _CC_SQL = {cc_sql_all!r}  (no filter = ALL)")

cc_cfg2 = "1001"
cc_codes2 = [c.strip() for c in cc_cfg2.split(",") if c.strip()]
cc_sql_specific = "company_code IN (" + ",".join(f"'{c}'" for c in cc_codes2) + ")"
print(f"  cc_cfg='1001' => _CC_SQL = {cc_sql_specific!r}")

print()
print("=== Test query: Total PO value ALL vs 1001 ===")
val_all = conn.execute(
    "SELECT SUM(CAST(net_order_value AS REAL)) FROM po_dump"
    " WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))"
    " AND 1=1"
).fetchone()[0]
print(f"  ALL: {val_all:,.2f}" if val_all else "  ALL: NULL")

val_1001 = conn.execute(
    "SELECT SUM(CAST(net_order_value AS REAL)) FROM po_dump"
    " WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))"
    " AND company_code IN ('1001')"
).fetchone()[0]
print(f"  1001: {val_1001:,.2f}" if val_1001 else "  1001: NULL")

val_9999 = conn.execute(
    "SELECT SUM(CAST(net_order_value AS REAL)) FROM po_dump"
    " WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))"
    " AND company_code IN ('9999')"
).fetchone()[0]
print(f"  9999 (fake): {val_9999}" if val_9999 else "  9999 (fake): NULL / 0")

print()
print("=== Test: Invoice spend ALL vs 1001 vs 9999 ===")
for cc_filter, label in [("1=1","ALL"), ("company_code IN ('1001')","1001"), ("company_code IN ('9999')","9999-fake")]:
    r = conn.execute(f"""
        WITH cancelled AS (
            SELECT DISTINCT reverse_invoice AS doc FROM invoice_dump
            WHERE reverse_invoice IS NOT NULL AND reverse_invoice != ''
        )
        SELECT SUM(
            CAST(amount_local_ccy AS REAL)
            * CASE WHEN debit_credit_ind='S' THEN 1.0 ELSE -1.0 END
        )
        FROM invoice_dump
        WHERE document_type IN ('RE','KR','RN')
          AND posting_date >= '2022-04-01'
          AND {cc_filter}
          AND invoice_doc NOT IN (SELECT doc FROM cancelled)
          AND (reverse_invoice IS NULL OR reverse_invoice='')
    """).fetchone()[0]
    print(f"  {label}: {r:,.2f}" if r else f"  {label}: NULL / 0")

print()
print("=== Test: compute_all with company_code='1001' vs 'ALL' ===")
import services.kpi_engine as ke

conn2 = get_connection()
# Check if compute_all accepts company_code param
import inspect
sig = inspect.signature(ke.compute_all)
print(f"  compute_all signature: {sig}")

print()
print("=== Router: how company_code param flows to KPIs ===")
# Read router to see filter flow
from pathlib import Path
kpi_router = Path(__file__).parent / "routers" / "kpi.py"
if kpi_router.exists():
    text = kpi_router.read_text()
    # find lines with company_code
    for i, line in enumerate(text.splitlines(), 1):
        if "company_code" in line.lower() or "cc_cfg" in line.lower():
            print(f"  router:{i}: {line.rstrip()}")
