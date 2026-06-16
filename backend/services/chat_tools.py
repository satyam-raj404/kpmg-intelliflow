"""Chat tool executors — called by the agentic loop in chat_engine.py."""
import re
from database import get_connection

_WRITE_OP = re.compile(
    r'\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|GRANT|REVOKE|EXECUTE|CALL)\b',
    re.IGNORECASE,
)


def query_database(sql: str) -> list[dict]:
    """Execute a read-only SQL SELECT against the DB. Max 150 rows returned."""
    if _WRITE_OP.search(sql):
        raise ValueError("Write operations not permitted")
    sql = sql.rstrip(";")
    if "limit" not in sql.lower():
        sql = f"{sql} LIMIT 150"
    conn = get_connection()
    rows = conn.execute(sql).fetchmany(150)
    return [dict(r) for r in rows]


def get_kpis(dashboard: str, company_code: str = "ALL") -> list[dict]:
    """Fetch pre-computed KPIs from kpi_results for a given dashboard and company."""
    conn = get_connection()
    rows = conn.execute(
        "SELECT kpi_code, kpi_name, value_numeric, value_text, unit, trend "
        "FROM kpi_results WHERE dashboard = ? AND company_code = ? ORDER BY kpi_code",
        (dashboard.lower(), company_code),
    ).fetchall()
    return [dict(r) for r in rows]


def find_document(doc_type: str, doc_number: str) -> dict:
    """Find full details for a PO, PR, GRN, or Invoice by document number."""
    conn = get_connection()
    dt = doc_type.upper().strip()

    if dt == "PO":
        po_rows = conn.execute(
            "SELECT purchasing_document, item, vendor, vendor_name, net_order_value, "
            "document_date, material_description, material_group, company_code, "
            "deletion_indicator, delivery_completed, release_indicator, capex_opex_flag "
            "FROM po_dump WHERE purchasing_document = ? LIMIT 20",
            (doc_number,),
        ).fetchall()
        fact_rows = conn.execute(
            "SELECT purchase_requisition, purchasing_document, vendor, vendor_name, "
            "company_code, po_net_value, grn_amount, invoice_amount, "
            "pr_to_po_days, po_to_grn_days, grn_to_invoice_days, invoice_to_payment_days, "
            "total_cycle_days, capex_opex_flag, grn_posting_date, invoice_posting_date "
            "FROM pr_po_grn_invoice WHERE purchasing_document = ? LIMIT 20",
            (doc_number,),
        ).fetchall()
        inv_rows = conn.execute(
            "SELECT invoice_doc, purchasing_document, amount_local_ccy, invoice_date "
            "FROM po_invoice_dump WHERE purchasing_document = ? LIMIT 10",
            (doc_number,),
        ).fetchall()
        return {
            "doc_type": "PO",
            "doc_number": doc_number,
            "po_lines": [dict(r) for r in po_rows],
            "p2p_chain": [dict(r) for r in fact_rows],
            "invoices": [dict(r) for r in inv_rows],
        }

    elif dt == "PR":
        pr_rows = conn.execute(
            "SELECT purchase_requisition, item_of_requisition, material_description, "
            "order_quantity, unit_of_measure, release_status, release_date, "
            "created_on, company_code, deletion_indicator "
            "FROM pr_dump WHERE purchase_requisition = ? LIMIT 20",
            (doc_number,),
        ).fetchall()
        fact_rows = conn.execute(
            "SELECT purchase_requisition, purchasing_document, vendor, vendor_name, "
            "po_net_value, pr_to_po_days, total_cycle_days "
            "FROM pr_po_grn_invoice WHERE purchase_requisition = ? LIMIT 20",
            (doc_number,),
        ).fetchall()
        return {
            "doc_type": "PR",
            "doc_number": doc_number,
            "pr_items": [dict(r) for r in pr_rows],
            "linked_pos": [dict(r) for r in fact_rows],
        }

    elif dt == "GRN":
        grn_rows = conn.execute(
            "SELECT * FROM grn_dump WHERE mat_doc = ? LIMIT 10",
            (doc_number,),
        ).fetchall()
        return {"doc_type": "GRN", "doc_number": doc_number, "grn_items": [dict(r) for r in grn_rows]}

    elif dt == "INVOICE":
        inv_rows = conn.execute(
            "SELECT * FROM po_invoice_dump WHERE invoice_doc = ? LIMIT 10",
            (doc_number,),
        ).fetchall()
        return {"doc_type": "INVOICE", "doc_number": doc_number, "invoice_items": [dict(r) for r in inv_rows]}

    return {"error": f"Unknown doc_type: {doc_type}. Use PO, PR, GRN, or INVOICE."}


def get_anomalies() -> list[dict]:
    """Get anomaly summary: distinct anomaly flag codes, counts, and severity."""
    conn = get_connection()
    # Overall anomaly counts by flag code from process_mining_events
    rows = conn.execute(
        "SELECT anomaly_flags, COUNT(*) as po_count "
        "FROM process_mining_events "
        "WHERE anomaly_flags IS NOT NULL AND anomaly_flags != '' "
        "GROUP BY anomaly_flags ORDER BY po_count DESC LIMIT 30"
    ).fetchall()

    # Also get total summary
    summary = conn.execute(
        "SELECT COUNT(*) as total_pos, "
        "SUM(anomaly_count) as total_anomaly_flags, "
        "COUNT(*) FILTER (WHERE anomaly_count > 0) as pos_with_anomalies "
        "FROM process_mining_events"
    ).fetchone()

    return {
        "summary": dict(summary) if summary else {},
        "anomaly_breakdown": [dict(r) for r in rows],
    }


def get_vendor_info(vendor_id: str = None) -> list[dict]:
    """Get vendor spend, PO count, and status. Omit vendor_id for top 20 by spend."""
    conn = get_connection()
    if vendor_id:
        rows = conn.execute(
            "SELECT vm.vendor, vm.name1 as vendor_name, vm.posting_block_cc, vm.msme_flag, "
            "COUNT(DISTINCT p.purchasing_document) as po_count, "
            "SUM(CAST(COALESCE(NULLIF(p.net_order_value,''),'0') AS REAL)) as total_spend "
            "FROM vendor_master vm "
            "LEFT JOIN po_dump p ON p.vendor = vm.vendor "
            "WHERE vm.vendor = ? "
            "GROUP BY vm.vendor, vm.name1, vm.posting_block_cc, vm.msme_flag",
            (vendor_id,),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT vm.vendor, vm.name1 as vendor_name, vm.posting_block_cc, vm.msme_flag, "
            "COUNT(DISTINCT p.purchasing_document) as po_count, "
            "SUM(CAST(COALESCE(NULLIF(p.net_order_value,''),'0') AS REAL)) as total_spend "
            "FROM vendor_master vm "
            "LEFT JOIN po_dump p ON p.vendor = vm.vendor "
            "GROUP BY vm.vendor, vm.name1, vm.posting_block_cc, vm.msme_flag "
            "ORDER BY total_spend DESC NULLS LAST LIMIT 20"
        ).fetchall()
    return [dict(r) for r in rows]


def get_p2p_stage_summary() -> dict:
    """Get P2P pipeline counts and average cycle times per stage."""
    conn = get_connection()
    row = conn.execute(
        "SELECT "
        "  COUNT(DISTINCT purchase_requisition) FILTER (WHERE purchase_requisition IS NOT NULL AND purchase_requisition != '') as pr_count, "
        "  COUNT(DISTINCT purchasing_document) FILTER (WHERE purchasing_document IS NOT NULL AND purchasing_document != '') as po_count, "
        "  COUNT(*) FILTER (WHERE grn_posting_date IS NOT NULL AND grn_posting_date != '') as grn_lines, "
        "  COUNT(*) FILTER (WHERE invoice_posting_date IS NOT NULL AND invoice_posting_date != '') as invoice_lines, "
        "  ROUND(AVG(pr_to_po_days::numeric), 1) as avg_pr_to_po_days, "
        "  ROUND(AVG(po_to_grn_days::numeric), 1) as avg_po_to_grn_days, "
        "  ROUND(AVG(grn_to_invoice_days::numeric), 1) as avg_grn_to_invoice_days, "
        "  ROUND(AVG(invoice_to_payment_days::numeric), 1) as avg_invoice_to_payment_days, "
        "  ROUND(AVG(total_cycle_days::numeric), 1) as avg_total_cycle_days "
        "FROM pr_po_grn_invoice"
    ).fetchone()
    return dict(row) if row else {}
