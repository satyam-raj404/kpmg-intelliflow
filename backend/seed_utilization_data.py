"""
Seed dummy data for Utilization dashboard new tables:
  - license_usage
  - po_categorization
  - material_license_cost
  - profit_center_master
  - pc_budget

Run: python backend/seed_utilization_data.py
"""
import os, sys, json
from pathlib import Path

# ── load .env ──────────────────────────────────────────────────────────────────
_env = Path(__file__).parent.parent / ".env"
if _env.exists():
    for line in _env.read_text().splitlines():
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

import psycopg

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:1234@localhost:5432/intellisource"
)

conn = psycopg.connect(DATABASE_URL)
conn.autocommit = False


def run(sql, params=None):
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return cur


# ── 1. LICENSE_USAGE ──────────────────────────────────────────────────────────
print("Seeding license_usage...")
TOOLS = [
    # (tool_name, total, active, annual_cost_inr, renewal_date, vendor, type)
    ("SAP S/4HANA",        500, 423, 12_50_00_000, "2025-03-31", "SAP SE",        "ERP_LICENSE"),
    ("Microsoft 365",      800, 756, 4_80_00_000,  "2025-12-31", "Microsoft Corp","SUBSCRIPTION"),
    ("Salesforce CRM",     120,  68, 2_40_00_000,  "2024-12-31", "Salesforce Inc","SUBSCRIPTION"),
    ("Adobe Creative CC",   60,  22, 72_00_000,    "2025-06-30", "Adobe Inc",     "SUBSCRIPTION"),
    ("Jira + Confluence",  200, 198, 96_00_000,    "2025-09-30", "Atlassian",     "SUBSCRIPTION"),
    ("GitHub Enterprise",  150, 143, 60_00_000,    "2025-08-31", "GitHub Inc",    "SUBSCRIPTION"),
    ("Oracle DB EE",        20,  18, 3_60_00_000,  "2026-03-31", "Oracle Corp",   "PERPETUAL"),
    ("Tableau",             80,  41, 1_20_00_000,  "2025-07-31", "Salesforce Inc","SUBSCRIPTION"),
    ("Zoom Workplace",     300, 290, 48_00_000,    "2025-03-31", "Zoom Video",    "SUBSCRIPTION"),
    ("ServiceNow ITSM",     50,  49, 1_80_00_000,  "2026-01-31", "ServiceNow",    "SUBSCRIPTION"),
]

for t in TOOLS:
    run("""
        INSERT INTO license_usage
            (tool_name, total_licenses, active_users, annual_cost_inr,
             renewal_date, vendor, license_type, material_group, profit_center)
        VALUES (%s,%s,%s,%s,%s,%s,%s,'SOFTWARE','PC-IT')
        ON CONFLICT(tool_name) DO UPDATE SET
            total_licenses  = EXCLUDED.total_licenses,
            active_users    = EXCLUDED.active_users,
            annual_cost_inr = EXCLUDED.annual_cost_inr,
            renewal_date    = EXCLUDED.renewal_date,
            vendor          = EXCLUDED.vendor,
            license_type    = EXCLUDED.license_type
    """, (t[0], t[1], t[2], t[3], t[4], t[5], t[6]))

print(f"  ✓ {len(TOOLS)} license tools seeded")


# ── 2. PROFIT_CENTER_MASTER ───────────────────────────────────────────────────
print("Seeding profit_center_master...")
PCS = [
    ("PC-IT",   "IT & Digital",         "1001", "Rahul Sharma",   "IT"),
    ("PC-MFG",  "Manufacturing Ops",    "1001", "Priya Nair",     "MANUFACTURING"),
    ("PC-INF",  "Infrastructure",       "1001", "Arun Mehta",     "CAPEX"),
    ("PC-MKT",  "Marketing & Comms",    "2001", "Sneha Iyer",     "OPEX"),
    ("PC-SCM",  "Supply Chain Mgmt",    "2001", "Vijay Reddy",    "OPEX"),
    ("PC-FIN",  "Finance & Accounts",   "3001", "Ananya Gupta",   "CORPORATE"),
    ("PC-HRD",  "Human Resources",      "3001", "Kiran Patel",    "CORPORATE"),
    ("PC-R&D",  "Research & Dev",       "1001", "Deepak Joshi",   "CAPEX"),
]
for p in PCS:
    run("""
        INSERT INTO profit_center_master
            (profit_center, pc_name, company_code, responsible_person, bu_type)
        VALUES (%s,%s,%s,%s,%s)
        ON CONFLICT(profit_center) DO UPDATE SET
            pc_name            = EXCLUDED.pc_name,
            responsible_person = EXCLUDED.responsible_person,
            bu_type            = EXCLUDED.bu_type
    """, p)
print(f"  ✓ {len(PCS)} profit centers seeded")


# ── 3. PC_BUDGET ──────────────────────────────────────────────────────────────
print("Seeding pc_budget...")
BUDGETS = [
    ("PC-IT",  "2025", "TOTAL",  18_00_00_000, "CTO"),
    ("PC-IT",  "2025", "CAPEX",   5_00_00_000, "CTO"),
    ("PC-IT",  "2025", "OPEX",   13_00_00_000, "CTO"),
    ("PC-MFG", "2025", "TOTAL",  45_00_00_000, "COO"),
    ("PC-MFG", "2025", "CAPEX",  20_00_00_000, "COO"),
    ("PC-MFG", "2025", "OPEX",   25_00_00_000, "COO"),
    ("PC-INF", "2025", "TOTAL",  30_00_00_000, "CFO"),
    ("PC-INF", "2025", "CAPEX",  25_00_00_000, "CFO"),
    ("PC-INF", "2025", "OPEX",    5_00_00_000, "CFO"),
    ("PC-SCM", "2025", "TOTAL",  10_00_00_000, "CPO"),
    ("PC-R&D", "2025", "TOTAL",   8_00_00_000, "CTO"),
    ("PC-R&D", "2025", "CAPEX",   6_00_00_000, "CTO"),
]
for b in BUDGETS:
    run("""
        INSERT INTO pc_budget
            (profit_center, fiscal_year, budget_type, budget_inr, approved_by, approved_at)
        VALUES (%s,%s,%s,%s,%s,'2025-04-01')
        ON CONFLICT(profit_center, fiscal_year, budget_type) DO UPDATE SET
            budget_inr  = EXCLUDED.budget_inr,
            approved_by = EXCLUDED.approved_by
    """, b)
print(f"  ✓ {len(BUDGETS)} budget rows seeded")


# ── 4. PO_CATEGORIZATION + MATERIAL_LICENSE_COST via real PO data ─────────────
print("Fetching real PO docs for categorization seeding...")

with conn.cursor() as cur:
    cur.execute("""
        SELECT purchasing_document, item,
               COALESCE(material_description,'') AS md,
               COALESCE(vendor,'') AS vendor,
               COALESCE(company_code,'1001') AS cc,
               COALESCE(net_order_value,'0') AS nov
        FROM po_dump
        ORDER BY RANDOM()
        LIMIT 200
    """)
    po_rows = cur.fetchall()

print(f"  Got {len(po_rows)} PO lines")

if not po_rows:
    print("  ⚠ No PO data found — skipping categorization seeding")
else:
    import re

    SW_RULES = [
        (re.compile(r'(?i)SAAS|SUBSCR|CLOUD LIC|ANNUAL LIC|MONTHLY LIC'),  'SOFTWARE','SUBSCRIPTION','OPEX','SUBSCRIPTION'),
        (re.compile(r'(?i)PERPETUAL|ONE.TIME LIC'),                         'SOFTWARE','PERPETUAL',   'CAPEX','PERPETUAL'),
        (re.compile(r'(?i)SOFTWARE MAINT|AMC SOFTWARE|SUPPORT LIC|MAINTEN'),'SOFTWARE','MAINTENANCE', 'OPEX','SUBSCRIPTION'),
        (re.compile(r'(?i)SAP|ERP LIC|ORACLE LIC|S/4'),                    'SOFTWARE','ERP_LICENSE',  'CAPEX','PERPETUAL'),
        (re.compile(r'(?i)MICROSOFT|ADOBE|SALESFORCE|JIRA|GITHUB|LICENSE KEY'), 'SOFTWARE','IT_TOOL','OPEX','SUBSCRIPTION'),
        (re.compile(r'(?i)ROYALTY|PATENT FEE|IP FEE|TECHNOLOGY FEE'),      'MATERIAL','ROYALTY',     'OPEX','ROYALTY'),
        (re.compile(r'(?i)IMPORT LIC|CUSTOMS LIC|DGFT|IEC LIC'),           'MATERIAL','IMPORT_LIC',  'OPEX','IMPORT_LICENSE'),
        (re.compile(r'(?i)MACHIN|EQUIP|TURBINE|COMPRESSOR|PLANT ASSET|CAPITAL'), 'MATERIAL','CAPEX_ASSET','CAPEX',''),
    ]

    # Manually assign categories to batches of POs for deterministic coverage
    cat_assignments = [
        # (category, sub_category, capex_opex, license_type, profit_center)
        ('SOFTWARE','SUBSCRIPTION','OPEX','SUBSCRIPTION','PC-IT'),
        ('SOFTWARE','ERP_LICENSE','CAPEX','PERPETUAL','PC-IT'),
        ('SOFTWARE','MAINTENANCE','OPEX','SUBSCRIPTION','PC-IT'),
        ('SOFTWARE','IT_TOOL','OPEX','SUBSCRIPTION','PC-IT'),
        ('MATERIAL','ROYALTY','OPEX','ROYALTY','PC-MFG'),
        ('MATERIAL','IMPORT_LIC','OPEX','IMPORT_LICENSE','PC-SCM'),
        ('MATERIAL','CAPEX_ASSET','CAPEX','','PC-INF'),
        ('MATERIAL','OPEX','OPEX','','PC-MFG'),
        ('SERVICE','IT_SERVICE','OPEX','','PC-IT'),
        ('SERVICE','CONSULTING','OPEX','','PC-FIN'),
    ]

    cat_count  = 0
    lic_count  = 0
    batch_size = max(1, len(po_rows) // len(cat_assignments))

    for idx, assignment in enumerate(cat_assignments):
        cat, sub, co, lic, pc = assignment
        start = idx * batch_size
        batch = po_rows[start: start + batch_size]
        for row in batch:
            po_doc, item = row[0], row[1]
            vendor = row[3]
            try:
                run("""
                    INSERT INTO po_categorization
                        (purchasing_document, item, po_category, sub_category,
                         capex_opex_flag, license_type, profit_center, tagged_by, tagged_at)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,'SYSTEM',NOW()::TEXT)
                    ON CONFLICT(purchasing_document, item) DO UPDATE SET
                        po_category     = EXCLUDED.po_category,
                        sub_category    = EXCLUDED.sub_category,
                        capex_opex_flag = EXCLUDED.capex_opex_flag,
                        license_type    = EXCLUDED.license_type,
                        profit_center   = EXCLUDED.profit_center
                    WHERE po_categorization.tagged_by = 'SYSTEM'
                """, (po_doc, item, cat, sub, co, lic, pc))
                cat_count += 1
            except Exception as e:
                pass

            # Add material license cost rows for royalty/import_lic categories
            if cat == 'MATERIAL' and sub in ('ROYALTY', 'IMPORT_LIC'):
                try:
                    nov = float(row[5]) if row[5] else 0
                    fee = round(nov * 0.035, 2)   # 3.5% royalty on PO value
                    lic_type = 'ROYALTY' if sub == 'ROYALTY' else 'IMPORT_LICENSE'
                    run("""
                        INSERT INTO material_license_cost
                            (purchasing_document, item, license_type, license_fee_inr,
                             fee_basis, fee_pct, vendor, validity_start, validity_end, created_by)
                        VALUES (%s,%s,%s,%s,'PERCENTAGE',3.5,%s,'2024-04-01','2025-03-31','SYSTEM')
                        ON CONFLICT DO NOTHING
                    """, (po_doc, item, lic_type, fee, vendor or 'UNKNOWN'))
                    lic_count += 1
                except Exception:
                    pass

    print(f"  ✓ {cat_count} po_categorization rows seeded")
    print(f"  ✓ {lic_count} material_license_cost rows seeded")

    # Add some explicit SOFTWARE POs tagged as CAPEX for SW_CAPEX_SPEND KPI visibility
    sw_po_sample = po_rows[:5]
    for row in sw_po_sample:
        po_doc, item = row[0], row[1]
        try:
            run("""
                INSERT INTO po_categorization
                    (purchasing_document, item, po_category, sub_category,
                     capex_opex_flag, license_type, profit_center, tagged_by)
                VALUES (%s,%s,'SOFTWARE','ERP_LICENSE','CAPEX','PERPETUAL','PC-IT','USER_SEED')
                ON CONFLICT(purchasing_document, item) DO UPDATE SET
                    po_category     = 'SOFTWARE',
                    sub_category    = 'ERP_LICENSE',
                    capex_opex_flag = 'CAPEX',
                    license_type    = 'PERPETUAL',
                    profit_center   = 'PC-IT',
                    tagged_by       = 'USER_SEED'
            """, (po_doc, item))
        except Exception:
            pass

    # Add explicit SOFTWARE OPEX rows
    sw_opex_sample = po_rows[5:20]
    for row in sw_opex_sample:
        po_doc, item = row[0], row[1]
        try:
            run("""
                INSERT INTO po_categorization
                    (purchasing_document, item, po_category, sub_category,
                     capex_opex_flag, license_type, profit_center, tagged_by)
                VALUES (%s,%s,'SOFTWARE','SUBSCRIPTION','OPEX','SUBSCRIPTION','PC-IT','USER_SEED')
                ON CONFLICT(purchasing_document, item) DO UPDATE SET
                    po_category     = 'SOFTWARE',
                    sub_category    = 'SUBSCRIPTION',
                    capex_opex_flag = 'OPEX',
                    license_type    = 'SUBSCRIPTION',
                    tagged_by       = 'USER_SEED'
            """, (po_doc, item))
        except Exception:
            pass

    print("  ✓ explicit SW CAPEX/OPEX sample rows added")


# ── Commit ────────────────────────────────────────────────────────────────────
conn.commit()
conn.close()
print("\n✅ Seed complete. Trigger KPI recompute: POST /api/kpis/recompute")
