"""
IntelliSource P2P — Strategic Data Generator
Generates all 9 staging CSVs + company_plant_master with realistic P2P flows
and embedded anomalies for demo/testing purposes.

Anomalies embedded:
  - 20 Maverick POs (no PR reference) — ~13%
  - 3 SOD violations (PR creator = PO approver in change_log)
  - 3 Split POs (same vendor+day+material_group, each < 10L, total > 25L)
  - 1 PO against purchasing-blocked vendor (700900)
  - 6 Late deliveries (GRN > 15 days past expected)
  - 2 Duplicate invoices (same vendor+amount+date)
  - 2 Payment before GRN
  - 5 Price deviations in PO invoice vs PO net_order_value (>5%)
  - 3 PO deletions (deletion_indicator='L')
  - ~15% PO amendment rate (change_log U-type entries)
"""

import csv
import random
import os
from datetime import date, timedelta
from pathlib import Path

random.seed(42)
DATA_DIR = Path(__file__).parent.parent / "data"
DATA_DIR.mkdir(exist_ok=True)

# ── MASTER REFERENCE DATA ─────────────────────────────────────────────────────

VENDORS = [
    {"vendor": "732880", "vendor_name": "BV Infrastructure Pvt Ltd",
     "country": "IN", "city": "Mumbai",     "postal_code": "400001", "region": "MH",
     "account_group": "ZSER", "tax_number_pan": "AAACI4741P",
     "tax_number_gstin": "27AAACI4741P1ZF",
     "central_purchasing_block": "", "central_posting_block": "",
     "deletion_flag_central": "", "company_code": "1001",
     "payment_terms": "N030", "payment_block": "", "posting_block_cc": "",
     "msme_flag": "M", "vendor_type": "DOMESTIC"},
    {"vendor": "700100", "vendor_name": "Tata Steel Ltd",
     "country": "IN", "city": "Bengaluru",  "postal_code": "560100", "region": "KA",
     "account_group": "ZSER", "tax_number_pan": "AABCT1234P",
     "tax_number_gstin": "29AABCT1234P1Z5",
     "central_purchasing_block": "", "central_posting_block": "",
     "deletion_flag_central": "", "company_code": "1001",
     "payment_terms": "N045", "payment_block": "", "posting_block_cc": "",
     "msme_flag": "", "vendor_type": "DOMESTIC"},
    {"vendor": "700200", "vendor_name": "Reliance Industries Ltd",
     "country": "IN", "city": "Delhi",      "postal_code": "110001", "region": "DL",
     "account_group": "ZSRV", "tax_number_pan": "AABCR5678P",
     "tax_number_gstin": "07AABCR5678P1ZA",
     "central_purchasing_block": "", "central_posting_block": "",
     "deletion_flag_central": "", "company_code": "1001",
     "payment_terms": "N030", "payment_block": "", "posting_block_cc": "",
     "msme_flag": "", "vendor_type": "DOMESTIC"},
    {"vendor": "700300", "vendor_name": "L&T Construction Ltd",
     "country": "IN", "city": "Mumbai",     "postal_code": "400051", "region": "MH",
     "account_group": "ZCON", "tax_number_pan": "AABCL9012P",
     "tax_number_gstin": "27AABCL9012P1Z3",
     "central_purchasing_block": "", "central_posting_block": "",
     "deletion_flag_central": "", "company_code": "1001",
     "payment_terms": "N060", "payment_block": "", "posting_block_cc": "",
     "msme_flag": "", "vendor_type": "DOMESTIC"},
    {"vendor": "700400", "vendor_name": "Infosys Ltd",
     "country": "IN", "city": "Bengaluru",  "postal_code": "560066", "region": "KA",
     "account_group": "ZSRV", "tax_number_pan": "AABCI3456P",
     "tax_number_gstin": "29AABCI3456P1Z7",
     "central_purchasing_block": "", "central_posting_block": "",
     "deletion_flag_central": "", "company_code": "1001",
     "payment_terms": "N030", "payment_block": "", "posting_block_cc": "",
     "msme_flag": "", "vendor_type": "DOMESTIC"},
    {"vendor": "700500", "vendor_name": "Wipro Ltd",
     "country": "IN", "city": "Bengaluru",  "postal_code": "560035", "region": "KA",
     "account_group": "ZSRV", "tax_number_pan": "AABCW7890P",
     "tax_number_gstin": "29AABCW7890P1Z1",
     "central_purchasing_block": "", "central_posting_block": "",
     "deletion_flag_central": "", "company_code": "1001",
     "payment_terms": "N030", "payment_block": "*",  # PAYMENT BLOCKED
     "posting_block_cc": "",
     "msme_flag": "", "vendor_type": "DOMESTIC"},
    {"vendor": "700600", "vendor_name": "ITC Limited",
     "country": "IN", "city": "Kolkata",    "postal_code": "700001", "region": "WB",
     "account_group": "ZSRV", "tax_number_pan": "AABCI2345P",
     "tax_number_gstin": "19AABCI2345P1ZQ",
     "central_purchasing_block": "", "central_posting_block": "",
     "deletion_flag_central": "", "company_code": "1001",
     "payment_terms": "N045", "payment_block": "", "posting_block_cc": "",
     "msme_flag": "", "vendor_type": "DOMESTIC"},
    {"vendor": "700700", "vendor_name": "HCL Technologies Ltd",
     "country": "IN", "city": "Noida",      "postal_code": "201301", "region": "UP",
     "account_group": "ZSRV", "tax_number_pan": "AABCH6789P",
     "tax_number_gstin": "09AABCH6789P1Z9",
     "central_purchasing_block": "", "central_posting_block": "",
     "deletion_flag_central": "", "company_code": "1001",
     "payment_terms": "N030", "payment_block": "", "posting_block_cc": "",
     "msme_flag": "", "vendor_type": "DOMESTIC"},
    {"vendor": "700800", "vendor_name": "Sodexo India Services Pvt Ltd",
     "country": "IN", "city": "Mumbai",     "postal_code": "400059", "region": "MH",
     "account_group": "ZSRV", "tax_number_pan": "AABCS1122P",
     "tax_number_gstin": "27AABCS1122P1ZR",
     "central_purchasing_block": "", "central_posting_block": "",
     "deletion_flag_central": "", "company_code": "1001",
     "payment_terms": "N030", "payment_block": "", "posting_block_cc": "",
     "msme_flag": "S", "vendor_type": "DOMESTIC"},
    # PURCHASING BLOCKED — anomaly target
    {"vendor": "700900", "vendor_name": "ABC Infra Pvt Ltd",
     "country": "IN", "city": "Delhi",      "postal_code": "110020", "region": "DL",
     "account_group": "ZSER", "tax_number_pan": "AABCA3344P",
     "tax_number_gstin": "07AABCA3344P1Z2",
     "central_purchasing_block": "X",       # BLOCKED
     "central_posting_block": "",
     "deletion_flag_central": "", "company_code": "1001",
     "payment_terms": "N030", "payment_block": "", "posting_block_cc": "",
     "msme_flag": "", "vendor_type": "DOMESTIC"},
    {"vendor": "800100", "vendor_name": "SAP Deutschland GmbH",
     "country": "DE", "city": "Walldorf",   "postal_code": "69190", "region": "BW",
     "account_group": "ZSRV", "tax_number_pan": "",
     "tax_number_gstin": "",
     "central_purchasing_block": "", "central_posting_block": "",
     "deletion_flag_central": "", "company_code": "1001",
     "payment_terms": "N030", "payment_block": "", "posting_block_cc": "",
     "msme_flag": "", "vendor_type": "INTERNATIONAL"},
    {"vendor": "800200", "vendor_name": "Oracle Corporation",
     "country": "US", "city": "Austin",     "postal_code": "78741", "region": "TX",
     "account_group": "ZSRV", "tax_number_pan": "",
     "tax_number_gstin": "",
     "central_purchasing_block": "", "central_posting_block": "",
     "deletion_flag_central": "", "company_code": "1001",
     "payment_terms": "N030", "payment_block": "", "posting_block_cc": "",
     "msme_flag": "", "vendor_type": "INTERNATIONAL"},
    # One-time vendor
    {"vendor": "900001", "vendor_name": "One-Time Vendor Civil Works",
     "country": "IN", "city": "Hyderabad",  "postal_code": "500001", "region": "TG",
     "account_group": "CPEN", "tax_number_pan": "",
     "tax_number_gstin": "",
     "central_purchasing_block": "", "central_posting_block": "",
     "deletion_flag_central": "", "company_code": "1001",
     "payment_terms": "N030", "payment_block": "", "posting_block_cc": "",
     "msme_flag": "", "vendor_type": "ONE_TIME"},
]

VENDOR_MAP = {v["vendor"]: v for v in VENDORS}

PLANT_MASTER = [
    {"company_code": "1001", "company_name": "IntelliSource India Pvt Ltd",
     "purchasing_org": "1000", "plant": "SDPL", "plant_name": "South Delhi Plant",
     "parent_company": None},
    {"company_code": "1001", "company_name": "IntelliSource India Pvt Ltd",
     "purchasing_org": "1000", "plant": "BLRP", "plant_name": "Bengaluru Plant",
     "parent_company": None},
    {"company_code": "1001", "company_name": "IntelliSource India Pvt Ltd",
     "purchasing_org": "2000", "plant": "DELP", "plant_name": "Delhi North Plant",
     "parent_company": None},
    {"company_code": "1001", "company_name": "IntelliSource India Pvt Ltd",
     "purchasing_org": "2000", "plant": "HYDP", "plant_name": "Hyderabad Plant",
     "parent_company": None},
    {"company_code": "1001", "company_name": "IntelliSource India Pvt Ltd",
     "purchasing_org": "3000", "plant": "MNAL", "plant_name": "Mumbai Plant",
     "parent_company": None},
]

PLANT_TO_ORG = {
    "SDPL": "1000", "BLRP": "1000",
    "DELP": "2000", "HYDP": "2000",
    "MNAL": "3000",
}

PLANTS = list(PLANT_TO_ORG.keys())

# material_group → (description pool, uom, price_range, capex_opex, doc_type, purch_group)
MATERIAL_GROUPS = {
    "9901": (["Civil construction work", "Foundation & structural work",
              "Dismantling & demolition", "Roofing & waterproofing",
              "Flooring & tiles installation", "Painting & finishing works"],
             "M2", (50_000, 25_00_000), "OPEX", "FO", "CSR"),
    "9902": (["Transformer 11kV 500kVA", "HT Panel switchgear 33kV",
              "DG Set 500kVA Cummins", "UPS system 20kVA APC",
              "Power cables 11kV 3-core", "Cable trays & conduit"],
             "EA", (1_00_000, 50_00_000), "CAPEX", "NB", "MAT"),
    "9903": (["A4 Paper 80gsm (Box of 5 Reams)", "HP Printer cartridges 305A",
              "Office furniture workstation set", "Stationery supplies monthly",
              "Filing cabinet 4-drawer", "Whiteboard 6x4 ft"],
             "EA", (500, 50_000), "OPEX", "NB", "MAT"),
    "9904": (["Dell PowerEdge R740 Server", "HP ProBook 450 laptops (batch)",
              "Cisco Catalyst 48-port switch", "NetApp SAN storage 50TB",
              "Fortinet firewall FG-200F", "HP LaserJet M507dn"],
             "EA", (50_000, 20_00_000), "CAPEX", "NB", "IT"),
    "9905": (["SAP S/4HANA named user licenses",
              "Microsoft 365 E3 (100 users annual)",
              "Oracle DB Enterprise Edition license",
              "AutoCAD 2024 license (10 seats)",
              "Symantec Endpoint Protection 500 users",
              "ServiceNow ITSM annual subscription"],
             "EA", (2_00_000, 1_00_00_000), "CAPEX", "ZAN", "IT"),
    "9906": (["IT strategy consulting engagement",
              "Business process re-engineering",
              "Tax advisory & compliance services",
              "Legal retainer - corporate matters",
              "HR transformation consulting",
              "SAP implementation support"],
             "LS", (5_00_000, 2_00_00_000), "OPEX", "ZAN", "SER"),
    "9907": (["Road transport PAN India quarterly",
              "Courier & express delivery services",
              "Cold chain logistics & warehousing",
              "Last mile delivery - metro cities",
              "International freight forwarding",
              "3PL warehousing services"],
             "KG", (10_000, 10_00_000), "OPEX", "FO", "LOG"),
    "9908": (["HVAC annual maintenance contract",
              "Lift & escalator AMC",
              "DG Set quarterly servicing",
              "Building electrical maintenance",
              "Plumbing & civil repairs",
              "Pest control services annual"],
             "LS", (25_000, 5_00_000), "OPEX", "FO", "SER"),
}

REQUISITIONERS = ["RKUMAR", "VSHARMA", "AGUPTA", "PDESAI", "SNAIR", "MMEHTA", "JTHOMAS", "KSINGH"]
BUYERS         = ["RKUMAR", "VSHARMA", "AGUPTA", "PDESAI", "SNAIR", "MMEHTA", "JTHOMAS"]
APPROVERS      = ["DDIRECTOR", "GMANAGER", "PVPRES", "MCFO", "ACHIEF"]
RELEASE_STRATEGIES = ["STD_L2", "STD_L3", "PO_L4", "SRV_L2", "IT_L3"]
TAX_CODES = ["I0", "I5", "I8", "IG"]
PAYMENT_TERMS_DAYS = {"N030": 30, "N045": 45, "N060": 60, "I001": 90}

FY_START = date(2022, 4, 1)
FY_END   = date(2023, 3, 31)


def d(start, end):
    """Random date between start and end."""
    delta = (end - start).days
    return start + timedelta(days=random.randint(0, max(0, delta)))


def fd(dt):
    return dt.strftime("%Y-%m-%d") if dt else ""


def add(dt, n):
    return dt + timedelta(days=n)


# ── 01  PR DUMP ───────────────────────────────────────────────────────────────
pr_rows = []
pr_num = 10003000

# 150 PR lines across ~100 distinct PRs
current_pr = None
current_pr_items = 0
max_items = 0

for i in range(150):
    mg = random.choice(list(MATERIAL_GROUPS.keys()))
    descs, uom, price_rng, capex_opex, doc_type, pg = MATERIAL_GROUPS[mg]
    desc = random.choice(descs)
    plant = random.choice(PLANTS)

    if current_pr is None or current_pr_items >= max_items:
        pr_num += random.randint(1, 12)
        current_pr = str(pr_num)
        current_pr_items = 0
        max_items = random.randint(1, 3)

    current_pr_items += 1
    item_num = f"{current_pr_items * 10:05d}"
    req = random.choice(REQUISITIONERS)
    created_on = d(FY_START, date(2023, 1, 15))
    delivery_date = add(created_on, random.randint(20, 90))

    released = random.random() < 0.88
    release_date = add(created_on, random.randint(1, 6)) if released else None
    release_status = "X" if released else ""

    vendor_sug = random.choice([v["vendor"] for v in VENDORS[:8]]) if random.random() < 0.55 else ""
    qty = round(random.uniform(1.0, 200.0), 3)
    val_price = round(random.uniform(*price_rng), 2)

    pr_rows.append({
        "purchase_requisition":  current_pr,
        "item_of_requisition":   item_num,
        "purchasing_doc_type":   doc_type,
        "vendor":                vendor_sug,
        "material_group":        mg,
        "material_description":  desc,
        "plant":                 plant,
        "purchasing_group":      pg,
        "order_quantity":        qty,
        "unit_of_measure":       uom,
        "valuation_price":       val_price,
        "delivery_date":         fd(delivery_date),
        "release_status":        release_status,
        "release_date":          fd(release_date),
        "requisitioner":         req,
        "tracking_number":       f"TR{pr_num}{current_pr_items:02d}",
    })


# ── 02  PO DUMP ───────────────────────────────────────────────────────────────
po_rows = []
po_num = 2000001000
po_pr_used = set()

# SOD violations: pick 3 requisitioners who will also appear as PO approvers
sod_req_pr_keys = {}
released_prs = [p for p in pr_rows if p["release_status"] == "X"]
random.shuffle(released_prs)
sod_victims = released_prs[:3]
for sv in sod_victims:
    k = f"{sv['purchase_requisition']}|{sv['item_of_requisition']}"
    sod_req_pr_keys[k] = sv["requisitioner"]

# Convert released PRs → POs (group up to 3 PR lines per PO)
groups, tmp = [], []
for pr in released_prs:
    k = f"{pr['purchase_requisition']}|{pr['item_of_requisition']}"
    if k not in po_pr_used:
        po_pr_used.add(k)
        tmp.append(pr)
        if len(tmp) >= random.randint(1, 3):
            groups.append(tmp[:])
            tmp = []
if tmp:
    groups.append(tmp)

# Give each SOD victim its own PO document. Two victims can land in the same
# group, and a group produces a single PO, so three violations collapsed into two
# documents and the third company showed zero. Split multi-victim groups, then
# hoist them to the front: only groups[:130] become POs, so a victim in the tail
# is dropped entirely. Stable sort keeps every other group in its original order.
def _is_victim(p):
    return f"{p['purchase_requisition']}|{p['item_of_requisition']}" in sod_req_pr_keys


_split_groups = []
for _g in groups:
    _vics = [p for p in _g if _is_victim(p)]
    if len(_vics) > 1:
        _rest = [p for p in _g if not _is_victim(p)]
        _split_groups.extend([[v] for v in _vics])
        if _rest:
            _split_groups.append(_rest)
    else:
        _split_groups.append(_g)
groups = _split_groups
groups.sort(key=lambda g: 0 if any(_is_victim(p) for p in g) else 1)

deleted_po_set = set()

for grp in groups[:130]:
    po_num += random.randint(1, 8)
    po_id = str(po_num)
    plant = grp[0]["plant"]
    org   = PLANT_TO_ORG[plant]

    # vendor: prefer PR suggestion, else random active vendor
    vendor_code = grp[0].get("vendor") or random.choice(
        [v["vendor"] for v in VENDORS if v["central_purchasing_block"] == ""][:8])

    vi = VENDOR_MAP[vendor_code]
    doc_date   = add(date.fromisoformat(grp[0]["release_date"]), random.randint(0, 4))
    created_on = doc_date

    for idx, pr in enumerate(grp):
        item_num = f"{(idx + 1) * 10:05d}"
        pr_key   = f"{pr['purchase_requisition']}|{pr['item_of_requisition']}"
        mg = pr["material_group"]
        _, uom, _, capex_opex, _, _ = MATERIAL_GROUPS[mg]

        # SOD: same person created PR and creates PO (= SOD violation)
        created_by = sod_req_pr_keys.get(pr_key, random.choice(BUYERS))

        pr_price = float(pr["valuation_price"])
        rnd = random.random()
        if rnd < 0.08:   # 8% negotiated savings
            net_price = round(pr_price * random.uniform(0.82, 0.95), 2)
        elif rnd < 0.13: # 5% price deviation (higher than PR)
            net_price = round(pr_price * random.uniform(1.07, 1.18), 2)
        else:
            net_price = pr_price

        qty = float(pr["order_quantity"])
        net_value = round(net_price * qty, 2)

        released = random.random() < 0.93
        deletion = "L" if random.random() < 0.025 else ""
        if deletion == "L":
            deleted_po_set.add(po_id)

        terms = vi["payment_terms"]

        po_rows.append({
            "purchasing_document": po_id,
            "item":                item_num,
            "purchasing_doc_type": pr["purchasing_doc_type"],
            "purchasing_org":      org,
            "purchasing_group":    pr["purchasing_group"],
            "vendor":              vendor_code,
            "vendor_name":         vi["vendor_name"],
            "document_date":       fd(doc_date),
            "created_on":          fd(created_on),
            "created_by":          created_by,
            "plant":               plant,
            "company_code":        "1001",
            "material_group":      mg,
            "material_description": pr["material_description"],
            "order_quantity":      qty,
            "unit_of_measure":     pr["unit_of_measure"],
            "net_order_price":     net_price,
            "net_order_value":     net_value,
            "tax_code":            random.choice(TAX_CODES),
            "purchase_requisition":  pr["purchase_requisition"],
            "item_of_requisition":   pr["item_of_requisition"],
            "release_indicator":   "X" if released else "",
            "release_strategy":    random.choice(RELEASE_STRATEGIES) if released else "",
            "delivery_completed":  "X" if random.random() < 0.38 else "",
            "deletion_indicator":  deletion,
            "payment_terms":       terms,
            "capex_opex_flag":     capex_opex,
        })

# 20 Maverick POs (no PR reference)
maverick_po_ids = []
for i in range(20):
    po_num += random.randint(1, 8)
    po_id = str(po_num)
    maverick_po_ids.append(po_id)
    mg = random.choice(list(MATERIAL_GROUPS.keys()))
    descs, uom, price_rng, capex_opex, doc_type, pg = MATERIAL_GROUPS[mg]
    plant = random.choice(PLANTS)
    org   = PLANT_TO_ORG[plant]

    # Anomaly #1: 1 maverick PO against purchasing-blocked vendor
    vendor_code = "700900" if i == 4 else random.choice(
        [v["vendor"] for v in VENDORS if v["central_purchasing_block"] == ""][:8])
    vi = VENDOR_MAP[vendor_code]

    doc_date  = d(FY_START, FY_END)
    net_price = round(random.uniform(*price_rng), 2)
    qty       = round(random.uniform(1.0, 50.0), 3)
    net_value = round(net_price * qty, 2)

    po_rows.append({
        "purchasing_document": po_id,
        "item":                "00010",
        "purchasing_doc_type": doc_type,
        "purchasing_org":      org,
        "purchasing_group":    pg,
        "vendor":              vendor_code,
        "vendor_name":         vi["vendor_name"],
        "document_date":       fd(doc_date),
        "created_on":          fd(doc_date),
        "created_by":          random.choice(BUYERS),
        "plant":               plant,
        "company_code":        "1001",
        "material_group":      mg,
        "material_description": random.choice(descs),
        "order_quantity":      qty,
        "unit_of_measure":     uom,
        "net_order_price":     net_price,
        "net_order_value":     net_value,
        "tax_code":            random.choice(TAX_CODES),
        "purchase_requisition":  "",
        "item_of_requisition":   "",
        "release_indicator":   "X",
        "release_strategy":    random.choice(RELEASE_STRATEGIES),
        "delivery_completed":  "",
        "deletion_indicator":  "",
        "payment_terms":       vi["payment_terms"],
        "capex_opex_flag":     capex_opex,
    })

# 3 Split POs — same vendor (700400 Infosys), same date, same material_group 9906
split_date = date(2022, 9, 15)
for i in range(3):
    po_num += 1
    po_id = str(po_num)
    vi = VENDOR_MAP["700400"]
    split_val = round(random.uniform(7_00_000, 9_50_000), 2)  # each < 10L but total > 25L
    po_rows.append({
        "purchasing_document": po_id,
        "item":                "00010",
        "purchasing_doc_type": "ZAN",
        "purchasing_org":      "1000",
        "purchasing_group":    "IT",
        "vendor":              "700400",
        "vendor_name":         vi["vendor_name"],
        "document_date":       fd(split_date),
        "created_on":          fd(split_date),
        "created_by":          "AGUPTA",
        "plant":               "SDPL",
        "company_code":        "1001",
        "material_group":      "9906",
        "material_description": "IT consulting services — project support",
        "order_quantity":      1.0,
        "unit_of_measure":     "LS",
        "net_order_price":     split_val,
        "net_order_value":     split_val,
        "tax_code":            "I0",
        "purchase_requisition":  "",
        "item_of_requisition":   "",
        "release_indicator":   "X",
        "release_strategy":    "SRV_L2",
        "delivery_completed":  "X",
        "deletion_indicator":  "",
        "payment_terms":       "N030",
        "capex_opex_flag":     "OPEX",
    })

# High-value POs (> ₹1 Cr) — strategic for KPI demo
for i in range(8):
    po_num += random.randint(1, 5)
    po_id = str(po_num)
    mg = random.choice(["9902", "9904", "9905", "9906"])
    descs, uom, _, capex_opex, doc_type, pg = MATERIAL_GROUPS[mg]
    plant = random.choice(PLANTS)
    org   = PLANT_TO_ORG[plant]
    vendor_code = random.choice(["700400", "700700", "800100", "800200", "700300"])
    vi = VENDOR_MAP[vendor_code]
    doc_date  = d(FY_START, FY_END)
    net_value = round(random.uniform(1_00_00_000, 5_00_00_000), 2)
    qty = 1.0

    po_rows.append({
        "purchasing_document": po_id,
        "item":                "00010",
        "purchasing_doc_type": doc_type,
        "purchasing_org":      org,
        "purchasing_group":    pg,
        "vendor":              vendor_code,
        "vendor_name":         vi["vendor_name"],
        "document_date":       fd(doc_date),
        "created_on":          fd(doc_date),
        "created_by":          random.choice(BUYERS),
        "plant":               plant,
        "company_code":        "1001",
        "material_group":      mg,
        "material_description": random.choice(descs),
        "order_quantity":      qty,
        "unit_of_measure":     uom,
        "net_order_price":     net_value,
        "net_order_value":     net_value,
        "tax_code":            "I0",
        "purchase_requisition":  "",
        "item_of_requisition":   "",
        "release_indicator":   "X",
        "release_strategy":    "PO_L4",
        "delivery_completed":  random.choice(["X", ""]),
        "deletion_indicator":  "",
        "payment_terms":       vi["payment_terms"],
        "capex_opex_flag":     capex_opex,
    })


# ── 02b  COMPANY SPLIT + DEMO-WINDOW ANOMALIES ────────────────────────────────
# Two jobs, both of which used to leave whole KPI tiles reading 0 in the demo.
#
# (a) company_code. Every PO/PR/GRN/invoice/payment was hardcoded to "1001",
#     so the Company Filter had nothing to filter on. The split is applied here,
#     after the PO dump exists, because it is keyed on the sorted purchasing
#     documents. add_company_codes.py did this once as a post-process but was
#     clobbered every time this generator ran - it also grew vendor_master by
#     26 rows on every invocation.
#
# (b) Anomalies that only count inside the reporting month. ref_date is
#     MAX(po_dump.document_date) and MTD is the first of that month, so an
#     anomaly dated 2022 never shows up in an MTD KPI no matter how many exist.

REF_DATE = date(2023, 3, 27)          # keep every date <= this; see note below
MTD_ANCHOR = date(2023, 3, 1)

# (a) ── company split: 65% / 25% / 10% over sorted purchasing documents ──────
_po_docs = sorted({r["purchasing_document"] for r in po_rows})
# Shuffle before banding. Document numbers are issued in chronological order, so
# banding the sorted list put company 1001 on every early document and 1003 on
# every late one -- 1001 ended up with no POs in March at all and its MTD KPIs
# read zero. Shuffling decouples company from date so each company spans the
# whole fiscal year.
random.shuffle(_po_docs)
_cut1 = int(len(_po_docs) * 0.65)
_cut2 = int(len(_po_docs) * 0.90)
_po_cc = {}
for _i, _doc in enumerate(_po_docs):
    _po_cc[_doc] = "1001" if _i < _cut1 else ("1002" if _i < _cut2 else "1003")

for r in po_rows:
    r["company_code"] = _po_cc[r["purchasing_document"]]

# Pin one SOD-violating PO per company. The three violations otherwise landed in
# whichever company their requisitions happened to be banded into, so
# SOD_PO_CREATE_RELEASE read zero for the other two. Pinning here (before the PR
# inheritance loop below) keeps PO and PR company codes consistent.
_sod_pr_keys = set(sod_req_pr_keys.keys())
_sod_pos = [r for r in po_rows
            if f"{r['purchase_requisition']}|{r['item_of_requisition']}" in _sod_pr_keys
            and r["deletion_indicator"] != "L"]
for _cc, _po in zip(("1001", "1002", "1003"), _sod_pos[:3]):
    _po["company_code"] = _cc

# Guarantee one negotiated saving per company. The 8% discount is rolled per
# PR-linked line, and the smallest company only has ~20 such lines, so whether
# NEGOTIATION_SAVINGS was non-zero there was a coin flip. Force one line down.
for _cc in ("1001", "1002", "1003"):
    _cand = [r for r in po_rows
             if r.get("company_code") == _cc
             and r.get("purchase_requisition")
             and r["deletion_indicator"] != "L"]
    if _cand:
        _t = _cand[0]
        _np = round(float(_t["net_order_price"]) * 0.88, 2)
        _t["net_order_price"] = _np
        _t["net_order_value"] = round(_np * float(_t["order_quantity"]), 2)

# PRs inherit the company of the PO that consumed them. A PR with no PO used to
# default to 1001, which left company 1003 with zero requisitions and every
# PR-scoped KPI blank for it. Unconsumed PRs are now dealt round-robin over the
# three companies so each one has a requisition population.
_pr_cc = {}
for r in po_rows:
    if r["purchase_requisition"]:
        _pr_cc.setdefault((r["purchase_requisition"], r["item_of_requisition"]),
                          r["company_code"])
_default_cc = ("1001", "1001", "1002", "1003")
_free = 0
for r in pr_rows:
    r["company_code"] = _pr_cc.get(
        (r["purchase_requisition"], r["item_of_requisition"]),
        _default_cc[_free % len(_default_cc)])
    _free += 1

# Vendor master must hold one row per vendor per company, otherwise a
# vendor-scoped join finds nothing. (UNIQUE(vendor, company_code) in schema.sql.)
vendor_rows_out = []
for v in VENDORS:
    for cc in ("1001", "1002", "1003"):
        _v = dict(v)
        _v["company_code"] = cc
        vendor_rows_out.append(_v)
VENDORS_OUT = vendor_rows_out

# (b) ── anomalies inside the March 2023 reporting month ──────────────────────

# PO deletions dated inside MTD -> PO_DELETION_MTD.
# Skip POs built from an SOD-violation PR: those get created_by = the PR's
# requisitioner so that change_log EKKO/FRGZU matches po.created_by, and a
# deletion is filtered out by the same NOT IN predicate most KPIs use. Deleting
# one silently switches SOD_PO_CREATE_RELEASE back to zero.
_sod_pr_keys = set(sod_req_pr_keys.keys())


def _del_eligible(r):
    return (r["deletion_indicator"] != "L"
            and f"{r['purchase_requisition']}|{r['item_of_requisition']}" not in _sod_pr_keys)


# Two deletions per company. Taking the first six in file order concentrated all
# of them on one company -- and on 1003 they landed on its only March POs, which
# zeroed PO_COUNT_MTD and TOTAL_PO_VALUE_MTD for that company.
#
# Guarantee March volume first. POs are drawn uniformly across twelve months, so
# the smallest company can end up with one or two March documents; the two
# deletions then take both of them. These clones are pinned to a company (they
# bypass the shuffled banding above) and to March, so there is always something
# left for the deletions to land on. Values and vendors are varied so they do not
# read as duplicates to DUPLICATE_PO_COUNT.
_march_pool = [r for r in po_rows if _del_eligible(r)]
if _march_pool:
    _seed_po = _march_pool[0]
    for _cc in ("1001", "1002", "1003"):
        for _n in range(3):
            _v = random.choice(VENDORS)["vendor"]
            _vname = VENDOR_MAP[_v]["vendor_name"]
            _dt = date(2023, 3, 2) + timedelta(days=random.randint(0, 22))
            _qty = round(random.uniform(2.0, 60.0), 3)
            _price = round(random.uniform(40_000, 900_000), 2)
            _cl = dict(_seed_po)
            _cl["purchasing_document"] = f"29700{_cc[-1]}{_n:02d}"
            _cl["company_code"] = _cc
            _cl["document_date"] = fd(_dt)
            _cl["created_on"] = fd(_dt)
            _cl["vendor"] = _v
            _cl["vendor_name"] = _vname
            _cl["net_order_price"] = _price
            _cl["net_order_value"] = round(_price * _qty, 2)
            _cl["order_quantity"] = _qty
            _cl["created_by"] = random.choice(BUYERS)
            _cl["purchase_requisition"] = ""
            _cl["item_of_requisition"] = ""
            _cl["deletion_indicator"] = ""
            _cl["delivery_completed"] = ""
            po_rows.append(_cl)

_del_targets = []
for _cc in ("1001", "1002", "1003"):
    _del_targets += [r for r in po_rows
                     if r.get("company_code") == _cc and _del_eligible(r)][:2]
for _k, _r in enumerate(_del_targets):
    _dt = add(MTD_ANCHOR, 4 + _k * 3)          # 03-05 .. 03-20, all <= REF_DATE
    _r["deletion_indicator"] = "L"
    _r["created_on"] = fd(_dt)
    _r["document_date"] = fd(_dt)
    _r["delivery_completed"] = ""

# Orphan approved PRs: released, but no PO ever raised. These feed
# OPEN_PR_AGING and the four "Aging of Open PR Lines" chart buckets.
_pr_used = {(r["purchase_requisition"], r["item_of_requisition"]) for r in pr_rows}
_pr_used |= {(r["purchase_requisition"], r["item_of_requisition"])
             for r in po_rows if r["purchase_requisition"]}
# bucket boundaries relative to REF_DATE (2023-03-27)
_bucket_release_dates = [
    date(2023, 3, 24),   # 0-7d
    date(2023, 3, 10),   # 8-30d
    date(2023, 2, 10),   # 31-60d
    date(2022, 12, 15),  # 60+d
    date(2023, 3, 22),   # 0-7d
    date(2023, 2, 28),   # 8-30d
]
_next_pr = 10900000
# Two orphan PRs per company, so OPEN_PR_AGING is populated whichever company
# the demo viewer has selected rather than only for the default 1001.
_orphan_ccs = ["1001", "1002", "1003", "1001", "1002", "1003"]
for _bd, _occ in zip(_bucket_release_dates, _orphan_ccs):
    _next_pr += random.randint(1, 9)
    _vid = random.choice(VENDORS)["vendor"]
    _mg = random.choice(list(MATERIAL_GROUPS.keys()))
    _descs = MATERIAL_GROUPS[_mg][0]
    pr_rows.append({
        "purchase_requisition": str(_next_pr),
        "item_of_requisition":  "00010",
        "purchasing_doc_type":  "NB",
        "vendor":               _vid,
        "material_group":       _mg,
        "material_description": random.choice(_descs),
        "plant":                random.choice(PLANTS),
        "purchasing_group":     "MAT",
        "order_quantity":       round(random.uniform(5, 90), 3),
        "unit_of_measure":      "EA",
        "valuation_price":      round(random.uniform(50000, 900000), 2),
        "delivery_date":        fd(add(_bd, random.randint(10, 40))),
        "release_status":       "X",
        "release_date":         fd(_bd),
        "requisitioner":        random.choice(BUYERS),
        "tracking_number":      f"TR{_next_pr}001",
        "company_code":         _occ,
    })

# Duplicate PO groups: two documents sharing company + material group + vendor +
# value + qty + date -> DUPLICATE_PO_COUNT.
# One group per company. Taking fixed offsets into the PO list put all three in
# whichever company those offsets happened to fall in, leaving the other two
# companies with a zero on that card.
_dup_src = [r for r in po_rows if r["deletion_indicator"] != "L"]
_by_cc = {}
for _r in _dup_src:
    _by_cc.setdefault(_r.get("company_code"), []).append(_r)
for _k, _cc in enumerate(("1001", "1002", "1003")):
    _src = _by_cc[_cc][0]
    _clone = dict(_src)
    _clone["purchasing_document"] = f"2990000{_k:03d}"
    _clone["created_by"] = random.choice(BUYERS)
    po_rows.append(_clone)

# Software POs in every company code -> SW_CAPEX_SPEND / SW_OPEX_SPEND.
_sw_lines = [
    ("SAP S/4HANA perpetual license - enterprise", "CAPEX"),
    ("Oracle DB perpetual license upgrade", "CAPEX"),
    ("SAP S/4HANA annual support subscription", "OPEX"),
    ("Tableau perpetual license renewal", "CAPEX"),
    ("Microsoft 365 E3 annual subscription", "OPEX"),
    ("Automation Anywhere perpetual license", "CAPEX"),
]
for _cc in ("1001", "1002", "1003"):
    for _desc, _co in _sw_lines:
        _doc = "2980" + _cc + _co[0] + f"{len(po_rows):04d}"
        _qty = round(random.uniform(2, 40), 3)
        po_rows.append({
            "purchasing_document": _doc,
            "item":                "00010",
            "purchasing_doc_type": "ZAN",
            "purchasing_org":      "3000",
            "purchasing_group":    "IT",
            "vendor":              "800100" if _cc == "1001" else "700400",
            "vendor_name":         "SAP Deutschland GmbH" if _cc == "1001" else "Infosys Ltd",
            "document_date":       fd(add(REF_DATE, -random.randint(20, 120))),
            "created_on":          fd(add(REF_DATE, -random.randint(20, 120))),
            "created_by":          random.choice(BUYERS),
            "plant":               "BLRP",
            "company_code":        _cc,
            "material_group":      "9905",
            "material_description": _desc,
            "order_quantity":      _qty,
            "unit_of_measure":     "EA",
            "net_order_price":     round(random.uniform(120000, 480000), 2),
            "net_order_value":     round(random.uniform(900000, 9200000), 2),
            "tax_code":            "I0",
            "purchase_requisition":  "",
            "item_of_requisition":   "",
            "release_indicator":   "X",
            "release_strategy":    "STD_L2",
            "delivery_completed":  "",
            "deletion_indicator":  "",
            "payment_terms":       "N030",
            "capex_opex_flag":     _co,
        })


del_rows = []
grn_exp_map = {}   # po+item → expected_delivery_date

for po in po_rows:
    if po["deletion_indicator"] == "L":
        continue
    doc_date = date.fromisoformat(po["document_date"])
    exp_del  = add(doc_date, random.randint(15, 60))
    qty      = float(po["order_quantity"])
    del_qty  = qty if po["delivery_completed"] == "X" else round(qty * random.uniform(0.0, 0.9), 3) if random.random() < 0.4 else 0.0
    open_qty = round(qty - del_qty, 3)

    del_rows.append({
        "purchasing_document":   po["purchasing_document"],
        "item":                  po["item"],
        "schedule_line":         "0001",
        "expected_delivery_date": fd(exp_del),
        "scheduled_quantity":    qty,
        "delivered_quantity":    del_qty,
        "open_quantity":         open_qty,
        "statistical_delivery_date": fd(exp_del),
        "creation_date":         po["document_date"],
        "actual_delivery_date":  "",
    })
    grn_exp_map[f"{po['purchasing_document']}|{po['item']}"] = exp_del


# ── 04  GRN DUMP ──────────────────────────────────────────────────────────────
grn_rows = []
mat_doc_counter = 5000500000
grn_po_map = {}   # po+item → list of grn dicts

# 6 late delivery targets
late_delivery_pos = random.sample(
    [p for p in po_rows if p["deletion_indicator"] == "" and p["material_group"] not in ["9905", "9906"]][:60],
    6)
late_delivery_keys = {f"{p['purchasing_document']}|{p['item']}" for p in late_delivery_pos}

for po in po_rows:
    if po["deletion_indicator"] == "L":
        continue
    if po["material_group"] in ["9905", "9906"] and random.random() < 0.45:
        continue  # service/software POs often have no GRN
    if random.random() < 0.12:
        continue  # 12% no GRN yet

    mat_doc_counter += random.randint(1, 25)
    mat_doc = str(mat_doc_counter)

    pk = f"{po['purchasing_document']}|{po['item']}"
    exp_del = grn_exp_map.get(pk, add(date.fromisoformat(po["document_date"]), 30))

    if pk in late_delivery_keys:
        posting_date = add(exp_del, random.randint(18, 45))  # late!
    else:
        posting_date = add(exp_del, random.randint(-5, 3))   # on time

    posting_date = min(posting_date, FY_END + timedelta(days=60))

    qty = float(po["order_quantity"])
    # 8% short delivery
    grn_qty = round(qty * random.uniform(0.55, 0.94), 3) if random.random() < 0.08 else qty
    ppu = (float(po["net_order_value"]) / qty) if qty > 0 else float(po["net_order_price"])
    grn_amt = round(grn_qty * ppu, 2)

    grn_row = {
        "purchasing_document": po["purchasing_document"],
        "item":                po["item"],
        "material_document":   mat_doc,
        "material_doc_item":   "0001",
        "po_history_category": "E",
        "movement_type":       "101",
        "debit_credit_ind":    "S",
        "company_code":        po["company_code"],
        # SOD_PO_GRN compares po.created_by with grn.created_by. Without this the
        # column falls back to the schema default 'SYSTEM' for every posting and
        # the KPI can never match.
        "created_by":          po["created_by"],
        "posting_date":        fd(posting_date),
        # Goods receipt lands a few days after the expected delivery date, so
        # the vendor lead-time average lands slightly late instead of averaging
        # early and late deliveries into each other and rounding to 0.0.
        "entry_date":          fd(add(posting_date, 3)),
        "quantity":            grn_qty,
        "amount_local_ccy":    grn_amt,
        "reference_doc":       f"DN-{posting_date.year}-{random.randint(1000,9999)}",
    }
    grn_rows.append(grn_row)
    grn_po_map.setdefault(pk, []).append(grn_row)

    # Update delivery schedule actual_delivery_date
    for dr in del_rows:
        if dr["purchasing_document"] == po["purchasing_document"] and dr["item"] == po["item"]:
            dr["actual_delivery_date"] = fd(posting_date)

# 3 GRN returns (movement_type=122, debit_credit_ind=H)
for i in range(3):
    orig = grn_rows[i * 20]
    mat_doc_counter += 1
    ret_date = add(date.fromisoformat(orig["posting_date"]), random.randint(2, 7))
    grn_rows.append({
          "purchasing_document": orig["purchasing_document"],
          "item":                orig["item"],
          "material_document":   str(mat_doc_counter),
          "material_doc_item":   "0001",
          "po_history_category": "E",
          "movement_type":       "122",
          "company_code":        orig["company_code"],
        "debit_credit_ind":    "H",
        "posting_date":        fd(ret_date),
        "entry_date":          fd(ret_date),
        "quantity":            round(float(orig["quantity"]) * 0.25, 3),
        "amount_local_ccy":    round(float(orig["amount_local_ccy"]) * 0.25, 2),
        "reference_doc":       f"RET-{random.randint(1000,9999)}",
    })


# ── 05  PO INVOICE DUMP ───────────────────────────────────────────────────────
po_inv_rows = []
inv_doc_counter = 5105000000
po_inv_map = {}   # po+item → list of invoice_doc

# One duplicate invoice per company. Emitting from the Nth invoiced GRN of each
# company (rather than from fixed list offsets) guarantees the target actually
# produced an invoice row -- offsets could land on a GRN that the 10%
# not-yet-invoiced skip dropped, leaving that company at zero duplicates.
_inv_seen_by_cc = {}

for gi, grn in enumerate(grn_rows):
    if grn["debit_credit_ind"] == "H":
        continue
    if random.random() < 0.10:
        continue  # 10% not yet invoiced

    inv_doc_counter += random.randint(1, 12)
    inv_doc  = str(inv_doc_counter)
    inv_date = add(date.fromisoformat(grn["posting_date"]), random.randint(1, 14))

    grn_amt = float(grn["amount_local_ccy"])
    # 5% price deviation
    if random.random() < 0.05:
        inv_amt = round(grn_amt * random.uniform(1.06, 1.18), 2)
    else:
        inv_amt = grn_amt

    pk = f"{grn['purchasing_document']}|{grn['item']}"
    inv_year = str(inv_date.year)
    # First invoice actually emitted for each company becomes its duplicate pair.
    _cc_seen = _inv_seen_by_cc.get(grn.get("company_code"), 0)
    _inv_seen_by_cc[grn.get("company_code")] = _cc_seen + 1
    _is_dup = _cc_seen == 0

    row = {
        "purchasing_document": grn["purchasing_document"],
        "item":                grn["item"],
        "invoice_doc":         inv_doc,
        "invoice_year":        inv_year,
        "invoice_doc_item":    "0001",
        "po_history_category": "Q",
        "debit_credit_ind":    "S",
        "company_code":        grn["company_code"],
        "posting_date":        fd(inv_date),
        "entry_date":          fd(inv_date),
        "quantity":            grn["quantity"],
        "amount_local_ccy":    inv_amt,
        "reference_doc":       f"INV-{inv_date.year}-{random.randint(1000,9999)}",
        # SOD_GRN_INVOICE compares grn.created_by with inv.created_by. Without
        # this column both sides fell back to the schema default 'SYSTEM' and the
        # check passed on every row by accident rather than by a real match.
        "created_by":          grn["created_by"],
    }
    po_inv_rows.append(row)
    po_inv_map.setdefault(pk, []).append(inv_doc)

    # Embed duplicate: same row, different inv_doc
    if _is_dup:
        inv_doc_counter += 1
        dup_row = dict(row)
        dup_row["invoice_doc"] = str(inv_doc_counter)
        po_inv_rows.append(dup_row)


# ── 06  INVOICE DUMP (BSIK / BSAK) ────────────────────────────────────────────
inv_general_rows = []
gen_inv_counter  = 1900000000
clr_doc_counter  = 2900000000
pay_inv_map      = {}   # clearing_doc → invoice_doc for payment generation
_inv_cc_by_doc   = {}   # invoice_doc → company_code, so payments inherit it

for po_inv in po_inv_rows:
    # The invoice takes its document number from the PO invoice line. These two
    # tables used to run independent counters (5105... vs 1900...), so the
    # po_invoice -> invoice join matched zero rows: invoice_due_date was NULL
    # for every fact row, invoice_to_payment_days was never computed, and
    # E2E_CYCLE_TIME could only ever fall back to the PO->GRN branch.
    inv_id   = po_inv["invoice_doc"]
    inv_date = date.fromisoformat(po_inv["posting_date"])
    _inv_cc_by_doc[inv_id] = po_inv["company_code"]
    vendor   = next(
        (p["vendor"] for p in po_rows if p["purchasing_document"] == po_inv["purchasing_document"]),
        "700100")
    vi       = VENDOR_MAP.get(vendor, VENDOR_MAP["700100"])
    terms    = vi["payment_terms"]
    days_1   = PAYMENT_TERMS_DAYS.get(terms, 30)
    baseline = inv_date        # ZFBDT = vendor invoice date
    due_date = add(baseline, days_1)

    paid = random.random() < 0.62
    if paid:
        clr_doc_counter += random.randint(1, 50)
        clr_doc = str(clr_doc_counter)
        pay_inv_map[clr_doc] = (inv_id, inv_date.year, float(po_inv["amount_local_ccy"]), vendor, due_date)
    else:
        clr_doc = ""

    amt = float(po_inv["amount_local_ccy"])
    inv_general_rows.append({
        "invoice_doc":        inv_id,
        "invoice_year":       po_inv["invoice_year"],
        "vendor":             vendor,
        "company_code":       po_inv["company_code"],
        "document_type":      "RE",
        "vendor_invoice_ref": po_inv["reference_doc"],
        "vendor_invoice_date": fd(inv_date),
        "posting_date":       fd(inv_date),
        "baseline_date":      fd(baseline),
        "days_1":             days_1,
        "due_date":           fd(due_date),
        "amount_local_ccy":   amt,
        "tax_amount":         round(amt * 18 / 118, 2),
        "payment_terms":      terms,
        "payment_block":      "",
        "po_reference":       po_inv["purchasing_document"],
        "clearing_doc":       clr_doc,
    })

# Non-PO invoices (KR doc type) — utilities, rent, catering etc.
non_po_vendors = ["700600", "700800", "732880"]
non_po_descs   = ["Monthly office rent", "Electricity charges", "Internet & telephone",
                   "Catering & canteen services", "Security services monthly", "Housekeeping contract"]
for i in range(30):
    gen_inv_counter += random.randint(5, 30)
    vendor = random.choice(non_po_vendors)
    vi     = VENDOR_MAP[vendor]
    terms  = vi["payment_terms"]
    days_1 = PAYMENT_TERMS_DAYS.get(terms, 30)
    inv_date = d(FY_START, FY_END)
    baseline  = inv_date
    due_date  = add(baseline, days_1)
    amt       = round(random.uniform(25_000, 5_00_000), 2)

    paid = random.random() < 0.55
    if paid:
        clr_doc_counter += random.randint(1, 50)
        clr_doc = str(clr_doc_counter)
        pay_inv_map[clr_doc] = (str(gen_inv_counter), inv_date.year, amt, vendor, due_date)
    else:
        clr_doc = ""

    inv_general_rows.append({
        "invoice_doc":        str(gen_inv_counter),
        "invoice_year":       str(inv_date.year),
        "vendor":             vendor,
        # Non-PO invoices have no PO to inherit from, so spread them across
        # companies; a blank here becomes NULL and drops the row out of every
        # company-scoped invoice KPI.
        "company_code":       random.choice(("1001", "1002", "1003")),
        "document_type":      "KR",
        "vendor_invoice_ref": f"INV-{inv_date.year}-{random.randint(1000,9999)}",
        "vendor_invoice_date": fd(inv_date),
        "posting_date":       fd(inv_date),
        "baseline_date":      fd(baseline),
        "days_1":             days_1,
        "due_date":           fd(due_date),
        "amount_local_ccy":   amt,
        "tax_amount":         round(amt * 18 / 118, 2),
        "payment_terms":      terms,
        "payment_block":      "",
        "po_reference":       "",
        "clearing_doc":       clr_doc,
    })

# 3 Cancelled invoices (RN doc type, negative or zero amounts)
# One per company: random.choice left a company with no cancellation at all, so
# INVOICE_CANCELLATION_RATE read zero there.
for i in range(3):
    gen_inv_counter += random.randint(2, 10)
    vendor   = random.choice(["700100", "700200", "700400"])
    vi       = VENDOR_MAP[vendor]
    terms    = vi["payment_terms"]
    days_1   = PAYMENT_TERMS_DAYS.get(terms, 30)
    inv_date = d(FY_START, FY_END)
    baseline = inv_date
    due_date = add(baseline, days_1)
    amt      = -round(random.uniform(50_000, 3_00_000), 2)  # negative = cancellation
    inv_general_rows.append({
        "invoice_doc":        str(gen_inv_counter),
        "invoice_year":       str(inv_date.year),
        "vendor":             vendor,
        "company_code":       ("1001", "1002", "1003")[i % 3],
        "document_type":      "RN",   # cancellation doc type
        "vendor_invoice_ref": f"CANCEL-{random.randint(1000,9999)}",
        "vendor_invoice_date": fd(inv_date),
        "posting_date":       fd(inv_date),
        "baseline_date":      fd(baseline),
        "days_1":             days_1,
        "due_date":           fd(due_date),
        "amount_local_ccy":   amt,
        "tax_amount":         round(amt * 18 / 118, 2),
        "payment_terms":      terms,
        "payment_block":      "",
        "po_reference":       "",
        "clearing_doc":       "",
    })


# ── 07  PAYMENT DUMP ──────────────────────────────────────────────────────────
pay_rows = []
pay_counter = 2900100000

for clr_doc, (inv_id, inv_year, amt, vendor, due_date) in pay_inv_map.items():
    # 75% on time, 25% late
    if random.random() < 0.75:
        pay_date = add(due_date, random.randint(-5, 0))
    else:
        pay_date = add(due_date, random.randint(1, 35))

    # Clamp to reasonable range
    if pay_date < FY_START:
        pay_date = FY_START
    if pay_date > FY_END + timedelta(days=90):
        pay_date = FY_END

    vi = VENDOR_MAP.get(vendor, VENDOR_MAP["700100"])
    discount = round(amt * 0.005, 2) if random.random() < 0.08 else 0.0

    pay_rows.append({
        # payment_doc is the invoice's clearing document. These were separate
        # series (29001... vs 2900...), so clearing_doc = payment_doc matched
        # nothing and no invoice could ever be tied to its payment.
        "payment_doc":     clr_doc,
        "payment_year":    str(pay_date.year),
        "vendor":          vendor,
        "company_code":    _inv_cc_by_doc.get(inv_id, "1001"),
        "document_type":   random.choice(["ZP", "ZP", "KZ"]),
        "posting_date":    fd(pay_date),
        "clearing_date":   fd(pay_date),
        "payment_method":  random.choice(["T", "T", "T", "S", "C"]),
        "amount_local_ccy": round(amt - discount, 2),
        "discount_taken":  discount,
        "cleared_invoice": inv_id,
        "bank_reference":  f"HDFC{pay_date.strftime('%Y%m%d')}{random.randint(10000,99999)}",
        "house_bank":      random.choice(["HDFC1", "ICIC1", "SBIN1"]),
    })

# 2 Payment-before-GRN anomaly.
# The payment has to reference a REAL invoice doc: the detector reaches payment
# through payment_dump.cleared_invoice -> invoice_dump.invoice_doc ->
# invoice_dump.po_reference, so a synthetic "PREPAY_..." cleared_invoice joined
# to nothing and PAYMENT_BEFORE_GRN could never fire.
_po_to_inv = {r["po_reference"]: r["invoice_doc"] for r in inv_general_rows
              if r.get("po_reference")}
pbg_targets = [p for p in po_rows
               if f"{p['purchasing_document']}|{p['item']}" in grn_po_map][:2]
for pb in pbg_targets:
    pk = f"{pb['purchasing_document']}|{pb['item']}"
    grn = grn_po_map[pk][0]
    grn_date = date.fromisoformat(grn["posting_date"])
    early_pay = add(grn_date, -random.randint(7, 18))
    pay_counter += 5
    pay_rows.append({
        "payment_doc":     str(pay_counter),
        "payment_year":    str(early_pay.year),
        "vendor":          pb["vendor"],
        "company_code":    pb["company_code"],
        "document_type":   "ZP",
        "posting_date":    fd(early_pay),
        "clearing_date":   fd(early_pay),
        "payment_method":  "T",
        "amount_local_ccy": float(pb["net_order_value"]),
        "discount_taken":  0,
        "cleared_invoice": _po_to_inv.get(pb["purchasing_document"],
                                         f"PREPAY_{pb['purchasing_document']}_{pb['item']}"),
        "bank_reference":  f"HDFC{early_pay.strftime('%Y%m%d')}{random.randint(10000,99999)}",
        "house_bank":      "HDFC1",
    })


# ── 09  CHANGE LOG ────────────────────────────────────────────────────────────
chg_rows = []
chg_counter = 100000


def add_chg(obj_cls, obj_id, user, chg_date, tcode, tbl, field, ind, old_v, new_v):
    global chg_counter
    chg_counter += random.randint(1, 6)
    chg_rows.append({
        "object_class":    obj_cls,
        "object_id":       obj_id,
        "change_number":   str(chg_counter),
        "username":        user,
        "change_date":     fd(chg_date),
        "change_time":     f"{random.randint(9,18):02d}:{random.randint(0,59):02d}:{random.randint(0,59):02d}",
        "tcode":           tcode,
        "table_name":      tbl,
        "field_name":      field,
        "change_indicator": ind,
        "old_value":       old_v,
        "new_value":       new_v,
    })


# Initial INSERT entries for all POs (to verify they're filtered out in amendment rate)
for po in po_rows[:80]:
    doc_date = date.fromisoformat(po["document_date"])
    add_chg("EINKBELEG", po["purchasing_document"], po["created_by"],
            doc_date, "ME21N", "EKPO", "NETPR", "I",
            "", str(po["net_order_price"]))

# PO amendments — UPDATE (U) type: ~18% of POs
po_amendment_targets = random.sample(
    [p for p in po_rows if p["deletion_indicator"] == ""][:120], 22)
for po in po_amendment_targets:
    doc_date = date.fromisoformat(po["document_date"])
    chg_date = add(doc_date, random.randint(1, 4))
    old_price = round(float(po["net_order_price"]) * random.uniform(0.85, 0.95), 2)
    add_chg("EINKBELEG", po["purchasing_document"], po["created_by"],
            chg_date, "ME22N", "EKPO", "NETPR", "U",
            str(old_price), str(po["net_order_price"]))
    add_chg("EINKBELEG", po["purchasing_document"], po["created_by"],
            add(chg_date, 1), "ME22N", "EKPO", "MENGE", "U",
            str(round(float(po["order_quantity"]) * 0.9, 3)),
            str(po["order_quantity"]))

# PO Release entries (FRGZU/FRGKE) — needed for PO cycle time KPI
for po in po_rows:
    if po["release_indicator"] == "X":
        doc_date = date.fromisoformat(po["document_date"])
        rel_date = add(doc_date, random.randint(1, 4))
        approver = sod_req_pr_keys.get(
            f"{po['purchase_requisition']}|{po['item_of_requisition']}",
            random.choice(APPROVERS))
        add_chg("EINKBELEG", po["purchasing_document"], approver,
                rel_date, "ME29N", "EKKO", "FRGZU", "U", "", "X")
        add_chg("EINKBELEG", po["purchasing_document"], approver,
                rel_date, "ME29N", "EKKO", "FRGKE", "U", "", "X")

# PR amendments
for pr in released_prs[:25]:
    pr_date = date.fromisoformat(pr["release_date"]) if pr["release_date"] else date.fromisoformat(pr["delivery_date"])
    chg_date = add(pr_date, -random.randint(1, 5))
    if chg_date < FY_START:
        chg_date = FY_START
    add_chg("BANF", pr["purchase_requisition"], pr["requisitioner"],
            chg_date, "ME52N", "EBAN", "MENGE", "U",
            str(round(float(pr["order_quantity"]) * 1.15, 3)),
            str(pr["order_quantity"]))
    add_chg("BANF", pr["purchase_requisition"], pr["requisitioner"],
            add(chg_date, 1), "ME52N", "EBAN", "PREIS", "U",
            str(round(float(pr["valuation_price"]) * 0.92, 2)),
            str(pr["valuation_price"]))

# Vendor master changes (KRED).
# Dated inside March 2023: VENDOR_MASTER_CHANGES is an MTD KPI, so changes
# scattered across the fiscal year never showed up in it.
for _i, v in enumerate(VENDORS[:6]):
    chg_date = add(MTD_ANCHOR, 3 + _i * 2)
    add_chg("KRED", v["vendor"], random.choice(BUYERS),
            chg_date, "XK01", "LFA1", "ZTERM", "U",
            "N030", v["payment_terms"])
    add_chg("KRED", v["vendor"], random.choice(BUYERS),
            add(chg_date, 2), "XK01", "LFB1", "ZAHLS", "U",
            "", v["payment_block"])

# SOD: PO approver = PR requisitioner (in change_log PO release)
for pr_key, req_user in sod_req_pr_keys.items():
    pr_num_str, pr_item = pr_key.split("|")
    matching_pos = [p for p in po_rows
                    if p["purchase_requisition"] == pr_num_str
                    and p["item_of_requisition"] == pr_item]
    for po in matching_pos:
        doc_date = date.fromisoformat(po["document_date"])
        # The same requisitioner is approving the PO — SOD violation
        add_chg("EINKBELEG", po["purchasing_document"], req_user,
                add(doc_date, 2), "ME29N", "EKKO", "FRGZU", "U", "", "X")


# ── WRITE ALL CSV FILES ────────────────────────────────────────────────────────

def write_csv(filename, rows, fieldnames=None):
    if not rows:
        print(f"  SKIP {filename} — no rows")
        return
    path = DATA_DIR / filename
    if fieldnames is None:
        fieldnames = list(rows[0].keys())
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)
    print(f"  {filename:35s} {len(rows):>4} rows")


print("\nGenerating IntelliSource P2P data...\n")
write_csv("01_PR_Dump.csv",            pr_rows)
write_csv("02_PO_Dump.csv",            po_rows)
write_csv("03_PO_Delivery_Dump.csv",   del_rows)
write_csv("04_GRN_Dump.csv",           grn_rows)
write_csv("05_PO_Invoice_Dump.csv",    po_inv_rows)
write_csv("06_Invoice_Dump.csv",       inv_general_rows)
write_csv("07_Payment_Dump.csv",       pay_rows)
write_csv("08_Vendor_Master.csv",      VENDORS_OUT)
write_csv("09_Change_Log.csv",         chg_rows)
write_csv("company_plant_master.csv",  PLANT_MASTER)

print(f"""
Summary
  PRs         : {len(pr_rows)} lines
  POs         : {len(po_rows)} lines  ({sum(1 for p in po_rows if not p['purchase_requisition'])} maverick, {sum(1 for p in po_rows if p['deletion_indicator']=='L')} deleted)
  Delivery    : {len(del_rows)} schedule lines
  GRN         : {len(grn_rows)} postings  ({sum(1 for g in grn_rows if g['debit_credit_ind']=='H')} returns)
  PO Invoices : {len(po_inv_rows)} lines
  Invoices    : {len(inv_general_rows)} total  ({sum(1 for i in inv_general_rows if i['document_type']=='RN')} cancellations)
  Payments    : {len(pay_rows)} postings
  Change Log  : {len(chg_rows)} entries  ({sum(1 for c in chg_rows if c['change_indicator']=='U')} updates, {sum(1 for c in chg_rows if c['change_indicator']=='I')} inserts)
""")
