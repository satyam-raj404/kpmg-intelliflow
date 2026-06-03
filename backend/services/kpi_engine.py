"""Step 6 — Compute all KPIs and store in kpi_results.
KPI formulas follow IntelliSource_P2P_Reference_Schema_2 definitions exactly.
"""
import json
import sqlite3
from datetime import datetime, date


IT_MATERIAL_GROUPS_SQL = "('IT','CLOUD','LICENSE','SOFTWARE','SAAS','9904','9905')"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_config(conn: sqlite3.Connection, key: str, default: str) -> str:
    row = conn.execute(
        "SELECT config_value FROM kpi_config WHERE config_key = ?", (key,)
    ).fetchone()
    return row[0] if row else default


def _get_ref_date(conn: sqlite3.Connection) -> str:
    """Latest document_date in po_dump. Falls back to today."""
    row = conn.execute(
        "SELECT MAX(document_date) FROM po_dump WHERE document_date IS NOT NULL AND document_date != ''"
    ).fetchone()
    return row[0] if (row and row[0]) else datetime.utcnow().strftime("%Y-%m-%d")


def _build_periods(ref_date: str) -> tuple[str, str]:
    """(FY_START_SQL, MTD_START_SQL) based on ref_date and FY_START_MONTH config."""
    d = date.fromisoformat(ref_date)
    # Indian FY: April 1
    fy_start_year = d.year if d.month >= 4 else d.year - 1
    return f"'{fy_start_year}-04-01'", f"'{d.year}-{d.month:02d}-01'"


def _run(conn: sqlite3.Connection, sql: str) -> float | None:
    try:
        r = conn.execute(sql).fetchone()
        return float(r[0]) if r and r[0] is not None else None
    except Exception:
        return None


def _run_text(conn: sqlite3.Connection, sql: str) -> str | None:
    try:
        r = conn.execute(sql).fetchone()
        return str(r[0]) if r and r[0] is not None else None
    except Exception:
        return None


def _upsert(conn, dashboard, kpi_code, kpi_name, value_numeric, value_text, unit, trend=None):
    conn.execute("""
        INSERT INTO kpi_results
            (dashboard, kpi_code, kpi_name, value_numeric, value_text, unit, trend, computed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(kpi_code) DO UPDATE SET
            value_numeric = excluded.value_numeric,
            value_text    = excluded.value_text,
            trend         = excluded.trend,
            computed_at   = excluded.computed_at
    """, (dashboard, kpi_code, kpi_name, value_numeric, value_text, unit, trend))


# ── PROCUREMENT ───────────────────────────────────────────────────────────────

def _procurement(conn, FY, MTD, high_value_threshold, ref_date="2023-03-31"):

    # P1 — Total PO Value MTD
    # Formula: SUM(net_order_value) WHERE creation date in current month AND deletion_indicator != 'L'
    # Uses COALESCE(created_on, document_date) — created_on=ERDAT preferred; document_date=BEDAT fallback
    p1 = _run(conn, f"""
        SELECT SUM(CAST(net_order_value AS REAL))
        FROM po_dump
        WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))
          AND COALESCE(NULLIF(created_on,''), document_date) >= {MTD}
    """)
    _upsert(conn, "procurement", "TOTAL_PO_VALUE_MTD", "Total PO Value (MTD)", p1, None, "INR")

    # P2 — Active PO Count: DISTINCT purchasing_document, no date filter, not delivery-complete, not deleted
    # Spec: COUNT(DISTINCT purchasing_document) WHERE delivery_completed != 'X' AND deletion_indicator != 'L'
    p2 = _run(conn, """
        SELECT COUNT(DISTINCT purchasing_document)
        FROM po_dump
        WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))
          AND (delivery_completed IS NULL OR delivery_completed = '')
    """)
    _upsert(conn, "procurement", "ACTIVE_PO_COUNT", "Active PO Count", p2, None, "count")

    # P3 — High-Value PO Count (threshold from kpi_config — user-configurable)
    # Spec: COUNT(DISTINCT purchasing_document) WHERE net_order_value > threshold AND deletion_indicator != 'L'
    p3 = _run(conn, f"""
        SELECT COUNT(DISTINCT purchasing_document)
        FROM po_dump
        WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))
          AND CAST(net_order_value AS REAL) > {high_value_threshold}
    """)
    _upsert(conn, "procurement", "HIGH_VALUE_PO_COUNT",
            f"High-Value PO Count (>₹{int(high_value_threshold):,})", p3, None, "count")

    # P4 — Avg PR-to-PO Conversion Time
    # Join: PO ↔ PR on company_code + purchase_requisition + item_of_requisition (EKPO-BNFPO)
    # Formula: AVG(PO.created_on − PR.created_on) in days; both dates are ERDAT (SAP creation date), no fallback
    # Excludes: deleted PRs (EBAN-LOEKZ = 'X'), negative values, rows without a matched PR or PO
    p4 = _run(conn, """
        SELECT AVG(CAST(pr_to_po_days AS REAL))
        FROM pr_po_grn_invoice
        WHERE pr_to_po_days IS NOT NULL
          AND pr_to_po_days >= 0
          AND purchase_requisition IS NOT NULL
          AND purchasing_document  IS NOT NULL
    """)
    _upsert(conn, "procurement", "PR_TO_PO_DAYS", "Avg PR-to-PO Time (days)", p4, None, "days")

    # P5 — PO Approval Cycle Time: PO creation (EKKO-ERDAT) → release via change_log FRGZU
    # field_name = 'FRGZU' only (FRGKE excluded — not a reliable release indicator)
    # change_indicator IN ('E','U') — E=initial entry, U=update; both valid release events
    # new_value LIKE 'X%' — covers single-level (X) and multi-level (XX, XXX...) release
    # release_indicator LIKE 'X%' on po_dump — same multi-level logic
    # Excludes deleted POs (EKKO-LOEKZ / EKPO-LOEKZ IN ('L','X'))
    p5 = _run(conn, """
        SELECT AVG(CAST(julianday(cl.change_date) - julianday(po.created_on) AS REAL))
        FROM po_dump po
        JOIN change_log cl
          ON cl.object_id        = po.purchasing_document
         AND cl.object_class     = 'EINKBELEG'
         AND cl.field_name       = 'FRGZU'
         AND cl.change_indicator IN ('E', 'U')
         AND cl.new_value        LIKE 'X%'
        WHERE po.release_indicator LIKE 'X%'
          AND (po.deletion_indicator IS NULL OR po.deletion_indicator NOT IN ('L', 'X'))
          AND po.created_on IS NOT NULL AND po.created_on != ''
    """)
    _upsert(conn, "procurement", "PO_APPROVAL_CYCLE", "PO Approval Cycle (days)", p5, None, "days")

    # P6 — PO Deletion Frequency MTD
    # Count at item level (purchasing_document + item) — deletion_indicator lives on EKPO (item), not header
    # Uses created_on (EKKO-ERDAT) not document_date (BEDAT) — measures when PO was created, not dated
    p6 = _run(conn, f"""
        SELECT COUNT(DISTINCT purchasing_document || '|' || item)
        FROM po_dump
        WHERE deletion_indicator = 'L'
          AND COALESCE(NULLIF(created_on,''), document_date) >= {MTD}
    """)
    _upsert(conn, "procurement", "PO_DELETION_MTD", "PO Deleted Line Items (MTD)", p6, None, "count")

    # P7 — PO Amendment Rate
    # Numerator: distinct PO line items (purchasing_document + item) with at least one change
    #   to MATNR / NETPR / NETWR / MENGE; change_indicator IN ('E','U')
    # Join: change_log → po_dump on object_id = purchasing_document + company_code via po_dump
    # Item match: CDPOS-TABKEY rightmost 5 chars (EBELP) stripped of leading zeros vs po_dump.item
    #   Fallback: when table_key IS NULL (not yet uploaded), all items of amended PO are counted
    # Denominator: all active PO line items (item level to match numerator grain)
    p7_amended = _run(conn, """
        SELECT COUNT(DISTINCT po.purchasing_document || '|' || po.item)
        FROM po_dump po
        JOIN change_log cl
          ON  cl.object_id        = po.purchasing_document
         AND  cl.object_class     = 'EINKBELEG'
         AND  cl.change_indicator IN ('E', 'U')
         AND  cl.field_name       IN ('MATNR', 'NETPR', 'NETWR', 'MENGE')
         AND  (
               cl.table_key IS NULL
               OR cl.table_key = ''
               OR CAST(SUBSTR(cl.table_key, -5) AS INTEGER) = CAST(po.item AS INTEGER)
              )
        WHERE (po.deletion_indicator IS NULL OR po.deletion_indicator NOT IN ('L', 'X'))
    """)
    p7_total = _run(conn, """
        SELECT COUNT(DISTINCT purchasing_document || '|' || item) FROM po_dump
        WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))
    """)
    p7 = round((p7_amended / p7_total * 100), 2) if p7_amended and p7_total else None
    _upsert(conn, "procurement", "PO_AMENDMENT_RATE", "PO Amendment Rate (%)", p7, None, "%")

    # P8 — Open PO Aging (overdue open PO line items, bucket distribution)
    # Open PO = delivery_completed blank + order_qty != delivered_qty + not deleted
    # Overdue = past po_delivery_dump.expected_delivery_date (EKET-EINDT)
    # Delay = julianday(ref_date) - julianday(expected_delivery_date)
    # ref_date used (not 'now') so historical datasets work correctly
    _OPEN_PO_WHERE = f"""
        FROM po_dump po
        JOIN po_delivery_dump pod
          ON pod.purchasing_document = po.purchasing_document
         AND pod.item                = po.item
        WHERE (po.delivery_completed IS NULL OR po.delivery_completed = '')
          AND (po.deletion_indicator IS NULL OR po.deletion_indicator NOT IN ('L', 'X'))
          AND CAST(po.order_quantity AS REAL) !=
              CAST(COALESCE(NULLIF(po.delivered_quantity, ''), '0') AS REAL)
          AND pod.expected_delivery_date IS NOT NULL AND pod.expected_delivery_date != ''
          AND julianday('{ref_date}') - julianday(pod.expected_delivery_date) > 0
    """

    p8 = _run(conn, f"""
        SELECT COUNT(DISTINCT po.purchasing_document || '|' || po.item)
        {_OPEN_PO_WHERE}
    """)
    _upsert(conn, "procurement", "OPEN_PO_AGING", "Open PO Line Items (Overdue)", p8, None, "count")

    # Bucket distribution stored as JSON for the bar chart
    try:
        bucket_row = conn.execute(f"""
            SELECT
                COUNT(DISTINCT CASE WHEN delay BETWEEN 1  AND 30  THEN key END),
                COUNT(DISTINCT CASE WHEN delay BETWEEN 31 AND 60  THEN key END),
                COUNT(DISTINCT CASE WHEN delay BETWEEN 61 AND 90  THEN key END),
                COUNT(DISTINCT CASE WHEN delay > 90               THEN key END)
            FROM (
                SELECT po.purchasing_document || '|' || po.item AS key,
                       CAST(julianday('{ref_date}') - julianday(pod.expected_delivery_date) AS INTEGER) AS delay
                {_OPEN_PO_WHERE}
            )
        """).fetchone()
        buckets = {
            "1-30d":  int(bucket_row[0] or 0),
            "31-60d": int(bucket_row[1] or 0),
            "61-90d": int(bucket_row[2] or 0),
            "90+d":   int(bucket_row[3] or 0),
        }
        _upsert(conn, "procurement", "OPEN_PO_AGING_BUCKETS",
                "Open PO Aging Buckets", None, json.dumps(buckets), "json")
    except Exception:
        pass

    # P9 — Total PO Value YTD
    p9 = _run(conn, f"""
        SELECT SUM(CAST(net_order_value AS REAL))
        FROM po_dump
        WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))
          AND document_date >= {FY}
    """)
    _upsert(conn, "procurement", "TOTAL_PO_VALUE_YTD", "Total PO Value (YTD)", p9, None, "INR")

    # P10 — PO Line Count YTD
    p10 = _run(conn, f"""
        SELECT COUNT(*) FROM po_dump
        WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))
          AND document_date >= {FY}
    """)
    _upsert(conn, "procurement", "PO_LINE_COUNT_YTD", "PO Line Count (YTD)", p10, None, "count")

    # ── Frontend-expected aliases ─────────────────────────────────────────────

    # PO_COUNT_MTD — distinct POs with creation date in current month
    po_count_mtd = _run(conn, f"""
        SELECT COUNT(DISTINCT purchasing_document)
        FROM po_dump
        WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))
          AND COALESCE(NULLIF(created_on,''), document_date) >= {MTD}
    """)
    _upsert(conn, "procurement", "PO_COUNT_MTD", "PO Count (MTD)", po_count_mtd, None, "count")

    # AVG_PO_VALUE — average net_order_value MTD
    avg_po = _run(conn, f"""
        SELECT AVG(CAST(net_order_value AS REAL))
        FROM po_dump
        WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))
          AND document_date >= {MTD}
    """)
    _upsert(conn, "procurement", "AVG_PO_VALUE", "Average PO Value (MTD)", avg_po, None, "INR")

    # HIGH_VALUE_PO_RATE — % of POs above threshold (frontend expects a rate/%)
    hv_total = _run(conn, f"""
        SELECT COUNT(DISTINCT purchasing_document) FROM po_dump
        WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))
          AND document_date >= {FY}
    """)
    hv_rate = round((p3 / hv_total * 100), 2) if p3 and hv_total else None
    _upsert(conn, "procurement", "HIGH_VALUE_PO_RATE",
            f"High-Value PO Rate (>₹{int(high_value_threshold):,})", hv_rate, None, "%")

    # MAVERICK_SPEND_RATE — POs without approved PR (frontend procurement card)
    mav_total = _run(conn, """
        SELECT COUNT(DISTINCT purchasing_document) FROM po_dump
        WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L', 'X'))
    """)
    mav_count = _run(conn, """
        SELECT COUNT(DISTINCT purchasing_document) FROM po_dump
        WHERE (purchase_requisition IS NULL OR purchase_requisition = '')
          AND (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L', 'X'))
    """)
    mav_rate = round((mav_count / mav_total * 100), 2) if mav_count and mav_total else 0.0
    _upsert(conn, "procurement", "MAVERICK_SPEND_RATE", "Maverick Spend Rate (%)", mav_rate, None, "%")

    # ACTIVE_VENDOR_COUNT_MTD — distinct vendors on active POs this FY
    active_v = _run(conn, f"""
        SELECT COUNT(DISTINCT vendor) FROM po_dump
        WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))
          AND document_date >= {FY}
    """)
    _upsert(conn, "procurement", "ACTIVE_VENDOR_COUNT_MTD", "Active Vendors (YTD)", active_v, None, "count")


# ── FINANCIAL ─────────────────────────────────────────────────────────────────

def _financial(conn, FY, MTD):

    # F1 — Total Spend YTD
    # Spec: SUM of PO invoices (RE) + Non-PO invoices (KR) minus Cancellations (RN)
    # RN amounts are stored as negative in the DB — include them naturally (no sign flip needed)
    # No amount>0 filter — credit memos within RE/KR must also be included
    f1 = _run(conn, f"""
        SELECT SUM(CAST(amount_local_ccy AS REAL))
        FROM invoice_dump
        WHERE document_type IN ('RE','KR','RN')
          AND posting_date >= {FY}
    """)
    _upsert(conn, "financial", "TOTAL_SPEND_YTD", "Total Spend YTD (Invoices)", f1, None, "INR")

    # F2 — Invoice Cancellation Rate
    # Spec: Cancelled (RN) / Total (RE+KR+RN) * 100
    # Only RN type = true cancellations; denominator = all invoice transactions #Depend Client to Client - Show Data First, Take Debit Credit Indicator
    f2_cancelled = _run(conn, """
        SELECT COUNT(*) FROM invoice_dump WHERE document_type = 'RN'
    """)
    f2_total = _run(conn, """
        SELECT COUNT(*) FROM invoice_dump WHERE document_type IN ('RE','KR','RN')
    """)
    f2 = round((f2_cancelled / f2_total * 100), 2) if f2_cancelled and f2_total else 0.0
    _upsert(conn, "financial", "INVOICE_CANCELLATION_RATE", "Invoice Cancellation Rate (%)", f2, None, "%")

    # F3 — 3-Way Match Success Rate
    # Spec: PO line qty == SUM(net GRN qty) — GRN debit_credit_ind already netted in fact table
    # grn_quantity in pr_po_grn_invoice = S receipts - H returns (net)
    # Match = ABS(grn_quantity - po_quantity) / po_quantity <= 5%
    f3 = _run(conn, """
        SELECT COUNT(CASE
            WHEN ABS(COALESCE(f.grn_quantity, 0) - CAST(f.po_quantity AS REAL))
                 / NULLIF(ABS(CAST(f.po_quantity AS REAL)), 0) <= 0.05
            THEN 1 END) * 100.0
            / NULLIF(COUNT(CASE WHEN f.po_quantity IS NOT NULL AND f.po_quantity > 0 THEN 1 END), 0)
        FROM pr_po_grn_invoice f
        WHERE f.purchasing_document IS NOT NULL
          AND f.po_quantity IS NOT NULL
          AND f.grn_quantity IS NOT NULL
    """)
    _upsert(conn, "financial", "THREE_WAY_MATCH_RATE", "3-Way Match Success Rate (%)", f3, None, "%")

    # F4 — Invoice Processing Cycle Time: vendor_invoice_date → payment clearing_date
    # Spec: AVG(DATEDIFF(Payment_Dump.clearing_date, Invoice_Dump.vendor_invoice_date))
    # Join: payment_dump.cleared_invoice = invoice_dump.invoice_doc
    # Note: invoice_dump.clearing_doc ≠ payment_dump.payment_doc (different numbering ranges)
    f4 = _run(conn, """
        SELECT AVG(julianday(p.clearing_date) - julianday(i.vendor_invoice_date))
        FROM invoice_dump i
        JOIN payment_dump p ON p.cleared_invoice = i.invoice_doc
        WHERE i.vendor_invoice_date IS NOT NULL
          AND p.clearing_date IS NOT NULL
    """)
    _upsert(conn, "financial", "INVOICE_PROCESSING_DAYS", "Invoice Processing Time (days)", f4, None, "days")

    # F5 — Payment On-Time Rate: payment.posting_date ≤ invoice.due_date
    f5 = _run(conn, """
        SELECT COUNT(CASE
            WHEN p.posting_date <= i.due_date THEN 1 END) * 100.0
            / NULLIF(COUNT(*), 0)
        FROM payment_dump p
        JOIN invoice_dump i ON p.cleared_invoice = i.invoice_doc
        WHERE i.due_date IS NOT NULL
    """)
    _upsert(conn, "financial", "ON_TIME_PAYMENT_RATE", "On-Time Payment Rate (%)", f5, None, "%")

    # F6 — DPO: AVG(payment.posting_date - invoice.posting_date)
    f6 = _run(conn, """
        SELECT AVG(julianday(p.posting_date) - julianday(i.posting_date))
        FROM payment_dump p
        JOIN invoice_dump i ON p.cleared_invoice = i.invoice_doc
        WHERE i.posting_date IS NOT NULL
    """)
    _upsert(conn, "financial", "DPO", "Days Payable Outstanding (DPO)", f6, None, "days")

    # F7 — Open Invoice Value (unpaid invoices: no clearing_doc)
    f7 = _run(conn, """
        SELECT SUM(CAST(amount_local_ccy AS REAL))
        FROM invoice_dump
        WHERE (clearing_doc IS NULL OR clearing_doc = '')
          AND CAST(amount_local_ccy AS REAL) > 0
    """)
    _upsert(conn, "financial", "OPEN_INVOICE_VALUE", "Open Invoice Value", f7, None, "INR")

    # F8 — Early Payment Count (paid before due date)
    f8_early = _run(conn, """
        SELECT COUNT(*) FROM payment_dump p
        JOIN invoice_dump i ON p.cleared_invoice = i.invoice_doc
        WHERE p.posting_date < i.due_date
    """)
    _upsert(conn, "financial", "EARLY_PAYMENT_COUNT", "Early Payment Count", f8_early, None, "count")

    # F8b — Late Payment Count (paid after due date)
    f8_late = _run(conn, """
        SELECT COUNT(*) FROM payment_dump p
        JOIN invoice_dump i ON p.cleared_invoice = i.invoice_doc
        WHERE p.posting_date > i.due_date
    """)
    _upsert(conn, "financial", "LATE_PAYMENT_COUNT", "Late Payment Count", f8_late, None, "count")

    # F9 — Open Invoice Aging Buckets (JSON text value)
    try:
        rows = conn.execute("""
            SELECT
                SUM(CASE WHEN julianday('now') - julianday(posting_date) <= 30
                         THEN CAST(amount_local_ccy AS REAL) ELSE 0 END),
                SUM(CASE WHEN julianday('now') - julianday(posting_date) BETWEEN 31 AND 60
                         THEN CAST(amount_local_ccy AS REAL) ELSE 0 END),
                SUM(CASE WHEN julianday('now') - julianday(posting_date) BETWEEN 61 AND 90
                         THEN CAST(amount_local_ccy AS REAL) ELSE 0 END),
                SUM(CASE WHEN julianday('now') - julianday(posting_date) > 90
                         THEN CAST(amount_local_ccy AS REAL) ELSE 0 END)
            FROM invoice_dump
            WHERE (clearing_doc IS NULL OR clearing_doc = '')
              AND CAST(amount_local_ccy AS REAL) > 0
        """).fetchone()
        buckets = {
            "0-30d":  round(rows[0] or 0, 2),
            "31-60d": round(rows[1] or 0, 2),
            "61-90d": round(rows[2] or 0, 2),
            "90+d":   round(rows[3] or 0, 2),
        }
        _upsert(conn, "financial", "OPEN_INVOICE_AGING_BUCKETS",
                "Open Invoice Aging Buckets", None, json.dumps(buckets), "json")
    except Exception:
        pass

    # F10 — Total Payments YTD
    f10 = _run(conn, f"""
        SELECT SUM(CAST(amount_local_ccy AS REAL))
        FROM payment_dump
        WHERE posting_date >= {FY}
    """)
    _upsert(conn, "financial", "TOTAL_PAYMENTS_YTD", "Total Payments (YTD)", f10, None, "INR")


# ── LEADERSHIP ────────────────────────────────────────────────────────────────

def _leadership(conn, FY, MTD, high_value_threshold):

    # L1 — Total Procurement Value YTD (committed PO value — NOT invoice spend)
    # Uses distinct kpi_code TOTAL_PROCUREMENT_YTD to avoid conflict with financial.TOTAL_SPEND_YTD
    l1 = _run(conn, f"""
        SELECT SUM(CAST(net_order_value AS REAL))
        FROM po_dump
        WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))
          AND document_date >= {FY}
    """)
    _upsert(conn, "leadership", "TOTAL_PROCUREMENT_YTD", "Total Procurement Value (YTD)", l1, None, "INR")

    # L2 — Maverick PO Rate
    l2 = _run(conn, """
        SELECT COUNT(CASE WHEN is_maverick = 1 THEN 1 END) * 100.0
               / NULLIF(COUNT(*), 0)
        FROM pr_po_grn_invoice
        WHERE purchasing_document IS NOT NULL
    """)
    _upsert(conn, "leadership", "MAVERICK_BUY_RATE", "Maverick PO Rate (%)", l2, None, "%")

    # L3 — End-to-End P2P Cycle Time
    l3 = _run(conn, """
        SELECT AVG(CAST(total_cycle_days AS REAL))
        FROM pr_po_grn_invoice
        WHERE total_cycle_days IS NOT NULL AND total_cycle_days > 0
    """)
    _upsert(conn, "leadership", "E2E_CYCLE_TIME", "End-to-End P2P Cycle (days)", l3, None, "days")

    # L4 — Vendor Concentration Risk (Top-3 vendors' share of total spend)
    l4 = _run(conn, """
        SELECT SUM(sub.spend) * 100.0 / NULLIF(
            (SELECT SUM(CAST(net_order_value AS REAL)) FROM po_dump
             WHERE deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X')), 0)
        FROM (
            SELECT SUM(CAST(net_order_value AS REAL)) AS spend
            FROM po_dump
            WHERE deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X')
            GROUP BY vendor
            ORDER BY spend DESC LIMIT 3
        ) sub
    """)
    _upsert(conn, "leadership", "VENDOR_CONCENTRATION", "Top-3 Vendor Spend Concentration (%)", l4, None, "%")

    # L5 — Negotiation Savings YTD: (PR valuation_price - PO net_order_price) × qty, where positive
    l5 = _run(conn, """
        SELECT SUM((CAST(f.pr_value AS REAL) - CAST(f.po_net_price AS REAL))
                   * CAST(f.po_quantity AS REAL))
        FROM pr_po_grn_invoice f
        WHERE f.pr_value    IS NOT NULL
          AND f.po_net_price IS NOT NULL
          AND (CAST(f.pr_value AS REAL) - CAST(f.po_net_price AS REAL)) > 0
    """)
    _upsert(conn, "leadership", "NEGOTIATION_SAVINGS", "Negotiation Savings YTD", l5, None, "INR")

    # L6 — Strategic Risk Index: 0.4×vendor_conc + 0.3×maverick + 0.3×anomaly_rate (0-100)
    try:
        conc_pct   = l4 or 0
        mav_pct    = l2 or 0
        anom_count = _run(conn, "SELECT COUNT(*) FROM process_mining_events WHERE anomaly_count > 0") or 0
        total_ev   = _run(conn, "SELECT COUNT(*) FROM process_mining_events") or 1
        anom_pct   = (anom_count / total_ev) * 100
        l6 = round(0.4 * conc_pct + 0.3 * mav_pct + 0.3 * anom_pct, 1)
    except Exception:
        l6 = None
    _upsert(conn, "leadership", "SUPPLY_RISK_SCORE", "Supply Chain Risk Score", l6, None, "score")

    # L7 — SOD Conflict Count: same user created PR AND approved PO (change_log FRGZU=X)
    l7 = _run(conn, """
        SELECT COUNT(DISTINCT po.purchasing_document)
        FROM po_dump po
        JOIN pr_dump pr
            ON po.purchase_requisition = pr.purchase_requisition
           AND po.item_of_requisition  = pr.item_of_requisition
        JOIN change_log cl
            ON cl.object_id      = po.purchasing_document
           AND cl.object_class   = 'EINKBELEG'
           AND cl.field_name     IN ('FRGZU','FRGKE')
           AND cl.change_indicator = 'U'
           AND cl.new_value      = 'X'
           AND cl.username       = pr.requisitioner  -- same person who raised the PR
        WHERE po.purchase_requisition IS NOT NULL
    """)
    _upsert(conn, "leadership", "SOD_CONFLICT_COUNT", "SOD Conflict Count", l7, None, "count")

    # L8 — PO to GRN Conversion Rate
    l8_total = _run(conn, """
        SELECT COUNT(DISTINCT purchasing_document || '|' || item)
        FROM pr_po_grn_invoice
        WHERE purchasing_document IS NOT NULL
    """)
    l8_with_grn = _run(conn, """
        SELECT COUNT(DISTINCT purchasing_document || '|' || item)
        FROM pr_po_grn_invoice
        WHERE purchasing_document IS NOT NULL AND grn_posting_date IS NOT NULL
    """)
    l8 = round((l8_with_grn / l8_total * 100), 2) if l8_with_grn and l8_total else None
    _upsert(conn, "leadership", "PO_GRN_CONVERSION_RATE", "PO→GRN Conversion Rate (%)", l8, None, "%")

    # L9 — Duplicate Invoice Count
    l9 = _run(conn, """
        SELECT COUNT(*) - COUNT(DISTINCT vendor || '|' || amount_local_ccy || '|' || posting_date)
        FROM invoice_dump
        WHERE document_type IN ('RE','KR')
    """)
    _upsert(conn, "leadership", "DUPLICATE_INVOICE_COUNT", "Duplicate Invoice Count", l9, None, "count")

    # L10 — High-Value PO Count (uses user-configurable threshold)
    l10 = _run(conn, f"""
        SELECT COUNT(DISTINCT purchasing_document)
        FROM po_dump
        WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))
          AND CAST(net_order_value AS REAL) > {high_value_threshold}
    """)
    _upsert(conn, "leadership", "HIGH_VALUE_PO_COUNT",
            f"High-Value PO Count (>₹{int(high_value_threshold):,})", l10, None, "count")

    # L11 — Summary counts (JSON)
    try:
        approved_pr  = _run(conn, "SELECT COUNT(DISTINCT purchase_requisition || '|' || item_of_requisition) FROM pr_dump WHERE release_status IN ('X','XX','XXX','XXXX','XXXXX')") or 0
        approved_po  = _run(conn, "SELECT COUNT(DISTINCT purchasing_document || '|' || item) FROM po_dump WHERE release_indicator = 'X' AND (deletion_indicator IS NULL OR deletion_indicator = '')") or 0
        grn_count    = _run(conn, "SELECT COUNT(*) FROM grn_dump WHERE debit_credit_ind = 'S'") or 0
        inv_count    = _run(conn, "SELECT COUNT(*) FROM invoice_dump WHERE document_type IN ('RE','KR') AND CAST(amount_local_ccy AS REAL) > 0") or 0
        pay_count    = _run(conn, "SELECT COUNT(*) FROM payment_dump") or 0
        po_no_pr     = _run(conn, "SELECT COUNT(DISTINCT purchasing_document) FROM po_dump WHERE (purchase_requisition IS NULL OR purchase_requisition = '') AND (deletion_indicator IS NULL OR deletion_indicator = '')") or 0
        counts = {
            "approved_pr": int(approved_pr), "approved_po": int(approved_po),
            "grn_lines": int(grn_count),     "invoice_lines": int(inv_count),
            "payments": int(pay_count),      "po_without_pr": int(po_no_pr),
        }
        _upsert(conn, "leadership", "SUMMARY_COUNTS", "P2P Summary Counts",
                None, json.dumps(counts), "json")
    except Exception:
        pass


# ── VENDOR ────────────────────────────────────────────────────────────────────

def _vendor(conn, FY, MTD):

    # V1 — Active Vendor Count: all 5 blocks must be clear
    v1 = _run(conn, """
        SELECT COUNT(DISTINCT vendor)
        FROM vendor_master
        WHERE (central_purchasing_block IS NULL OR central_purchasing_block NOT IN ('X'))
          AND (central_posting_block    IS NULL OR central_posting_block    NOT IN ('X'))
          AND (deletion_flag_central    IS NULL OR deletion_flag_central    NOT IN ('X'))
          AND (payment_block            IS NULL OR payment_block            NOT IN ('*'))
          AND (posting_block_cc         IS NULL OR posting_block_cc         NOT IN ('X'))
    """)
    _upsert(conn, "vendor", "ACTIVE_VENDOR_COUNT", "Active Vendor Count", v1, None, "count")

    # V2 — Vendor Breakdown (JSON: active, blocked/non-active, one_time, domestic, international, msme, total)
    # All 5 block flags checked for active status
    try:
        rows = conn.execute("""
            SELECT
                SUM(CASE WHEN (central_purchasing_block IS NULL OR central_purchasing_block NOT IN ('X'))
                           AND (central_posting_block   IS NULL OR central_posting_block   NOT IN ('X'))
                           AND (deletion_flag_central   IS NULL OR deletion_flag_central   NOT IN ('X'))
                           AND (payment_block           IS NULL OR payment_block           NOT IN ('*'))
                           AND (posting_block_cc        IS NULL OR posting_block_cc        NOT IN ('X'))
                         THEN 1 ELSE 0 END)  AS active,
                SUM(CASE WHEN central_purchasing_block='X' OR payment_block='*'
                              OR central_posting_block='X' OR posting_block_cc='X'
                              OR deletion_flag_central='X'
                         THEN 1 ELSE 0 END)  AS blocked,
                SUM(CASE WHEN UPPER(COALESCE(vendor_type,'')) = 'ONE_TIME'      THEN 1 ELSE 0 END) AS one_time,
                SUM(CASE WHEN UPPER(COALESCE(vendor_type,'')) = 'DOMESTIC'      THEN 1 ELSE 0 END) AS domestic,
                SUM(CASE WHEN UPPER(COALESCE(vendor_type,'')) = 'INTERNATIONAL' THEN 1 ELSE 0 END) AS international,
                SUM(CASE WHEN msme_flag IN ('M','S')          THEN 1 ELSE 0 END) AS msme,
                COUNT(*) AS total
            FROM vendor_master
        """).fetchone()
        breakdown = {
            "active":        int(rows[0] or 0),
            "blocked":       int(rows[1] or 0),
            "one_time":      int(rows[2] or 0),
            "domestic":      int(rows[3] or 0),
            "international": int(rows[4] or 0),
            "msme":          int(rows[5] or 0),
            "total":         int(rows[6] or 0),
        }
        _upsert(conn, "vendor", "VENDOR_BREAKDOWN", "Vendor Type Breakdown",
                None, json.dumps(breakdown), "json")
    except Exception:
        pass

    # V3 — OTIF Rate
    # Spec: COUNT(POs where first GRN posting_date ≤ expected_delivery_date)
    #       / COUNT(POs where delivery_completed='X')
    # Numerator: PO lines with at least one on-time GRN receipt
    # Denominator: fully delivered PO lines (delivery_completed='X')
    # Numerator: fully-delivered PO lines where first GRN receipt was on or before expected date
    # Denominator: all fully-delivered PO lines (delivery_completed='X')
    # Both use delivery_completed='X' to keep numerator ≤ denominator (rate stays 0-100%)
    v3_num = _run(conn, """
        SELECT COUNT(DISTINCT po.purchasing_document || '|' || po.item)
        FROM po_dump po
        JOIN po_delivery_dump pod
          ON pod.purchasing_document = po.purchasing_document
         AND pod.item               = po.item
        JOIN grn_dump grn
          ON grn.purchasing_document = po.purchasing_document
         AND grn.item               = po.item
         AND grn.debit_credit_ind   = 'S'
        WHERE po.delivery_completed = 'X'
          AND grn.posting_date <= pod.expected_delivery_date
    """)
    v3_den = _run(conn, """
        SELECT COUNT(DISTINCT purchasing_document || '|' || item)
        FROM po_dump
        WHERE delivery_completed = 'X'
    """)
    v3 = round((v3_num / v3_den * 100), 2) if v3_num and v3_den else None
    _upsert(conn, "vendor", "OTIF_RATE", "OTIF Rate (%)", v3, None, "%")

    # V4 — Average Delivery Delay (late deliveries only)
    v4 = _run(conn, """
        SELECT AVG(julianday(grn.posting_date) - julianday(pod.expected_delivery_date))
        FROM po_delivery_dump pod
        JOIN grn_dump grn
          ON grn.purchasing_document = pod.purchasing_document
         AND grn.item               = pod.item
        WHERE grn.debit_credit_ind  = 'S'
          AND grn.posting_date      > pod.expected_delivery_date
    """)
    _upsert(conn, "vendor", "AVG_DELIVERY_DELAY", "Avg Delivery Delay (days, late only)", v4, None, "days")

    # V5 — Quantity Variance Rate
    # Spec: COUNT(PO lines where net GRN qty < PO order_qty) / COUNT(all GRN lines) × 100
    # Multiple GRNs per PO → use net qty (S receipts - H returns) already in fact table
    # No tolerance threshold — any shortfall (net GRN < PO qty) counts as variance
    v5 = _run(conn, """
        SELECT COUNT(CASE
            WHEN COALESCE(f.grn_quantity, 0) < CAST(f.po_quantity AS REAL)
            THEN 1 END) * 100.0
            / NULLIF(COUNT(CASE WHEN f.grn_quantity IS NOT NULL THEN 1 END), 0)
        FROM pr_po_grn_invoice f
        WHERE f.purchasing_document IS NOT NULL
          AND f.po_quantity IS NOT NULL AND f.po_quantity > 0
    """)
    _upsert(conn, "vendor", "QTY_VARIANCE_RATE", "Quantity Variance Rate (%)", v5, None, "%")

    # V6 — Top-10 vendors by spend share (JSON)
    try:
        total_v = _run(conn, """
            SELECT SUM(CAST(net_order_value AS REAL)) FROM po_dump
            WHERE deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X')
        """) or 1
        rows = conn.execute("""
            SELECT po.vendor,
                   COALESCE(vm.vendor_name, po.vendor_name, po.vendor) AS name,
                   SUM(CAST(po.net_order_value AS REAL)) AS spend
            FROM po_dump po
            LEFT JOIN vendor_master vm ON po.vendor = vm.vendor
            WHERE po.deletion_indicator IS NULL OR po.deletion_indicator NOT IN ('L','X')
            GROUP BY po.vendor
            ORDER BY spend DESC
            LIMIT 10
        """).fetchall()
        top10 = [{"vendor": r[0], "name": r[1],
                  "spend": round(r[2], 2),
                  "share_pct": round(r[2] / total_v * 100, 2)} for r in rows]
        _upsert(conn, "vendor", "TOP_VENDOR_SPEND", "Top-10 Vendor Spend Share",
                None, json.dumps(top10), "json")
    except Exception:
        pass

    # V7 — Blocked Vendor Count
    v7 = _run(conn, """
        SELECT COUNT(DISTINCT vendor) FROM vendor_master
        WHERE central_purchasing_block = 'X'
           OR central_posting_block    = 'X'
           OR payment_block            = '*'
           OR posting_block_cc         = 'X'
    """)
    _upsert(conn, "vendor", "BLOCKED_VENDOR_COUNT", "Blocked Vendor Count", v7, None, "count")

    # V9 — MSME Vendor Count (Micro/Small enterprises — msme_flag IN ('M','S'))
    v8 = _run(conn, """
        SELECT COUNT(*) FROM vendor_master
        WHERE msme_flag IN ('M','S')
          AND (deletion_flag_central IS NULL OR deletion_flag_central = '')
    """)
    _upsert(conn, "vendor", "MSME_VENDOR_COUNT", "MSME Vendor Count", v8, None, "count")

    # V9 — Vendor Compliance Rate (all 5 blocks clear ÷ total)
    v9_clear = _run(conn, """
        SELECT COUNT(*) FROM vendor_master
        WHERE (central_purchasing_block IS NULL OR central_purchasing_block = '')
          AND (central_posting_block    IS NULL OR central_posting_block    = '')
          AND (deletion_flag_central    IS NULL OR deletion_flag_central    = '')
          AND (payment_block            IS NULL OR payment_block            = '')
          AND (posting_block_cc         IS NULL OR posting_block_cc         = '')
    """)
    v9_total = _run(conn, "SELECT COUNT(*) FROM vendor_master")
    v9 = round((v9_clear / v9_total * 100), 2) if v9_clear and v9_total else None
    _upsert(conn, "vendor", "VENDOR_COMPLIANCE_RATE", "Vendor Compliance Rate (%)", v9, None, "%")

    # V10 — Vendor Master Changes MTD
    v10 = _run(conn, f"""
        SELECT COUNT(DISTINCT object_id)
        FROM change_log
        WHERE object_class = 'KRED'
          AND change_date >= {MTD}
    """)
    _upsert(conn, "vendor", "VENDOR_MASTER_CHANGES", "Vendor Master Changes (MTD)", v10, None, "count")


# ── UTILIZATION (CAPEX / OPEX) ────────────────────────────────────────────────

CAPEX_FLAG = "UPPER(COALESCE(capex_opex_flag,'OPEX')) = 'CAPEX'"
OPEX_FLAG  = "UPPER(COALESCE(capex_opex_flag,'OPEX')) = 'OPEX'"
NOT_DELETED = "(deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))"

# Human-readable material group names
MG_NAMES = {
    "9901": "Civil Works",       "9902": "Electrical Equip.",
    "9903": "Office Supplies",   "9904": "IT Hardware",
    "9905": "IT Software",       "9906": "Consulting",
    "9907": "Logistics",         "9908": "Maintenance",
}


def _utilization(conn, FY, MTD):

    # U1 — Total CAPEX Spend YTD
    u1 = _run(conn, f"""
        SELECT SUM(CAST(net_order_value AS REAL)) FROM po_dump
        WHERE {NOT_DELETED} AND document_date >= {FY} AND {CAPEX_FLAG}
    """)
    _upsert(conn, "utilization", "CAPEX_SPEND_YTD", "Total CAPEX Spend (YTD)", u1, None, "INR")

    # U2 — Total OPEX Spend YTD
    u2 = _run(conn, f"""
        SELECT SUM(CAST(net_order_value AS REAL)) FROM po_dump
        WHERE {NOT_DELETED} AND document_date >= {FY} AND {OPEX_FLAG}
    """)
    _upsert(conn, "utilization", "OPEX_SPEND_YTD", "Total OPEX Spend (YTD)", u2, None, "INR")

    # U3 — CAPEX % of total spend
    total_spend = (u1 or 0) + (u2 or 0)
    u3_capex_pct = round((u1 or 0) / total_spend * 100, 1) if total_spend else None
    _upsert(conn, "utilization", "CAPEX_PCT", "CAPEX as % of Total Spend", u3_capex_pct, None, "%")

    # U4 — OPEX % of total spend
    u4_opex_pct = round((u2 or 0) / total_spend * 100, 1) if total_spend else None
    _upsert(conn, "utilization", "OPEX_PCT", "OPEX as % of Total Spend", u4_opex_pct, None, "%")

    # U5 — CAPEX PO Count YTD
    u5 = _run(conn, f"""
        SELECT COUNT(DISTINCT purchasing_document) FROM po_dump
        WHERE {NOT_DELETED} AND document_date >= {FY} AND {CAPEX_FLAG}
    """)
    _upsert(conn, "utilization", "CAPEX_PO_COUNT", "CAPEX PO Count (YTD)", u5, None, "count")

    # U6 — OPEX PO Count YTD
    u6 = _run(conn, f"""
        SELECT COUNT(DISTINCT purchasing_document) FROM po_dump
        WHERE {NOT_DELETED} AND document_date >= {FY} AND {OPEX_FLAG}
    """)
    _upsert(conn, "utilization", "OPEX_PO_COUNT", "OPEX PO Count (YTD)", u6, None, "count")

    # U7 — Avg CAPEX PO Value
    u7 = _run(conn, f"""
        SELECT AVG(CAST(net_order_value AS REAL)) FROM po_dump
        WHERE {NOT_DELETED} AND {CAPEX_FLAG}
    """)
    _upsert(conn, "utilization", "CAPEX_AVG_PO_VALUE", "Avg CAPEX PO Value", u7, None, "INR")

    # U8 — Avg OPEX PO Value
    u8 = _run(conn, f"""
        SELECT AVG(CAST(net_order_value AS REAL)) FROM po_dump
        WHERE {NOT_DELETED} AND {OPEX_FLAG}
    """)
    _upsert(conn, "utilization", "OPEX_AVG_PO_VALUE", "Avg OPEX PO Value", u8, None, "INR")

    # U9 — CAPEX Pending Delivery Value (open, not delivery-complete)
    u9 = _run(conn, f"""
        SELECT SUM(CAST(net_order_value AS REAL)) FROM po_dump
        WHERE {NOT_DELETED} AND {CAPEX_FLAG}
          AND (delivery_completed IS NULL OR delivery_completed = '')
    """)
    _upsert(conn, "utilization", "CAPEX_PENDING_VALUE", "CAPEX Pending Delivery", u9, None, "INR")

    # U10 — OPEX Pending Delivery Value
    u10 = _run(conn, f"""
        SELECT SUM(CAST(net_order_value AS REAL)) FROM po_dump
        WHERE {NOT_DELETED} AND {OPEX_FLAG}
          AND (delivery_completed IS NULL OR delivery_completed = '')
    """)
    _upsert(conn, "utilization", "OPEX_PENDING_VALUE", "OPEX Pending Delivery", u10, None, "INR")

    # U11 — CAPEX by Category (top material groups — JSON)
    try:
        rows = conn.execute(f"""
            SELECT material_group,
                   SUM(CAST(net_order_value AS REAL)) AS v,
                   COUNT(DISTINCT purchasing_document) AS po_count
            FROM po_dump
            WHERE {NOT_DELETED} AND {CAPEX_FLAG}
            GROUP BY material_group ORDER BY v DESC LIMIT 6
        """).fetchall()
        capex_cats = [{"mg": r[0],
                       "name": MG_NAMES.get(r[0], r[0]),
                       "value": round(r[1], 2),
                       "po_count": int(r[2])} for r in rows]
        _upsert(conn, "utilization", "CAPEX_BY_CATEGORY",
                "CAPEX by Category", None, json.dumps(capex_cats), "json")
    except Exception:
        pass

    # U12 — OPEX by Category (JSON)
    try:
        rows = conn.execute(f"""
            SELECT material_group,
                   SUM(CAST(net_order_value AS REAL)) AS v,
                   COUNT(DISTINCT purchasing_document) AS po_count
            FROM po_dump
            WHERE {NOT_DELETED} AND {OPEX_FLAG}
            GROUP BY material_group ORDER BY v DESC LIMIT 6
        """).fetchall()
        opex_cats = [{"mg": r[0],
                      "name": MG_NAMES.get(r[0], r[0]),
                      "value": round(r[1], 2),
                      "po_count": int(r[2])} for r in rows]
        _upsert(conn, "utilization", "OPEX_BY_CATEGORY",
                "OPEX by Category", None, json.dumps(opex_cats), "json")
    except Exception:
        pass

    # U13 — CAPEX/OPEX by Plant (JSON)
    try:
        rows = conn.execute(f"""
            SELECT plant,
                   SUM(CASE WHEN {CAPEX_FLAG} THEN CAST(net_order_value AS REAL) ELSE 0 END) AS capex,
                   SUM(CASE WHEN {OPEX_FLAG}  THEN CAST(net_order_value AS REAL) ELSE 0 END) AS opex
            FROM po_dump
            WHERE {NOT_DELETED}
            GROUP BY plant ORDER BY (capex + opex) DESC
        """).fetchall()
        by_plant = [{"plant": r[0],
                     "capex": round(r[1], 2),
                     "opex": round(r[2], 2),
                     "total": round(r[1] + r[2], 2)} for r in rows]
        _upsert(conn, "utilization", "CAPEX_OPEX_BY_PLANT",
                "CAPEX/OPEX by Plant", None, json.dumps(by_plant), "json")
    except Exception:
        pass


# ── CHART DATA ────────────────────────────────────────────────────────────────

def compute_chart_data(conn: sqlite3.Connection, dashboard: str) -> list[dict]:
    results = []
    try:
        ref_date = _get_ref_date(conn)
        from datetime import timedelta
        ref_d = date.fromisoformat(ref_date)
        twelve_ago = (ref_d.replace(day=1) - timedelta(days=335)).strftime("%Y-%m-%d")
        cutoff = f"'{twelve_ago}'"

        if dashboard == "procurement":
            # Monthly PO value + count
            rows = conn.execute(f"""
                SELECT strftime('%Y-%m', document_date) AS month,
                       SUM(CAST(net_order_value AS REAL)) AS total_value,
                       COUNT(*) AS po_count,
                       SUM(CASE WHEN purchase_requisition IS NULL OR purchase_requisition=''
                                THEN CAST(net_order_value AS REAL) ELSE 0 END) AS maverick_value
                FROM po_dump
                WHERE document_date >= {cutoff}
                  AND (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))
                GROUP BY month ORDER BY month
            """).fetchall()
            results = [{"month": r[0], "total_value": round(r[1] or 0, 2),
                        "po_count": int(r[2] or 0), "maverick_value": round(r[3] or 0, 2)} for r in rows]

            # Monthly deleted PO line items (item level, by created_on)
            del_rows = conn.execute(f"""
                SELECT strftime('%Y-%m', COALESCE(NULLIF(created_on,''), document_date)) AS month,
                       COUNT(DISTINCT purchasing_document || '|' || item) AS deleted_lines
                FROM po_dump
                WHERE deletion_indicator = 'L'
                  AND COALESCE(NULLIF(created_on,''), document_date) >= {cutoff}
                GROUP BY month
            """).fetchall()
            del_by_month = {r[0]: int(r[1]) for r in del_rows}
            results = [{**r, "deleted_lines": del_by_month.get(r["month"], 0)} for r in results]

        elif dashboard == "financial":
            # Monthly payments + invoice totals
            rows = conn.execute(f"""
                SELECT strftime('%Y-%m', posting_date) AS month,
                       SUM(CAST(amount_local_ccy AS REAL)) AS payments
                FROM payment_dump
                WHERE posting_date >= {cutoff}
                GROUP BY month ORDER BY month
            """).fetchall()
            monthly = [{"month": r[0], "payments": round(r[1] or 0, 2)} for r in rows]

            # Invoice aging buckets (snapshot)
            today = ref_date
            aging_rows = conn.execute(f"""
                SELECT
                    SUM(CASE WHEN julianday('{today}') - julianday(posting_date) <= 30
                             THEN CAST(amount_local_ccy AS REAL) ELSE 0 END)   AS b0_30,
                    SUM(CASE WHEN julianday('{today}') - julianday(posting_date) BETWEEN 31 AND 60
                             THEN CAST(amount_local_ccy AS REAL) ELSE 0 END)   AS b31_60,
                    SUM(CASE WHEN julianday('{today}') - julianday(posting_date) BETWEEN 61 AND 90
                             THEN CAST(amount_local_ccy AS REAL) ELSE 0 END)   AS b61_90,
                    SUM(CASE WHEN julianday('{today}') - julianday(posting_date) > 90
                             THEN CAST(amount_local_ccy AS REAL) ELSE 0 END)   AS b90p
                FROM invoice_dump
                WHERE (clearing_doc IS NULL OR clearing_doc = '')
                  AND CAST(amount_local_ccy AS REAL) > 0
            """).fetchone()
            aging = [
                {"bucket": "0-30d",  "value": round((aging_rows[0] or 0) / 1e7, 2)},
                {"bucket": "31-60d", "value": round((aging_rows[1] or 0) / 1e7, 2)},
                {"bucket": "61-90d", "value": round((aging_rows[2] or 0) / 1e7, 2)},
                {"bucket": "90+d",   "value": round((aging_rows[3] or 0) / 1e7, 2)},
            ]

            # Payment on-time vs late
            pt_rows = conn.execute("""
                SELECT
                    COUNT(CASE WHEN p.posting_date <= i.due_date THEN 1 END) AS on_time,
                    COUNT(CASE WHEN p.posting_date  > i.due_date THEN 1 END) AS late,
                    COUNT(*) AS total
                FROM payment_dump p
                JOIN invoice_dump i ON p.cleared_invoice = i.invoice_doc
                WHERE i.due_date IS NOT NULL
            """).fetchone()
            payment_split = {
                "on_time": int(pt_rows[0] or 0),
                "late":    int(pt_rows[1] or 0),
                "total":   int(pt_rows[2] or 0),
            }

            results = {
                "type": "financial_multi",
                "monthly": monthly,
                "aging_buckets": aging,
                "payment_split": payment_split,
            }

        elif dashboard == "vendor":
            # Monthly OTIF trend
            otif_rows = conn.execute(f"""
                SELECT strftime('%Y-%m', grn.posting_date) AS month,
                       COUNT(CASE WHEN grn.posting_date <= pod.expected_delivery_date THEN 1 END) * 100.0
                       / NULLIF(COUNT(*), 0) AS otif_pct,
                       COUNT(*) AS deliveries
                FROM grn_dump grn
                JOIN po_delivery_dump pod ON grn.purchasing_document = pod.purchasing_document
                  AND grn.item = pod.item
                WHERE grn.debit_credit_ind = 'S' AND grn.posting_date >= {cutoff}
                GROUP BY month ORDER BY month
            """).fetchall()
            otif = [{"month": r[0], "otif_pct": round(r[1] or 0, 2), "deliveries": int(r[2] or 0)} for r in otif_rows]

            # Compliance donut
            comp_rows = conn.execute("""
                SELECT
                    COUNT(CASE WHEN (central_purchasing_block IS NULL OR central_purchasing_block='')
                                AND (payment_block IS NULL OR payment_block='')
                                AND (deletion_flag_central IS NULL OR deletion_flag_central='')
                               THEN 1 END) AS active,
                    COUNT(CASE WHEN central_purchasing_block='X' OR central_posting_block='X' THEN 1 END) AS purchase_blocked,
                    COUNT(CASE WHEN payment_block='*' THEN 1 END) AS payment_blocked,
                    COUNT(CASE WHEN deletion_flag_central='X' THEN 1 END) AS deleted,
                    COUNT(*) AS total
                FROM vendor_master
            """).fetchone()
            compliance = {
                "active":           int(comp_rows[0] or 0),
                "purchase_blocked": int(comp_rows[1] or 0),
                "payment_blocked":  int(comp_rows[2] or 0),
                "deleted":          int(comp_rows[3] or 0),
                "total":            int(comp_rows[4] or 0),
            }

            # Vendor type breakdown
            type_rows = conn.execute("""
                SELECT vendor_type, COUNT(*) AS cnt
                FROM vendor_master
                GROUP BY vendor_type ORDER BY cnt DESC
            """).fetchall()

            results = {
                "type": "vendor_multi",
                "otif": otif,
                "compliance": compliance,
                "vendor_types": [{"type": r[0] or "UNKNOWN", "count": int(r[1])} for r in type_rows],
            }

        elif dashboard == "leadership":
            rows = conn.execute(f"""
                SELECT strftime('%Y-%m', document_date) AS month,
                       SUM(CAST(net_order_value AS REAL)) AS spend,
                       SUM(CASE WHEN UPPER(COALESCE(capex_opex_flag,'OPEX'))='CAPEX'
                                THEN CAST(net_order_value AS REAL) ELSE 0 END) AS capex,
                       SUM(CASE WHEN UPPER(COALESCE(capex_opex_flag,'OPEX'))='OPEX'
                                THEN CAST(net_order_value AS REAL) ELSE 0 END) AS opex
                FROM po_dump
                WHERE document_date >= {cutoff}
                  AND (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))
                GROUP BY month ORDER BY month
            """).fetchall()
            results = [{"month": r[0], "spend": round(r[1] or 0, 2),
                        "capex": round(r[2] or 0, 2), "opex": round(r[3] or 0, 2)} for r in rows]

        elif dashboard == "utilization":
            # Monthly CAPEX vs OPEX trend
            rows = conn.execute(f"""
                SELECT strftime('%Y-%m', document_date) AS month,
                       SUM(CASE WHEN UPPER(COALESCE(capex_opex_flag,'OPEX'))='CAPEX'
                                THEN CAST(net_order_value AS REAL) ELSE 0 END) AS capex,
                       SUM(CASE WHEN UPPER(COALESCE(capex_opex_flag,'OPEX'))='OPEX'
                                THEN CAST(net_order_value AS REAL) ELSE 0 END) AS opex,
                       COUNT(DISTINCT purchasing_document) AS po_count
                FROM po_dump
                WHERE document_date >= {cutoff}
                  AND (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))
                GROUP BY month ORDER BY month
            """).fetchall()
            results = [{"month": r[0],
                        "capex": round(r[1] or 0, 2),
                        "opex":  round(r[2] or 0, 2),
                        "po_count": int(r[3] or 0)} for r in rows]

    except Exception as e:
        import traceback
        print(f"[chart_data ERROR] dashboard={dashboard}: {e}")
        traceback.print_exc()
    return results


# ── MAIN ENTRY ────────────────────────────────────────────────────────────────

def compute_all(conn: sqlite3.Connection) -> None:
    ref_date = _get_ref_date(conn)
    FY, MTD  = _build_periods(ref_date)
    high_val = float(_get_config(conn, "HIGH_VALUE_PO_THRESHOLD", "10000000"))

    _procurement(conn, FY, MTD, high_val, ref_date)
    _financial(conn, FY, MTD)
    _leadership(conn, FY, MTD, high_val)
    _vendor(conn, FY, MTD)
    _utilization(conn, FY, MTD)

    conn.commit()
