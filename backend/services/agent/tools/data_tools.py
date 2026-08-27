"""Data tools — ported from services/chat_tools.py, now running on the harness's
dedicated read-only connection (harness_db.py) instead of the app's main
database.get_connection(). Fixes two pre-existing column bugs found during
migration: vendor_master has no name1 (use vendor_name); po_invoice_dump has no
invoice_date (use posting_date).
"""
from ..context import TurnContext
from ..guardrails import run_guarded_select, validate_tool_args
from ..harness_db import harness_select
from ..registry import Tool, register


def query_database(args: dict, ctx: TurnContext):
    validate_tool_args("query_database", args)
    rows, err = run_guarded_select(args["sql"])
    if err:
        return {"error": err}
    return rows


def get_kpis(args: dict, ctx: TurnContext):
    dashboard = args["dashboard"].lower()
    company_code = args.get("company_code", "ALL")
    return harness_select(
        "SELECT kpi_code, kpi_name, value_numeric, value_text, unit, trend "
        "FROM kpi_results WHERE dashboard = %s AND company_code = %s ORDER BY kpi_code",
        (dashboard, company_code),
    )


def find_document(args: dict, ctx: TurnContext):
    doc_type = args["doc_type"].upper().strip()
    doc_number = args["doc_number"]

    if doc_type == "PO":
        po_rows = harness_select(
            "SELECT purchasing_document, item, vendor, vendor_name, net_order_value, "
            "document_date, material_description, material_group, company_code, "
            "deletion_indicator, delivery_completed, release_indicator, capex_opex_flag "
            "FROM po_dump WHERE purchasing_document = %s LIMIT 20",
            (doc_number,),
        )
        fact_rows = harness_select(
            "SELECT purchase_requisition, purchasing_document, vendor, vendor_name, "
            "company_code, po_net_value, grn_amount, invoice_amount, "
            "pr_to_po_days, po_to_grn_days, grn_to_invoice_days, invoice_to_payment_days, "
            "total_cycle_days, capex_opex_flag, grn_posting_date, invoice_posting_date "
            "FROM pr_po_grn_invoice WHERE purchasing_document = %s LIMIT 20",
            (doc_number,),
        )
        inv_rows = harness_select(
            "SELECT invoice_doc, purchasing_document, amount_local_ccy, posting_date "
            "FROM po_invoice_dump WHERE purchasing_document = %s LIMIT 10",
            (doc_number,),
        )
        return {"doc_type": "PO", "doc_number": doc_number, "po_lines": po_rows,
                "p2p_chain": fact_rows, "invoices": inv_rows}

    if doc_type == "PR":
        pr_rows = harness_select(
            "SELECT purchase_requisition, item_of_requisition, material_description, "
            "order_quantity, unit_of_measure, release_status, release_date, "
            "created_on, company_code, deletion_indicator "
            "FROM pr_dump WHERE purchase_requisition = %s LIMIT 20",
            (doc_number,),
        )
        fact_rows = harness_select(
            "SELECT purchase_requisition, purchasing_document, vendor, vendor_name, "
            "po_net_value, pr_to_po_days, total_cycle_days "
            "FROM pr_po_grn_invoice WHERE purchase_requisition = %s LIMIT 20",
            (doc_number,),
        )
        return {"doc_type": "PR", "doc_number": doc_number, "pr_items": pr_rows, "linked_pos": fact_rows}

    if doc_type == "GRN":
        grn_rows = harness_select("SELECT * FROM grn_dump WHERE material_document = %s LIMIT 10", (doc_number,))
        return {"doc_type": "GRN", "doc_number": doc_number, "grn_items": grn_rows}

    if doc_type == "INVOICE":
        inv_rows = harness_select("SELECT * FROM po_invoice_dump WHERE invoice_doc = %s LIMIT 10", (doc_number,))
        return {"doc_type": "INVOICE", "doc_number": doc_number, "invoice_items": inv_rows}

    return {"error": f"Unknown doc_type: {doc_type}. Use PO, PR, GRN, or INVOICE."}


def get_anomalies(args: dict, ctx: TurnContext):
    breakdown = harness_select(
        "SELECT anomaly_flags, COUNT(*) as po_count FROM process_mining_events "
        "WHERE anomaly_flags IS NOT NULL AND anomaly_flags != '' "
        "GROUP BY anomaly_flags ORDER BY po_count DESC LIMIT 30"
    )
    summary = harness_select(
        "SELECT COUNT(*) as total_pos, SUM(anomaly_count) as total_anomaly_flags, "
        "COUNT(*) FILTER (WHERE anomaly_count > 0) as pos_with_anomalies "
        "FROM process_mining_events"
    )
    return {"summary": summary[0] if summary else {}, "anomaly_breakdown": breakdown}


def get_vendor_info(args: dict, ctx: TurnContext):
    vendor_id = args.get("vendor_id")
    base = (
        "SELECT vm.vendor, vm.vendor_name, vm.posting_block_cc, vm.msme_flag, "
        "COUNT(DISTINCT p.purchasing_document) as po_count, "
        "SUM(CAST(COALESCE(NULLIF(p.net_order_value,''),'0') AS REAL)) as total_spend "
        "FROM vendor_master vm LEFT JOIN po_dump p ON p.vendor = vm.vendor "
    )
    if vendor_id:
        return harness_select(
            base + "WHERE vm.vendor = %s GROUP BY vm.vendor, vm.vendor_name, vm.posting_block_cc, vm.msme_flag",
            (vendor_id,),
        )
    return harness_select(
        base + "GROUP BY vm.vendor, vm.vendor_name, vm.posting_block_cc, vm.msme_flag "
        "ORDER BY total_spend DESC NULLS LAST LIMIT 20"
    )


def get_p2p_stage_summary(args: dict, ctx: TurnContext):
    rows = harness_select(
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
    )
    return rows[0] if rows else {}


def get_metric(args: dict, ctx: TurnContext):
    """New: run a canonical registered metric by key (see ../metrics.py) — the
    preferred path over query_database for common questions, since the SQL is
    pre-validated and can't drift between answers."""
    from .. import metrics
    m = metrics.get_metric(args["metric_key"])
    rows, err = run_guarded_select(m.sql, trusted=True)
    if err:
        return {"error": err}
    return rows


register(Tool(
    name="query_database",
    description="Run a read-only PostgreSQL SELECT for custom aggregations or joins not covered by other tools. Prefer get_metric for common questions.",
    parameters={
        "type": "object",
        "properties": {"sql": {"type": "string", "description": "Valid PostgreSQL SELECT. No writes. Use ::numeric for ROUND()."}},
        "required": ["sql"],
    },
    executor=query_database,
    manifest_hint="sql",
))

register(Tool(
    name="get_metric",
    description="Run a pre-defined canonical metric by key (e.g. total_po_value, spend_by_vendor, maverick_rate). Prefer this over query_database — the SQL is fixed and consistent across answers.",
    parameters={
        "type": "object",
        "properties": {"metric_key": {"type": "string", "description": "One of the registered metric keys."}},
        "required": ["metric_key"],
    },
    executor=get_metric,
    manifest_hint="metric",
))

register(Tool(
    name="get_kpis",
    description="Fetch pre-computed KPI values. Faster than raw SQL for dashboard-level metrics.",
    parameters={
        "type": "object",
        "properties": {
            "dashboard": {"type": "string", "enum": ["procurement", "financial", "leadership", "vendor", "utilization"]},
            "company_code": {"type": "string", "description": "1001, 1002, 1003, or ALL", "default": "ALL"},
        },
        "required": ["dashboard"],
    },
    executor=get_kpis,
    manifest_hint="kpi",
))

register(Tool(
    name="find_document",
    description="Find full P2P chain details for a PO, PR, GRN, or Invoice number.",
    parameters={
        "type": "object",
        "properties": {
            "doc_type": {"type": "string", "enum": ["PO", "PR", "GRN", "INVOICE"]},
            "doc_number": {"type": "string"},
        },
        "required": ["doc_type", "doc_number"],
    },
    executor=find_document,
    manifest_hint="doc",
))

register(Tool(
    name="get_anomalies",
    description="Get all procurement anomaly flag counts and summary stats from process mining events.",
    parameters={"type": "object", "properties": {}},
    executor=get_anomalies,
    manifest_hint="anomaly",
))

register(Tool(
    name="get_vendor_info",
    description="Get vendor spend, PO count, block status. Omit vendor_id for top 20 by spend.",
    parameters={
        "type": "object",
        "properties": {"vendor_id": {"type": "string", "description": "Optional vendor ID"}},
    },
    executor=get_vendor_info,
    manifest_hint="vendor",
))

register(Tool(
    name="get_p2p_stage_summary",
    description="Get P2P pipeline document counts and average days per stage (PR->PO->GRN->Invoice->Payment).",
    parameters={"type": "object", "properties": {}},
    executor=get_p2p_stage_summary,
    manifest_hint="p2p",
))
