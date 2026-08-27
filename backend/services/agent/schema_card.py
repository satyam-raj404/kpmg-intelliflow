"""Compact schema retrieval — only the 1-3 relevant tables per question, not the
full schema. This is what makes small/local models viable: a 7B model given the
whole 20-table schema drowns; given 2 relevant tables + a worked SQL pattern it
does fine.
"""
import re
from dataclasses import dataclass, field


@dataclass
class TableCard:
    name: str
    columns: str          # short "col[type notes], ..." string
    description: str
    keywords: list[str] = field(default_factory=list)
    patterns: list[str] = field(default_factory=list)  # worked SQL snippets


TABLES: dict[str, TableCard] = {
    "po_dump": TableCard(
        name="po_dump",
        columns=(
            "purchasing_document, item, vendor, vendor_name, net_order_value[TEXT], "
            "document_date, company_code, plant, material_group, deletion_indicator, "
            "delivery_completed, capex_opex_flag, contract_number, contract_check"
        ),
        description="Purchase orders. One row per PO line item.",
        keywords=["po", "purchase order", "vendor", "spend", "capex", "opex", "contract",
                   "maverick", "high-value", "plant", "material"],
        patterns=[
            "Active POs: (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X')) — NULL must be handled explicitly, NOT IN alone silently drops NULL rows",
            "Cast value: CAST(COALESCE(NULLIF(net_order_value,''),'0') AS REAL)",
            "EXAMPLE — 'total spend for company 1001': "
            "SELECT SUM(CAST(COALESCE(NULLIF(net_order_value,''),'0') AS REAL)) AS total "
            "FROM po_dump WHERE company_code = '1001' AND (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))",
            "EXAMPLE — 'POs above 5 Cr': "
            "SELECT purchasing_document, vendor_name, net_order_value FROM po_dump "
            "WHERE CAST(COALESCE(NULLIF(net_order_value,''),'0') AS REAL) >= 50000000 "
            "AND (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))",
        ],
    ),
    "pr_dump": TableCard(
        name="pr_dump",
        columns="purchase_requisition, item_of_requisition, material_description, order_quantity, release_status, created_on, company_code, deletion_indicator",
        description="Purchase requisitions — the request that precedes a PO.",
        keywords=["pr", "requisition", "request"],
    ),
    "grn_dump": TableCard(
        name="grn_dump",
        columns="material_document, purchasing_document, item, material_doc_item, posting_date, movement_type, debit_credit_ind, plant",
        description="Goods receipts against POs. Column is material_document, NOT mat_doc.",
        keywords=["grn", "goods receipt", "delivery", "received"],
        patterns=[
            "EXAMPLE — 'POs with no GRN yet': "
            "SELECT po.purchasing_document FROM po_dump po "
            "LEFT JOIN grn_dump grn ON grn.purchasing_document = po.purchasing_document "
            "WHERE grn.purchasing_document IS NULL",
        ],
    ),
    "po_invoice_dump": TableCard(
        name="po_invoice_dump",
        columns="invoice_doc, purchasing_document, item, invoice_year, amount_local_ccy[TEXT], posting_date",
        description="Invoices linked to a PO. Join to payment via invoice_doc = payment_dump.cleared_invoice.",
        keywords=["invoice", "billed", "3-way match"],
    ),
    "invoice_dump": TableCard(
        name="invoice_dump",
        columns="invoice_doc, vendor, document_type, posting_date, due_date, amount_local_ccy[TEXT]",
        description="Standalone vendor invoices (AP).",
        keywords=["invoice", "ap", "payable", "overdue"],
        patterns=[
            "Overdue: LEFT JOIN payment_dump pay ON pay.cleared_invoice = inv.invoice_doc "
            "WHERE pay.payment_doc IS NULL AND (CURRENT_DATE - inv.posting_date::date) > 30",
        ],
    ),
    "payment_dump": TableCard(
        name="payment_dump",
        columns="payment_doc, payment_year, vendor, company_code, amount_local_ccy[TEXT], posting_date, clearing_date, cleared_invoice, payment_method",
        description="Outgoing payments. No purchasing_document column — join to invoices via cleared_invoice.",
        keywords=["payment", "paid", "cleared", "cash"],
    ),
    "vendor_master": TableCard(
        name="vendor_master",
        columns="vendor, vendor_name, country, city, msme_flag, central_purchasing_block, payment_block, vendor_type",
        description="Vendor reference data. Column is vendor_name, NOT name1.",
        keywords=["vendor", "supplier", "msme", "blocked"],
        patterns=[
            "EXAMPLE — 'blocked vendors': "
            "SELECT vendor, vendor_name FROM vendor_master "
            "WHERE central_purchasing_block IS NOT NULL AND central_purchasing_block != ''",
        ],
    ),
    "contract_master": TableCard(
        name="contract_master",
        columns="contract_number, contract_name, vendor, contract_type, contract_value, status, start_date, end_date",
        description="Contracts. po_dump.contract_number is checked against this (contract_check column).",
        keywords=["contract", "agreement", "framework"],
    ),
    "pr_po_grn_invoice": TableCard(
        name="pr_po_grn_invoice",
        columns=(
            "purchase_requisition, purchasing_document, vendor, vendor_name, company_code, "
            "po_net_value[REAL], grn_amount, invoice_amount, pr_to_po_days, po_to_grn_days, "
            "grn_to_invoice_days, invoice_to_payment_days, total_cycle_days, is_maverick, capex_opex_flag"
        ),
        description="Denormalised P2P fact table — use for cycle-time analysis.",
        keywords=["cycle time", "p2p", "maverick", "lifecycle", "days", "duration"],
        patterns=[
            "ROUND requires ::numeric cast, e.g. ROUND(AVG(pr_to_po_days::numeric),1)",
            "EXAMPLE — 'average cycle time by vendor': "
            "SELECT vendor_name, ROUND(AVG(total_cycle_days::numeric),1) AS avg_days "
            "FROM pr_po_grn_invoice GROUP BY vendor_name ORDER BY avg_days DESC",
        ],
    ),
    "process_mining_events": TableCard(
        name="process_mining_events",
        columns="purchasing_document, anomaly_flags[comma-sep], anomaly_count, variant_class",
        description="Per-PO anomaly classifications (SPLIT_PO, MAVERICK_BUY, etc.).",
        keywords=["anomaly", "risk", "flag", "split po", "duplicate"],
    ),
    "kpi_results": TableCard(
        name="kpi_results",
        columns="kpi_code, kpi_name, value_numeric, value_text, unit, dashboard, company_code",
        description="Pre-computed KPI values — prefer this over raw SQL for dashboard-level metrics.",
        keywords=["kpi", "dashboard", "metric", "summary"],
    ),
}


def select_relevant_tables(question: str, max_tables: int = 4) -> list[TableCard]:
    """Keyword-overlap ranking — cheap, deterministic, no embedding model required.

    Word-boundary matching (not substring) — "po" must match the word "po", not
    the "po" inside "re-po-rt". Multi-word phrases score higher: they're rarer
    and far more specific signal than a single common word.
    """
    q = question.lower()
    scored: list[tuple[int, TableCard]] = []
    for card in TABLES.values():
        score = 0
        for kw in card.keywords:
            weight = 2 if " " in kw else 1
            if re.search(rf"\b{re.escape(kw)}\b", q):
                score += weight
        if re.search(rf"\b{re.escape(card.name.replace('_', ' '))}\b", q):
            score += 3
        if score > 0:
            scored.append((score, card))
    scored.sort(key=lambda t: -t[0])
    top = [c for _, c in scored[:max_tables]]
    return top or [TABLES["kpi_results"]]  # sane default: pre-computed KPIs


def render_schema_card(tables: list[TableCard]) -> str:
    lines = []
    for t in tables:
        lines.append(f"- {t.name}({t.columns}) — {t.description}")
        for p in t.patterns:
            lines.append(f"    pattern: {p}")
    return "\n".join(lines)


if __name__ == "__main__":
    picked = select_relevant_tables("what is the average PO to GRN cycle time by vendor")
    names = [t.name for t in picked]
    assert "pr_po_grn_invoice" in names, names
    print(render_schema_card(picked))
    print("schema_card OK")
