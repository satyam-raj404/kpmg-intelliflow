"""Cascade orchestrator — replaces chat_engine.run_chat.

Speed (Plan Part B):
  - B1 fast-path router: metric-alias / document-number questions skip the
    planner loop entirely — one tool call + one narrator call.
  - B2 narrator merge: only fire the separate narrator call when the planner's
    terminating response has no content of its own.
  - B3 tool subsetting: report/chart tools are only offered when the question
    signals that intent — smaller prompt, better tool-pick on small models.
  - B4 parallel tool calls: multiple tool_calls in one planner response are
    independent by construction (the model prepared them without seeing each
    other's results) — run them concurrently.
  - B5 trusted-SQL: canonical metric/table SQL skips the EXPLAIN round-trip
    (guardrails.run_guarded_select(trusted=True)), used inside the tools
    themselves.

Accuracy (Plan Part C):
  - C1 session-scoped DataManifest: the same manifest carries across turns in
    a session, so "chart that" / "export this" can resolve a prior turn's key.
  - C5 citations: every tool call is recorded with its manifest key.
  - Numeric verification against the manifest before the reply is returned —
    unverified figures are stripped, not trusted.
"""
import json
from concurrent.futures import ThreadPoolExecutor
import threading

from . import cache, config, metrics, router, schema_card
from .context import DataManifest, TurnContext
from .grounding import verify_numbers
from .guardrails import Budget, GuardrailViolation, scrub_rows
from .providers.base import LLMResponse, ProviderUnavailable
from .registry import get_tool, openai_tool_schemas, tool_subset_for_question

MAX_ITERATIONS = 8
MAX_TOOL_CALLS_PER_TURN = 8
MAX_COMPRESSED_ROWS = 20
MANIFEST_MAX_ENTRIES = 40  # per-session cap; oldest tool results evicted first

BASE_SYSTEM_PROMPT = """You are Ask IntelliSource — KPMG's procurement analytics assistant, with LIVE read-only
access to the procurement database via tools.

HARD RULES:
- This harness is READ-ONLY. You cannot and must not attempt to create, update, or delete data.
- Always call a tool before making any data claim. Never invent a number.
- Prefer get_metric (canonical, pre-validated) over query_database for common questions.
- EVERY tool result starts with "[manifest_key: X]". To build a chart or report, you MUST reuse
  that exact key as the 'source' (analyze_data, add_table_section) or 'data_key' (create_visual)
  argument in your next call — never re-type the data itself, never invent a key. Manifest keys
  persist across the whole conversation, not just this turn — if an earlier message already
  fetched what you need, reuse that key instead of calling the tool again.
- To build a CHART: (1) get_metric/query_database/analyze_data -> its manifest_key ->
  (2) create_visual with that data_key -> its artifact_id.
- To build a REPORT (Excel/PPTX/PDF): STRONGLY PREFER the single-call create_report tool.
  First fetch data (get_metric/query_database/analyze_data -> a manifest_key), then call
  create_report(format="pptx"|"pdf"|"excel", source=<that manifest_key OR a metric key like
  spend_by_vendor>, chart=<optional chart type>, title=..., narrative=<optional>). It returns the
  download link directly. Example: "make a PPT of top vendors" -> get_metric(spend_by_vendor) ->
  create_report(format="pptx", source="spend_by_vendor", chart="bar", title="Top Vendors by Spend").
  Only use the start_report/add_*_section/finalize_report chain for a genuinely multi-section
  report that create_report can't express.
- Use at most 6 tool calls before synthesizing an answer from what you have.
- Money-like fields (spend, value, amount, total, ...) above Rs.1 lakh come with a pre-computed
  "<field>_cr" sibling string already formatted in Cr — COPY that value verbatim, never divide by
  1e7 yourself. A miscalculated conversion will be caught and stripped as unverifiable.
  Use markdown tables for comparisons. Lead with the direct answer, bold key numbers.

CANONICAL METRICS (prefer get_metric with one of these keys):
{metrics}

RELEVANT SCHEMA FOR THIS QUESTION:
{schema}
"""

NARRATOR_SYSTEM_SUFFIX = (
    "\n\nYou are now writing the FINAL answer for the user, using ONLY the tool results already "
    "gathered in this conversation. Do not call any more tools. Lead with the direct answer and "
    "bold the key numbers, THEN add useful detail grounded in the data: a markdown table of the "
    "relevant rows, notable comparisons or outliers, and a one-line 'what this means' takeaway. "
    "Every number must come from the tool results — never invent or estimate. Aim for a thorough, "
    "analyst-quality answer, not a one-liner."
)

# Words that mean the user wants a downloadable FILE (not just a chart preview) —
# used to detect a failed report generation and return a clear message instead of
# letting the model's fallback text (often an echo of the request) reach the user.
_REPORT_FILE_KEYWORDS = ("ppt", "pptx", "powerpoint", "deck", "slide", "pdf",
                          "excel", "xlsx", "spreadsheet", "report", "workbook")


def _wants_report_file(user_message: str) -> bool:
    q = user_message.lower()
    return any(kw in q for kw in _REPORT_FILE_KEYWORDS)


FAST_PATH_NARRATOR_PROMPT = (
    "You are Ask IntelliSource. Answer the user's question using ONLY the tool result provided. "
    "Lead with the direct answer and bold the key numbers, then add useful grounded detail: a "
    "markdown table when there are multiple rows, and a short 'what this means' takeaway. "
    "Money-like fields above Rs.1 lakh have a pre-computed '<field>_cr' sibling already formatted "
    "in Cr — copy it verbatim, never compute your own conversion. Never invent numbers not in the data."
)


# ── Session-scoped manifest store (Plan C1) ─────────────────────────────────────
# Keyed by session_id so a follow-up turn ("chart that") can resolve a manifest
# key a previous turn created. Capped + pruned per turn to bound memory.

_session_manifests: dict[str, DataManifest] = {}
_session_manifests_lock = threading.Lock()


def _get_session_manifest(session_id: str) -> DataManifest:
    with _session_manifests_lock:
        manifest = _session_manifests.get(session_id)
        if manifest is None:
            manifest = DataManifest()
            _session_manifests[session_id] = manifest
        return manifest


def clear_session_manifest(session_id: str) -> None:
    with _session_manifests_lock:
        _session_manifests.pop(session_id, None)


def _build_system_prompt(user_message: str, manifest: DataManifest) -> str:
    tables = schema_card.select_relevant_tables(user_message)
    prompt = BASE_SYSTEM_PROMPT.format(
        metrics=metrics.list_metrics_for_prompt(),
        schema=schema_card.render_schema_card(tables),
    )
    available = manifest.render_available_data()
    if available != "(none yet)":
        prompt += (
            "\n\nDATA ALREADY FETCHED THIS SESSION — if one of these already answers the "
            "current question or covers the data a chart/report needs, REUSE its key directly "
            "as 'source'/'data_key' instead of calling the tool again:\n"
            f"{available}\n"
        )
    return prompt


_MONEY_KEY_HINTS = ("spend", "value", "amount", "total", "budget", "cost", "price")


def _add_cr_hints(row: dict) -> dict:
    """Pre-compute the Cr-formatted string for money-like fields so the model
    never has to divide by 1e7 itself. A small model doing that arithmetic
    inline is exactly how a correct 8,354,776,000 turns into a wrong "83.55 Cr"
    instead of 835.48 Cr — caught by the grounding verifier, but better to
    remove the failure mode than rely on catching it after the fact."""
    out = dict(row)
    for k, v in row.items():
        if not isinstance(v, (int, float)) or abs(v) < 100_000:
            continue
        if any(hint in k.lower() for hint in _MONEY_KEY_HINTS):
            out[f"{k}_cr"] = f"Rs.{v / 1e7:.2f} Cr"
    return out


def _compress_for_model(result, max_rows: int = MAX_COMPRESSED_ROWS) -> str:
    """What the MODEL sees — capped + injection-scrubbed. The manifest keeps the
    full, unscrubbed result separately for reports/citations/grounding."""
    if isinstance(result, list):
        scrubbed = scrub_rows([r for r in result if isinstance(r, dict)]) if result and isinstance(result[0], dict) else result
        scrubbed = [_add_cr_hints(r) if isinstance(r, dict) else r for r in scrubbed]
        trimmed = scrubbed[:max_rows]
        out = json.dumps(trimmed, default=str)
        if len(result) > max_rows:
            out += f"\n[TRUNCATED: showing {max_rows} of {len(result)} rows — full data is available to analyze_data/report tools via the manifest key.]"
        return out
    if isinstance(result, dict):
        return json.dumps(_add_cr_hints(result), default=str)[:3000]
    return json.dumps(result, default=str)[:3000]


def _call_with_cascade(role: str, messages: list[dict], tools=None, json_mode=False,
                        force_tool=False, temperature=0.1) -> LLMResponse:
    """Try each model in the role's cascade in order; escalate on ProviderUnavailable."""
    chain = config.resolve(role)
    last_error: Exception | None = None
    for model_ref in chain:
        provider = model_ref.get_provider()
        try:
            return provider.chat(messages, model_ref.model, tools=tools, json_mode=json_mode,
                                  temperature=temperature, force_tool=force_tool)
        except ProviderUnavailable as exc:
            last_error = exc
            continue  # escalate to next tier
    raise RuntimeError(f"All providers in cascade for role={role!r} failed. Last error: {last_error}")


def _attempt_sql_repair(bad_sql: str, error: str, ctx: TurnContext) -> str | None:
    """One repair attempt via the 'sql' role — returns corrected SQL or None."""
    repair_messages = [
        {"role": "system", "content": "You fix broken read-only PostgreSQL SELECT statements. "
                                       "Reply with ONLY the corrected SQL, no explanation, no markdown fences."},
        {"role": "user", "content": f"This SQL failed:\n{bad_sql}\n\nError: {error}\n\nCorrected SQL:"},
    ]
    try:
        resp = _call_with_cascade("sql", repair_messages, temperature=0.0)
    except RuntimeError:
        return None
    if not resp.content:
        return None
    fixed = resp.content.strip().strip("`").strip()
    if fixed.lower().startswith("sql\n"):
        fixed = fixed[4:]
    return fixed or None


def _run_one_tool(name: str, args: dict, ctx: TurnContext, budget: Budget) -> tuple[dict | None, str]:
    """Executes one tool call. Returns (tool_dict_for_manifest_lookup, compressed_str).
    Shared by both the sequential and parallel execution paths."""
    budget.check()
    budget.record_call()
    ctx.record_tool_call(name)

    tool = get_tool(name)
    try:
        result = tool.executor(args, ctx)
    except GuardrailViolation as exc:
        return None, json.dumps({"error": str(exc)})
    except Exception as exc:
        return None, json.dumps({"error": f"Tool execution failed: {exc}"})

    # One repair attempt specifically for query_database SQL errors.
    if name == "query_database" and isinstance(result, dict) and "error" in result:
        fixed_sql = _attempt_sql_repair(args.get("sql", ""), result["error"], ctx)
        if fixed_sql:
            budget.check()
            budget.record_call()
            result = tool.executor({"sql": fixed_sql}, ctx)

    description = _describe_call(name, args)
    key = ctx.manifest.put(result, hint=tool.manifest_hint, description=description)
    ctx.record_citation(name, key, description)
    header = f"[manifest_key: {key}] Use this exact key as 'source' or 'data_key' in follow-up tool calls to reuse this data.\n"
    return {"manifest_key": key}, header + _compress_for_model(result)


def _describe_call(name: str, args: dict) -> str:
    """Args-specific one-liner for the available-data listing — 'get_metric(total_po_value)'
    is far more useful than the tool's static description when several calls
    to the same tool exist across a session."""
    arg_str = ", ".join(f"{k}={v}" for k, v in args.items())
    return f"{name}({arg_str})"[:120]


def _execute_tool_calls(tool_calls: list[dict], ctx: TurnContext, budget: Budget) -> list[tuple[str, str]]:
    """Runs a batch of tool calls from ONE planner response. They're independent
    by construction — the model prepared all of them before seeing any result —
    so batches of 2+ read tools run concurrently (Plan B4). Returns
    [(tool_call_id, compressed_result), ...] in the original order."""
    if len(tool_calls) <= 1:
        results = []
        for tc in tool_calls:
            try:
                _, compressed = _run_one_tool(tc["name"], tc["arguments"], ctx, budget)
            except GuardrailViolation as exc:
                compressed = json.dumps({"error": str(exc)})
            results.append((tc["id"], compressed))
        return results

    results: list[tuple[str, str] | None] = [None] * len(tool_calls)

    def _worker(idx: int, tc: dict):
        try:
            _, compressed = _run_one_tool(tc["name"], tc["arguments"], ctx, budget)
        except GuardrailViolation as exc:
            compressed = json.dumps({"error": str(exc)})
        results[idx] = (tc["id"], compressed)

    with ThreadPoolExecutor(max_workers=min(4, len(tool_calls))) as pool:
        futures = [pool.submit(_worker, i, tc) for i, tc in enumerate(tool_calls)]
        for f in futures:
            f.result()  # propagate any unexpected worker exception

    return results  # type: ignore[return-value]


def _fast_path(session_id: str, user_message: str, history: list[dict], ctx: TurnContext) -> dict | None:
    """Plan B1. Returns a finished result dict, or None to fall through to the
    full agentic loop. Zero LLM calls to DECIDE; one tool call + one narrator
    call to ANSWER (vs 3-4 calls through the full planner loop)."""
    kind, value = router.route(user_message)
    if kind is None:
        return None

    budget = Budget(max_tool_calls=2)
    if kind == "metric":
        cached = cache.get(value)
        if cached is not None:
            rows, cached_reply = cached
            key = ctx.manifest.put(rows, hint="metric", description=f"get_metric(metric_key={value}) [cached]")
            ctx.record_tool_call("get_metric")
            ctx.record_citation("get_metric", key, f"get_metric(metric_key={value}) [cache hit]")
            return _finish(ctx, history, user_message, cached_reply)

        info, compressed = _run_one_tool("get_metric", {"metric_key": value}, ctx, budget)
    else:  # "document"
        # doc_type is ambiguous from digits alone in this dataset — try in
        # likely-first order, keep the first non-empty result.
        result_dict = None
        for doc_type in ("PO", "PR", "GRN", "INVOICE"):
            tool = get_tool("find_document")
            candidate = tool.executor({"doc_type": doc_type, "doc_number": value}, ctx)
            has_data = any(isinstance(v, list) and v for k, v in candidate.items() if k not in ("doc_type", "doc_number"))
            if has_data:
                result_dict = candidate
                break
        if result_dict is None:
            return None  # no match under any type — let the full loop try harder
        ctx.record_tool_call("find_document")
        description = f"find_document(doc_type={doc_type}, doc_number={value})"
        key = ctx.manifest.put(result_dict, hint="doc", description=description)
        ctx.record_citation("find_document", key, description)
        compressed = f"[manifest_key: {key}]\n" + _compress_for_model(result_dict)

    narrator_messages = [
        {"role": "system", "content": FAST_PATH_NARRATOR_PROMPT},
        {"role": "user", "content": user_message},
        {"role": "user", "content": f"Tool result:\n{compressed}"},
    ]
    try:
        narrator_resp = _call_with_cascade("narrator", narrator_messages, temperature=0.1)
        reply = narrator_resp.content or ""
    except RuntimeError as exc:
        return _finish(ctx, history, user_message,
                        f"I couldn't reach a model to answer that: {exc}", skip_grounding=True)

    if not reply.strip():
        return None  # narrator produced nothing usable — fall through to the full loop

    if kind == "metric" and info is not None:
        cache.put(value, ctx.manifest.get(info["manifest_key"]), reply)

    return _finish(ctx, history, user_message, reply)


def run_turn(session_id: str, user_message: str, history: list[dict]) -> dict:
    manifest = _get_session_manifest(session_id)
    ctx = TurnContext(session_id=session_id, manifest=manifest)

    fast_result = _fast_path(session_id, user_message, history, ctx)
    if fast_result is not None:
        manifest.prune(MANIFEST_MAX_ENTRIES)
        return fast_result

    budget = Budget(max_tool_calls=MAX_TOOL_CALLS_PER_TURN)

    system_prompt = _build_system_prompt(user_message, manifest)
    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(history)
    messages.append({"role": "user", "content": user_message})

    tool_names = tool_subset_for_question(user_message)
    tool_schemas = openai_tool_schemas(tool_names)

    for iteration in range(MAX_ITERATIONS):
        try:
            response = _call_with_cascade("planner", messages, tools=tool_schemas)
        except RuntimeError as exc:
            return _finish(ctx, history, user_message,
                            f"I couldn't reach a model to answer that: {exc}", skip_grounding=True)

        if response.tool_calls:
            messages.append({
                "role": "assistant",
                "content": response.content or "",
                "tool_calls": [
                    {"id": tc["id"], "type": "function",
                     "function": {"name": tc["name"], "arguments": json.dumps(tc["arguments"])}}
                    for tc in response.tool_calls
                ],
            })
            for tc_id, compressed in _execute_tool_calls(response.tool_calls, ctx, budget):
                messages.append({"role": "tool", "tool_call_id": tc_id, "content": compressed})
            continue

        # No more tool calls requested. Plan B2: if the planner already wrote a
        # usable answer, use it directly — only fire a separate narrator call
        # when it stopped with empty content.
        if response.content and response.content.strip():
            reply = response.content
        else:
            narrator_messages = messages + [{"role": "system", "content": NARRATOR_SYSTEM_SUFFIX}]
            try:
                narrator_resp = _call_with_cascade("narrator", narrator_messages, temperature=0.1)
                reply = narrator_resp.content or ""
            except RuntimeError:
                reply = ""

        manifest.prune(MANIFEST_MAX_ENTRIES)
        return _finish(ctx, history, user_message, reply)

    manifest.prune(MANIFEST_MAX_ENTRIES)
    return _finish(ctx, history, user_message,
                    "Reached the maximum number of tool calls for this question. Try being more specific.",
                    skip_grounding=True)


def _finish(ctx: TurnContext, history: list[dict], user_message: str, reply: str,
            skip_grounding: bool = False) -> dict:
    """skip_grounding=True for our own error/status strings — the numeric verifier
    is for MODEL-generated data claims, not for stripping digits out of our own
    error messages (e.g. HTTP status codes) before the user ever sees them."""
    if skip_grounding:
        clean_reply = reply
        verification_summary = {"verified_numbers": 0, "unverified_stripped": 0}
    else:
        verification = verify_numbers(reply, ctx.manifest.all_values())
        clean_reply = reply
        for token in verification.unverified:
            clean_reply = clean_reply.replace(token, "[unverifiable]")
        verification_summary = {"verified_numbers": verification.verified_count,
                                 "unverified_stripped": len(verification.unverified)}

    # Failed report generation: the user asked for a downloadable file but no
    # report artifact was produced. Return a clear message instead of letting the
    # model's fallback text (which is often just an echo of the request, or a
    # description of a file that was never built) reach the user.
    _REPORT_ARTIFACT_TYPES = {"pptx", "pdf", "excel"}
    if _wants_report_file(user_message) and not any(
        a.get("type") in _REPORT_ARTIFACT_TYPES for a in ctx.artifacts
    ):
        clean_reply = (
            "I couldn't finish generating that file this time — the report step didn't complete. "
            "Please try again in a moment. If it keeps failing, ask for the underlying data directly "
            "(I can show it as a table or a chart), or request a simpler report."
        )
        verification_summary["report_generation_failed"] = True

    new_history = history + [
        {"role": "user", "content": user_message},
        {"role": "assistant", "content": clean_reply},
    ]
    if len(new_history) > 20:
        new_history = new_history[-20:]

    return {
        "reply": clean_reply,
        "tools_used": ctx.dedup_tools_used(),
        "artifacts": ctx.artifacts,
        "citations": ctx.citations,
        "grounding": verification_summary,
        "new_history": new_history,
    }


if __name__ == "__main__":
    result = run_turn("smoke-orchestrator", "What is the total PO value?", [])
    print("reply:", result["reply"][:300])
    print("tools_used:", result["tools_used"])
    print("citations:", result["citations"])
    print("grounding:", result["grounding"])
    assert result["tools_used"], "expected at least one tool call"
    assert result["grounding"]["unverified_stripped"] == 0, "unexpected unverified numbers"
    assert result["citations"], "expected at least one citation"
    print("orchestrator OK")
