"""
Add company codes 1002 and 1003 to CSV data files.
Assignment: sorted purchasing_documents → first 65% keep 1001, next 25% → 1002, last 10% → 1003.
Propagates to all linked tables. Adds vendor_master rows for new companies.
Run once: python add_company_codes.py
"""
import csv
import copy
from pathlib import Path

DATA = Path(__file__).parent.parent / "data"


def load_csv(fname):
    p = DATA / fname
    with open(p, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))
    return rows


def save_csv(fname, rows):
    if not rows:
        return
    p = DATA / fname
    with open(p, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=rows[0].keys())
        w.writeheader()
        w.writerows(rows)
    print(f"  saved {fname}  ({len(rows)} rows)")


# ── 1. Assign company_code per purchasing_document ──────────────────────────

po_rows = load_csv("02_PO_Dump.csv")
docs = sorted(set(r["purchasing_document"] for r in po_rows if r.get("purchasing_document")))
n = len(docs)
cut1 = int(n * 0.65)
cut2 = int(n * 0.90)

doc_company = {}
for i, doc in enumerate(docs):
    if i < cut1:
        doc_company[doc] = "1001"
    elif i < cut2:
        doc_company[doc] = "1002"
    else:
        doc_company[doc] = "1003"

cc_counts = {cc: sum(1 for v in doc_company.values() if v == cc) for cc in ["1001","1002","1003"]}
print(f"[po] company_code split: {cc_counts}")

# ── 2. Update po_dump ────────────────────────────────────────────────────────

for r in po_rows:
    doc = r.get("purchasing_document", "")
    r["company_code"] = doc_company.get(doc, "1001")

save_csv("02_PO_Dump.csv", po_rows)

# Build invoice lookup: invoice_doc → company_code (via po_reference → po doc)
# and pr lookup: (purchase_requisition, item) → company_code

pr_to_company = {}  # purchase_requisition → company_code
for r in po_rows:
    pr = r.get("purchase_requisition", "").strip()
    if pr:
        cc = r["company_code"]
        # last write wins; acceptable since same PR usually → same PO company
        pr_to_company[pr] = cc

# ── 3. Update pr_dump ────────────────────────────────────────────────────────

pr_rows = load_csv("01_PR_Dump.csv")
for r in pr_rows:
    pr = r.get("purchase_requisition", "").strip()
    r["company_code"] = pr_to_company.get(pr, "1001")

save_csv("01_PR_Dump.csv", pr_rows)

# ── 4. Update grn_dump ───────────────────────────────────────────────────────

grn_rows = load_csv("04_GRN_Dump.csv")
for r in grn_rows:
    doc = r.get("purchasing_document", "").strip()
    r["company_code"] = doc_company.get(doc, "1001")

save_csv("04_GRN_Dump.csv", grn_rows)

# ── 5. Update po_invoice_dump (05) — propagate via purchasing_document ───────
# po_invoice_dump may not have company_code column — check header
poi_rows = load_csv("05_PO_Invoice_Dump.csv")
has_cc = "company_code" in poi_rows[0] if poi_rows else False
if has_cc:
    for r in poi_rows:
        doc = r.get("purchasing_document", "").strip()
        r["company_code"] = doc_company.get(doc, "1001")
    save_csv("05_PO_Invoice_Dump.csv", poi_rows)
else:
    print("  05_PO_Invoice_Dump.csv has no company_code column — skipped")

# Build invoice_doc → company_code map via po_invoice_dump
inv_to_company = {}
for r in poi_rows:
    inv_doc = r.get("invoice_doc", "").strip()
    po_doc  = r.get("purchasing_document", "").strip()
    if inv_doc and po_doc:
        inv_to_company[inv_doc] = doc_company.get(po_doc, "1001")

# ── 6. Update invoice_dump ───────────────────────────────────────────────────

inv_rows = load_csv("06_Invoice_Dump.csv")
for r in inv_rows:
    inv_doc = r.get("invoice_doc", "").strip()
    # try po_invoice_dump map first, then po_reference
    if inv_doc in inv_to_company:
        r["company_code"] = inv_to_company[inv_doc]
    else:
        po_ref = r.get("po_reference", "").strip()
        r["company_code"] = doc_company.get(po_ref, "1001")

# Update inv_to_company with final invoice_dump values (for payment)
for r in inv_rows:
    inv_to_company[r.get("invoice_doc","").strip()] = r["company_code"]

save_csv("06_Invoice_Dump.csv", inv_rows)

# ── 7. Update payment_dump ───────────────────────────────────────────────────

pay_rows = load_csv("07_Payment_Dump.csv")
for r in pay_rows:
    cleared = r.get("cleared_invoice", "").strip()
    r["company_code"] = inv_to_company.get(cleared, "1001")

save_csv("07_Payment_Dump.csv", pay_rows)

# ── 8. Vendor master: add copies for 1002 and 1003 ──────────────────────────

vm_rows = load_csv("08_Vendor_Master.csv")
base_1001 = [r for r in vm_rows if r.get("company_code","1001") == "1001"]

new_vm_rows = list(vm_rows)
for cc in ["1002", "1003"]:
    for r in base_1001:
        new_row = dict(r)
        new_row["company_code"] = cc
        new_vm_rows.append(new_row)

save_csv("08_Vendor_Master.csv", new_vm_rows)
print(f"  vendor_master: {len(vm_rows)} -> {len(new_vm_rows)} rows")

print("\n[done] Company codes assigned.")
print(f"  POs: 1001={cc_counts['1001']}, 1002={cc_counts['1002']}, 1003={cc_counts['1003']}")
print("Next: python load_data.py")
