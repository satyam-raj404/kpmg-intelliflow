"""Canonical metric registry — the model reuses these instead of inventing SQL
for common questions. Kills metric drift (e.g. two different "active PO" defs
across answers) and gives small models a huge assist: recognise intent, pick a
metric key, done — no SQL authored at all for the common case.
"""
from dataclasses import dataclass


@dataclass
class Metric:
    key: str
    description: str
    sql: str  # single SELECT, safe to run as-is (still passes through guardrails)


METRICS: dict[str, Metric] = {
    "total_po_value": Metric(
        "total_po_value",
        "Total committed PO value across active (non-deleted) purchase orders.",
        "SELECT SUM(CAST(COALESCE(NULLIF(net_order_value,''),'0') AS REAL)) AS total_po_value "
        "FROM po_dump WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))",
    ),
    "active_po_count": Metric(
        "active_po_count",
        "Count of active (non-deleted) purchase orders.",
        "SELECT COUNT(*) AS active_po_count FROM po_dump WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))",
    ),
    "spend_by_vendor": Metric(
        "spend_by_vendor",
        "Total PO spend grouped by vendor, descending.",
        "SELECT vendor, vendor_name, "
        "SUM(CAST(COALESCE(NULLIF(net_order_value,''),'0') AS REAL)) AS spend "
        "FROM po_dump WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X')) "
        "GROUP BY vendor, vendor_name ORDER BY spend DESC",
    ),
    "capex_opex_split": Metric(
        "capex_opex_split",
        "Total spend split by CAPEX vs OPEX classification.",
        "SELECT capex_opex_flag, "
        "SUM(CAST(COALESCE(NULLIF(net_order_value,''),'0') AS REAL)) AS total "
        "FROM po_dump WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X')) GROUP BY capex_opex_flag",
    ),
    "avg_cycle_time": Metric(
        "avg_cycle_time",
        "Average end-to-end P2P cycle time in days.",
        "SELECT ROUND(AVG(total_cycle_days::numeric),1) AS avg_cycle_days FROM pr_po_grn_invoice",
    ),
    "maverick_rate": Metric(
        "maverick_rate",
        "Share of POs flagged as maverick spend (no approved requisition).",
        "SELECT ROUND(100.0 * SUM(CASE WHEN is_maverick != 0 THEN 1 ELSE 0 END) / "
        "NULLIF(COUNT(*),0), 1) AS maverick_pct FROM pr_po_grn_invoice",
    ),
    "overdue_invoices": Metric(
        "overdue_invoices",
        "Invoices posted >30 days ago with no matching payment yet.",
        "SELECT inv.purchasing_document, inv.invoice_doc, inv.amount_local_ccy, "
        "inv.posting_date, (CURRENT_DATE - inv.posting_date::date) AS days_overdue "
        "FROM po_invoice_dump inv "
        "LEFT JOIN payment_dump pay ON pay.cleared_invoice = inv.invoice_doc "
        "WHERE pay.payment_doc IS NULL AND (CURRENT_DATE - inv.posting_date::date) > 30 "
        "ORDER BY days_overdue DESC",
    ),
    "contract_match_rate": Metric(
        "contract_match_rate",
        "PO contract-number check verdict counts (MATCHED/UNMATCHED/NO_CONTRACT).",
        "SELECT contract_check, COUNT(*) AS n FROM po_dump GROUP BY contract_check",
    ),
    "top_anomalies": Metric(
        "top_anomalies",
        "Most common procurement anomaly flags.",
        "SELECT anomaly_flags, COUNT(*) AS n FROM process_mining_events "
        "GROUP BY anomaly_flags ORDER BY n DESC",
    ),
    "pr_to_po_cycle_time": Metric(
        "pr_to_po_cycle_time",
        "Average days from purchase requisition to purchase order.",
        "SELECT ROUND(AVG(pr_to_po_days::numeric),1) AS avg_pr_to_po_days FROM pr_po_grn_invoice",
    ),
    "high_value_po_count": Metric(
        "high_value_po_count",
        "Count and value of POs above Rs.1 Cr (10,000,000).",
        "SELECT COUNT(*) AS high_value_po_count, "
        "SUM(CAST(COALESCE(NULLIF(net_order_value,''),'0') AS REAL)) AS high_value_po_total "
        "FROM po_dump WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X')) "
        "AND CAST(COALESCE(NULLIF(net_order_value,''),'0') AS REAL) >= 10000000",
    ),
    "vendor_compliance": Metric(
        "vendor_compliance",
        "Active vs blocked vendor counts and compliance rate.",
        "SELECT COUNT(*) AS total_vendors, "
        "COUNT(*) FILTER (WHERE central_purchasing_block IS NULL OR central_purchasing_block = '') AS active_vendors, "
        "COUNT(*) FILTER (WHERE central_purchasing_block IS NOT NULL AND central_purchasing_block != '') AS blocked_vendors "
        "FROM vendor_master",
    ),
    "grn_pending_pos": Metric(
        "grn_pending_pos",
        "Active POs with no goods receipt posted yet.",
        "SELECT po.purchasing_document, po.vendor_name, po.net_order_value, po.document_date "
        "FROM po_dump po "
        "LEFT JOIN grn_dump grn ON grn.purchasing_document = po.purchasing_document "
        "WHERE grn.purchasing_document IS NULL "
        "AND (po.deletion_indicator IS NULL OR po.deletion_indicator NOT IN ('L','X')) "
        "ORDER BY po.document_date DESC",
    ),
    "payment_total_ytd": Metric(
        "payment_total_ytd",
        "Total outgoing payments (all recorded payments).",
        "SELECT SUM(CAST(COALESCE(NULLIF(amount_local_ccy,''),'0') AS REAL)) AS payment_total "
        "FROM payment_dump",
    ),
    "spend_by_material_group": Metric(
        "spend_by_material_group",
        "Total PO spend grouped by material group, descending.",
        "SELECT material_group, "
        "SUM(CAST(COALESCE(NULLIF(net_order_value,''),'0') AS REAL)) AS spend "
        "FROM po_dump WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X')) "
        "GROUP BY material_group ORDER BY spend DESC",
    ),
    "msme_overdue_payments": Metric(
        "msme_overdue_payments",
        "MSME vendor invoices unpaid beyond 45 days (MSMED Act compliance).",
        "SELECT inv.purchasing_document, inv.invoice_doc, inv.amount_local_ccy, inv.posting_date, "
        "(CURRENT_DATE - inv.posting_date::date) AS days_overdue "
        "FROM po_invoice_dump inv "
        "JOIN po_dump po ON po.purchasing_document = inv.purchasing_document "
        "JOIN vendor_master vm ON vm.vendor = po.vendor AND vm.msme_flag IN ('M','S') "
        "LEFT JOIN payment_dump pay ON pay.cleared_invoice = inv.invoice_doc "
        "WHERE pay.payment_doc IS NULL AND (CURRENT_DATE - inv.posting_date::date) > 45 "
        "ORDER BY days_overdue DESC",
    ),
}

# Alias phrases -> canonical metric key. Used by the fast-path router for
# rule-based (zero-LLM-latency) intent matching, and mentioned to the model as
# a hint so it prefers get_metric over hand-writing equivalent SQL.
METRIC_ALIASES: dict[str, list[str]] = {
    "total_po_value": ["total po value", "total purchase order value", "total committed spend",
                        "total procurement value", "po value"],
    "active_po_count": ["active po count", "how many active pos", "number of active purchase orders",
                         "active purchase orders"],
    "spend_by_vendor": ["spend by vendor", "top vendors", "vendor spend", "spend per vendor",
                         "which vendors", "top suppliers", "supplier spend"],
    "capex_opex_split": ["capex opex split", "capex vs opex", "capital vs operational",
                          "capex percentage", "opex percentage"],
    "avg_cycle_time": ["cycle time", "p2p cycle", "average cycle time", "end to end cycle",
                        "procure to pay time"],
    "maverick_rate": ["maverick spend", "maverick rate", "maverick buying", "off-contract spend",
                       "unauthorized purchases"],
    "overdue_invoices": ["overdue invoices", "overdue payments", "unpaid invoices", "late payments",
                          "invoices pending payment"],
    "contract_match_rate": ["contract match rate", "contract compliance", "matched contracts",
                             "unmatched contracts"],
    "top_anomalies": ["anomalies", "anomaly report", "risk flags", "procurement risks",
                       "split pos", "duplicate invoices"],
    "pr_to_po_cycle_time": ["pr to po", "requisition to order", "pr to po time", "pr backlog"],
    "high_value_po_count": ["high value pos", "large purchase orders", "high-value purchase orders"],
    "vendor_compliance": ["vendor compliance", "blocked vendors", "vendor block status"],
    "grn_pending_pos": ["grn pending", "goods receipt pending", "pos without grn", "no grn"],
    "payment_total_ytd": ["total payments", "payments made", "total paid", "payment total"],
    "spend_by_material_group": ["spend by material group", "material group spend", "spend by category"],
    "msme_overdue_payments": ["msme compliance", "msme overdue", "msme payment delays",
                               "msmed act", "msme vendors"],
}


def get_metric(key: str) -> Metric:
    if key not in METRICS:
        raise KeyError(f"Unknown metric {key!r}. Known: {list(METRICS)}")
    return METRICS[key]


def list_metrics_for_prompt() -> str:
    return "\n".join(f"- {m.key}: {m.description}" for m in METRICS.values())


def match_alias(question: str) -> str | None:
    """Rule-based fuzzy match: question text -> metric key, or None.
    Longest alias match wins (more specific phrase beats a generic substring)."""
    q = question.lower()
    best_key, best_len = None, 0
    for key, phrases in METRIC_ALIASES.items():
        for phrase in phrases:
            if phrase in q and len(phrase) > best_len:
                best_key, best_len = key, len(phrase)
    return best_key


if __name__ == "__main__":
    assert get_metric("total_po_value").sql.strip().upper().startswith("SELECT")
    for key in METRICS:
        assert key in METRIC_ALIASES, f"metric {key!r} has no aliases registered"
    assert match_alias("what are the top vendors by spend") == "spend_by_vendor"
    assert match_alias("show me msme compliance status") == "msme_overdue_payments"
    assert match_alias("banana") is None
    print(list_metrics_for_prompt())
    print("metrics OK —", len(METRICS), "canonical metrics,", len(METRIC_ALIASES), "alias sets")
