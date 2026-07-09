"""P2P router — lifecycle, events, anomalies, stage-summary."""
from fastapi import APIRouter, Query
from typing import Optional

from database import get_connection

router = APIRouter()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _where_filters(
    date_from: Optional[str],
    date_to: Optional[str],
    vendor: Optional[str],
    plant: Optional[str],
    purchasing_group: Optional[str],
    table_alias: str = "f",
) -> tuple[str, list]:
    """Build WHERE clause fragments and bind values for fact-table filters."""
    clauses, vals = [], []
    if date_from:
        clauses.append(f"{table_alias}.po_document_date >= ?")
        vals.append(date_from)
    if date_to:
        clauses.append(f"{table_alias}.po_document_date <= ?")
        vals.append(date_to)
    if vendor:
        clauses.append(f"{table_alias}.vendor = ?")
        vals.append(vendor)
    if plant:
        clauses.append(f"{table_alias}.plant = ?")
        vals.append(plant)
    if purchasing_group:
        clauses.append(f"{table_alias}.purchasing_group = ?")
        vals.append(purchasing_group)
    where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
    return where, vals


# ── /p2p/filter-options ────────────────────────────────────────────────────────

@router.get("/p2p/filter-options")
def get_filter_options():
    conn = get_connection()
    vendors = conn.execute(
        "SELECT DISTINCT vendor, COALESCE(vendor_name, vendor) AS name FROM po_dump "
        "WHERE vendor IS NOT NULL ORDER BY name LIMIT 200"
    ).fetchall()
    plants = conn.execute(
        "SELECT DISTINCT plant FROM po_dump WHERE plant IS NOT NULL ORDER BY plant"
    ).fetchall()
    pgroups = conn.execute(
        "SELECT DISTINCT purchasing_group FROM po_dump WHERE purchasing_group IS NOT NULL ORDER BY purchasing_group"
    ).fetchall()
    anomaly_codes = conn.execute(
        "SELECT DISTINCT anomaly_flags FROM process_mining_events "
        "WHERE anomaly_flags IS NOT NULL AND anomaly_flags != ''"
    ).fetchall()
    codes: set[str] = set()
    for row in anomaly_codes:
        for c in str(row[0]).split(","):
            c = c.strip()
            if c:
                codes.add(c)
    return {
        "vendors":          [{"value": r[0], "label": r[1]} for r in vendors],
        "plants":           [r[0] for r in plants],
        "purchasing_groups":[r[0] for r in pgroups],
        "anomaly_codes":    sorted(codes),
    }


# ── /p2p/stage-summary ────────────────────────────────────────────────────────

STAGE_THRESHOLDS = {
    "PR_TO_PO":    (5,  10),
    "PO_TO_GRN":  (30, 45),
    "GRN_TO_INV": (7,  15),
    "INV_TO_PAY": (30, 60),
}


def _rag(days, green_max, amber_max):
    if days is None:
        return "grey"
    days = abs(days)  # backdated POs give negative values
    if days <= green_max:
        return "green"
    if days <= amber_max:
        return "amber"
    return "red"


@router.get("/p2p/stage-summary")
def get_stage_summary(
    date_from:        Optional[str] = Query(None),
    date_to:          Optional[str] = Query(None),
    vendor:           Optional[str] = Query(None),
    plant:            Optional[str] = Query(None),
    purchasing_group: Optional[str] = Query(None),
):
    conn = get_connection()
    where, vals = _where_filters(date_from, date_to, vendor, plant, purchasing_group)

    sql = f"""
        SELECT
            COUNT(*)                                                         AS total,
            COUNT(CASE WHEN f.purchase_requisition IS NOT NULL
                            AND f.purchase_requisition != '' THEN 1 END)    AS has_pr,
            COUNT(CASE WHEN f.pr_release_date IS NOT NULL THEN 1 END)       AS pr_approved,
            COUNT(CASE WHEN f.purchasing_document IS NOT NULL THEN 1 END)   AS has_po,
            COUNT(CASE WHEN f.po_release_indicator = 'X' THEN 1 END)        AS po_approved,
            COUNT(CASE WHEN f.grn_posting_date IS NOT NULL THEN 1 END)      AS has_grn,
            COUNT(CASE WHEN f.invoice_posting_date IS NOT NULL THEN 1 END)  AS has_invoice,
            ROUND(AVG(CASE WHEN f.pr_to_po_days IS NOT NULL
                                AND f.pr_to_po_days >= 0
                           THEN f.pr_to_po_days::numeric END), 1)           AS avg_pr_to_po,
            ROUND(AVG(CASE WHEN f.po_to_grn_days > 0
                           THEN f.po_to_grn_days::numeric END), 1)          AS avg_po_to_grn,
            ROUND(AVG(CASE WHEN f.grn_to_invoice_days > 0
                           THEN f.grn_to_invoice_days::numeric END), 1)     AS avg_grn_to_inv,
            ROUND(AVG(CASE WHEN f.invoice_to_payment_days IS NOT NULL
                           THEN f.invoice_to_payment_days::numeric END), 1) AS avg_inv_to_pay,
            ROUND(AVG(CASE WHEN f.total_cycle_days > 0
                           THEN f.total_cycle_days::numeric END), 1)        AS avg_total,
            COUNT(CASE WHEN f.is_maverick = 1 THEN 1 END)                   AS maverick_count,
            COUNT(CASE WHEN f.has_grn_return = 1 THEN 1 END)                AS grn_returns,
            COUNT(CASE WHEN f.has_credit_memo = 1 THEN 1 END)               AS credit_memos
        FROM pr_po_grn_invoice f
        {where}
    """
    r = conn.execute(sql, vals).fetchone()
    if not r:
        return {"stages": [], "summary": {}}

    (total, has_pr, pr_approved, has_po, po_approved,
     has_grn, has_invoice,
     avg_pr_po, avg_po_grn, avg_grn_inv, avg_inv_pay,
     avg_total, maverick, grn_ret, credit_memo) = r

    # Payment count from payment_dump (filtered by vendor if applicable)
    pay_sql = "SELECT COUNT(DISTINCT payment_doc) FROM payment_dump"
    pay_vals: list = []
    if vendor:
        pay_sql += " WHERE vendor = ?"
        pay_vals.append(vendor)
    payment_count = conn.execute(pay_sql, pay_vals).fetchone()[0] or 0

    stages = [
        {
            "id":         "PR_CREATED",
            "label":      "PR Created",
            "icon":       "file-plus",
            "count":      has_pr,
            "conversion": round(has_pr / total * 100, 1) if total else 0,
            "avg_days_to_next": avg_pr_po,
            "next_label": "PR → PO",
            "rag":        _rag(avg_pr_po, *STAGE_THRESHOLDS["PR_TO_PO"]),
        },
        {
            "id":         "PR_APPROVED",
            "label":      "PR Approved",
            "icon":       "check-square",
            "count":      pr_approved,
            "conversion": round(pr_approved / total * 100, 1) if total else 0,
            "avg_days_to_next": None,
            "next_label": None,
            "rag":        "green",
        },
        {
            "id":         "PO_CREATED",
            "label":      "PO Created",
            "icon":       "shopping-cart",
            "count":      has_po,
            "conversion": round(has_po / total * 100, 1) if total else 0,
            "avg_days_to_next": avg_po_grn,
            "next_label": "PO → GRN",
            "rag":        _rag(avg_po_grn, *STAGE_THRESHOLDS["PO_TO_GRN"]),
        },
        {
            "id":         "PO_APPROVED",
            "label":      "PO Approved",
            "icon":       "clipboard-check",
            "count":      po_approved,
            "conversion": round(po_approved / has_po * 100, 1) if has_po else 0,
            "avg_days_to_next": None,
            "next_label": None,
            "rag":        "green",
        },
        {
            "id":         "GRN_POSTED",
            "label":      "GRN Posted",
            "icon":       "package",
            "count":      has_grn,
            "conversion": round(has_grn / has_po * 100, 1) if has_po else 0,
            "avg_days_to_next": avg_grn_inv,
            "next_label": "GRN → Invoice",
            "rag":        _rag(avg_grn_inv, *STAGE_THRESHOLDS["GRN_TO_INV"]),
        },
        {
            "id":         "INVOICE_POSTED",
            "label":      "Invoice Posted",
            "icon":       "file-text",
            "count":      has_invoice,
            "conversion": round(has_invoice / has_grn * 100, 1) if has_grn else 0,
            "avg_days_to_next": avg_inv_pay,
            "next_label": "Invoice → Payment",
            "rag":        _rag(avg_inv_pay, *STAGE_THRESHOLDS["INV_TO_PAY"]),
        },
        {
            "id":         "PAYMENT_MADE",
            "label":      "Payment Made",
            "icon":       "banknote",
            "count":      payment_count,
            "conversion": round(payment_count / has_invoice * 100, 1) if has_invoice else 0,
            "avg_days_to_next": None,
            "next_label": None,
            "rag":        "green",
        },
    ]

    # Monthly stage funnel (last 12 months)
    monthly_funnel = conn.execute(f"""
        SELECT
            LEFT(f.po_document_date, 7) AS month,
            COUNT(*) AS po,
            COUNT(CASE WHEN f.grn_posting_date IS NOT NULL THEN 1 END) AS grn,
            COUNT(CASE WHEN f.invoice_posting_date IS NOT NULL THEN 1 END) AS inv
        FROM pr_po_grn_invoice f
        WHERE f.po_document_date IS NOT NULL
        {('AND ' + ' AND '.join(_where_filters(date_from, date_to, vendor, plant, purchasing_group)[0].replace('WHERE ','').split(' AND '))) if vals else ''}
        GROUP BY month ORDER BY month
    """).fetchall()

    # Simplified: just use the base counts without complex filter re-injection
    monthly_funnel = conn.execute(f"""
        SELECT LEFT(po_document_date, 7) AS month,
               COUNT(*) AS po_count,
               COUNT(CASE WHEN grn_posting_date IS NOT NULL THEN 1 END) AS grn_count,
               COUNT(CASE WHEN invoice_posting_date IS NOT NULL THEN 1 END) AS inv_count
        FROM pr_po_grn_invoice
        WHERE po_document_date IS NOT NULL
        GROUP BY month ORDER BY month
    """).fetchall()

    return {
        "stages": stages,
        "summary": {
            "total_cases":   total,
            "avg_cycle_days": avg_total,
            "maverick_count": maverick,
            "grn_returns":   grn_ret,
            "credit_memos":  credit_memo,
            "payment_count": payment_count,
        },
        "monthly_funnel": [
            {"month": r[0], "po": r[1], "grn": r[2], "invoice": r[3]}
            for r in monthly_funnel
        ],
    }


# ── /p2p/lifecycle ────────────────────────────────────────────────────────────

@router.get("/p2p/lifecycle")
def get_lifecycle():
    conn = get_connection()
    stage_counts = conn.execute("""
        SELECT
            COUNT(*) AS total,
            COUNT(CASE WHEN purchase_requisition IS NOT NULL THEN 1 END) AS has_pr,
            COUNT(CASE WHEN purchasing_document  IS NOT NULL THEN 1 END) AS has_po,
            COUNT(CASE WHEN grn_posting_date     IS NOT NULL THEN 1 END) AS has_grn,
            COUNT(CASE WHEN invoice_posting_date IS NOT NULL THEN 1 END) AS has_invoice,
            AVG(pr_to_po_days)        AS avg_pr_to_po,
            AVG(po_to_grn_days)       AS avg_po_to_grn,
            AVG(grn_to_invoice_days)  AS avg_grn_to_invoice,
            AVG(total_cycle_days)     AS avg_total_cycle
        FROM pr_po_grn_invoice
    """).fetchone()
    variant_counts = conn.execute("""
        SELECT variant_class, COUNT(*) AS count
        FROM process_mining_events
        GROUP BY variant_class ORDER BY count DESC
    """).fetchall()
    return {
        "stage_counts": dict(stage_counts) if stage_counts else {},
        "variants": [dict(r) for r in variant_counts],
    }


# ── /p2p/events ───────────────────────────────────────────────────────────────

@router.get("/p2p/events")
def get_events(
    limit:         int           = Query(50, ge=1, le=500),
    offset:        int           = Query(0, ge=0),
    variant_class: Optional[str] = Query(None),
    anomaly:       Optional[str] = Query(None),
    vendor:        Optional[str] = Query(None),
    plant:         Optional[str] = Query(None),
):
    conn = get_connection()
    clauses, vals = ["1=1"], []

    if variant_class:
        clauses.append("pme.variant_class = ?")
        vals.append(variant_class)
    if anomaly:
        clauses.append("pme.anomaly_flags LIKE ?")
        vals.append(f"%{anomaly}%")
    if vendor:
        clauses.append("pme.vendor = ?")
        vals.append(vendor)

    where = " AND ".join(clauses)

    # Join to fact table for plant filter
    if plant:
        base_sql = f"""
            SELECT pme.* FROM process_mining_events pme
            JOIN pr_po_grn_invoice f ON pme.purchasing_document = f.purchasing_document
            WHERE {where} AND f.plant = ?
        """
        vals.append(plant)
        count_sql = f"""
            SELECT COUNT(*) FROM process_mining_events pme
            JOIN pr_po_grn_invoice f ON pme.purchasing_document = f.purchasing_document
            WHERE {where} AND f.plant = ?
        """
    else:
        base_sql = f"SELECT pme.* FROM process_mining_events pme WHERE {where}"
        count_sql = f"SELECT COUNT(*) FROM process_mining_events pme WHERE {where}"

    total = conn.execute(count_sql, vals).fetchone()[0]
    rows  = conn.execute(base_sql + f" LIMIT {limit} OFFSET {offset}", vals).fetchall()

    return {
        "total": total, "offset": offset, "limit": limit,
        "events": [dict(r) for r in rows],
    }


# ── /p2p/po-deletions ─────────────────────────────────────────────────────────

@router.get("/p2p/po-deletions")
def get_po_deletions(limit: int = Query(20, ge=1, le=100)):
    conn = get_connection()
    rows = conn.execute("""
        SELECT po.purchasing_document, po.item, po.vendor, po.vendor_name,
               po.material_description, po.material_group, po.net_order_value,
               po.document_date, po.created_by, po.deletion_indicator,
               pme.anomaly_flags
        FROM po_dump po
        LEFT JOIN process_mining_events pme
          ON po.purchasing_document = pme.purchasing_document AND po.item = pme.item
        WHERE po.deletion_indicator = 'L'
        ORDER BY po.document_date DESC LIMIT ?
    """, (limit,)).fetchall()
    return [dict(r) for r in rows]


# ── /p2p/anomalies ────────────────────────────────────────────────────────────

@router.get("/p2p/anomalies")
def get_anomalies():
    conn = get_connection()
    from services.event_generator import ANOMALY_CODES
    rows = conn.execute(
        "SELECT anomaly_flags FROM process_mining_events "
        "WHERE anomaly_flags IS NOT NULL AND anomaly_flags != ''"
    ).fetchall()
    counts: dict[str, int] = {}
    for row in rows:
        for code in str(row[0]).split(","):
            code = code.strip()
            if code:
                counts[code] = counts.get(code, 0) + 1
    result = []
    for code, count in sorted(counts.items(), key=lambda x: -x[1]):
        severity, description = ANOMALY_CODES.get(code, ("LOW", code))
        result.append({
            "anomaly_code": code, "count": count,
            "severity": severity, "description": description,
        })
    return result


# ── /p2p/anomaly-detail ───────────────────────────────────────────────────────

@router.get("/p2p/anomaly-detail")
def get_anomaly_detail(
    code:  str = Query(..., description="Anomaly code e.g. MAVERICK_BUY"),
    limit: int = Query(default=50, le=200),
):
    if not code or len(code) > 60:
        raise HTTPException(400, "Invalid anomaly code")

    conn = get_connection()

    # Step 1: get PO numbers with this anomaly from PME (indexed anomaly_flags LIKE)
    pme_rows = conn.execute(
        """
        SELECT DISTINCT purchasing_document, vendor, purchase_requisition, anomaly_flags
        FROM process_mining_events
        WHERE anomaly_flags LIKE ?
        LIMIT ?
        """,
        (f"%{code}%", limit),
    ).fetchall()

    if not pme_rows:
        return []

    # Step 2: look up PO details for those specific PO numbers (point lookups via index)
    po_nums = list({r[0] for r in pme_rows if r[0]})
    placeholders = ", ".join("?" * len(po_nums))
    po_rows = conn.execute(
        f"""
        SELECT DISTINCT ON (purchasing_document)
            purchasing_document,
            COALESCE(vendor_name, vendor) AS vendor_name,
            CAST(COALESCE(NULLIF(net_order_value,''),'0') AS REAL) AS net_order_value,
            document_date,
            material_description,
            material_group,
            company_code,
            created_by
        FROM po_dump
        WHERE purchasing_document IN ({placeholders})
        ORDER BY purchasing_document
        """,
        po_nums,
    ).fetchall()

    po_map = {r[0]: r for r in po_rows}

    result = []
    for pme in pme_rows:
        po_num = pme[0]
        po = po_map.get(po_num)
        result.append({
            "purchasing_document":  po_num,
            "vendor":               pme[1],
            "purchase_requisition": pme[2],
            "anomaly_flags":        pme[3],
            "vendor_name":          po[1] if po else None,
            "net_order_value":      po[2] if po else None,
            "document_date":        po[3] if po else None,
            "material_description": po[4] if po else None,
            "material_group":       po[5] if po else None,
            "company_code":         po[6] if po else None,
            "created_by":           po[7] if po else None,
        })
    return result


# ── /p2p/find ─────────────────────────────────────────────────────────────────

@router.get("/p2p/find")
def find_document(
    doc_type:   str = Query(..., description="PO | PR | GRN | INVOICE"),
    doc_number: str = Query(...),
):
    conn = get_connection()
    dt = doc_type.upper().strip()

    if dt == "PO":
        fact_rows = conn.execute(
            "SELECT * FROM pr_po_grn_invoice WHERE purchasing_document = ? LIMIT 20",
            (doc_number,),
        ).fetchall()
    elif dt == "PR":
        fact_rows = conn.execute(
            "SELECT * FROM pr_po_grn_invoice WHERE purchase_requisition = ? LIMIT 20",
            (doc_number,),
        ).fetchall()
    elif dt == "GRN":
        po_row = conn.execute(
            "SELECT purchasing_document FROM grn_dump WHERE mat_doc = ? LIMIT 1",
            (doc_number,),
        ).fetchone()
        if not po_row:
            return {"found": False, "doc_type": dt, "doc_number": doc_number, "chain": []}
        fact_rows = conn.execute(
            "SELECT * FROM pr_po_grn_invoice WHERE purchasing_document = ? LIMIT 20",
            (po_row[0],),
        ).fetchall()
    elif dt == "INVOICE":
        po_row = conn.execute(
            "SELECT purchasing_document FROM po_invoice_dump WHERE invoice_doc = ? LIMIT 1",
            (doc_number,),
        ).fetchone()
        if not po_row:
            return {"found": False, "doc_type": dt, "doc_number": doc_number, "chain": []}
        fact_rows = conn.execute(
            "SELECT * FROM pr_po_grn_invoice WHERE purchasing_document = ? LIMIT 20",
            (po_row[0],),
        ).fetchall()
    else:
        return {"found": False, "doc_type": dt, "doc_number": doc_number, "chain": []}

    if not fact_rows:
        return {"found": False, "doc_type": dt, "doc_number": doc_number, "chain": []}

    chain = [
        {
            "purchase_requisition":    r["purchase_requisition"],
            "item_of_requisition":     r["item_of_requisition"],
            "pr_release_date":         r["pr_release_date"],
            "purchasing_document":     r["purchasing_document"],
            "item":                    r["item"],
            "vendor":                  r["vendor"],
            "vendor_name":             r["vendor_name"],
            "material_description":    r["material_description"],
            "company_code":            r["company_code"],
            "po_net_value":            r["po_net_value"],
            "po_document_date":        r["po_document_date"],
            "grn_posting_date":        r["grn_posting_date"],
            "grn_quantity":            r["grn_quantity"],
            "grn_amount":              r["grn_amount"],
            "invoice_posting_date":    r["invoice_posting_date"],
            "invoice_amount":          r["invoice_amount"],
            "pr_to_po_days":           r["pr_to_po_days"],
            "po_to_grn_days":          r["po_to_grn_days"],
            "grn_to_invoice_days":     r["grn_to_invoice_days"],
            "invoice_to_payment_days": r["invoice_to_payment_days"],
            "is_maverick":             r["is_maverick"],
        }
        for r in fact_rows
    ]
    return {"found": True, "doc_type": dt, "doc_number": doc_number, "chain": chain}


# ── /p2p/stage-records ────────────────────────────────────────────────────────

_STAGE_FILTERS = {
    "PR_CREATED":    "purchase_requisition IS NOT NULL AND purchase_requisition != ''",
    "PR_APPROVED":   "pr_release_date IS NOT NULL AND pr_release_date != ''",
    "PO_CREATED":    "purchasing_document IS NOT NULL AND purchasing_document != ''",
    "PO_APPROVED":   "po_release_indicator = 'X'",
    "GRN_POSTED":    "grn_posting_date IS NOT NULL AND grn_posting_date != ''",
    "INVOICE_POSTED":"invoice_posting_date IS NOT NULL AND invoice_posting_date != ''",
    "PAYMENT_MADE":  "invoice_to_payment_days IS NOT NULL",
}


@router.get("/p2p/stage-records")
def get_stage_records(stage: str = Query(...), limit: int = Query(50, le=200)):
    conn = get_connection()
    where = _STAGE_FILTERS.get(stage.upper(), "1=1")
    rows = conn.execute(f"""
        SELECT purchase_requisition, item_of_requisition,
               purchasing_document, item,
               vendor, vendor_name, material_description, material_group, company_code,
               po_document_date, po_net_value,
               grn_posting_date, grn_quantity, grn_amount,
               invoice_posting_date, invoice_amount,
               pr_to_po_days, po_to_grn_days, grn_to_invoice_days, invoice_to_payment_days,
               is_maverick
        FROM pr_po_grn_invoice
        WHERE {where}
        ORDER BY po_document_date DESC NULLS LAST
        LIMIT {limit}
    """).fetchall()
    return [dict(r) for r in rows]
