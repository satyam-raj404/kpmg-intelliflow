"""KPI router — dashboard KPIs, charts, and kpi_config management."""
import re
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from database import get_connection
from services.kpi_engine import compute_all, compute_chart_data
from services.audit import write_audit

router = APIRouter()

VALID_DASHBOARDS = {"procurement", "financial", "leadership", "vendor", "utilization"}


# ── Dashboard KPIs ─────────────────────────────────────────────────────────────

@router.get("/kpi/{dashboard}/companies")
def get_kpi_companies(dashboard: str):
    """Return distinct company_codes available for a dashboard."""
    if dashboard not in VALID_DASHBOARDS:
        raise HTTPException(404, f"Dashboard '{dashboard}' not found.")
    conn = get_connection()
    rows = conn.execute(
        "SELECT DISTINCT company_code FROM kpi_results WHERE dashboard = ? ORDER BY company_code",
        (dashboard,),
    ).fetchall()
    return {"dashboard": dashboard, "companies": [r[0] for r in rows]}


@router.get("/kpi/{dashboard}")
def get_kpis(dashboard: str, company_code: str = Query(default="ALL")):
    if dashboard not in VALID_DASHBOARDS:
        raise HTTPException(404, f"Dashboard '{dashboard}' not found.")
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM kpi_results WHERE dashboard = ? AND company_code = ? ORDER BY kpi_code",
        (dashboard, company_code),
    ).fetchall()
    kpis = [dict(r) for r in rows]
    computed_at = kpis[0]["computed_at"] if kpis else None
    return {"dashboard": dashboard, "company_code": company_code, "computed_at": computed_at, "kpis": kpis}


@router.get("/charts/{dashboard}")
def get_charts(dashboard: str):
    if dashboard not in VALID_DASHBOARDS:
        raise HTTPException(404, f"Dashboard '{dashboard}' not found.")
    conn = get_connection()
    data = compute_chart_data(conn, dashboard)
    return {"dashboard": dashboard, "series": data}


# ── KPI Config ────────────────────────────────────────────────────────────────

@router.get("/kpi-config")
def get_kpi_config():
    """Return all kpi_config key-value pairs."""
    conn = get_connection()
    rows = conn.execute("SELECT config_key, config_value, description, updated_at FROM kpi_config").fetchall()
    return {"config": [dict(r) for r in rows]}


# ── Summary Detail Drill-Down ─────────────────────────────────────────────────

_VALID_SUMMARY_KEYS = frozenset({
    "approved_pr", "approved_po", "grn_lines", "invoice_lines", "payments",
    "po_without_pr", "one_time_vendors", "po_no_contract", "duplicate_invoices", "sod_conflicts",
})


def _cc(company_code: str, alias: str = "") -> str:
    col = f"{alias}.company_code" if alias else "company_code"
    return "1=1" if company_code == "ALL" else f"{col} = '{company_code}'"


@router.get("/summary-detail/{key}")
def get_summary_detail(key: str, company_code: str = Query(default="ALL"), limit: int = Query(default=15, ge=1, le=200)):
    if key not in _VALID_SUMMARY_KEYS:
        raise HTTPException(404, f"Unknown summary key: '{key}'")
    if company_code != "ALL" and not re.match(r"^[A-Za-z0-9_\-]+$", company_code):
        raise HTTPException(400, "Invalid company_code")

    cc = _cc(company_code)
    cc_po = _cc(company_code, "po")
    cc_grn = _cc(company_code, "grn")
    cc_inv = _cc(company_code, "i")

    queries: dict[str, tuple[str, list[str]]] = {
        "approved_pr": (
            f"SELECT DISTINCT purchase_requisition, item_of_requisition, vendor,"
            f" ROUND(CAST(valuation_price AS NUMERIC), 2) AS price, release_date, created_by"
            f" FROM pr_dump WHERE release_status IN ('X','XX','XXX','XXXX','XXXXX') AND {cc}"
            f" ORDER BY release_date DESC NULLS LAST LIMIT 15",
            ["PR Number", "Item", "Vendor", "Price (₹)", "Release Date", "Created By"],
        ),
        "approved_po": (
            f"SELECT DISTINCT purchasing_document, vendor_name,"
            f" ROUND(CAST(net_order_value AS NUMERIC), 2) AS value, document_date, created_by"
            f" FROM po_dump WHERE release_indicator='X'"
            f" AND (deletion_indicator IS NULL OR deletion_indicator='') AND {cc}"
            f" ORDER BY document_date DESC NULLS LAST LIMIT 15",
            ["PO Number", "Vendor", "Value (₹)", "Date", "Created By"],
        ),
        "grn_lines": (
            f"SELECT purchasing_document, material_document, vendor,"
            f" ROUND(CAST(amount_local_ccy AS NUMERIC), 2) AS amount, posting_date, created_by"
            f" FROM grn_dump WHERE debit_credit_ind='S' AND {cc}"
            f" ORDER BY posting_date DESC NULLS LAST LIMIT 15",
            ["PO Number", "GRN Doc", "Vendor", "Amount (₹)", "Posting Date", "Created By"],
        ),
        "invoice_lines": (
            f"SELECT invoice_doc, vendor,"
            f" ROUND(CAST(amount_local_ccy AS NUMERIC), 2) AS amount,"
            f" document_type, posting_date, due_date"
            f" FROM invoice_dump"
            f" WHERE document_type IN ('RE','KR') AND CAST(amount_local_ccy AS REAL) > 0 AND {cc}"
            f" ORDER BY posting_date DESC NULLS LAST LIMIT 15",
            ["Invoice", "Vendor", "Amount (₹)", "Type", "Posting Date", "Due Date"],
        ),
        "payments": (
            f"SELECT payment_doc, vendor,"
            f" ROUND(CAST(amount_local_ccy AS NUMERIC), 2) AS amount,"
            f" payment_method, posting_date, cleared_invoice"
            f" FROM payment_dump WHERE {cc}"
            f" ORDER BY posting_date DESC NULLS LAST LIMIT 15",
            ["Payment Doc", "Vendor", "Amount (₹)", "Method", "Posting Date", "Invoice"],
        ),
        "po_without_pr": (
            f"SELECT DISTINCT purchasing_document, vendor_name,"
            f" ROUND(CAST(net_order_value AS NUMERIC), 2) AS value, document_date, created_by"
            f" FROM po_dump"
            f" WHERE (purchase_requisition IS NULL OR purchase_requisition='')"
            f" AND (deletion_indicator IS NULL OR deletion_indicator='') AND {cc}"
            f" ORDER BY document_date DESC NULLS LAST LIMIT 15",
            ["PO Number", "Vendor", "Value (₹)", "Date", "Created By"],
        ),
        "one_time_vendors": (
            f"SELECT vendor, vendor_name, company_code, vendor_type, msme_flag"
            f" FROM vendor_master WHERE UPPER(vendor_type)='ONE_TIME' AND {cc}"
            f" ORDER BY vendor LIMIT 15",
            ["Vendor Code", "Vendor Name", "Company", "Type", "MSME"],
        ),
        "po_no_contract": (
            f"SELECT DISTINCT purchasing_document, vendor_name,"
            f" ROUND(CAST(net_order_value AS NUMERIC), 2) AS value, document_date, created_by"
            f" FROM po_dump"
            f" WHERE (contract_number IS NULL OR contract_number='')"
            f" AND (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X')) AND {cc}"
            f" ORDER BY document_date DESC NULLS LAST LIMIT 15",
            ["PO Number", "Vendor", "Value (₹)", "Date", "Created By"],
        ),
        "duplicate_invoices": (
            f"SELECT vendor, vendor_invoice_ref,"
            f" ROUND(CAST(amount_local_ccy AS NUMERIC), 2) AS amount,"
            f" COUNT(*) AS dup_count, MIN(posting_date) AS first_date"
            f" FROM invoice_dump"
            f" WHERE vendor_invoice_ref IS NOT NULL AND vendor_invoice_ref <> ''"
            f" AND CAST(amount_local_ccy AS REAL) > 0 AND {cc}"
            f" GROUP BY vendor, vendor_invoice_ref, amount_local_ccy"
            f" HAVING COUNT(*) > 1"
            f" ORDER BY dup_count DESC LIMIT 15",
            ["Vendor", "Invoice Ref", "Amount (₹)", "Duplicates", "First Date"],
        ),
        "sod_conflicts": (
            f"SELECT doc, sod_type, vendor, conflicting_user, date FROM ("
            f" SELECT DISTINCT po.purchasing_document AS doc, 'PO-Release' AS sod_type,"
            f"  COALESCE(po.vendor_name, po.vendor, '') AS vendor,"
            f"  po.created_by AS conflicting_user, po.document_date AS date"
            f" FROM po_dump po"
            f" JOIN change_log cl ON cl.object_id = po.purchasing_document"
            f" WHERE cl.object_class = 'EINKBELEG' AND cl.table_name = 'EKKO'"
            f"  AND cl.field_name = 'FRGZU' AND cl.change_indicator IN ('E','U')"
            f"  AND cl.new_value = 'X' AND cl.username = po.created_by"
            f"  AND (po.deletion_indicator IS NULL OR po.deletion_indicator = '') AND {cc_po}"
            f" UNION ALL"
            f" SELECT DISTINCT po.purchasing_document, 'PO-GRN',"
            f"  COALESCE(po.vendor_name, po.vendor, ''), po.created_by, po.document_date"
            f" FROM po_dump po"
            f" JOIN grn_dump grn ON grn.purchasing_document = po.purchasing_document AND grn.item = po.item"
            f" WHERE po.created_by = grn.created_by"
            f"  AND (po.deletion_indicator IS NULL OR po.deletion_indicator = '')"
            f"  AND grn.debit_credit_ind = 'S' AND {cc_po}"
            f" UNION ALL"
            f" SELECT DISTINCT grn.purchasing_document, 'GRN-Invoice',"
            f"  COALESCE(grn.vendor, ''), grn.created_by, grn.posting_date"
            f" FROM grn_dump grn"
            f" JOIN po_invoice_dump inv ON inv.purchasing_document = grn.purchasing_document AND inv.item = grn.item"
            f" WHERE grn.created_by = inv.created_by"
            f"  AND grn.debit_credit_ind = 'S' AND inv.debit_credit_ind = 'S' AND {cc_grn}"
            f" UNION ALL"
            f" SELECT DISTINCT i.invoice_doc, 'Invoice-Payment',"
            f"  COALESCE(i.vendor, ''), i.created_by, i.posting_date"
            f" FROM invoice_dump i"
            f" JOIN payment_dump p ON p.company_code = i.company_code AND p.vendor = i.vendor AND p.cleared_invoice = i.invoice_doc"
            f" WHERE i.created_by = p.created_by AND i.document_type IN ('RE','KR')"
            f"  AND (i.reverse_invoice IS NULL OR i.reverse_invoice = '')"
            f"  AND i.invoice_doc NOT IN ("
            f"   SELECT DISTINCT reverse_invoice FROM invoice_dump"
            f"   WHERE reverse_invoice IS NOT NULL AND reverse_invoice != ''"
            f"  ) AND p.debit_credit_ind = 'S' AND {cc_inv}"
            f") t ORDER BY date DESC NULLS LAST LIMIT 15",
            ["Document", "SOD Type", "Vendor", "Conflicting User", "Date"],
        ),
    }

    sql, columns = queries[key]
    sql = re.sub(r'LIMIT\s+\d+\s*$', f'LIMIT {limit}', sql.rstrip())
    conn = get_connection()
    try:
        rows = conn.execute(sql).fetchall()
    except Exception as exc:
        raise HTTPException(500, f"Query failed: {exc}")

    return {
        "key": key,
        "columns": columns,
        "rows": [[str(v) if v is not None else "" for v in dict(r).values()] for r in rows],
        "count": len(rows),
    }


class ConfigUpdate(BaseModel):
    value: str


@router.put("/kpi-config/{key}")
def update_kpi_config(key: str, body: ConfigUpdate):
    """Update a single kpi_config value and re-run all KPIs."""
    conn = get_connection()
    existing = conn.execute(
        "SELECT config_key FROM kpi_config WHERE config_key = ?", (key,)
    ).fetchone()
    if not existing:
        raise HTTPException(404, f"Config key '{key}' not found.")

    conn.execute(
        "UPDATE kpi_config SET config_value = ?, updated_at = NOW()::TEXT WHERE config_key = ?",
        (body.value, key),
    )
    conn.commit()

    # Re-compute all KPIs with the new threshold
    compute_all(conn)
    write_audit(
        user_id="admin",
        action="KPI_CONFIG_UPDATED",
        entity_type="KPI_CONFIG",
        entity_id=key,
        details=f"new_value={body.value}",
    )
    return {"config_key": key, "config_value": body.value, "status": "updated"}
