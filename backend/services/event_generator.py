"""Step 5 — Process mining events + anomaly detection."""
import sqlite3
from datetime import datetime, timedelta


IDEAL_PATHS = {
    "PR_PO_GRN_INV_PAY": ["PR_CREATED", "PR_APPROVED", "PO_CREATED", "GRN_POSTED", "INVOICE_POSTED", "PAYMENT_MADE"],
    "PO_GRN_INV_PAY":    ["PO_CREATED", "GRN_POSTED", "INVOICE_POSTED", "PAYMENT_MADE"],
    "PR_PO_INV_PAY":     ["PR_CREATED", "PR_APPROVED", "PO_CREATED", "INVOICE_POSTED", "PAYMENT_MADE"],
    "PO_INV_PAY":        ["PO_CREATED", "INVOICE_POSTED", "PAYMENT_MADE"],
}

ANOMALY_CODES = {
    "MAVERICK_BUY":         ("HIGH",   "PO created without approved PR"),
    "LATE_DELIVERY":        ("MEDIUM", "GRN posting date exceeds expected delivery date"),
    "THREE_WAY_MISMATCH":   ("HIGH",   "GRN quantity differs from invoice quantity > 5%"),
    "DUPLICATE_INVOICE":    ("HIGH",   "Same vendor+amount+date appears > 1 time"),
    "BACKDATED_PO":         ("MEDIUM", "PO document date < PR release date"),
    "PAYMENT_BEFORE_GRN":   ("HIGH",   "Payment posting date before GRN posting date"),
    "LONG_APPROVAL":        ("LOW",    "PR approval time > 7 days"),
    "PRICE_DEVIATION":      ("MEDIUM", "PO net price deviates > 10% from PR valuation price"),
    "SPLIT_PO":             ("MEDIUM", "Multiple POs to same vendor same day same material group"),
    "OVERDUE_INVOICE":      ("MEDIUM", "Invoice due date passed without payment (open > 30 days)"),
    "GRN_WITHOUT_PO":       ("HIGH",   "GRN posting references PO not in po_dump"),
    "VENDOR_BLOCK":         ("HIGH",   "PO raised against payment-blocked vendor"),
    "LATE_PAYMENT":         ("LOW",    "Payment clearing date after invoice due date"),
}


def _classify_variant(activities: list[str]) -> str:
    act_set = set(activities)
    for name, path in IDEAL_PATHS.items():
        if act_set >= set(path):
            return name
    if "PR_CREATED" in act_set and "PO_CREATED" in act_set:
        return "PR_PO_VARIANT"
    if "PO_CREATED" in act_set:
        return "PO_ONLY_VARIANT"
    return "INCOMPLETE"


def generate_events(conn: sqlite3.Connection) -> None:
    conn.execute("DELETE FROM process_mining_events")

    facts = conn.execute("""
        SELECT f.id, f.purchasing_document, f.item, f.vendor,
               f.purchase_requisition, f.item_of_requisition,
               f.pr_delivery_date, f.pr_release_date,
               f.po_document_date, f.po_delivery_date,
               f.grn_posting_date, f.invoice_posting_date,
               f.grn_quantity, f.invoice_quantity,
               f.po_net_price, f.pr_value,
               f.is_maverick,
               f.po_to_grn_days,
               f.material_group
        FROM pr_po_grn_invoice f
        WHERE f.purchasing_document IS NOT NULL
    """).fetchall()

    # Precompute duplicate invoice candidates
    dup_invoices = set()
    try:
        rows = conn.execute("""
            SELECT vendor, amount_local_ccy, posting_date
            FROM invoice_dump
            GROUP BY vendor, amount_local_ccy, posting_date
            HAVING COUNT(*) > 1
        """).fetchall()
        for r in rows:
            dup_invoices.add((r[0], str(r[1]), r[2]))
    except Exception:
        pass

    # Precompute split PO candidates (same vendor+day+material_group, count >1)
    split_pos = set()
    try:
        rows = conn.execute("""
            SELECT vendor, document_date, material_group
            FROM po_dump
            WHERE deletion_indicator IS NULL OR deletion_indicator = ''
            GROUP BY vendor, document_date, material_group
            HAVING COUNT(*) > 1
        """).fetchall()
        for r in rows:
            split_pos.add((r[0], r[1], r[2]))
    except Exception:
        pass

    # Precompute overdue open invoices
    overdue_invoices = set()
    try:
        today = datetime.utcnow().strftime("%Y-%m-%d")
        rows = conn.execute("""
            SELECT invoice_doc, invoice_year FROM invoice_dump
            WHERE (clearing_doc IS NULL OR clearing_doc = '')
              AND due_date < ?
              AND julianday(?) - julianday(due_date) > 30
        """, (today, today)).fetchall()
        for r in rows:
            overdue_invoices.add((r[0], r[1]))
    except Exception:
        pass

    # Precompute blocked vendors
    blocked_vendors = set()
    try:
        rows = conn.execute("""
            SELECT vendor FROM vendor_master
            WHERE central_purchasing_block = 'X'
               OR central_posting_block = 'X'
        """).fetchall()
        blocked_vendors = {r[0] for r in rows}
    except Exception:
        pass

    # Precompute late payments
    late_payment_pos = set()
    try:
        rows = conn.execute("""
            SELECT pi.purchasing_document FROM po_invoice_dump pi
            JOIN invoice_dump inv ON pi.invoice_doc = inv.invoice_doc
              AND pi.invoice_year = inv.invoice_year
            JOIN payment_dump pay ON inv.invoice_doc = pay.cleared_invoice
            WHERE pay.clearing_date > inv.due_date
        """).fetchall()
        late_payment_pos = {r[0] for r in rows}
    except Exception:
        pass

    # Precompute payment before GRN (po-level)
    payment_before_grn_pos = set()
    try:
        rows = conn.execute("""
            SELECT pi.purchasing_document FROM po_invoice_dump pi
            JOIN invoice_dump inv ON pi.invoice_doc = inv.invoice_doc
            JOIN payment_dump pay ON inv.invoice_doc = pay.cleared_invoice
            JOIN pr_po_grn_invoice f ON pi.purchasing_document = f.purchasing_document
            WHERE pay.posting_date < f.grn_posting_date
        """).fetchall()
        payment_before_grn_pos = {r[0] for r in rows}
    except Exception:
        pass

    events_batch = []

    for row in facts:
        (fact_id, po, item, vendor, pr, pr_item,
         pr_del_date, pr_rel_date, po_doc_date, po_del_date,
         grn_date, inv_date, grn_qty, inv_qty,
         po_price, pr_price, is_maverick, po_grn_days, mat_group) = row

        activities = []
        timestamps = []

        if pr and pr_rel_date:
            activities.append("PR_CREATED")
            timestamps.append(pr_rel_date)
            # PR approval — use release_date as proxy (same day)
            activities.append("PR_APPROVED")
            timestamps.append(pr_rel_date)

        if po_doc_date:
            activities.append("PO_CREATED")
            timestamps.append(po_doc_date)

        if grn_date:
            activities.append("GRN_POSTED")
            timestamps.append(grn_date)

        if inv_date:
            activities.append("INVOICE_POSTED")
            timestamps.append(inv_date)

        # Payment (get from payment_dump via invoice join)
        pay_date = None
        try:
            r = conn.execute("""
                SELECT MIN(pay.posting_date) FROM po_invoice_dump pi
                JOIN invoice_dump inv ON pi.invoice_doc = inv.invoice_doc
                JOIN payment_dump pay ON inv.invoice_doc = pay.cleared_invoice
                WHERE pi.purchasing_document = ? AND pi.item = ?
            """, (po, item)).fetchone()
            if r and r[0]:
                pay_date = r[0]
        except Exception:
            pass

        if pay_date:
            activities.append("PAYMENT_MADE")
            timestamps.append(pay_date)

        variant_class = _classify_variant(activities)

        # Anomaly detection
        flags = []

        if is_maverick:
            flags.append("MAVERICK_BUY")

        if po_del_date and grn_date and grn_date > po_del_date:
            flags.append("LATE_DELIVERY")

        if grn_qty is not None and inv_qty is not None and inv_qty != 0:
            if abs(grn_qty - inv_qty) / abs(inv_qty) > 0.05:
                flags.append("THREE_WAY_MISMATCH")

        if vendor and inv_date:
            try:
                inv_row = conn.execute(
                    "SELECT amount_local_ccy FROM invoice_dump WHERE vendor = ? AND posting_date = ? LIMIT 1",
                    (vendor, inv_date)
                ).fetchone()
                if inv_row and (vendor, str(inv_row[0]), inv_date) in dup_invoices:
                    flags.append("DUPLICATE_INVOICE")
            except Exception:
                pass

        if pr_rel_date and po_doc_date and po_doc_date < pr_rel_date:
            flags.append("BACKDATED_PO")

        if po in payment_before_grn_pos:
            flags.append("PAYMENT_BEFORE_GRN")

        if po_price and pr_price and pr_price != 0:
            if abs(po_price - pr_price) / abs(pr_price) > 0.10:
                flags.append("PRICE_DEVIATION")

        if vendor and po_doc_date and mat_group:
            if (vendor, po_doc_date, mat_group) in split_pos:
                flags.append("SPLIT_PO")

        if vendor and vendor in blocked_vendors:
            flags.append("VENDOR_BLOCK")

        if po in late_payment_pos:
            flags.append("LATE_PAYMENT")

        anomaly_flags = ",".join(flags) if flags else None
        anomaly_count = len(flags)

        events_batch.append((
            po, item, vendor,
            pr, pr_item,
            ",".join(activities),
            timestamps[0] if timestamps else None,
            timestamps[-1] if len(timestamps) > 1 else None,
            variant_class,
            anomaly_flags,
            anomaly_count,
        ))

    conn.executemany("""
        INSERT INTO process_mining_events (
            purchasing_document, item, vendor,
            purchase_requisition, item_of_requisition,
            activities, start_time, end_time,
            variant_class, anomaly_flags, anomaly_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, events_batch)

    conn.commit()
