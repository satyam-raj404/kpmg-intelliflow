"""OpenRouter agentic loop — NL question → tool calls → final answer."""
import json
import os
import re
import time
import urllib.request
import urllib.error
from typing import Any

from services.chat_tools import (
    query_database,
    get_kpis,
    find_document,
    get_anomalies,
    get_vendor_info,
    get_p2p_stage_summary,
)

OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODEL = "openai/gpt-4o"

SYSTEM_PROMPT = """You are IntelliSource AI — KPMG P2P procurement analytics assistant with LIVE PostgreSQL database access.

RULES: Always call a tool before answering data questions. Never invent numbers. Format INR values ≥1Cr as ₹X.XX Cr. Use at most 3 tool calls per response, then synthesize your final answer from the results you have.

TABLES:
- po_dump: POs (purchasing_document, vendor, vendor_name, net_order_value[TEXT], document_date, company_code, deletion_indicator, delivery_completed, capex_opex_flag, material_description)
  Active POs: deletion_indicator NOT IN ('L','X'). Cast value: CAST(COALESCE(NULLIF(net_order_value,''),'0') AS REAL)
- pr_dump: PRs (purchase_requisition, material_description, order_quantity, release_status, release_date, created_on, company_code, deletion_indicator)
- grn_dump: GRNs (mat_doc, purchasing_document, quantity, posting_date)
- po_invoice_dump: Invoices (invoice_doc, purchasing_document, amount_local_ccy[TEXT], invoice_date)
- payment_dump: Payments (payment_doc, vendor, amount[TEXT], payment_date, purchasing_document)
- vendor_master: Vendors (vendor, name1, posting_block_cc, msme_flag)
- pr_po_grn_invoice: P2P FACT TABLE (purchase_requisition, purchasing_document, vendor, vendor_name, company_code, po_net_value[REAL], grn_amount, invoice_amount, pr_to_po_days, po_to_grn_days, grn_to_invoice_days, invoice_to_payment_days, total_cycle_days, grn_posting_date, invoice_posting_date, is_maverick, capex_opex_flag)
  Use for cycle time analysis. ROUND requires ::numeric cast e.g. ROUND(AVG(pr_to_po_days::numeric),1)
- process_mining_events: Anomalies (purchasing_document, anomaly_flags[comma-sep], anomaly_count, variant_class)
  Flags: SPLIT_PO, RETRO_PO, NO_GRN, PRICE_VARIANCE, MAVERICK_BUY, DELETED_AFTER_GRN
- kpi_results: Pre-computed KPIs (kpi_code, kpi_name, value_numeric, value_text, unit, dashboard, company_code)
  Dashboards: procurement, financial, leadership, vendor, utilization. Companies: 1001, 1002, 1003, ALL

Use markdown tables for comparisons. Bold key numbers. Lead with direct answer."""


TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "query_database",
            "description": "Run a read-only PostgreSQL SELECT on the procurement database. Use for custom aggregations, trend analysis, or any multi-table join not covered by other tools. Always use CAST for numeric text columns.",
            "parameters": {
                "type": "object",
                "properties": {
                    "sql": {
                        "type": "string",
                        "description": "Valid PostgreSQL SELECT. No writes. Use LIMIT. Cast net_order_value: CAST(COALESCE(NULLIF(net_order_value,''),'0') AS REAL). Use ::numeric for ROUND().",
                    }
                },
                "required": ["sql"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_kpis",
            "description": "Fetch pre-computed KPI values. Faster than raw SQL for dashboard-level metrics. Call this first for any KPI question.",
            "parameters": {
                "type": "object",
                "properties": {
                    "dashboard": {
                        "type": "string",
                        "enum": ["procurement", "financial", "leadership", "vendor", "utilization"],
                    },
                    "company_code": {
                        "type": "string",
                        "description": "1001, 1002, 1003, or ALL",
                        "default": "ALL",
                    },
                },
                "required": ["dashboard"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "find_document",
            "description": "Find full P2P chain details for a PO, PR, GRN, or Invoice number. Always use this for document-specific questions.",
            "parameters": {
                "type": "object",
                "properties": {
                    "doc_type": {"type": "string", "enum": ["PO", "PR", "GRN", "INVOICE"]},
                    "doc_number": {"type": "string"},
                },
                "required": ["doc_type", "doc_number"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_anomalies",
            "description": "Get all procurement anomaly flag counts and summary stats from process mining events.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_vendor_info",
            "description": "Get vendor spend, PO count, block status. Omit vendor_id for top 20 by spend.",
            "parameters": {
                "type": "object",
                "properties": {
                    "vendor_id": {"type": "string", "description": "Optional vendor ID"}
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_p2p_stage_summary",
            "description": "Get P2P pipeline document counts and average days per stage (PR→PO→GRN→Invoice→Payment).",
            "parameters": {"type": "object", "properties": {}},
        },
    },
]


def _execute_tool(name: str, arguments: dict) -> Any:
    if name == "query_database":
        return query_database(arguments["sql"])
    elif name == "get_kpis":
        return get_kpis(arguments["dashboard"], arguments.get("company_code", "ALL"))
    elif name == "find_document":
        return find_document(arguments["doc_type"], arguments["doc_number"])
    elif name == "get_anomalies":
        return get_anomalies()
    elif name == "get_vendor_info":
        return get_vendor_info(arguments.get("vendor_id"))
    elif name == "get_p2p_stage_summary":
        return get_p2p_stage_summary()
    return {"error": f"Unknown tool: {name}"}


def _openrouter_call(messages: list, force_tool: bool = False, no_tools: bool = False) -> dict:
    body: dict = {
        "model": OPENROUTER_MODEL,
        "messages": messages,
        "max_tokens": 2048,
        "temperature": 0.1,
    }
    if not no_tools:
        body["tools"] = TOOLS
        body["tool_choice"] = "required" if force_tool else "auto"
    payload = json.dumps(body).encode()
    req = urllib.request.Request(
        OPENROUTER_URL,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "HTTP-Referer": "https://intellisource.kpmg.com",
            "X-Title": "IntelliSource P2P",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        err_body = e.read().decode()
        if e.code == 429:
            time.sleep(15)
            return _openrouter_call(messages, force_tool, no_tools)
        raise RuntimeError(f"OpenRouter API error {e.code}: {err_body}")


def _enforce_limit(sql: str, limit: int = 20) -> str:
    """Inject LIMIT clause if SQL has none, preventing massive result sets."""
    stripped = sql.strip().rstrip(";")
    if not re.search(r"\bLIMIT\b", stripped, re.IGNORECASE):
        stripped += f" LIMIT {limit}"
    return stripped


def _compress_result(result: Any, max_rows: int = 20) -> str:
    """
    Compress tool result to stay within context window.
    - Lists: keep top max_rows, report total omitted.
    - Dicts: truncate long string values.
    - Fallback: hard cap at 3000 chars.
    """
    if isinstance(result, list):
        total = len(result)
        trimmed = result[:max_rows]
        out = json.dumps(trimmed, default=str)
        if total > max_rows:
            out += f"\n[TRUNCATED: showing {max_rows} of {total} rows. Ask for specific filters to see more.]"
        return out
    if isinstance(result, dict):
        compressed: dict = {}
        for k, v in result.items():
            if isinstance(v, str) and len(v) > 400:
                compressed[k] = v[:400] + "…"
            elif isinstance(v, list) and len(v) > max_rows:
                compressed[k] = v[:max_rows] + [f"…{len(v) - max_rows} more"]
            else:
                compressed[k] = v
        return json.dumps(compressed, default=str)
    return json.dumps(result, default=str)[:3000]


def run_chat(user_message: str, history: list[dict]) -> dict:
    """Run one agentic turn. Returns { reply, tools_used, new_history }."""
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(history)
    messages.append({"role": "user", "content": user_message})

    tools_used = []
    MAX_ITERATIONS = 8

    for iteration in range(MAX_ITERATIONS):
        force_synthesize = iteration == MAX_ITERATIONS - 1
        response = _openrouter_call(messages, no_tools=force_synthesize)
        choice = response["choices"][0]
        finish = choice.get("finish_reason", "stop")
        msg = choice["message"]

        if finish == "tool_calls" and msg.get("tool_calls"):
            messages.append(msg)
            tool_results = []
            for tc in msg["tool_calls"]:
                fn_name = tc["function"]["name"]
                fn_args = json.loads(tc["function"]["arguments"] or "{}")
                tools_used.append(fn_name)
                try:
                    # Enforce LIMIT on raw SQL to prevent huge result sets
                    if fn_name == "query_database" and "sql" in fn_args:
                        fn_args["sql"] = _enforce_limit(fn_args["sql"])
                    result = _execute_tool(fn_name, fn_args)
                    result_str = _compress_result(result)
                except Exception as exc:
                    result_str = json.dumps({"error": str(exc)})
                tool_results.append({
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "content": result_str,
                })
            messages.extend(tool_results)
        else:
            reply = msg.get("content") or ""
            new_history = history + [
                {"role": "user", "content": user_message},
                {"role": "assistant", "content": reply},
            ]
            if len(new_history) > 20:
                new_history = new_history[-20:]
            return {"reply": reply, "tools_used": list(dict.fromkeys(tools_used)), "new_history": new_history}

    return {
        "reply": "Reached maximum tool iterations. Try a more specific question.",
        "tools_used": tools_used,
        "new_history": history,
    }
