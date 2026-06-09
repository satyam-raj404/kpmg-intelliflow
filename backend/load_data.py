"""
Load real P2P CSV data from ../data/ into the IntelliSource DB,
then rebuild facts, process events, and KPIs.

Run:  python load_data.py
"""
import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from database import get_connection, init_db
from services.fact_builder import build_facts
from services.event_generator import generate_events
from services.kpi_engine import compute_all

DATA_DIR = Path(__file__).parent.parent / "data"
BATCH = "REAL-DATA-001"


def load_csv(path: Path) -> list[dict]:
    with open(path, newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def _v(row: dict, key: str, default: str = "") -> str:
    return (row.get(key) or default).strip()


def load_vendor_master(conn, rows: list[dict]):
    conn.execute("DELETE FROM vendor_master")
    data = []
    for r in rows:
        data.append((
            _v(r, "vendor"),
            _v(r, "vendor_name"),
            _v(r, "country"),
            _v(r, "city"),
            _v(r, "postal_code"),
            _v(r, "region"),
            _v(r, "account_group"),
            _v(r, "tax_number_pan"),
            _v(r, "tax_number_gstin"),
            _v(r, "central_purchasing_block"),
            _v(r, "central_posting_block"),
            _v(r, "deletion_flag_central"),
            _v(r, "company_code"),
            _v(r, "payment_terms"),
            _v(r, "payment_block"),
            _v(r, "posting_block_cc"),
            _v(r, "msme_flag"),
            _v(r, "vendor_type"),
            BATCH,
        ))
    conn.executemany("""
        INSERT INTO vendor_master
        (vendor, vendor_name, country, city, postal_code, region,
         account_group, tax_number_pan, tax_number_gstin,
         central_purchasing_block, central_posting_block, deletion_flag_central,
         company_code, payment_terms, payment_block,
         posting_block_cc, msme_flag, vendor_type, upload_batch_id)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT (vendor, company_code) DO UPDATE SET
            vendor_name               = excluded.vendor_name,
            country                   = excluded.country,
            city                      = excluded.city,
            postal_code               = excluded.postal_code,
            region                    = excluded.region,
            account_group             = excluded.account_group,
            tax_number_pan            = excluded.tax_number_pan,
            tax_number_gstin          = excluded.tax_number_gstin,
            central_purchasing_block  = excluded.central_purchasing_block,
            central_posting_block     = excluded.central_posting_block,
            deletion_flag_central     = excluded.deletion_flag_central,
            payment_terms             = excluded.payment_terms,
            payment_block             = excluded.payment_block,
            posting_block_cc          = excluded.posting_block_cc,
            msme_flag                 = excluded.msme_flag,
            vendor_type               = excluded.vendor_type,
            upload_batch_id           = excluded.upload_batch_id
    """, data)
    print(f"  [vendor_master] {len(data)} rows")


def load_pr_dump(conn, rows: list[dict]):
    conn.execute("DELETE FROM pr_dump")
    data = []
    for r in rows:
        data.append((
            _v(r, "company_code", "1001"),
            _v(r, "purchase_requisition"),
            _v(r, "item_of_requisition"),
            _v(r, "purchasing_doc_type"),
            _v(r, "vendor"),
            _v(r, "material_group"),
            _v(r, "material_description"),
            _v(r, "plant"),
            _v(r, "purchasing_group"),
            _v(r, "order_quantity"),
            _v(r, "unit_of_measure"),
            _v(r, "valuation_price"),
            _v(r, "delivery_date"),
            _v(r, "release_status"),
            _v(r, "release_date"),
            _v(r, "requisitioner"),
            _v(r, "tracking_number"),
            _v(r, "created_on"),
            _v(r, "deletion_indicator", ""),
            _v(r, "account_assignment_category", ""),
            BATCH,
        ))
    conn.executemany("""
        INSERT INTO pr_dump
        (company_code, purchase_requisition, item_of_requisition, purchasing_doc_type, vendor,
         material_group, material_description, plant, purchasing_group,
         order_quantity, unit_of_measure, valuation_price,
         delivery_date, release_status, release_date,
         requisitioner, tracking_number, created_on, deletion_indicator,
         account_assignment_category, upload_batch_id)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, data)
    print(f"  [pr_dump] {len(data)} rows")


def load_po_dump(conn, rows: list[dict]):
    conn.execute("DELETE FROM po_dump")
    data = []
    for r in rows:
        data.append((
            _v(r, "company_code", "1001"),
            _v(r, "purchasing_document"),
            _v(r, "item"),
            _v(r, "purchasing_doc_type"),
            _v(r, "purchasing_org"),
            _v(r, "purchasing_group"),
            _v(r, "vendor"),
            _v(r, "vendor_name"),
            _v(r, "document_date"),
            _v(r, "created_on"),
            _v(r, "plant"),
            _v(r, "material_group"),
            _v(r, "material_type"),
            _v(r, "material_description"),
            _v(r, "order_quantity"),
            _v(r, "unit_of_measure"),
            _v(r, "net_order_price"),
            _v(r, "net_order_value"),
            _v(r, "delivery_date"),
            _v(r, "purchase_requisition"),
            _v(r, "item_of_requisition"),
            _v(r, "deletion_indicator", ""),
            _v(r, "release_indicator"),
            _v(r, "release_strategy"),
            _v(r, "contract_number"),
            _v(r, "capex_opex_flag", "OPEX"),
            _v(r, "delivery_completed"),
            _v(r, "tax_code"),
            _v(r, "account_assignment_category", ""),
            _v(r, "item_category", "0"),
            _v(r, "gr_based_iv", ""),
            BATCH,
        ))
    conn.executemany("""
        INSERT INTO po_dump
        (company_code, purchasing_document, item,
         purchasing_doc_type, purchasing_org, purchasing_group,
         vendor, vendor_name,
         document_date, created_on, plant,
         material_group, material_type, material_description,
         order_quantity, unit_of_measure,
         net_order_price, net_order_value,
         delivery_date, purchase_requisition, item_of_requisition,
         deletion_indicator, release_indicator, release_strategy,
         contract_number, capex_opex_flag, delivery_completed,
         tax_code, account_assignment_category, item_category, gr_based_iv,
         upload_batch_id)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, data)
    print(f"  [po_dump] {len(data)} rows")


def load_po_delivery(conn, rows: list[dict]):
    conn.execute("DELETE FROM po_delivery_dump")
    data = []
    for r in rows:
        data.append((
            _v(r, "purchasing_document"),
            _v(r, "item"),
            _v(r, "schedule_line"),
            _v(r, "expected_delivery_date"),
            _v(r, "scheduled_quantity"),
            _v(r, "delivered_quantity"),
            _v(r, "open_quantity"),
            _v(r, "statistical_delivery_date"),
            _v(r, "actual_delivery_date"),
            _v(r, "creation_date"),
            BATCH,
        ))
    conn.executemany("""
        INSERT INTO po_delivery_dump
        (purchasing_document, item, schedule_line,
         expected_delivery_date, scheduled_quantity, delivered_quantity, open_quantity,
         statistical_delivery_date, actual_delivery_date, creation_date, upload_batch_id)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)
    """, data)
    print(f"  [po_delivery_dump] {len(data)} rows")


def load_grn(conn, rows: list[dict]):
    conn.execute("DELETE FROM grn_dump")
    data = []
    for r in rows:
        data.append((
            _v(r, "purchasing_document"),
            _v(r, "item"),
            _v(r, "material_document"),
            _v(r, "material_doc_item"),
            _v(r, "po_history_category", "E"),
            _v(r, "movement_type"),
            _v(r, "debit_credit_ind"),
            _v(r, "posting_date"),
            _v(r, "entry_date"),
            _v(r, "plant"),
            _v(r, "storage_location"),
            _v(r, "company_code", "1001"),
            _v(r, "vendor"),
            _v(r, "quantity"),
            _v(r, "amount_local_ccy"),
            _v(r, "reference_doc"),
            BATCH,
        ))
    conn.executemany("""
        INSERT INTO grn_dump
        (purchasing_document, item,
         material_document, material_doc_item,
         po_history_category, movement_type, debit_credit_ind,
         posting_date, entry_date,
         plant, storage_location, company_code, vendor,
         quantity, amount_local_ccy, reference_doc, upload_batch_id)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, data)
    print(f"  [grn_dump] {len(data)} rows")


def load_po_invoice(conn, rows: list[dict]):
    conn.execute("DELETE FROM po_invoice_dump")
    data = []
    for r in rows:
        data.append((
            _v(r, "purchasing_document"),
            _v(r, "item"),
            _v(r, "invoice_doc"),
            _v(r, "invoice_year"),
            _v(r, "invoice_doc_item"),
            _v(r, "po_history_category", "Q"),
            _v(r, "debit_credit_ind"),
            _v(r, "posting_date"),
            _v(r, "entry_date"),
            _v(r, "quantity"),
            _v(r, "amount_local_ccy"),
            _v(r, "reference_doc"),
            BATCH,
        ))
    conn.executemany("""
        INSERT INTO po_invoice_dump
        (purchasing_document, item,
         invoice_doc, invoice_year, invoice_doc_item,
         po_history_category, debit_credit_ind,
         posting_date, entry_date,
         quantity, amount_local_ccy, reference_doc, upload_batch_id)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, data)
    print(f"  [po_invoice_dump] {len(data)} rows")


def load_invoice(conn, rows: list[dict]):
    conn.execute("DELETE FROM invoice_dump")
    data = []
    for r in rows:
        data.append((
            _v(r, "invoice_doc"),
            _v(r, "invoice_year"),
            _v(r, "company_code", "1001"),
            _v(r, "vendor"),
            _v(r, "document_type"),
            _v(r, "debit_credit_ind", "S"),
            _v(r, "reverse_invoice"),
            _v(r, "reversal_reason"),
            _v(r, "vendor_invoice_ref"),
            _v(r, "vendor_invoice_date"),
            _v(r, "posting_date"),
            _v(r, "baseline_date"),
            _v(r, "days_1", "30"),
            _v(r, "due_date"),
            _v(r, "amount_local_ccy"),
            _v(r, "tax_amount", "0"),
            _v(r, "payment_terms"),
            _v(r, "payment_block"),
            _v(r, "po_reference"),
            _v(r, "clearing_doc") or None,
            BATCH,
        ))
    conn.executemany("""
        INSERT INTO invoice_dump
        (invoice_doc, invoice_year,
         company_code, vendor, document_type,
         debit_credit_ind, reverse_invoice, reversal_reason,
         vendor_invoice_ref, vendor_invoice_date,
         posting_date, baseline_date, days_1, due_date,
         amount_local_ccy, tax_amount,
         payment_terms, payment_block,
         po_reference, clearing_doc, upload_batch_id)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, data)
    print(f"  [invoice_dump] {len(data)} rows")


def load_payment(conn, rows: list[dict]):
    conn.execute("DELETE FROM payment_dump")
    data = []
    for r in rows:
        data.append((
            _v(r, "payment_doc"),
            _v(r, "payment_year"),
            _v(r, "company_code", "1001"),
            _v(r, "vendor"),
            _v(r, "document_type"),
            _v(r, "debit_credit_ind", "S"),
            _v(r, "posting_date"),
            _v(r, "clearing_date"),
            _v(r, "payment_method"),
            _v(r, "amount_local_ccy"),
            _v(r, "discount_taken", "0"),
            _v(r, "cleared_invoice"),
            _v(r, "bank_reference"),
            _v(r, "house_bank"),
            BATCH,
        ))
    conn.executemany("""
        INSERT INTO payment_dump
        (payment_doc, payment_year,
         company_code, vendor, document_type, debit_credit_ind,
         posting_date, clearing_date,
         payment_method,
         amount_local_ccy, discount_taken,
         cleared_invoice, bank_reference, house_bank,
         upload_batch_id)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, data)
    print(f"  [payment_dump] {len(data)} rows")


def load_change_log(conn, rows: list[dict]):
    conn.execute("DELETE FROM change_log")
    data = []
    for r in rows:
        data.append((
            _v(r, "object_class"),
            _v(r, "object_id"),
            _v(r, "change_number"),
            _v(r, "username"),
            _v(r, "change_date"),
            _v(r, "change_time"),
            _v(r, "tcode"),
            _v(r, "table_name"),
            _v(r, "field_name"),
            _v(r, "change_indicator"),
            _v(r, "old_value"),
            _v(r, "new_value"),
            BATCH,
        ))
    conn.executemany("""
        INSERT INTO change_log
        (object_class, object_id, change_number, username,
         change_date, change_time, tcode, table_name,
         field_name, change_indicator, old_value, new_value, upload_batch_id)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, data)
    print(f"  [change_log] {len(data)} rows")


def main():
    init_db()
    conn = get_connection()

    files = {
        "08_Vendor_Master.csv": load_vendor_master,
        "01_PR_Dump.csv":       load_pr_dump,
        "02_PO_Dump.csv":       load_po_dump,
        "03_PO_Delivery_Dump.csv": load_po_delivery,
        "04_GRN_Dump.csv":      load_grn,
        "05_PO_Invoice_Dump.csv": load_po_invoice,
        "06_Invoice_Dump.csv":  load_invoice,
        "07_Payment_Dump.csv":  load_payment,
        "09_Change_Log.csv":    load_change_log,
    }

    print("[load] Loading CSV files…")
    for fname, loader in files.items():
        path = DATA_DIR / fname
        if not path.exists():
            print(f"  SKIP {fname} (not found)")
            continue
        rows = load_csv(path)
        loader(conn, rows)
        conn.commit()

    # Seed license usage (static — no CSV for this)
    conn.execute("DELETE FROM license_usage")
    conn.executemany("""
        INSERT INTO license_usage
        (tool_name, total_licenses, active_users, annual_cost_inr, renewal_date, material_group)
        VALUES (?,?,?,?,?,?)
        ON CONFLICT (tool_name) DO NOTHING
    """, [
        ("Microsoft 365",   500, 423, 25_000_000, "2027-03-31", "SOFTWARE"),
        ("Salesforce",      200,  87, 18_000_000, "2026-11-30", "SAAS"),
        ("SAP S/4HANA",     150, 148,120_000_000, "2026-09-30", "SOFTWARE"),
        ("Jira/Confluence", 300, 156,  4_500_000, "2026-12-31", "SAAS"),
        ("Tableau",         100,  38,  8_000_000, "2026-08-31", "SOFTWARE"),
        ("Zoom",            400, 301,  6_000_000, "2027-01-31", "CLOUD"),
    ])
    conn.commit()
    print("  [license_usage] 6 rows")

    print("[load] Building facts…")
    build_facts(conn)

    print("[load] Generating process mining events…")
    generate_events(conn)

    print("[load] Computing KPIs…")
    compute_all(conn)

    kpi_count = conn.execute("SELECT COUNT(*) FROM kpi_results").fetchone()[0]
    fact_count = conn.execute("SELECT COUNT(*) FROM pr_po_grn_invoice").fetchone()[0]
    print(f"[load] Done. facts={fact_count}, kpi_results={kpi_count}")


if __name__ == "__main__":
    main()
