"""Step 6 — Compute all KPIs and store in kpi_results.
KPI formulas follow IntelliSource_P2P_Reference_Schema_2 definitions exactly.
"""
import json
import traceback
from datetime import datetime, date
from typing import Any


IT_MATERIAL_GROUPS_SQL = "('IT','CLOUD','LICENSE','SOFTWARE','SAAS','9904','9905')"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_config(conn: Any, key: str, default: str) -> str:
    row = conn.execute(
        "SELECT config_value FROM kpi_config WHERE config_key = ?", (key,)
    ).fetchone()
    return row[0] if row else default


def _get_ref_date(conn: Any) -> str:
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


def _run(conn: Any, sql: str) -> float | None:
    try:
        r = conn.execute(sql).fetchone()
        return float(r[0]) if r and r[0] is not None else None
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        return None


def _run_text(conn: Any, sql: str) -> str | None:
    try:
        r = conn.execute(sql).fetchone()
        return str(r[0]) if r and r[0] is not None else None
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        return None


def _upsert(conn, dashboard, kpi_code, kpi_name, value_numeric, value_text, unit, trend=None, company_code="ALL"):
    conn.execute("""
        INSERT INTO kpi_results
            (dashboard, kpi_code, company_code, kpi_name, value_numeric, value_text, unit, trend, computed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW()::TEXT)
        ON CONFLICT(dashboard, kpi_code, company_code) DO UPDATE SET
            kpi_name      = excluded.kpi_name,
            value_numeric = excluded.value_numeric,
            value_text    = excluded.value_text,
            trend         = excluded.trend,
            computed_at   = excluded.computed_at
    """, (dashboard, kpi_code, company_code, kpi_name, value_numeric, value_text, unit, trend))


# ── PROCUREMENT ───────────────────────────────────────────────────────────────

def _procurement(conn, FY, MTD, high_value_threshold, ref_date="2023-03-31"):

    # P1 — Total PO Value MTD
    p1 = _run(conn, f"""
        SELECT SUM(CAST(net_order_value AS REAL))
        FROM po_dump
        WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))
          AND document_date >= {MTD}
    """)
    _upsert(conn, "procurement", "TOTAL_PO_VALUE_MTD", "Total PO Value (MTD)", p1, None, "INR")

    # P2 — Active PO Count (not delivery-complete, not deleted)
    p2 = _run(conn, f"""
        SELECT COUNT(DISTINCT purchasing_document || '|' || item)
        FROM po_dump
        WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))
          AND (delivery_completed IS NULL OR delivery_completed = '')
          AND document_date >= {MTD}
    """)
    _upsert(conn, "procurement", "ACTIVE_PO_COUNT", "Active PO Count (MTD)", p2, None, "count")

    # P3 — High-Value PO Count (threshold from kpi_config — configurable by user)
    p3 = _run(conn, f"""
        SELECT COUNT(DISTINCT purchasing_document)
        FROM po_dump
        WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))
          AND CAST(net_order_value AS REAL) > {high_value_threshold}
    """)
    _upsert(conn, "procurement", "HIGH_VALUE_PO_COUNT",
            f"High-Value PO Count (>₹{int(high_value_threshold):,})", p3, None, "count")

    # P4 — Avg PR-to-PO Conversion Time (ITEM level: PR release_date → PO document_date)
    p4 = _run(conn, """
        SELECT AVG(CAST(pr_to_po_days AS REAL))
        FROM pr_po_grn_invoice
        WHERE pr_to_po_days IS NOT NULL
          AND pr_to_po_days >= 0
          AND purchase_requisition IS NOT NULL
          AND purchasing_document  IS NOT NULL
    """)
    _upsert(conn, "procurement", "PR_TO_PO_DAYS", "Avg PR-to-PO Time (days)", p4, None, "days")

    # P5 — PO Approval Cycle Time (PO document_date → release date from change_log)
    p5 = _run(conn, """
        SELECT AVG((cl.change_date::DATE - po.document_date::DATE)::FLOAT)
        FROM po_dump po
        JOIN change_log cl
          ON cl.object_id    = po.purchasing_document
         AND cl.object_class = 'EINKBELEG'
         AND cl.field_name   IN ('FRGZU','FRGKE')
         AND cl.change_indicator = 'U'
         AND cl.new_value    = 'X'
        WHERE po.release_indicator = 'X'
    """)
    _upsert(conn, "procurement", "PO_APPROVAL_CYCLE", "PO Approval Cycle (days)", p5, None, "days")

    # P6 — PO Deletion Rate MTD
    p6 = _run(conn, f"""
        SELECT COUNT(DISTINCT purchasing_document)
        FROM po_dump
        WHERE deletion_indicator = 'L'
          AND document_date >= {MTD}
    """)
    _upsert(conn, "procurement", "PO_DELETION_MTD", "PO Deletions (MTD)", p6, None, "count")

    # P7 — PO Amendment Rate: only U (Update) changes to meaningful fields
    #       Excludes I (Insert, initial creation) and D (Delete)
    p7_amended = _run(conn, """
        SELECT COUNT(DISTINCT cl.object_id)
        FROM change_log cl
        WHERE cl.object_class    = 'EINKBELEG'
          AND cl.change_indicator = 'U'
          AND cl.field_name NOT IN ('FRGZU','FRGKE')  -- exclude release approvals
    """)
    p7_total = _run(conn, """
        SELECT COUNT(DISTINCT purchasing_document) FROM po_dump
        WHERE deletion_indicator IS NULL OR deletion_indicator = ''
    """)
    p7 = round((p7_amended / p7_total * 100), 2) if p7_amended and p7_total else None
    _upsert(conn, "procurement", "PO_AMENDMENT_RATE", "PO Amendment Rate (%)", p7, None, "%")

    # P8 — Open PR Aging > 7 days with NO matching PO at item level
    # Uses ref_date (latest data date) not actual 'now' — prevents all-zero on historical data
    p8 = _run(conn, f"""
        SELECT COUNT(DISTINCT pr.purchase_requisition || '|' || pr.item_of_requisition)
        FROM pr_dump pr
        WHERE pr.release_status IN ('X','XX','XXX','XXXX','XXXXX')
          AND (pr.deletion_indicator IS NULL OR pr.deletion_indicator = '')
          AND pr.release_date IS NOT NULL
          AND ('{ref_date}'::DATE - pr.release_date::DATE) > 7
          AND NOT EXISTS (
              SELECT 1 FROM po_dump po
              WHERE po.purchase_requisition = pr.purchase_requisition
                AND po.item_of_requisition  = pr.item_of_requisition
          )
    """)
    _upsert(conn, "procurement", "OPEN_PR_AGING", "Open PR Lines > 7 Days", p8, None, "count")

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

    # PO_COUNT_MTD — total PO lines created this month (frontend uses this code)
    _upsert(conn, "procurement", "PO_COUNT_MTD", "PO Count (MTD)", p2, None, "count")

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
        WHERE deletion_indicator IS NULL OR deletion_indicator = ''
    """)
    mav_count = _run(conn, """
        SELECT COUNT(DISTINCT purchasing_document) FROM po_dump
        WHERE (purchase_requisition IS NULL OR purchase_requisition = '')
          AND (deletion_indicator IS NULL OR deletion_indicator = '')
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

def _financial(conn, FY, MTD, cc_cfg: str = "", company_code: str = "ALL"):
    # Build company_code IN (...) filter; blank config = include all
    _cc_codes = [c.strip() for c in cc_cfg.split(',') if c.strip()]
    _cc_sql   = ("company_code IN (" + ','.join(f"'{c}'" for c in _cc_codes) + ")"
                 if _cc_codes else "1=1")

    # F1 — Total Spend YTD (RE + KR + RN), D/C signed, cancellations removed
    #   Method (a): exclude reversed originals (invoice_doc appears as reverse_invoice elsewhere)
    #               and exclude the reversal docs themselves (reverse_invoice IS NOT NULL)
    #   Method (b): exclude (company_code, vendor, vendor_invoice_ref) groups that net to zero
    f1 = _run(conn, f"""
        WITH cancelled AS (
            SELECT DISTINCT reverse_invoice AS doc
            FROM   invoice_dump
            WHERE  reverse_invoice IS NOT NULL AND reverse_invoice != ''
        ),
        net_nonzero AS (
            SELECT company_code || '|' || vendor || '|' || vendor_invoice_ref AS grp
            FROM   invoice_dump
            WHERE  vendor_invoice_ref IS NOT NULL AND vendor_invoice_ref != ''
            GROUP  BY company_code, vendor, vendor_invoice_ref
            HAVING ABS(SUM(CAST(amount_local_ccy AS REAL))) > 0.005
        )
        SELECT SUM(
            CAST(amount_local_ccy AS REAL)
            * CASE WHEN debit_credit_ind = 'S' THEN 1.0 ELSE -1.0 END
        )
        FROM   invoice_dump
        WHERE  document_type IN ('RE','KR','RN')
          AND  posting_date >= {FY}
          AND  {_cc_sql}
          AND  invoice_doc NOT IN (SELECT doc FROM cancelled)
          AND  (reverse_invoice IS NULL OR reverse_invoice = '')
          AND  (
               vendor_invoice_ref IS NULL OR vendor_invoice_ref = ''
               OR company_code || '|' || vendor || '|' || vendor_invoice_ref
                  IN (SELECT grp FROM net_nonzero)
          )
    """)
    _upsert(conn, "financial", "TOTAL_SPEND_YTD", "Total Spend YTD (Invoices)", f1, None, "INR", company_code=company_code)

    # F2 — Invoice Cancellation Rate: distinct RN docs / distinct all docs * 100
    f2 = _run(conn, f"""
        SELECT
            COUNT(DISTINCT CASE WHEN document_type = 'RN' THEN invoice_doc END) * 100.0
            / NULLIF(COUNT(DISTINCT invoice_doc), 0)
        FROM invoice_dump
        WHERE {_cc_sql}
    """)
    f2 = round(f2, 2) if f2 is not None else 0.0
    _upsert(conn, "financial", "INVOICE_CANCELLATION_RATE", "Invoice Cancellation Rate (%)", f2, None, "%", company_code=company_code)

    # F3 — 3-Way Match Success Rate
    #   Materials (material_type not blank): qty-based — PO qty vs GRN qty, PO qty vs Inv qty, GRN qty vs Inv qty
    #   Services  (material_type blank):     amt-based — PO amt vs GRN amt, PO amt vs Inv amt, GRN amt vs Inv amt
    #   All three legs within 5% tolerance = matched. Denominator = PO lines with invoice.
    f3 = _run(conn, f"""
        WITH po AS (
            SELECT company_code,
                   purchasing_document,
                   item,
                   CAST(order_quantity  AS REAL) AS po_qty,
                   CAST(net_order_value AS REAL) AS po_amt,
                   CASE WHEN material_type IS NOT NULL AND material_type != ''
                        THEN 'MATERIAL' ELSE 'SERVICE' END AS item_type
            FROM po_dump
            WHERE {_cc_sql}
              AND (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))
        ),
        grn AS (
            SELECT purchasing_document, item,
                   SUM(CAST(quantity         AS REAL)
                       * CASE WHEN debit_credit_ind = 'S' THEN 1.0 ELSE -1.0 END) AS grn_qty,
                   SUM(CAST(amount_local_ccy AS REAL)
                       * CASE WHEN debit_credit_ind = 'S' THEN 1.0 ELSE -1.0 END) AS grn_amt
            FROM grn_dump
            GROUP BY purchasing_document, item
        ),
        inv AS (
            SELECT purchasing_document, item,
                   SUM(CAST(quantity         AS REAL)
                       * CASE WHEN debit_credit_ind = 'S' THEN 1.0 ELSE -1.0 END) AS inv_qty,
                   SUM(CAST(amount_local_ccy AS REAL)
                       * CASE WHEN debit_credit_ind = 'S' THEN 1.0 ELSE -1.0 END) AS inv_amt
            FROM po_invoice_dump
            GROUP BY purchasing_document, item
        ),
        combined AS (
            SELECT po.item_type,
                   po.po_qty,
                   po.po_amt,
                   COALESCE(grn.grn_qty, 0) AS grn_qty,
                   COALESCE(grn.grn_amt, 0) AS grn_amt,
                   COALESCE(inv.inv_qty, 0) AS inv_qty,
                   COALESCE(inv.inv_amt, 0) AS inv_amt
            FROM po
            JOIN      inv ON inv.purchasing_document = po.purchasing_document
                          AND inv.item               = po.item
            LEFT JOIN grn ON grn.purchasing_document = po.purchasing_document
                          AND grn.item               = po.item
        )
        SELECT
            COUNT(CASE
                WHEN item_type = 'MATERIAL'
                  AND ABS(grn_qty - po_qty)  / NULLIF(ABS(po_qty),  0) <= 0.05
                  AND ABS(inv_qty - po_qty)  / NULLIF(ABS(po_qty),  0) <= 0.05
                  AND ABS(inv_qty - grn_qty) / NULLIF(ABS(grn_qty), 0) <= 0.05
                THEN 1
                WHEN item_type = 'SERVICE'
                  AND ABS(grn_amt - po_amt)  / NULLIF(ABS(po_amt),  0) <= 0.05
                  AND ABS(inv_amt - po_amt)  / NULLIF(ABS(po_amt),  0) <= 0.05
                  AND ABS(inv_amt - grn_amt) / NULLIF(ABS(grn_amt), 0) <= 0.05
                THEN 1
            END) * 100.0
            / NULLIF(COUNT(*), 0)
        FROM combined
    """)
    _upsert(conn, "financial", "THREE_WAY_MATCH_RATE", "3-Way Match Success Rate (%)", f3, None, "%", company_code=company_code)

    # F4 — Invoice Processing Cycle Time: AVG(clearing_date - vendor_invoice_date)
    #   Join: payment_dump.cleared_invoice = invoice_dump.invoice_doc (+ company_code + vendor)
    #   NOTE: invoice_dump.clearing_doc ≠ payment_dump.payment_doc (different number ranges in SAP)
    #   Cancelled invoices removed via reverse_invoice (STBLG); reversed payments via net-zero check
    f4 = _run(conn, f"""
        WITH cancelled_inv AS (
            SELECT DISTINCT reverse_invoice AS doc
            FROM   invoice_dump
            WHERE  reverse_invoice IS NOT NULL AND reverse_invoice != ''
        ),
        valid_inv AS (
            SELECT company_code, vendor, invoice_doc, vendor_invoice_date
            FROM   invoice_dump
            WHERE  {_cc_sql}
              AND  vendor_invoice_date IS NOT NULL
              AND  (reverse_invoice IS NULL OR reverse_invoice = '')
              AND  invoice_doc NOT IN (SELECT doc FROM cancelled_inv)
        ),
        noncancelled_pay AS (
            SELECT company_code, vendor, payment_doc
            FROM   payment_dump
            GROUP  BY company_code, vendor, payment_doc
            HAVING ABS(SUM(
                CAST(amount_local_ccy AS REAL)
                * CASE WHEN debit_credit_ind = 'S' THEN 1.0 ELSE -1.0 END
            )) > 0.005
        ),
        valid_pay AS (
            SELECT pd.company_code, pd.vendor, pd.clearing_date, pd.cleared_invoice
            FROM   payment_dump pd
            JOIN   noncancelled_pay nc
              ON   nc.payment_doc  = pd.payment_doc
             AND   nc.company_code = pd.company_code
             AND   nc.vendor       = pd.vendor
            WHERE  pd.debit_credit_ind = 'S'
        )
        SELECT AVG((vp.clearing_date::DATE - vi.vendor_invoice_date::DATE)::FLOAT)
        FROM   valid_inv vi
        JOIN   valid_pay vp
          ON   vp.cleared_invoice = vi.invoice_doc
         AND   vp.company_code   = vi.company_code
         AND   vp.vendor         = vi.vendor
        WHERE  vp.clearing_date IS NOT NULL
    """)
    _upsert(conn, "financial", "INVOICE_PROCESSING_DAYS", "Invoice Processing Time (days)", f4, None, "days", company_code=company_code)

    # F5 — Payment On-Time Rate
    #   On-time: clearing_date <= due_date  (due_date loaded directly from CSV via load_invoice)
    #   baseline_date/days_1 are NOT loaded by load_invoice, so due_date column used directly
    #   4-key join: company_code, vendor, clearing_doc=payment_doc, invoice_doc=cleared_invoice
    #   Cancelled invoices + reversed payments excluded (same CTEs as F4)
    f5 = _run(conn, f"""
        WITH cancelled_inv AS (
            SELECT DISTINCT reverse_invoice AS doc
            FROM   invoice_dump
            WHERE  reverse_invoice IS NOT NULL AND reverse_invoice != ''
        ),
        valid_inv AS (
            SELECT company_code, vendor, invoice_doc, due_date
            FROM   invoice_dump
            WHERE  {_cc_sql}
              AND  due_date IS NOT NULL AND due_date != ''
              AND  (reverse_invoice IS NULL OR reverse_invoice = '')
              AND  invoice_doc NOT IN (SELECT doc FROM cancelled_inv)
        ),
        noncancelled_pay AS (
            SELECT company_code, vendor, payment_doc
            FROM   payment_dump
            GROUP  BY company_code, vendor, payment_doc
            HAVING ABS(SUM(
                CAST(amount_local_ccy AS REAL)
                * CASE WHEN debit_credit_ind = 'S' THEN 1.0 ELSE -1.0 END
            )) > 0.005
        ),
        valid_pay AS (
            SELECT pd.company_code, pd.vendor,
                   pd.clearing_date, pd.cleared_invoice
            FROM   payment_dump pd
            JOIN   noncancelled_pay nc
              ON   nc.payment_doc  = pd.payment_doc
             AND   nc.company_code = pd.company_code
             AND   nc.vendor       = pd.vendor
            WHERE  pd.debit_credit_ind = 'S'
        )
        SELECT COUNT(CASE WHEN vp.clearing_date = vi.due_date THEN 1 END) * 100.0
               / NULLIF(COUNT(*), 0)
        FROM   valid_inv vi
        JOIN   valid_pay vp
          ON   vp.cleared_invoice = vi.invoice_doc
         AND   vp.company_code   = vi.company_code
         AND   vp.vendor         = vi.vendor
        WHERE  vp.clearing_date IS NOT NULL
    """)
    _upsert(conn, "financial", "ON_TIME_PAYMENT_RATE", "On-Time Payment Rate (%)", f5, None, "%", company_code=company_code)


    # F7 — Open Invoice Aging: unpaid (clearing_doc IS NULL), cancelled removed
    #   due_date = pre-computed column (baseline_date + days_1)
    #   Buckets by (today - due_date): not_yet_due | 0-10 | 10-20 | 20-30 | 30-60 | 60-90 | 90+
    #   value_numeric = total open amount; value_text = JSON bucket breakdown for chart
    try:
        f7_rows = conn.execute(f"""
            WITH open_inv AS (
                SELECT
                    CAST(amount_local_ccy AS REAL)
                        * CASE WHEN debit_credit_ind = 'S' THEN 1.0 ELSE -1.0 END AS signed_amt,
                    (CURRENT_DATE - due_date::DATE) AS days_overdue
                FROM invoice_dump
                WHERE (clearing_doc IS NULL OR clearing_doc = '')
                  AND {_cc_sql}
                  AND document_type IN ('RE','KR')
                  AND due_date IS NOT NULL AND due_date != ''
                  AND (reverse_invoice IS NULL OR reverse_invoice = '')
                  AND invoice_doc NOT IN (
                      SELECT DISTINCT reverse_invoice FROM invoice_dump
                      WHERE reverse_invoice IS NOT NULL AND reverse_invoice != ''
                  )
            )
            SELECT
                SUM(CASE WHEN days_overdue <   0              THEN signed_amt ELSE 0 END),
                SUM(CASE WHEN days_overdue BETWEEN  0 AND  9  THEN signed_amt ELSE 0 END),
                SUM(CASE WHEN days_overdue BETWEEN 10 AND 19  THEN signed_amt ELSE 0 END),
                SUM(CASE WHEN days_overdue BETWEEN 20 AND 29  THEN signed_amt ELSE 0 END),
                SUM(CASE WHEN days_overdue BETWEEN 30 AND 59  THEN signed_amt ELSE 0 END),
                SUM(CASE WHEN days_overdue BETWEEN 60 AND 89  THEN signed_amt ELSE 0 END),
                SUM(CASE WHEN days_overdue >= 90              THEN signed_amt ELSE 0 END),
                SUM(signed_amt)
            FROM open_inv
        """).fetchone()
        f7_buckets = {
            "not_yet_due": round(f7_rows[0] or 0, 2),
            "0-10d":       round(f7_rows[1] or 0, 2),
            "10-20d":      round(f7_rows[2] or 0, 2),
            "20-30d":      round(f7_rows[3] or 0, 2),
            "30-60d":      round(f7_rows[4] or 0, 2),
            "60-90d":      round(f7_rows[5] or 0, 2),
            "90+d":        round(f7_rows[6] or 0, 2),
        }
        f7_total = round(f7_rows[7] or 0, 2)
        _upsert(conn, "financial", "OPEN_INVOICE_VALUE", "Open Invoice Aging",
                f7_total, json.dumps(f7_buckets), "INR", company_code=company_code)
    except Exception:
        pass

    # F8 — Payment Timing: Early / On-Time / Late counts + avg day diff
    #   Early: clearing_date < due_date  |  On-Time: = due_date  |  Late: > due_date
    #   4-key join: company_code, vendor, payment_doc=clearing_doc, cleared_invoice=invoice_doc
    #   due_date computed from baseline_date + days_1
    try:
        f8_rows = conn.execute(f"""
            WITH cancelled_inv AS (
                SELECT DISTINCT reverse_invoice AS doc
                FROM   invoice_dump
                WHERE  reverse_invoice IS NOT NULL AND reverse_invoice != ''
            ),
            valid_inv AS (
                SELECT company_code, vendor, invoice_doc, due_date
                FROM   invoice_dump
                WHERE  {_cc_sql}
                  AND  document_type IN ('RE','KR')
                  AND  due_date IS NOT NULL AND due_date != ''
                  AND  (reverse_invoice IS NULL OR reverse_invoice = '')
                  AND  invoice_doc NOT IN (SELECT doc FROM cancelled_inv)
            ),
            noncancelled_pay AS (
                SELECT company_code, vendor, payment_doc
                FROM   payment_dump
                GROUP  BY company_code, vendor, payment_doc
                HAVING ABS(SUM(
                    CAST(amount_local_ccy AS REAL)
                    * CASE WHEN debit_credit_ind = 'S' THEN 1.0 ELSE -1.0 END
                )) > 0.005
            ),
            valid_pay AS (
                SELECT pd.company_code, pd.vendor,
                       pd.clearing_date, pd.cleared_invoice
                FROM   payment_dump pd
                JOIN   noncancelled_pay nc
                  ON   nc.payment_doc  = pd.payment_doc
                 AND   nc.company_code = pd.company_code
                 AND   nc.vendor       = pd.vendor
                WHERE  pd.debit_credit_ind = 'S'
            ),
            joined AS (
                SELECT (vp.clearing_date::DATE - vi.due_date::DATE) AS day_diff
                FROM   valid_inv vi
                JOIN   valid_pay vp
                  ON   vp.cleared_invoice = vi.invoice_doc
                 AND   vp.company_code   = vi.company_code
                 AND   vp.vendor         = vi.vendor
                WHERE  vp.clearing_date IS NOT NULL
            )
            SELECT
                COUNT(CASE WHEN day_diff <  0 THEN 1 END),
                COUNT(CASE WHEN day_diff =  0 THEN 1 END),
                COUNT(CASE WHEN day_diff >  0 THEN 1 END),
                AVG(CASE  WHEN day_diff <  0 THEN ABS(day_diff) END),
                AVG(CASE  WHEN day_diff >  0 THEN day_diff      END),
                COUNT(*)
            FROM joined
        """).fetchone()
        early_count  = int(f8_rows[0] or 0)
        ontime_count = int(f8_rows[1] or 0)
        late_count   = int(f8_rows[2] or 0)
        avg_early    = round(float(f8_rows[3] or 0), 1)
        avg_late     = round(float(f8_rows[4] or 0), 1)
        total_count  = int(f8_rows[5] or 0)
        _upsert(conn, "financial", "EARLY_PAYMENT_COUNT",  "Early Payments",   early_count,  None, "count", company_code=company_code)
        _upsert(conn, "financial", "ON_TIME_PAYMENT_COUNT","On-Time Payments", ontime_count, None, "count", company_code=company_code)
        _upsert(conn, "financial", "LATE_PAYMENT_COUNT",   "Late Payments",    late_count,   None, "count", company_code=company_code)
        _upsert(conn, "financial", "PAYMENT_TIMING_SUMMARY", "Payment Timing Summary",
                total_count,
                json.dumps({"early": early_count, "on_time": ontime_count, "late": late_count,
                            "total": total_count, "avg_days_early": avg_early, "avg_days_late": avg_late}),
                "count", company_code=company_code)
    except Exception:
        pass

    # F10 — Total Payments YTD
    f10 = _run(conn, f"""
        SELECT SUM(CAST(amount_local_ccy AS REAL))
        FROM payment_dump
        WHERE posting_date >= {FY}
    """)
    _upsert(conn, "financial", "TOTAL_PAYMENTS_YTD", "Total Payments (YTD)", f10, None, "INR", company_code=company_code)

    # F11 — Payment-to-PO Ratio YTD
    f11_po_val = _run(conn, f"""
        SELECT SUM(CAST(net_order_value AS REAL))
        FROM po_dump
        WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))
          AND document_date >= {FY}
    """)
    f11 = round((f10 / f11_po_val * 100), 2) if f10 and f11_po_val and f11_po_val > 0 else None
    _upsert(conn, "financial", "PAYMENT_TO_PO_RATIO", "Payment-to-PO Ratio (%)", f11, None, "%", company_code=company_code)

    # F_PR — Approved PR Count YTD
    #   Distinct PR line items where release_status indicates full approval
    #   pr_dump.company_code filtered via _cc_sql
    f_pr = _run(conn, f"""
        SELECT COUNT(DISTINCT purchase_requisition || '|' || item_of_requisition)
        FROM pr_dump
        WHERE release_status IN ('X','XX','XXX','XXXX','XXXXX')
          AND (deletion_indicator IS NULL OR deletion_indicator = '')
          AND release_date >= {FY}
          AND {_cc_sql}
    """)
    _upsert(conn, "financial", "APPROVED_PR_COUNT", "Approved PR Count (YTD)", f_pr, None, "count", company_code=company_code)


# ── LEADERSHIP ────────────────────────────────────────────────────────────────

def _leadership(conn, FY, MTD, high_value_threshold):

    # L1 — Total Procurement Value + Count YTD
    #   Date filter on created_on (creation_date in SAP); deletion <> 'L' only (not X)
    #   Released = release_indicator LIKE 'X%'; Non-released = NULL or blank
    #   value_text = JSON breakdown: value, total_count, released_count, non_released_count
    try:
        l1_row = conn.execute(f"""
            SELECT
                SUM(CAST(net_order_value AS REAL)),
                COUNT(DISTINCT purchasing_document),
                COUNT(DISTINCT CASE WHEN release_indicator LIKE 'X%'
                                    THEN purchasing_document END),
                COUNT(DISTINCT CASE WHEN (release_indicator IS NULL OR release_indicator = '')
                                    THEN purchasing_document END)
            FROM po_dump
            WHERE (deletion_indicator IS NULL OR deletion_indicator <> 'L')
              AND created_on >= {FY}
              AND created_on <= CURRENT_DATE::TEXT
        """).fetchone()
        l1_value       = round(float(l1_row[0] or 0), 2)
        l1_total       = int(l1_row[1] or 0)
        l1_released    = int(l1_row[2] or 0)
        l1_nonreleased = int(l1_row[3] or 0)
        l1_json = json.dumps({
            "value":             l1_value,
            "total_count":       l1_total,
            "released_count":    l1_released,
            "non_released_count": l1_nonreleased,
        })
        _upsert(conn, "leadership", "TOTAL_SPEND_YTD",    "Total Procurement Value (YTD)", l1_value, l1_json, "INR")
        _upsert(conn, "leadership", "TOTAL_PO_COUNT_YTD", "Total PO Count (YTD)",          l1_total, l1_json, "count")
    except Exception:
        l1_value = None
        _upsert(conn, "leadership", "TOTAL_SPEND_YTD",    "Total Procurement Value (YTD)", None, None, "INR")
        _upsert(conn, "leadership", "TOTAL_PO_COUNT_YTD", "Total PO Count (YTD)",          None, None, "count")

    # L_GRN — GRN Count + Value YTD
    #   movement_type = '101' (goods receipt against PO); debit_credit_ind applied to value
    #   Count = COUNT(DISTINCT material_document); Value = SUM(amount * dc_sign)
    try:
        grn_row = conn.execute(f"""
            SELECT
                COUNT(DISTINCT material_document),
                SUM(CAST(amount_local_ccy AS REAL)
                    * CASE WHEN debit_credit_ind = 'S' THEN 1.0 ELSE -1.0 END)
            FROM grn_dump
            WHERE movement_type = '101'
              AND posting_date >= {FY}
        """).fetchone()
        grn_count = int(grn_row[0] or 0)
        grn_value = round(float(grn_row[1] or 0), 2)
        grn_json  = json.dumps({"count": grn_count, "value": grn_value})
        _upsert(conn, "leadership", "GRN_COUNT_YTD", "GRN Count (YTD)",  grn_count, grn_json, "count")
        _upsert(conn, "leadership", "GRN_VALUE_YTD", "GRN Value (YTD)",  grn_value, grn_json, "INR")
    except Exception:
        pass

    # L_INV — Invoice Count + Value YTD (unique invoices, reversals removed, dc_sign applied)
    #   Cancellation: exclude invoice_doc in reverse_invoice list AND exclude reversal docs
    #   Count = COUNT(DISTINCT invoice_doc); Value = SUM(amount * dc_sign)
    try:
        inv_row = conn.execute(f"""
            WITH cancelled AS (
                SELECT DISTINCT reverse_invoice AS doc
                FROM   invoice_dump
                WHERE  reverse_invoice IS NOT NULL AND reverse_invoice != ''
            )
            SELECT
                COUNT(DISTINCT invoice_doc),
                SUM(CAST(amount_local_ccy AS REAL)
                    * CASE WHEN debit_credit_ind = 'S' THEN 1.0 ELSE -1.0 END)
            FROM invoice_dump
            WHERE document_type IN ('RE','KR')
              AND posting_date >= {FY}
              AND invoice_doc NOT IN (SELECT doc FROM cancelled)
              AND (reverse_invoice IS NULL OR reverse_invoice = '')
        """).fetchone()
        inv_count = int(inv_row[0] or 0)
        inv_value = round(float(inv_row[1] or 0), 2)
        inv_json  = json.dumps({"count": inv_count, "value": inv_value})
        _upsert(conn, "leadership", "INVOICE_COUNT_YTD", "Invoice Count (YTD)", inv_count, inv_json, "count")
        _upsert(conn, "leadership", "INVOICE_VALUE_YTD", "Invoice Value (YTD)", inv_value, inv_json, "INR")
    except Exception:
        pass

    # L_INV_TYPE — Invoice Summary by Vendor Type (join with vendor_master)
    #   Groups: company_code, vendor_type; removes reversed invoices; uses debit_credit_ind for amounts
    try:
        inv_type_rows = conn.execute(f"""
            SELECT i.company_code,
                   COALESCE(v.vendor_type, 'UNKNOWN') AS vendor_type,
                   COUNT(DISTINCT i.invoice_doc) AS invoice_count,
                   SUM(CAST(i.amount_local_ccy AS REAL)
                       * CASE WHEN i.debit_credit_ind = 'S' THEN 1.0 ELSE -1.0 END) AS total_amount
            FROM invoice_dump i
            LEFT JOIN vendor_master v ON i.vendor = v.vendor
            WHERE i.document_type IN ('RE','KR')
              AND (i.reverse_invoice IS NULL OR i.reverse_invoice = '')
              AND i.invoice_doc NOT IN (
                  SELECT DISTINCT reverse_invoice FROM invoice_dump
                  WHERE reverse_invoice IS NOT NULL AND reverse_invoice != ''
              )
            GROUP BY i.company_code, v.vendor_type
            ORDER BY i.company_code, total_amount DESC
        """).fetchall()
        inv_type_list = [{"company_code": r[0], "vendor_type": r[1],
                          "invoice_count": int(r[2]), "total_amount": round(r[3] or 0, 2)}
                         for r in inv_type_rows]
        _upsert(conn, "leadership", "INVOICE_BY_VENDOR_TYPE", "Invoice Summary by Vendor Type",
                None, json.dumps(inv_type_list), "json")
    except Exception:
        pass

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
    #   deletion_indicator <> 'L' only; JSON stores top-10 vendor breakdown for chart
    try:
        l4_total = conn.execute("""
            SELECT SUM(CAST(net_order_value AS REAL)) FROM po_dump
            WHERE (deletion_indicator IS NULL OR deletion_indicator <> 'L')
        """).fetchone()
        total_v = float(l4_total[0] or 0)
        l4_rows = conn.execute("""
            SELECT po.vendor,
                   COALESCE(MIN(vm.vendor_name), MIN(po.vendor_name), po.vendor) AS name,
                   SUM(CAST(po.net_order_value AS REAL)) AS spend
            FROM po_dump po
            LEFT JOIN vendor_master vm ON po.vendor = vm.vendor
            WHERE (po.deletion_indicator IS NULL OR po.deletion_indicator <> 'L')
            GROUP BY po.vendor
            ORDER BY spend DESC
            LIMIT 10
        """).fetchall()
        vendors_list = [{"vendor": r[0], "name": r[1], "spend": round(float(r[2] or 0), 2),
                         "share_pct": round(float(r[2] or 0) / total_v * 100, 2) if total_v else 0}
                        for r in l4_rows]
        top3_spend = sum(v["spend"] for v in vendors_list[:3])
        l4 = round(top3_spend / total_v * 100, 2) if total_v else None
        _upsert(conn, "leadership", "VENDOR_CONCENTRATION", "Top-3 Vendor Spend Concentration (%)",
                l4, json.dumps({"concentration_pct": l4, "vendors": vendors_list}), "%")
    except Exception:
        l4 = None
        _upsert(conn, "leadership", "VENDOR_CONCENTRATION", "Top-3 Vendor Spend Concentration (%)", None, None, "%")

    # L4b — Single Source Procurement: same company + material_description, COUNT(DISTINCT vendor) = 1
    #   Indicates supply dependency / risk; value_text = JSON top-20 items list for chart
    try:
        ss_total_row = conn.execute("""
            SELECT COUNT(*), SUM(total_value)
            FROM (
                SELECT company_code, material_description,
                       SUM(CAST(net_order_value AS REAL)) AS total_value
                FROM po_dump
                WHERE (deletion_indicator IS NULL OR deletion_indicator <> 'L')
                  AND material_description IS NOT NULL AND material_description != ''
                GROUP BY company_code, material_description
                HAVING COUNT(DISTINCT vendor) = 1
            )
        """).fetchone()
        ss_count = int(ss_total_row[0] or 0)
        ss_value = round(float(ss_total_row[1] or 0), 2)
        ss_items = conn.execute("""
            WITH ss AS (
                SELECT po.company_code, po.material_description,
                       MIN(po.vendor) AS vendor_code,
                       SUM(CAST(po.net_order_value AS REAL)) AS total_value
                FROM po_dump po
                WHERE (po.deletion_indicator IS NULL OR po.deletion_indicator <> 'L')
                  AND po.material_description IS NOT NULL AND po.material_description != ''
                GROUP BY po.company_code, po.material_description
                HAVING COUNT(DISTINCT po.vendor) = 1
            )
            SELECT ss.company_code, ss.material_description, ss.vendor_code,
                   COALESCE(vm.vendor_name, ss.vendor_code) AS vendor_name,
                   ROUND(ss.total_value, 2)
            FROM ss
            LEFT JOIN vendor_master vm ON ss.vendor_code = vm.vendor
            ORDER BY ss.total_value DESC
            LIMIT 20
        """).fetchall()
        ss_list = [{"company": r[0], "material": r[1], "vendor": r[2],
                    "vendor_name": r[3], "value": float(r[4] or 0)} for r in ss_items]
        _upsert(conn, "leadership", "SINGLE_SOURCE_COUNT", "Single Source Procurement Count",
                ss_count, json.dumps({"count": ss_count, "value": ss_value, "items": ss_list}), "count")
        _upsert(conn, "leadership", "SINGLE_SOURCE_VALUE", "Single Source Procurement Value",
                ss_value, None, "INR")
    except Exception:
        pass

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

    # L7 — SOD Conflicts (4 scenarios)
    # S7a — PO Creation vs PO Release
    #   PO created_by matches change_log.username who released (FRGZU='X')
    s7a = _run(conn, """
        SELECT COUNT(DISTINCT po.purchasing_document)
        FROM po_dump po
        JOIN change_log cl
            ON cl.object_id = po.purchasing_document
        WHERE cl.object_class      = 'EINKBELEG'
          AND cl.table_name        = 'EKKO'
          AND cl.field_name        = 'FRGZU'
          AND cl.change_indicator  IN ('E','U')
          AND cl.new_value         = 'X'
          AND cl.username          = po.created_by
          AND (po.deletion_indicator IS NULL OR po.deletion_indicator = '')
    """)
    _upsert(conn, "leadership", "SOD_PO_CREATE_RELEASE", "SOD: PO Create vs Release", s7a, None, "count")

    # S7b — PO Creation vs GRN
    #   PO created_by matches GRN created_by (same person ordering AND receiving)
    s7b = _run(conn, """
        SELECT COUNT(DISTINCT po.purchasing_document || '|' || po.item)
        FROM po_dump po
        JOIN grn_dump grn
            ON grn.purchasing_document = po.purchasing_document
           AND grn.item               = po.item
        WHERE po.created_by = grn.created_by
          AND (po.deletion_indicator IS NULL OR po.deletion_indicator = '')
          AND grn.debit_credit_ind = 'S'
    """)
    _upsert(conn, "leadership", "SOD_PO_GRN", "SOD: PO vs GRN", s7b, None, "count")

    # S7c — GRN vs Invoice
    #   GRN created_by matches Invoice (po_invoice_dump) created_by
    s7c = _run(conn, """
        SELECT COUNT(DISTINCT grn.material_document)
        FROM grn_dump grn
        JOIN po_invoice_dump inv
            ON inv.purchasing_document = grn.purchasing_document
           AND inv.item               = grn.item
        WHERE grn.created_by = inv.created_by
          AND grn.debit_credit_ind  = 'S'
          AND inv.debit_credit_ind  = 'S'
    """)
    _upsert(conn, "leadership", "SOD_GRN_INVOICE", "SOD: GRN vs Invoice", s7c, None, "count")

    # S7d — Invoice vs Payment
    #   Invoice created_by matches Payment created_by
    s7d = _run(conn, """
        SELECT COUNT(DISTINCT i.invoice_doc)
        FROM invoice_dump i
        JOIN payment_dump p
            ON p.company_code    = i.company_code
           AND p.vendor          = i.vendor
           AND p.cleared_invoice = i.invoice_doc
        WHERE i.created_by = p.created_by
          AND i.document_type IN ('RE','KR')
          AND (i.reverse_invoice IS NULL OR i.reverse_invoice = '')
          AND i.invoice_doc NOT IN (
              SELECT DISTINCT reverse_invoice FROM invoice_dump
              WHERE reverse_invoice IS NOT NULL AND reverse_invoice != ''
          )
          AND p.debit_credit_ind = 'S'
    """)
    _upsert(conn, "leadership", "SOD_INVOICE_PAYMENT", "SOD: Invoice vs Payment", s7d, None, "count")

    # Combined SOD count
    s7_total = (s7a or 0) + (s7b or 0) + (s7c or 0) + (s7d or 0)
    _upsert(conn, "leadership", "SOD_CONFLICT_COUNT", "SOD Conflict Count (All)", s7_total, None, "count")

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

    # L9 — Duplicate Invoice Count: same company, vendor_invoice_ref, amount, vendor, posting_date
    #        Remove cancelled invoices (reverse_invoice); count excess system docs beyond the first
    l9 = _run(conn, """
        SELECT SUM(cnt - 1) FROM (
            SELECT COUNT(DISTINCT invoice_doc) AS cnt
            FROM invoice_dump
            WHERE document_type IN ('RE','KR')
              AND (reverse_invoice IS NULL OR reverse_invoice = '')
              AND invoice_doc NOT IN (
                  SELECT DISTINCT reverse_invoice FROM invoice_dump
                  WHERE reverse_invoice IS NOT NULL AND reverse_invoice != ''
              )
            GROUP BY company_code, vendor_invoice_ref,
                     CAST(amount_local_ccy AS REAL),
                     vendor, posting_date
            HAVING COUNT(DISTINCT invoice_doc) > 1
        )
    """)
    _upsert(conn, "leadership", "DUPLICATE_INVOICE_COUNT", "Duplicate Invoice Count", l9, None, "count")

    # L9b — Duplicate PO Count: same company, material_group, vendor, net_order_value, qty, date
    #        Remove deleted POs; count excess documents beyond the first
    l9b = _run(conn, """
        SELECT SUM(cnt - 1) FROM (
            SELECT COUNT(DISTINCT purchasing_document) AS cnt
            FROM po_dump
            WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))
            GROUP BY company_code, material_group, vendor,
                     CAST(net_order_value AS REAL),
                     CAST(order_quantity AS REAL),
                     document_date
            HAVING COUNT(DISTINCT purchasing_document) > 1
        )
    """)
    _upsert(conn, "leadership", "DUPLICATE_PO_COUNT", "Duplicate PO Count", l9b, None, "count")

    # L10 — High-Value PO Count (uses user-configurable threshold)
    l10 = _run(conn, f"""
        SELECT COUNT(DISTINCT purchasing_document)
        FROM po_dump
        WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))
          AND CAST(net_order_value AS REAL) > {high_value_threshold}
    """)
    _upsert(conn, "leadership", "HIGH_VALUE_PO_COUNT",
            f"High-Value PO Count (>₹{int(high_value_threshold):,})", l10, None, "count")

    # L11a — PR Amount YTD
    l11a = _run(conn, f"""
        SELECT SUM(CAST(valuation_price AS REAL))
        FROM pr_dump
        WHERE (deletion_indicator IS NULL OR deletion_indicator = '')
          AND release_date >= {FY}
    """)
    _upsert(conn, "leadership", "PR_AMOUNT_YTD", "PR Amount (YTD)", l11a, None, "INR")

    # L11b — PR Line Count YTD
    l11b = _run(conn, f"""
        SELECT COUNT(DISTINCT purchase_requisition || '|' || item_of_requisition)
        FROM pr_dump
        WHERE (deletion_indicator IS NULL OR deletion_indicator = '')
          AND release_date >= {FY}
    """)
    _upsert(conn, "leadership", "PR_LINE_COUNT_YTD", "PR Line Count (YTD)", l11b, None, "count")

    # L11c — PO Line Count YTD
    l11c = _run(conn, f"""
        SELECT COUNT(*)
        FROM po_dump
        WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))
          AND document_date >= {FY}
    """)
    _upsert(conn, "leadership", "PO_LINE_COUNT_YTD", "PO Line Count (YTD)", l11c, None, "count")

    # L11d — One-Time Vendor Count
    l11d = _run(conn, """
        SELECT COUNT(*) FROM vendor_master
        WHERE UPPER(vendor_type) = 'ONE_TIME'
    """)
    _upsert(conn, "leadership", "ONE_TIME_VENDOR_COUNT", "One-Time Vendor Count", l11d, None, "count")

    # L11e — PO Lines without Contract (no contract_number in PO)
    l11e = _run(conn, """
        SELECT COUNT(*) FROM po_dump
        WHERE (contract_number IS NULL OR contract_number = '')
          AND (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))
    """)
    _upsert(conn, "leadership", "PO_NO_CONTRACT_COUNT", "PO Lines without Contract", l11e, None, "count")

    # L12 — Summary counts (JSON) — expanded
    try:
        pr_count     = _run(conn, "SELECT COUNT(DISTINCT purchase_requisition || '|' || item_of_requisition) FROM pr_dump WHERE release_status IN ('X','XX','XXX','XXXX','XXXXX')") or 0
        approved_po  = _run(conn, "SELECT COUNT(DISTINCT purchasing_document || '|' || item) FROM po_dump WHERE release_indicator = 'X' AND (deletion_indicator IS NULL OR deletion_indicator = '')") or 0
        grn_count    = _run(conn, "SELECT COUNT(*) FROM grn_dump WHERE debit_credit_ind = 'S'") or 0
        inv_count    = _run(conn, "SELECT COUNT(*) FROM invoice_dump WHERE document_type IN ('RE','KR') AND CAST(amount_local_ccy AS REAL) > 0") or 0
        pay_count    = _run(conn, "SELECT COUNT(*) FROM payment_dump") or 0
        po_no_pr     = _run(conn, "SELECT COUNT(DISTINCT purchasing_document) FROM po_dump WHERE (purchase_requisition IS NULL OR purchase_requisition = '') AND (deletion_indicator IS NULL OR deletion_indicator = '')") or 0
        one_time_v   = _run(conn, "SELECT COUNT(*) FROM vendor_master WHERE UPPER(vendor_type) = 'ONE_TIME'") or 0
        po_no_contract = _run(conn, "SELECT COUNT(*) FROM po_dump WHERE (contract_number IS NULL OR contract_number = '') AND (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))") or 0
        dupl_inv     = l9 or 0
        sod_count    = s7_total or 0
        counts = {
            "approved_pr": int(pr_count), "approved_po": int(approved_po),
            "grn_lines": int(grn_count),  "invoice_lines": int(inv_count),
            "payments": int(pay_count),   "po_without_pr": int(po_no_pr),
            "one_time_vendors": int(one_time_v), "po_no_contract": int(po_no_contract),
            "duplicate_invoices": int(dupl_inv), "sod_conflicts": int(sod_count),
        }
        _upsert(conn, "leadership", "SUMMARY_COUNTS", "P2P Summary Counts",
                None, json.dumps(counts), "json")
    except Exception:
        pass


# ── VENDOR ────────────────────────────────────────────────────────────────────

def _vendor(conn, FY, MTD, cc_cfg: str = "", company_code: str = "ALL"):
    _cc_codes = [c.strip() for c in cc_cfg.split(',') if c.strip()]
    _cc_sql   = ("po.company_code IN (" + ','.join(f"'{c}'" for c in _cc_codes) + ")"
                 if _cc_codes else "1=1")

    # V1 — Active Vendor Count: all 5 blocks must be clear (blank/null = unblocked)
    #   Purchasing blocks: central_purchasing_block <> 'X', posting_block_cc <> 'X'
    #   Posting blocks:    central_posting_block <> 'X'
    #   Deletion:          deletion_flag_central <> 'X'
    #   Payment block:     payment_block <> '*'  (SAP uses '*' not 'X' for payment block)
    v1 = _run(conn, """
        SELECT COUNT(DISTINCT vendor)
        FROM vendor_master
        WHERE (central_purchasing_block IS NULL OR central_purchasing_block <> 'X')
          AND (central_posting_block    IS NULL OR central_posting_block    <> 'X')
          AND (deletion_flag_central    IS NULL OR deletion_flag_central    <> 'X')
          AND (payment_block            IS NULL OR payment_block            <> '*')
          AND (posting_block_cc         IS NULL OR posting_block_cc         <> 'X')
    """)
    _upsert(conn, "vendor", "ACTIVE_VENDOR_COUNT", "Active Vendor Count", v1, None, "count")

    # V2 — Vendor Health Breakdown
    #   Compliance rate = vendors with all 3 operational blocks clear / total * 100
    #   3 blocks: central_purchasing_block <> 'X', payment_block <> '*', posting_block_cc <> 'X'
    #   JSON stores full breakdown: active, non_active, one_time, domestic, international, msme
    try:
        v2_row = conn.execute("""
            SELECT
                COUNT(CASE WHEN (central_purchasing_block IS NULL OR central_purchasing_block <> 'X')
                             AND (payment_block            IS NULL OR payment_block            <> '*')
                             AND (posting_block_cc         IS NULL OR posting_block_cc         <> 'X')
                           THEN 1 END),
                COUNT(CASE WHEN central_purchasing_block = 'X'
                              OR payment_block           = '*'
                              OR posting_block_cc        = 'X'
                           THEN 1 END),
                COUNT(CASE WHEN UPPER(vendor_type) = 'ONE_TIME'      THEN 1 END),
                COUNT(CASE WHEN UPPER(vendor_type) = 'DOMESTIC'      THEN 1 END),
                COUNT(CASE WHEN UPPER(vendor_type) = 'INTERNATIONAL' THEN 1 END),
                COUNT(CASE WHEN msme_flag IN ('M','S')               THEN 1 END),
                COUNT(*)
            FROM vendor_master
        """).fetchone()
        v2_active = int(v2_row[0] or 0)
        v2_total  = int(v2_row[6] or 0)
        v2_rate   = round(v2_active / v2_total * 100, 2) if v2_total else None
        v2_health = {
            "active":        v2_active,
            "non_active":    int(v2_row[1] or 0),
            "one_time":      int(v2_row[2] or 0),
            "domestic":      int(v2_row[3] or 0),
            "international": int(v2_row[4] or 0),
            "msme":          int(v2_row[5] or 0),
            "total":         v2_total,
            "compliance_rate": v2_rate,
        }
        _upsert(conn, "vendor", "VENDOR_BREAKDOWN", "Vendor Health Breakdown",
                v2_rate, json.dumps(v2_health), "%")
    except Exception:
        pass

    # V3 — Vendor Delivery Lead Time: AVG(first GRN entry_date − PO delivery_date) per vendor
    #   CTE grn_first: MIN(entry_date) per PO line (debit_credit_ind='S' = receipts only)
    #   Join: po_dump + grn_first on purchasing_document + item (company via po.company_code)
    #   Positive avg = late, negative = early/on-time; deleted POs excluded
    #   value_numeric = overall avg days; value_text = JSON vendor-wise list (top 25 by avg_days)
    try:
        v3_rows = conn.execute(f"""
            WITH grn_first AS (
                SELECT purchasing_document, item,
                       MIN(entry_date) AS first_grn_date
                FROM grn_dump
                WHERE debit_credit_ind = 'S'
                  AND entry_date IS NOT NULL AND entry_date != ''
                GROUP BY purchasing_document, item
            )
            SELECT po.vendor,
                   COALESCE(MIN(vm.vendor_name), MIN(po.vendor_name), po.vendor) AS vendor_name,
                   ROUND(AVG((gf.first_grn_date::DATE - po.delivery_date::DATE)::FLOAT), 1) AS avg_days,
                   COUNT(*) AS po_lines
            FROM po_dump po
            JOIN grn_first gf ON gf.purchasing_document = po.purchasing_document
                             AND gf.item               = po.item
            LEFT JOIN vendor_master vm ON po.vendor = vm.vendor
            WHERE (po.deletion_indicator IS NULL OR po.deletion_indicator NOT IN ('L','X'))
              AND po.delivery_date IS NOT NULL AND po.delivery_date != ''
              AND {_cc_sql}
            GROUP BY po.vendor
            ORDER BY avg_days DESC
            LIMIT 25
        """).fetchall()
        v3_overall = conn.execute(f"""
            WITH grn_first AS (
                SELECT purchasing_document, item,
                       MIN(entry_date) AS first_grn_date
                FROM grn_dump
                WHERE debit_credit_ind = 'S'
                  AND entry_date IS NOT NULL AND entry_date != ''
                GROUP BY purchasing_document, item
            )
            SELECT ROUND(AVG((gf.first_grn_date::DATE - po.delivery_date::DATE)::FLOAT), 1)
            FROM po_dump po
            JOIN grn_first gf ON gf.purchasing_document = po.purchasing_document
                             AND gf.item               = po.item
            WHERE (po.deletion_indicator IS NULL OR po.deletion_indicator NOT IN ('L','X'))
              AND po.delivery_date IS NOT NULL AND po.delivery_date != ''
              AND {_cc_sql}
        """).fetchone()
        v3_avg  = float(v3_overall[0]) if v3_overall and v3_overall[0] is not None else None
        v3_list = [{"vendor": r[0], "name": r[1], "avg_days": float(r[2] or 0), "po_lines": int(r[3])} for r in v3_rows]
        _upsert(conn, "vendor", "VENDOR_DELIVERY_DAYS", "Vendor Delivery Lead Time (days)",
                v3_avg, json.dumps(v3_list), "days", company_code=company_code)
    except Exception:
        pass

    # V4 — Average Delivery Delay (late deliveries only)
    v4 = _run(conn, """
        SELECT AVG((grn.posting_date::DATE - pod.expected_delivery_date::DATE)::FLOAT)
        FROM po_delivery_dump pod
        JOIN grn_dump grn
          ON grn.purchasing_document = pod.purchasing_document
         AND grn.item               = pod.item
        WHERE grn.debit_credit_ind  = 'S'
          AND grn.posting_date      > pod.expected_delivery_date
    """)
    _upsert(conn, "vendor", "AVG_DELIVERY_DELAY", "Avg Delivery Delay (days, late only)", v4, None, "days")


    # V6 — Top-10 vendors by spend share (JSON)
    try:
        total_v = _run(conn, """
            SELECT SUM(CAST(net_order_value AS REAL)) FROM po_dump
            WHERE deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X')
        """) or 1
        rows = conn.execute("""
            SELECT po.vendor,
                   COALESCE(MIN(vm.vendor_name), MIN(po.vendor_name), po.vendor) AS name,
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

    # V8 — MSME Vendor Count
    v8 = _run(conn, "SELECT COUNT(*) FROM vendor_master WHERE msme_flag IN ('M','S')")
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

def compute_chart_data(conn: Any, dashboard: str) -> list[dict]:
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
                SELECT LEFT(document_date, 7) AS month,
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

        elif dashboard == "financial":
            # Monthly payments
            rows = conn.execute(f"""
                SELECT LEFT(posting_date, 7) AS month,
                       SUM(CAST(amount_local_ccy AS REAL)) AS payments
                FROM payment_dump
                WHERE posting_date >= {cutoff}
                GROUP BY month ORDER BY month
            """).fetchall()
            monthly = [{"month": r[0], "payments": round(r[1] or 0, 2)} for r in rows]

            results = {
                "type": "financial_multi",
                "monthly": monthly,
            }

        elif dashboard == "vendor":
            # Monthly OTIF trend
            otif_rows = conn.execute(f"""
                SELECT LEFT(grn.posting_date, 7) AS month,
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
            # Monthly spend trend
            monthly_rows = conn.execute(f"""
                SELECT LEFT(document_date, 7) AS month,
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
            monthly = [{"month": r[0], "spend": round(r[1] or 0, 2),
                        "capex": round(r[2] or 0, 2), "opex": round(r[3] or 0, 2)} for r in monthly_rows]

            # Invoice by Vendor (top 10)
            inv_vendor_rows = conn.execute(f"""
                SELECT i.vendor, COALESCE(MIN(v.vendor_name), i.vendor) AS vendor_name,
                       SUM(CAST(i.amount_local_ccy AS REAL)) AS total_amount,
                       COUNT(*) AS invoice_count
                FROM invoice_dump i
                LEFT JOIN vendor_master v ON i.vendor = v.vendor
                WHERE i.document_type IN ('RE','KR')
                  AND CAST(i.amount_local_ccy AS REAL) > 0
                  AND i.posting_date >= {cutoff}
                GROUP BY i.vendor ORDER BY total_amount DESC LIMIT 10
            """).fetchall()
            invoice_by_vendor = [{"vendor": r[0], "vendor_name": r[1],
                                  "total_amount": round(r[2] or 0, 2),
                                  "invoice_count": int(r[3] or 0)} for r in inv_vendor_rows]

            # Invoice by Vendor Type
            inv_type_rows = conn.execute(f"""
                SELECT COALESCE(v.vendor_type, 'UNKNOWN') AS vendor_type,
                       SUM(CAST(i.amount_local_ccy AS REAL)) AS total_amount,
                       COUNT(*) AS invoice_count
                FROM invoice_dump i
                LEFT JOIN vendor_master v ON i.vendor = v.vendor
                WHERE i.document_type IN ('RE','KR')
                  AND CAST(i.amount_local_ccy AS REAL) > 0
                  AND i.posting_date >= {cutoff}
                GROUP BY vendor_type ORDER BY total_amount DESC
            """).fetchall()
            invoice_by_vendor_type = [{"vendor_type": r[0],
                                       "total_amount": round(r[1] or 0, 2),
                                       "invoice_count": int(r[2] or 0)} for r in inv_type_rows]

            # PR Aging — open PRs grouped by age buckets
            ref_d_str = ref_date
            pr_aging_row = conn.execute(f"""
                SELECT
                    SUM(CASE WHEN ('{ref_d_str}'::DATE - COALESCE(release_date, created_on)::DATE) <= 7
                             THEN 1 ELSE 0 END) AS b0_7,
                    SUM(CASE WHEN ('{ref_d_str}'::DATE - COALESCE(release_date, created_on)::DATE) BETWEEN 8 AND 30
                             THEN 1 ELSE 0 END) AS b8_30,
                    SUM(CASE WHEN ('{ref_d_str}'::DATE - COALESCE(release_date, created_on)::DATE) BETWEEN 31 AND 60
                             THEN 1 ELSE 0 END) AS b31_60,
                    SUM(CASE WHEN ('{ref_d_str}'::DATE - COALESCE(release_date, created_on)::DATE) > 60
                             THEN 1 ELSE 0 END) AS b61p
                FROM pr_dump
                WHERE (deletion_indicator IS NULL OR deletion_indicator = '')
                  AND release_status IN ('X','XX','XXX','XXXX','XXXXX')
                  AND NOT EXISTS (
                      SELECT 1 FROM po_dump po
                      WHERE po.purchase_requisition = pr_dump.purchase_requisition
                        AND po.item_of_requisition  = pr_dump.item_of_requisition
                  )
            """).fetchone()
            pr_aging = [
                {"bucket": "0-7d",   "value": int(pr_aging_row[0] or 0)},
                {"bucket": "8-30d",  "value": int(pr_aging_row[1] or 0)},
                {"bucket": "31-60d", "value": int(pr_aging_row[2] or 0)},
                {"bucket": "60+d",   "value": int(pr_aging_row[3] or 0)},
            ]

            # PR Quantity by Material Group
            pr_qty_rows = conn.execute("""
                SELECT material_group,
                       SUM(CAST(order_quantity AS REAL)) AS total_qty,
                       COUNT(DISTINCT purchase_requisition || '|' || item_of_requisition) AS pr_lines
                FROM pr_dump
                WHERE (deletion_indicator IS NULL OR deletion_indicator = '')
                  AND material_group IS NOT NULL
                  AND material_group != ''
                GROUP BY material_group ORDER BY total_qty DESC LIMIT 10
            """).fetchall()
            pr_qty_by_material = [{"material_group": r[0],
                                   "total_qty": round(r[1] or 0, 2),
                                   "pr_lines": int(r[2] or 0)} for r in pr_qty_rows]

            # Invoice vs Payment — monthly comparison
            inv_monthly = conn.execute(f"""
                SELECT LEFT(posting_date, 7) AS month,
                       SUM(CAST(amount_local_ccy AS REAL)) AS total
                FROM invoice_dump
                WHERE document_type IN ('RE','KR')
                  AND CAST(amount_local_ccy AS REAL) > 0
                  AND posting_date >= {cutoff}
                GROUP BY month ORDER BY month
            """).fetchall()
            pay_monthly = conn.execute(f"""
                SELECT LEFT(posting_date, 7) AS month,
                       SUM(CAST(amount_local_ccy AS REAL)) AS total
                FROM payment_dump
                WHERE posting_date >= {cutoff}
                GROUP BY month ORDER BY month
            """).fetchall()
            inv_map = {r[0]: round(r[1] or 0, 2) for r in inv_monthly}
            pay_map = {r[0]: round(r[1] or 0, 2) for r in pay_monthly}
            all_months = sorted(set(list(inv_map.keys()) + list(pay_map.keys())))
            invoice_vs_payment = [{"month": m,
                                   "invoice_amount": inv_map.get(m, 0),
                                   "payment_amount": pay_map.get(m, 0)} for m in all_months]

            results = {
                "type": "leadership_multi",
                "monthly": monthly,
                "invoice_by_vendor": invoice_by_vendor,
                "invoice_by_vendor_type": invoice_by_vendor_type,
                "pr_aging": pr_aging,
                "pr_qty_by_material": pr_qty_by_material,
                "invoice_vs_payment": invoice_vs_payment,
            }

        elif dashboard == "utilization":
            # Monthly CAPEX vs OPEX trend
            rows = conn.execute(f"""
                SELECT LEFT(document_date, 7) AS month,
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

def compute_all(conn: Any) -> None:
    ref_date = _get_ref_date(conn)
    FY, MTD  = _build_periods(ref_date)
    high_val = float(_get_config(conn, "HIGH_VALUE_PO_THRESHOLD", "10000000"))
    overall_cc_cfg = _get_config(conn, "ACTIVE_COMPANY_CODES", "")

    _procurement(conn, FY, MTD, high_val, ref_date)

    # Financial KPIs: run once per distinct company in invoice_dump, then once for ALL
    _cc_rows = conn.execute(
        "SELECT DISTINCT company_code FROM invoice_dump "
        "WHERE company_code IS NOT NULL AND company_code != ''"
    ).fetchall()
    for (cc,) in _cc_rows:
        _financial(conn, FY, MTD, cc_cfg=cc, company_code=cc)
    _financial(conn, FY, MTD, cc_cfg=overall_cc_cfg, company_code="ALL")

    _leadership(conn, FY, MTD, high_val)
    _vendor(conn, FY, MTD)

    # Vendor delivery days per company (V3 in _vendor uses cc_cfg/company_code params)
    _cc_rows_vendor = conn.execute(
        "SELECT DISTINCT company_code FROM po_dump "
        "WHERE company_code IS NOT NULL AND company_code != ''"
    ).fetchall()
    for (cc,) in _cc_rows_vendor:
        _vendor(conn, FY, MTD, cc_cfg=cc, company_code=cc)

    _utilization(conn, FY, MTD)

    conn.commit()
