"""create_deep_dive_report — one call builds a detailed KPMG-style deck about ONE
purchase order (and its vendors) or ONE vendor.

Three analysts run in parallel on the read-only harness connection. Each runs fixed,
parameterised SQL (no model-written SQL), builds its own tables / chart specs, and then
makes ONE model call to phrase insight bullets from its facts. Every bullet is
number-verified against those facts and replaced by a deterministic sentence if the
model is unavailable or invents a figure.

  PO Lifecycle     PR -> PO -> delivery -> GRN -> invoice -> payment, change history
  Vendor Profile   master data, spend, delivery / payment performance vs portfolio
  Risk & Compliance anomaly flags, vendor blocks, price deviation, master-data changes

Joins use the keys verified on the seeded data: PO->FI invoice via invoice_dump.po_reference,
FI invoice->payment via payment_dump.cleared_invoice, lines via (purchasing_document, item).
"""
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta

from ...artifacts import save_artifact
from ...event_generator import ANOMALY_CODES
from ...reports import charts
from ...reports.pptx import build_pptx_report
from ..context import TurnContext
from ..grounding import verify_numbers
from ..harness_db import harness_select as q
from ..registry import Tool, register

_ACTIVE = "(p.deletion_indicator IS NULL OR p.deletion_indicator NOT IN ('L','X'))"
_VALUE = "NULLIF(p.net_order_value,'')::numeric"
_SEV_RANK = {"HIGH": 3, "MEDIUM": 2, "LOW": 1}
MAX_VENDORS = 3


# ── small helpers ────────────────────────────────────────────────────────────────

def _f(x) -> float | None:
    try:
        return float(str(x).replace(",", "")) if x not in (None, "") else None
    except ValueError:
        return None


def _d(x) -> date | None:
    try:
        return datetime.strptime(str(x)[:10], "%Y-%m-%d").date() if x else None
    except ValueError:
        return None


def _show(d: date | None) -> str | None:
    return d.strftime("%d-%b-%Y") if d else None


def _days(a: date | None, b: date | None) -> int | None:
    return (b - a).days if a and b else None


def _cr(v: float | None) -> str:
    return charts._fmt(v, "inr") if v is not None else "—"


def _sum(rows, key) -> float:
    return sum(_f(r.get(key)) or 0.0 for r in rows)


def _pt(label, value):
    return {"x": str(label), "y": float(value)}


def _spec(kind, title, points, unit="number", y="value"):
    points = [p for p in points if p["y"] is not None]
    return {"chart_type": kind, "title": title, "x": "label", "y": y, "unit": unit,
            "points": points, "total_points": len(points)}


def _llm_bullets(topic: str, facts: dict, fallback: list[str], n: str = "3 to 5") -> list[str]:
    """One model call -> verified insight bullets; deterministic fallback on any failure."""
    from .. import orchestrator   # lazy: orchestrator imports the registry, which imports this module
    import json
    msgs = [
        {"role": "system", "content": (
            "You are a senior procurement analyst writing for an executive slide. Using ONLY the JSON facts "
            f"provided, write {n} insight bullets about {topic}. Rules: one sentence per bullet (max 28 words); "
            "copy numbers and dates exactly as they appear in the facts (rupee amounts are given as display "
            "strings such as '₹11.16 Cr'); never compute, estimate or invent a figure; be specific and "
            "evaluative (what is good, what is a concern); start every line with '- '; no headings.")},
        {"role": "user", "content": json.dumps(facts, default=str)},
    ]
    try:
        resp = orchestrator._call_with_cascade("narrator", msgs, temperature=0.2)
    except Exception:
        return fallback
    out = []
    for line in (resp.content or "").splitlines():
        line = re.sub(r"^\s*[-*•]\s*", "", line).strip()
        if len(line) > 15 and verify_numbers(line, [facts]).all_verified:
            out.append(line)
    return out[:6] or fallback


# ── 1. PO lifecycle analyst ──────────────────────────────────────────────────────

def analyse_po(po: str) -> dict:
    lines = q("SELECT purchasing_document, item, vendor, vendor_name, document_date, created_by, purchasing_org, "
              "purchasing_group, plant, company_code, material_group, material_description, order_quantity, "
              "unit_of_measure, net_order_price, net_order_value, purchase_requisition, release_indicator, "
              "release_strategy, payment_terms, capex_opex_flag, contract_number, purchasing_doc_type, tax_code, "
              "deletion_indicator FROM po_dump p WHERE purchasing_document=%s ORDER BY item", (po,))
    if not lines:
        raise LookupError(f"Purchase order {po} was not found.")
    head = lines[0]
    pr_no = head["purchase_requisition"]
    prs = q("SELECT purchase_requisition, requisitioner, release_date, valuation_price FROM pr_dump "
            "WHERE purchase_requisition=%s", (pr_no,)) if pr_no else []
    deliv = q("SELECT expected_delivery_date, actual_delivery_date FROM po_delivery_dump WHERE purchasing_document=%s", (po,))
    grn = q("SELECT material_document, debit_credit_ind, posting_date, quantity, amount_local_ccy FROM grn_dump "
            "WHERE purchasing_document=%s ORDER BY posting_date", (po,))
    mm_inv = q("SELECT invoice_doc, posting_date, amount_local_ccy FROM po_invoice_dump WHERE purchasing_document=%s "
               "ORDER BY posting_date", (po,))
    fi = q("SELECT invoice_doc, vendor, vendor_invoice_ref, posting_date, due_date, amount_local_ccy, tax_amount "
           "FROM invoice_dump WHERE po_reference=%s ORDER BY posting_date", (po,))
    pay = q("SELECT payment_doc, posting_date, amount_local_ccy, payment_method, cleared_invoice FROM payment_dump "
            "WHERE cleared_invoice = ANY(%s) ORDER BY posting_date", ([r["invoice_doc"] for r in fi],)) if fi else []
    chg = q("SELECT change_date, username, tcode, field_name, old_value, new_value FROM change_log "
            "WHERE object_class='EINKBELEG' AND object_id=%s ORDER BY change_date, id", (po,))

    po_value = _sum(lines, "net_order_value")
    received = sum((_f(g["amount_local_ccy"]) or 0) * (1 if g["debit_credit_ind"] == "S" else -1) for g in grn)
    invoiced, paid = _sum(fi, "amount_local_ccy"), _sum(pay, "amount_local_ccy")

    pr_d = min(filter(None, (_d(r["release_date"]) for r in prs)), default=None)
    po_d = min(filter(None, (_d(r["document_date"]) for r in lines)), default=None)
    exp_d = min(filter(None, (_d(r["expected_delivery_date"]) for r in deliv)), default=None)
    grn_d = min(filter(None, (_d(g["posting_date"]) for g in grn if g["debit_credit_ind"] == "S")), default=None)
    inv_d = min(filter(None, (_d(r["posting_date"]) for r in fi)), default=None)
    due_d = min(filter(None, (_d(r["due_date"]) for r in fi)), default=None)
    paid_d = max(filter(None, (_d(r["posting_date"]) for r in pay)), default=None)

    stages = [("PR → PO", _days(pr_d, po_d)), ("PO → GRN", _days(po_d, grn_d)),
              ("GRN → Invoice", _days(grn_d, inv_d)), ("Invoice → Payment", _days(inv_d, paid_d))]
    delay = _days(exp_d, grn_d)
    pay_vs_due = _days(due_d, paid_d)
    total_cycle = _days(pr_d, paid_d)
    status = ("Paid" if pay else "Invoiced — awaiting payment" if fi else
              "Invoice verified — not yet in AP" if mm_inv else "Not invoiced")
    price_var = None
    if prs and _f(prs[0]["valuation_price"]) and _f(head["net_order_price"]):
        price_var = round((_f(head["net_order_price"]) / _f(prs[0]["valuation_price"]) - 1) * 100, 1)

    raw = [("PR released", pr_d), ("PO created", po_d), ("Expected delivery", exp_d), ("GRN posted", grn_d),
           ("Invoice posted", inv_d), ("Payment due", due_d), ("Paid", paid_d)]
    milestones, prev = [], None
    for label, d in raw:
        if d is None:
            continue
        m = {"label": label, "date": _show(d)}
        if prev is not None:
            m["gap_days"] = max(_days(prev, d), 0) if _days(prev, d) is not None else None
            m["late"] = (label == "GRN posted" and (delay or 0) > 0) or (label == "Paid" and (pay_vs_due or 0) > 0)
        prev = d
        milestones.append(m)

    chain = [{"stage": "Purchase requisition", "document": pr_no or "—", "date": _show(pr_d), "amount": _f(prs[0]["valuation_price"]) * (_f(head["order_quantity"]) or 1) if prs and _f(prs[0]["valuation_price"]) else None},
             {"stage": "Purchase order", "document": po, "date": _show(po_d), "amount": po_value}]
    chain += [{"stage": "Goods receipt" + (" (return)" if g["debit_credit_ind"] == "H" else ""), "document": g["material_document"],
               "date": _show(_d(g["posting_date"])), "amount": _f(g["amount_local_ccy"])} for g in grn]
    chain += [{"stage": "Invoice (MM)", "document": r["invoice_doc"], "date": _show(_d(r["posting_date"])), "amount": _f(r["amount_local_ccy"])} for r in mm_inv]
    chain += [{"stage": "Vendor invoice (FI)", "document": r["invoice_doc"], "date": _show(_d(r["posting_date"])), "amount": _f(r["amount_local_ccy"])} for r in fi]
    chain += [{"stage": "Payment", "document": r["payment_doc"], "date": _show(_d(r["posting_date"])), "amount": _f(r["amount_local_ccy"])} for r in pay]

    vendors = list(dict.fromkeys(r["vendor"] for r in lines if r["vendor"]))
    facts = {
        "po": po, "vendors": [f"{r['vendor_name']} ({r['vendor']})" for r in lines[:1]] if len(vendors) == 1 else vendors,
        "po_value_inr": po_value, "po_value": _cr(po_value), "line_items": len(lines),
        "material": head["material_description"], "capex_opex": head["capex_opex_flag"],
        "pr_to_po_days": stages[0][1], "po_to_grn_days": stages[1][1], "grn_to_invoice_days": stages[2][1],
        "invoice_to_payment_days": stages[3][1], "total_cycle_days": total_cycle,
        "expected_delivery": _show(exp_d), "grn_date": _show(grn_d), "delivery_delay_days": delay,
        "invoice_due": _show(due_d), "paid_on": _show(paid_d), "payment_vs_due_days": pay_vs_due,
        "payment_status": status, "received_inr": received, "invoiced_inr": invoiced, "paid_inr": paid,
        "price_variance_pct": price_var, "master_data_changes": len(chg),
    }
    fallback = [f"PO {po} is worth {_cr(po_value)} across {len(lines)} line(s) and is {status.lower()}."]
    if stages[0][1] is not None:
        fallback.append(f"The PO was created {stages[0][1]} days after PR release; goods were received {stages[1][1]} days after PO creation."
                        if stages[1][1] is not None else f"The PO was created {stages[0][1]} days after PR release; no goods receipt is posted yet.")
    if delay is not None:
        fallback.append(f"Delivery was {abs(delay)} days {'late' if delay > 0 else 'early' if delay < 0 else 'on schedule'} against the expected date of {_show(exp_d)}."
                        if delay else f"Delivery arrived on the expected date of {_show(exp_d)}.")
    if pay_vs_due is not None:
        fallback.append(f"Payment cleared on {_show(paid_d)}, {'on the due date' if pay_vs_due == 0 else f'{abs(pay_vs_due)} days ' + ('after' if pay_vs_due > 0 else 'before') + ' the due date'}.")
    facts_for_llm = {k: v for k, v in facts.items() if v is not None}

    return {
        "lines": lines, "head": head, "vendors": vendors, "facts": facts, "milestones": milestones,
        "kpis": [("PO value", _cr(po_value)), ("Line items", str(len(lines))),
                 ("PO → GRN", f"{stages[1][1]} d" if stages[1][1] is not None else "—"),
                 ("Delivery vs plan", (f"{delay:+d} d" if delay else "On time") if delay is not None else "—"),
                 ("Invoice → paid", f"{stages[3][1]} d" if stages[3][1] is not None else "—"),
                 ("Status", status.split(" —")[0])],
        "stage_chart": _spec("hbar", "Stage durations (days)", [_pt(n, v) for n, v in stages if v is not None]),
        "recon_chart": _spec("bar", "Value reconciliation", [_pt("Ordered", po_value), _pt("Received", received),
                                                           _pt("Invoiced", invoiced), _pt("Paid", paid)], unit="inr"),
        "kv": [("PO number", po), ("Document type", head["purchasing_doc_type"]), ("Company code", head["company_code"]),
               ("Plant", head["plant"]), ("Purchasing org / group", f"{head['purchasing_org']} / {head['purchasing_group']}"),
               ("Created by", head["created_by"]), ("Created on", _show(po_d)), ("Payment terms", head["payment_terms"]),
               ("Release strategy", head["release_strategy"]), ("Spend type", head["capex_opex_flag"]),
               ("Contract", head["contract_number"] or "No contract"), ("Requisition", f"{pr_no} ({prs[0]['requisitioner']})" if prs else pr_no),
               ("Vendor", f"{head['vendor_name']} ({head['vendor']})")],
        "line_rows": [{"item": r["item"], "description": r["material_description"], "quantity": f"{r['order_quantity']} {r['unit_of_measure'] or ''}".strip(),
                       "unit_price": r["net_order_price"], "net_value": r["net_order_value"], "plant": r["plant"]} for r in lines],
        "chain_rows": chain,
        "change_rows": [{"date": _show(_d(c["change_date"])), "user": c["username"], "transaction": c["tcode"], "field": c["field_name"],
                         "old_value": c["old_value"] or "—", "new_value": c["new_value"] or "—"} for c in chg],
        "fallback": fallback, "llm_facts": facts_for_llm,
    }


# ── 2. Vendor profile analyst ────────────────────────────────────────────────────

def analyse_vendor(vendor: str, subject_po: str | None = None) -> dict:
    vm = q("SELECT vendor, vendor_name, country, city, region, account_group, payment_terms, msme_flag, vendor_type, "
           "central_purchasing_block, central_posting_block, deletion_flag_central, payment_block, posting_block_cc "
           "FROM vendor_master WHERE vendor=%s LIMIT 1", (vendor,))
    if not vm:
        raise LookupError(f"Vendor {vendor} was not found.")
    vm = vm[0]
    ranking = q(f"SELECT vendor, SUM({_VALUE}) AS spend FROM po_dump p WHERE {_ACTIVE} GROUP BY vendor ORDER BY spend DESC NULLS LAST")
    total_spend = sum(_f(r["spend"]) or 0 for r in ranking)
    mine = next((r for r in ranking if r["vendor"] == vendor), None)
    rank = ranking.index(mine) + 1 if mine else None
    spend = _f(mine["spend"]) if mine else 0.0
    counts = q(f"SELECT COUNT(DISTINCT purchasing_document) AS pos, COUNT(*) AS lines FROM po_dump p WHERE vendor=%s AND {_ACTIVE}", (vendor,))[0]
    monthly = q(f"SELECT to_char(document_date::date,'YYYY-MM') AS m, SUM({_VALUE}) AS spend FROM po_dump p "
                f"WHERE vendor=%s AND {_ACTIVE} AND document_date IS NOT NULL GROUP BY 1 ORDER BY 1", (vendor,))
    groups = q(f"SELECT material_group, MAX(material_description) AS description, SUM({_VALUE}) AS spend FROM po_dump p "
               f"WHERE vendor=%s AND {_ACTIVE} GROUP BY material_group ORDER BY spend DESC", (vendor,))
    top_pos = q(f"SELECT purchasing_document, MIN(document_date) AS document_date, MAX(material_description) AS description, "
                f"MAX(capex_opex_flag) AS type, SUM({_VALUE}) AS value FROM po_dump p WHERE vendor=%s AND {_ACTIVE} "
                f"GROUP BY purchasing_document ORDER BY value DESC NULLS LAST LIMIT 10", (vendor,))
    deliveries = q("SELECT d.expected_delivery_date AS exp, MIN(g.posting_date) AS grn FROM po_delivery_dump d "
                   "JOIN po_dump p ON p.purchasing_document=d.purchasing_document AND p.item=d.item "
                   "LEFT JOIN grn_dump g ON g.purchasing_document=d.purchasing_document AND g.item=d.item AND g.debit_credit_ind='S' "
                   "WHERE p.vendor=%s AND d.expected_delivery_date IS NOT NULL GROUP BY d.purchasing_document, d.item, d.expected_delivery_date", (vendor,))
    invoices = q("SELECT i.invoice_doc, i.amount_local_ccy AS amount, i.posting_date, i.due_date, pay.posting_date AS paid_date "
                 "FROM invoice_dump i LEFT JOIN payment_dump pay ON pay.cleared_invoice=i.invoice_doc WHERE i.vendor=%s", (vendor,))
    cyc = q("SELECT AVG(pr_to_po_days) AS pr_po, AVG(po_to_grn_days) AS po_grn, AVG(grn_to_invoice_days) AS grn_inv "
            "FROM pr_po_grn_invoice WHERE vendor=%s", (vendor,))[0]
    cyc_all = q("SELECT AVG(pr_to_po_days) AS pr_po, AVG(po_to_grn_days) AS po_grn, AVG(grn_to_invoice_days) AS grn_inv "
                "FROM pr_po_grn_invoice")[0]

    delays = [(_days(_d(r["exp"]), _d(r["grn"]))) for r in deliveries if r["grn"]]
    late = [x for x in delays if x > 0]
    otd = round(100 * (len(delays) - len(late)) / len(delays), 1) if delays else None
    avg_late = round(sum(late) / len(late), 1) if late else 0.0
    pay_days = [_days(_d(r["posting_date"]), _d(r["paid_date"])) for r in invoices if r["paid_date"]]
    on_time_pay = [1 for r in invoices if r["paid_date"] and _d(r["paid_date"]) and _d(r["due_date"]) and _d(r["paid_date"]) <= _d(r["due_date"])]
    open_inv = [r for r in invoices if not r["paid_date"]]
    avg_pay = round(sum(pay_days) / len(pay_days), 1) if pay_days else None
    share = round(100 * spend / total_spend, 1) if total_spend else None
    blocks = [n for n, v in (("Purchasing block", vm["central_purchasing_block"]), ("Posting block", vm["central_posting_block"]),
                             ("Payment block", vm["payment_block"]), ("Company-code posting block", vm["posting_block_cc"]),
                             ("Deletion flag", vm["deletion_flag_central"])) if v]

    def _avg(r, k):
        return round(float(r[k]), 1) if r.get(k) is not None else 0.0

    top5 = groups[:5]
    other = sum(_f(g["spend"]) or 0 for g in groups[5:])
    mix = [_pt((g["description"] or g["material_group"] or "—")[:24], _f(g["spend"]) or 0) for g in top5]
    if other:
        mix.append(_pt("Other", other))

    facts = {
        "vendor": vm["vendor_name"], "vendor_code": vendor, "city": vm["city"], "payment_terms": vm["payment_terms"],
        "total_spend_inr": spend, "total_spend": _cr(spend), "purchase_orders": counts["pos"], "po_lines": counts["lines"],
        "spend_rank": rank, "vendors_total": len(ranking), "spend_share_pct": share,
        "on_time_delivery_pct": otd, "late_deliveries": len(late), "avg_days_late": avg_late, "deliveries_measured": len(delays),
        "invoices": len(invoices), "invoices_paid": len(pay_days), "invoices_open": len(open_inv),
        "avg_invoice_to_payment_days": avg_pay, "paid_by_due_date": len(on_time_pay),
        "avg_po_to_grn_days": _avg(cyc, "po_grn"), "portfolio_po_to_grn_days": _avg(cyc_all, "po_grn"),
        "avg_grn_to_invoice_days": _avg(cyc, "grn_inv"), "portfolio_grn_to_invoice_days": _avg(cyc_all, "grn_inv"),
        "blocks": blocks or "none", "msme": "Yes" if vm["msme_flag"] else "No",
    }
    fallback = [f"{vm['vendor_name']} ranks #{rank} of {len(ranking)} vendors with {_cr(spend)} of spend"
                f"{f' ({share}% of the portfolio)' if share is not None else ''} across {counts['pos']} purchase orders."]
    if otd is not None:
        fallback.append(f"On-time delivery is {otd}% ({len(late)} of {len(delays)} deliveries late, averaging {avg_late} days late).")
    fallback.append(f"Goods arrive on average {facts['avg_po_to_grn_days']} days after PO creation versus {facts['portfolio_po_to_grn_days']} days portfolio-wide.")
    if avg_pay is not None:
        fallback.append(f"Invoices are paid {avg_pay} days after posting on average; {len(open_inv)} invoice(s) remain open.")
    fallback.append("No vendor blocks are active." if not blocks else f"Active vendor flags: {', '.join(blocks)}.")

    return {
        "vm": vm, "facts": facts, "fallback": fallback, "llm_facts": {k: v for k, v in facts.items() if v is not None},
        "kpis": [("Total spend", _cr(spend)), ("Purchase orders", str(counts["pos"])),
                 ("Spend rank", f"#{rank} of {len(ranking)}" if rank else "—"),
                 ("On-time delivery", f"{otd}%" if otd is not None else "—"),
                 ("Avg invoice → paid", f"{avg_pay} d" if avg_pay is not None else "—"),
                 ("Open invoices", str(len(open_inv)))],
        "kv": [("Vendor", f"{vm['vendor_name']} ({vendor})"), ("Location", ", ".join(x for x in (vm["city"], vm["region"], vm["country"]) if x)),
               ("Vendor type", vm["vendor_type"]), ("Account group", vm["account_group"]), ("Payment terms", vm["payment_terms"]),
               ("MSME", "Yes" if vm["msme_flag"] else "No"), ("Active blocks", ", ".join(blocks) or "None"),
               ("Spend share", f"{share}%" if share is not None else "—")],
        "trend_chart": _spec("line", "Monthly spend", [_pt(r["m"], _f(r["spend"]) or 0) for r in monthly], unit="inr", y="spend"),
        "mix_chart": _spec("donut", "Spend by material group", mix, unit="inr", y="spend"),
        "otd_chart": _spec("donut", "Deliveries: on time vs late",
                           [_pt("On time", len(delays) - len(late)), _pt("Late", len(late))]) if delays else None,
        "cycle_chart": {"chart_type": "grouped", "title": "Cycle time vs portfolio (days)", "unit": "number",
                        "labels": ["PR → PO", "PO → GRN", "GRN → Invoice"],
                        "series": {vm["vendor_name"][:22]: [_avg(cyc, "pr_po"), _avg(cyc, "po_grn"), _avg(cyc, "grn_inv")],
                                   "Portfolio": [_avg(cyc_all, "pr_po"), _avg(cyc_all, "po_grn"), _avg(cyc_all, "grn_inv")]}},
        "top_rows": [{"po": r["purchasing_document"] + ("  ◄ this PO" if r["purchasing_document"] == subject_po else ""),
                      "date": _show(_d(r["document_date"])), "description": r["description"], "type": r["type"], "value": _f(r["value"])}
                     for r in top_pos],
    }


# ── 3. Risk & compliance analyst ─────────────────────────────────────────────────

def _po_rating(flag_codes) -> str:
    """Worst severity on the PO's own lines."""
    worst = max((_SEV_RANK[ANOMALY_CODES[c][0]] for c in flag_codes if c in ANOMALY_CODES), default=0)
    return {3: "High", 2: "Medium"}.get(worst, "Low")


def _vendor_rating(lines: int, flagged: int, high_lines: int) -> str:
    """Share of the vendor's lines that are flagged / carry a high-severity flag."""
    r, h = flagged / lines if lines else 0, high_lines / lines if lines else 0
    return "High" if h >= 0.10 or r >= 0.5 else "Medium" if r >= 0.2 or h > 0 else "Low"


def analyse_risk(vendors: list[str], po: str | None, po_head: dict | None = None) -> dict:
    ev = q("SELECT purchasing_document, item, vendor, anomaly_flags FROM process_mining_events WHERE vendor = ANY(%s)", (vendors,))
    po_events = [e for e in ev if po and e["purchasing_document"] == po]
    vm = q("SELECT vendor, vendor_name, central_purchasing_block, central_posting_block, payment_block, posting_block_cc, "
           "deletion_flag_central, msme_flag FROM vendor_master WHERE vendor = ANY(%s)", (vendors,))
    vchg = q("SELECT object_id, change_date, username, tcode, field_name, old_value, new_value FROM change_log "
             "WHERE object_class='KRED' AND object_id = ANY(%s) ORDER BY change_date DESC LIMIT 10", (vendors,))
    maverick = q("SELECT COUNT(*) AS n FROM pr_po_grn_invoice WHERE purchasing_document=%s AND is_maverick=1", (po,))[0]["n"] if po else 0

    def codes(events):
        out = {}
        for e in events:
            for c in filter(None, (e["anomaly_flags"] or "").split(",")):
                out.setdefault(c.strip(), set()).add((e["purchasing_document"], e["item"]))
        return out

    all_codes, po_codes = codes(ev), codes(po_events)
    flagged_lines = len({(e["purchasing_document"], e["item"]) for e in ev if e["anomaly_flags"]})
    register_rows = sorted(({"flag": c, "severity": ANOMALY_CODES.get(c, ("LOW", ""))[0].title(), "lines": len(s),
                             "share": f"{100 * len(s) / max(len(ev), 1):.1f}%", "description": ANOMALY_CODES.get(c, ("", c))[1],
                             "on_this_po": "Yes" if c in po_codes else "No"}
                            for c, s in all_codes.items()),
                           key=lambda r: (-_SEV_RANK[r["severity"].upper()], -r["lines"]))
    high = len({k for c, s_ in all_codes.items() if ANOMALY_CODES.get(c, ("LOW",))[0] == "HIGH" for k in s_})
    vendor_rating = _vendor_rating(len(ev), flagged_lines, high)
    po_rating = _po_rating(po_codes) if po else None
    blocked = [v["vendor_name"] for v in vm if any(v[k] for k in ("central_purchasing_block", "central_posting_block", "payment_block", "posting_block_cc", "deletion_flag_central"))]
    price_var = None
    if po_head:
        pr = q("SELECT valuation_price FROM pr_dump WHERE purchase_requisition=%s LIMIT 1", (po_head["purchase_requisition"],)) if po_head.get("purchase_requisition") else []
        if pr and _f(pr[0]["valuation_price"]) and _f(po_head["net_order_price"]):
            price_var = round((_f(po_head["net_order_price"]) / _f(pr[0]["valuation_price"]) - 1) * 100, 1)

    facts = {
        "po": po, "po_risk_rating": po_rating, "po_flags": [f"{c} ({ANOMALY_CODES.get(c, ('', ''))[0].title()})" for c in po_codes] or "none",
        "po_maverick_lines": maverick, "po_price_variance_pct": price_var,
        "vendor_risk_rating": vendor_rating, "vendor_lines_reviewed": len(ev), "vendor_lines_flagged": flagged_lines,
        "high_severity_flag_lines": high, "top_flags": [f"{r['flag']}: {r['lines']} lines, {r['severity']} severity" for r in register_rows[:4]],
        "vendors_with_blocks": blocked or "none", "vendor_master_changes": len(vchg),
        "payment_term_changes": [f"{c['field_name']} {c['old_value']}→{c['new_value']} on {c['change_date']}" for c in vchg if c["field_name"] == "ZTERM"] or "none",
    }
    fallback = []
    if po:
        fallback.append(f"This PO carries {len(po_codes)} anomaly flag(s)" + (f": {', '.join(po_codes)}." if po_codes else ".") +
                        f" PO risk rating: {po_rating}.")
    fallback.append(f"{flagged_lines} of {len(ev)} vendor PO lines are flagged; {high} lines carry a high-severity flag. Vendor risk rating: {vendor_rating}.")
    if vchg:
        fallback.append(f"{len(vchg)} vendor master-data changes are logged, including terms and payment-block updates.")

    return {
        "facts": facts, "fallback": fallback, "llm_facts": {k: v for k, v in facts.items() if v is not None},
        "po_rating": po_rating, "vendor_rating": vendor_rating, "register_rows": register_rows,
        "kpis": [("Flagged lines", f"{flagged_lines} / {len(ev)}"), ("High-severity lines", str(high)),
                 ("Vendor risk", vendor_rating)] + ([("PO risk", po_rating), ("PO flags", str(len(po_codes)))] if po else []),
        "flag_chart": _spec("hbar", "Anomaly flags across the vendor's PO lines",
                            [_pt(r["flag"].replace("_", " ").title(), r["lines"]) for r in register_rows[:8]]) if register_rows else None,
        "change_rows": [{"date": _show(_d(c["change_date"])), "user": c["username"], "transaction": c["tcode"], "field": c["field_name"],
                         "old_value": c["old_value"] or "—", "new_value": c["new_value"] or "—"} for c in vchg],
    }


# ── orchestration + deck assembly ────────────────────────────────────────────────

def _recommendations(po_f, vendor_fs, risk, llm_facts) -> list[tuple[str, str]]:
    """Deterministic, rule-based actions grounded in the findings (no model text)."""
    recs = []
    for vf in vendor_fs:
        f = vf["facts"]
        if f["on_time_delivery_pct"] is not None and f["on_time_delivery_pct"] < 80:
            recs.append(("Tighten delivery commitments", f"{f['vendor']} delivers on time {f['on_time_delivery_pct']}% of the time; agree delivery SLAs and track expected dates weekly."))
        if f["invoices_open"]:
            recs.append(("Clear open invoices", f"{f['invoices_open']} invoice(s) from {f['vendor']} are still unpaid; review due dates to protect payment terms and MSME obligations."))
    if po_f and (po_f["facts"].get("delivery_delay_days") or 0) > 0:
        recs.append(("Review this PO's delivery delay", f"Goods arrived {po_f['facts']['delivery_delay_days']} days after the expected date; confirm whether the schedule line was agreed with the vendor."))
    if risk["register_rows"]:
        top = risk["register_rows"][0]
        recs.append((f"Investigate {top['flag'].replace('_', ' ').title()}", f"{top['lines']} vendor PO lines carry this {top['severity'].lower()}-severity flag: {top['description']}."))
    if risk["facts"]["vendor_master_changes"]:
        recs.append(("Audit vendor master changes", f"{risk['facts']['vendor_master_changes']} master-data changes are logged for this vendor; confirm each was authorised, especially payment terms."))
    recs.append(("Keep monitoring", "Re-run this deep dive after the next GRN or payment posting to refresh the lifecycle and risk view."))
    return recs[:6]


def run(subject: str, ident: str) -> dict:
    """Build the deck. Returns {pptx, title, slides, summary, facts, subtitle}."""
    po = ident if subject == "po" else None
    po_data = None
    if subject == "po":
        po_data = analyse_po(po)
        vendors = po_data["vendors"][:MAX_VENDORS]
    else:
        vendors = [ident]

    with ThreadPoolExecutor(max_workers=3) as pool:   # analysts run concurrently; each thread owns its DB connection
        v_futs = [pool.submit(analyse_vendor, v, po) for v in vendors]
        r_fut = pool.submit(analyse_risk, vendors, po, po_data["head"] if po_data else None)
        vendor_fs, risk = [f.result() for f in v_futs], r_fut.result()
        ins = {}
        if po_data:
            ins["po"] = pool.submit(_llm_bullets, f"the lifecycle of purchase order {po}", po_data["llm_facts"], po_data["fallback"])
        for i, vf in enumerate(vendor_fs):
            ins[f"v{i}"] = pool.submit(_llm_bullets, f"vendor {vf['facts']['vendor']}", vf["llm_facts"], vf["fallback"])
        ins["risk"] = pool.submit(_llm_bullets, "procurement risk and compliance", risk["llm_facts"], risk["fallback"])
        bullets = {k: f.result() for k, f in ins.items()}

    recs = _recommendations(po_data, vendor_fs, risk, None)
    all_facts = {"po": po_data["facts"] if po_data else None, "vendors": [v["facts"] for v in vendor_fs], "risk": risk["facts"]}
    exec_facts = {"po": po_data["llm_facts"] if po_data else None, "vendor": vendor_fs[0]["llm_facts"], "risk": risk["llm_facts"]}
    summary = _llm_bullets("an executive summary of the whole deep dive", exec_facts,
                           (po_data["fallback"][:2] if po_data else []) + vendor_fs[0]["fallback"][:2] + risk["fallback"][:1], n="3 to 4")

    vname = vendor_fs[0]["facts"]["vendor"]
    title = f"Detailed Report: Purchase Order {po}" if po else f"Vendor Deep Dive: {vname}"
    subtitle = (f"{po_data['head']['material_description']} · {', '.join(v['facts']['vendor'] for v in vendor_fs)}" if po
                else f"{vendor_fs[0]['vm']['city'] or ''} · Spend, delivery, payment and risk review").strip(" ·")

    sections: list[dict] = []
    agenda = ([("PO lifecycle", "Requisition to payment — milestones, durations and document chain")] if po else []) + [
        ("Vendor profile", "Spend, delivery and payment performance versus the portfolio"),
        ("Risk & compliance", "Anomaly flags, vendor blocks and master-data changes"),
        ("Recommendations", "Suggested actions and data notes")]
    sections.append({"kind": "agenda", "heading": "What this deck covers", "items": agenda})
    if po:
        kpis = [po_data["kpis"][i] for i in (0, 3, 5)] + [vendor_fs[0]["kpis"][i] for i in (0, 3)] + [risk["kpis"][2]]
    else:
        kpis = vendor_fs[0]["kpis"][:5] + [risk["kpis"][2]]
    sections.append({"kind": "kpis", "heading": "Executive summary", "kicker": "Overview", "kpis": kpis, "bullets": summary,
                     "bullets_title": "Headline findings"})

    n = 0
    if po:
        n += 1
        sections += [
            {"kind": "divider", "number": n, "heading": "PO lifecycle", "subtitle": f"Purchase order {po}"},
            {"kind": "key_values", "heading": f"Purchase order {po} at a glance", "kicker": "PO lifecycle", "pairs": po_data["kv"],
             "rows": po_data["line_rows"], "money_cols": ("unit_price", "net_value")},
            {"kind": "timeline", "heading": "From requisition to payment", "kicker": "PO lifecycle", "milestones": po_data["milestones"],
             "chart": po_data["stage_chart"] if po_data["stage_chart"]["points"] else None, "insights": bullets["po"]},
            {"kind": "chart_insights", "heading": "Ordered, received, invoiced and paid", "kicker": "PO lifecycle",
             "chart": po_data["recon_chart"], "insights": [f"Status: {po_data['facts']['payment_status']}.",
                                                          f"Ordered value {po_data['facts']['po_value']}."]},
            {"kind": "table", "heading": "Document chain", "kicker": "PO lifecycle", "data": po_data["chain_rows"], "money_cols": ("amount",)},
        ]
        if po_data["change_rows"]:
            sections.append({"kind": "table", "heading": "PO change history", "kicker": "PO lifecycle", "data": po_data["change_rows"], "plain": True})

    n += 1
    sections.append({"kind": "divider", "number": n, "heading": "Vendor profile", "subtitle": ", ".join(v["facts"]["vendor"] for v in vendor_fs)})
    for i, vf in enumerate(vendor_fs):
        vn = vf["facts"]["vendor"]
        sections += [
            {"kind": "kpis", "heading": f"{vn} — snapshot", "kicker": "Vendor profile", "kpis": vf["kpis"], "bullets": bullets[f"v{i}"],
             "bullets_title": "Vendor insights"},
            {"kind": "key_values", "heading": f"{vn} — master data", "kicker": "Vendor profile", "pairs": vf["kv"]},
            {"kind": "two_charts", "heading": f"{vn} — spend pattern", "kicker": "Vendor profile",
             "charts": [c for c in (vf["trend_chart"], vf["mix_chart"]) if c["points"]]},
            {"kind": "two_charts", "heading": f"{vn} — delivery and cycle-time performance", "kicker": "Vendor profile",
             "charts": [c for c in (vf["otd_chart"], vf["cycle_chart"]) if c], "insights": vf["fallback"][1:3]},
            {"kind": "table", "heading": f"{vn} — largest purchase orders", "kicker": "Vendor profile", "data": vf["top_rows"], "money_cols": ("value",)},
        ]

    n += 1
    sections += [
        {"kind": "divider", "number": n, "heading": "Risk & compliance", "subtitle": "Anomalies, blocks and master-data changes"},
        {"kind": "kpis", "heading": "Risk summary", "kicker": "Risk & compliance", "kpis": risk["kpis"], "bullets": bullets["risk"],
         "bullets_title": "Risk insights"},
    ]
    if risk["flag_chart"]:
        sections.append({"kind": "chart_insights", "heading": "Where the anomalies are", "kicker": "Risk & compliance", "chart": risk["flag_chart"],
                         "insights": [f"{r['flag'].replace('_', ' ').title()}: {r['description']}" for r in risk["register_rows"][:3]]})
    if risk["register_rows"]:
        sections.append({"kind": "table", "heading": "Risk register", "kicker": "Risk & compliance", "data": risk["register_rows"], "plain": True})
    if risk["change_rows"]:
        sections.append({"kind": "table", "heading": "Vendor master-data changes", "kicker": "Risk & compliance", "data": risk["change_rows"], "plain": True})

    sections += [
        {"kind": "cards", "heading": "Recommended actions", "kicker": "Recommendations", "items": recs},
        {"kind": "narrative", "heading": "Data sources and method", "kicker": "Appendix", "narrative": "\n".join([
            "Source: IntelliSource procurement warehouse — PO, PR, delivery, GRN, invoice, payment, vendor master, change log and process-mining tables.",
            "Invoices are matched to purchase orders through the PO reference and to payments through the cleared-invoice reference.",
            "Every figure is queried directly with fixed read-only SQL; insight text is checked against those figures before it is shown.",
            "Risk flags come from the platform's anomaly rules (late delivery, price deviation, maverick buying, duplicate invoice and others)."])},
    ]

    spec = {"title": title, "subtitle": subtitle, "kicker": "KPMG IntelliSource · Deep dive", "sections": sections}
    data = build_pptx_report(spec)
    from pptx import Presentation
    import io
    slides = len(Presentation(io.BytesIO(data)).slides)
    return {"pptx": data, "title": title, "slides": slides, "summary": summary, "facts": all_facts}


# ── tool ─────────────────────────────────────────────────────────────────────────

def _resolve_vendor(ident: str) -> str:
    ident = ident.strip()
    if re.fullmatch(r"\d{4,10}", ident):
        return ident
    rows = q("SELECT vendor, vendor_name FROM vendor_master WHERE vendor_name ILIKE %s ORDER BY length(vendor_name) LIMIT 1", (f"%{ident}%",))
    if not rows:
        raise LookupError(f"No vendor matching {ident!r} was found.")
    return rows[0]["vendor"]


def create_deep_dive_report(args: dict, ctx: TurnContext):
    subject, ident = str(args["subject"]).lower(), str(args["id"]).strip()
    if subject not in ("po", "vendor"):
        return {"error": "subject must be 'po' or 'vendor'."}
    try:
        res = run(subject, _resolve_vendor(ident) if subject == "vendor" else ident)
    except LookupError as exc:
        return {"error": str(exc)}
    record = save_artifact(ctx.session_id, f"{res['title']}.pptx", res["pptx"], kind="pptx")
    ctx.record_artifact({"id": record.artifact_id, "type": "pptx", "filename": record.filename,
                         "url": f"/api/chat/artifacts/{record.artifact_id}"})
    # The findings go into the manifest so numbers in the reply are grounded against them.
    ctx.manifest.put(res["facts"], hint="deepdive", description=f"deep-dive facts: {res['title']}")
    return {"artifact_id": record.artifact_id, "filename": record.filename, "url": f"/api/chat/artifacts/{record.artifact_id}",
            "slides": res["slides"], "summary": res["summary"],
            "note": "The deck is attached below the reply automatically — do not add links."}


register(Tool(
    name="create_deep_dive_report",
    description=("Build a DETAILED PowerPoint deck about ONE purchase order (and its vendors) or ONE vendor: lifecycle "
                 "timeline, charts, vendor performance, risk register and recommendations. Runs the data analysis "
                 "itself — use this instead of find_document/create_report for any 'detailed ppt / deep dive / full "
                 "report on PO X or vendor Y' request."),
    parameters={
        "type": "object",
        "properties": {
            "subject": {"type": "string", "enum": ["po", "vendor"]},
            "id": {"type": "string", "description": "PO number (e.g. 2000001126) or vendor code / name (e.g. 700300)."},
        },
        "required": ["subject", "id"],
    },
    executor=create_deep_dive_report,
    manifest_hint="deepdive",
))
