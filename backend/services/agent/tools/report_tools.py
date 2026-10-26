"""Report tools — FLAT, incremental build-then-finalize (Plan C3).

Small models reliably struggle with one tool call that takes a nested
sections[] array of typed objects (observed directly: a 20B free model's
tool-call arguments failed OpenRouter's own schema validation on that shape).
The fix isn't a better prompt — it's a schema a small model can't get wrong:

  start_report(title)                        -> draft_key
  add_table_section(draft_key, heading, source)
  add_chart_section(draft_key, heading, artifact_id)
  add_narrative_section(draft_key, heading, narrative)
  finalize_report(draft_key, format)          -> artifact

Every call above has 2-3 flat string/enum arguments — no arrays, no nested
objects. The draft accumulates in the DataManifest like any other tool
result, so it inherits grounding/citation/read-only guarantees for free.

Every section's data is resolved from the DataManifest (or a canonical
metric) at the moment it's added — never a model-authored number. Narrative
text is numeric-verified before being added, same guarantee as before.
"""
import json

from ...artifacts import get_artifact, save_artifact
from ...reports import charts
from ...reports.excel import build_excel_report
from ...reports.pdf import build_pdf_report
from ...reports.pptx import build_pptx_report, fmt_cell, pretty_header
from ..context import TurnContext
from ..grounding import verify_numbers
from ..guardrails import GuardrailViolation
from ..registry import Tool, register
from .analysis_tools import _resolve_source

_BUILDERS = {"excel": build_excel_report, "pptx": build_pptx_report, "pdf": build_pdf_report}
_EXTENSIONS = {"excel": "xlsx", "pptx": "pptx", "pdf": "pdf"}
_CHART_TYPES = {"bar", "hbar", "line", "pie", "donut", "scatter"}


def _auto_axes(rows: list[dict]) -> tuple[str | None, str | None]:
    """Pick a label column (first non-numeric) and a value column (first numeric)
    when the caller doesn't specify — so a one-shot report can still chart."""
    if not rows:
        return None, None
    cols = list(rows[0].keys())
    # skip the synthetic _cr helper columns as value candidates; prefer raw numeric
    value_col = next((c for c in cols if not c.endswith("_cr")
                      and isinstance(rows[0].get(c), (int, float))), None)
    label_col = next((c for c in cols if c != value_col
                      and isinstance(rows[0].get(c), str)), None)
    return label_col, value_col


def _render_chart_png(rows: list[dict], chart_type: str, x_col: str | None, y_col: str | None, title: str) -> bytes:
    if not x_col or not y_col:
        ax, ay = _auto_axes(rows)
        x_col, y_col = x_col or ax, y_col or ay
    if not x_col or not y_col:
        raise GuardrailViolation("Could not determine chart columns from the data.")
    if chart_type not in _CHART_TYPES:
        raise GuardrailViolation(f"Unsupported chart_type {chart_type!r}.")
    return charts.render_png(charts.build_spec(rows, chart_type, x_col, y_col, title))


def _guard_narrative(text: str, ctx: TurnContext) -> str:
    result = verify_numbers(text, ctx.manifest.all_values())
    cleaned = text
    for token in result.unverified:
        cleaned = cleaned.replace(token, "[unverifiable]")
    return cleaned


def _get_draft(ctx: TurnContext, draft_key: str) -> dict:
    try:
        draft = ctx.manifest.get(draft_key)
    except KeyError:
        raise GuardrailViolation(
            f"Unknown draft_key {draft_key!r} — call start_report first, then use the "
            f"manifest_key it returns. Known keys: {ctx.manifest.keys()}"
        )
    if not isinstance(draft, dict) or draft.get("_type") != "report_draft":
        raise GuardrailViolation(f"{draft_key!r} is not a report draft.")
    return draft


def start_report(args: dict, ctx: TurnContext):
    draft = {"_type": "report_draft", "title": args["title"], "subtitle": args.get("subtitle", ""), "sections": []}
    key = ctx.manifest.put(draft, hint="draft", description=f"report draft: {args['title']}")
    return {"draft_key": key, "message": "Draft started. Call add_table_section / add_chart_section / "
                                          "add_narrative_section to build it, then finalize_report."}


def add_table_section(args: dict, ctx: TurnContext):
    draft = _get_draft(ctx, args["draft_key"])
    data = _resolve_source(args["source"], ctx)
    draft["sections"].append({"heading": args["heading"], "kind": "table", "data": data})
    return {"ok": True, "rows_added": len(data), "sections_so_far": len(draft["sections"])}


def add_chart_section(args: dict, ctx: TurnContext):
    draft = _get_draft(ctx, args["draft_key"])
    record = get_artifact(args["artifact_id"])
    if record is None:
        raise GuardrailViolation(f"Unknown or expired artifact_id {args['artifact_id']!r}.")
    raw = record.path.read_bytes()
    png = charts.render_png(json.loads(raw)) if record.kind == "chart_spec" else raw
    draft["sections"].append({"heading": args["heading"], "kind": "chart", "chart_png": png})
    return {"ok": True, "sections_so_far": len(draft["sections"])}


def add_narrative_section(args: dict, ctx: TurnContext):
    draft = _get_draft(ctx, args["draft_key"])
    cleaned = _guard_narrative(args.get("narrative", ""), ctx)
    draft["sections"].append({"heading": args["heading"], "kind": "narrative", "narrative": cleaned})
    return {"ok": True, "sections_so_far": len(draft["sections"])}


def finalize_report(args: dict, ctx: TurnContext):
    draft = _get_draft(ctx, args["draft_key"])
    fmt = args["format"]
    if fmt not in _BUILDERS:
        raise GuardrailViolation(f"format must be one of {list(_BUILDERS)}, got {fmt!r}")
    if not draft["sections"]:
        raise GuardrailViolation("Draft has no sections — add at least one before finalizing.")

    spec = {"title": draft["title"], "subtitle": draft["subtitle"], "sections": draft["sections"]}
    data = _BUILDERS[fmt](spec)
    ext = _EXTENSIONS[fmt]
    record = save_artifact(ctx.session_id, f"{draft['title']}.{ext}", data, kind=fmt)
    artifact = {"id": record.artifact_id, "type": fmt, "filename": record.filename,
                "url": f"/api/chat/artifacts/{record.artifact_id}"}
    ctx.record_artifact(artifact)
    return {"artifact_id": record.artifact_id, "filename": record.filename, "url": artifact["url"]}


register(Tool(
    name="start_report",
    description="Start a new multi-section report draft. Returns a draft_key — use it in add_*_section calls, then finalize_report.",
    parameters={
        "type": "object",
        "properties": {"title": {"type": "string"}, "subtitle": {"type": "string"}},
        "required": ["title"],
    },
    executor=start_report,
    manifest_hint="draft",
))

register(Tool(
    name="add_table_section",
    description="Add a data table section to a report draft. source = a manifest key, metric key, or table name (never invented data).",
    parameters={
        "type": "object",
        "properties": {
            "draft_key": {"type": "string", "description": "The draft_key returned by start_report."},
            "heading": {"type": "string"},
            "source": {"type": "string", "description": "Manifest key, metric key, or table name."},
        },
        "required": ["draft_key", "heading", "source"],
    },
    executor=add_table_section,
    manifest_hint="section",
))

register(Tool(
    name="add_chart_section",
    description="Add a chart image section to a report draft, from a chart artifact_id returned by a prior create_visual call.",
    parameters={
        "type": "object",
        "properties": {
            "draft_key": {"type": "string", "description": "The draft_key returned by start_report."},
            "heading": {"type": "string"},
            "artifact_id": {"type": "string", "description": "artifact_id from a prior create_visual call."},
        },
        "required": ["draft_key", "heading", "artifact_id"],
    },
    executor=add_chart_section,
    manifest_hint="section",
))

register(Tool(
    name="add_narrative_section",
    description="Add a prose section to a report draft. Any numbers in the narrative are verified against fetched data — unverifiable ones are stripped.",
    parameters={
        "type": "object",
        "properties": {
            "draft_key": {"type": "string", "description": "The draft_key returned by start_report."},
            "heading": {"type": "string"},
            "narrative": {"type": "string"},
        },
        "required": ["draft_key", "heading", "narrative"],
    },
    executor=add_narrative_section,
    manifest_hint="section",
))

register(Tool(
    name="finalize_report",
    description="Render a report draft to a downloadable file. Call this LAST, after adding all sections.",
    parameters={
        "type": "object",
        "properties": {
            "draft_key": {"type": "string", "description": "The draft_key returned by start_report."},
            "format": {"type": "string", "enum": ["excel", "pptx", "pdf"]},
        },
        "required": ["draft_key", "format"],
    },
    executor=finalize_report,
    manifest_hint="report",
))


# ── One-shot report (Plan follow-up) ─────────────────────────────────────────────
# The start_report -> add_*_section -> finalize_report chain is 3-4 sequential
# model tool calls. A weak/slow model routinely runs out of tool budget before
# reaching finalize (observed: 20B free model produced get_metric+analyze_data
# then hit the cap, never built the file). create_report does the whole chain in
# ONE Python call — the model only has to get a single tool call right, so PPT/PDF
# generation works regardless of model strength. The granular tools stay for
# genuinely multi-section reports.

def _dict_sections(raw: dict) -> tuple[list[dict], list[dict]]:
    """dict-of-lists tool output -> report sections + the first table's rows (for an optional chart)."""
    sections, first = [], []
    facts = [(pretty_header(k), fmt_cell(k, v)[0]) for k, v in raw.items() if not isinstance(v, (list, dict)) and v not in (None, "")]
    if facts:
        sections.append({"heading": "Summary", "kind": "key_values", "pairs": facts})
    for key, val in raw.items():
        if isinstance(val, list) and val and isinstance(val[0], dict):
            sections.append({"heading": pretty_header(key), "kind": "table", "data": val})
            first = first or val
    return sections, first


def create_report(args: dict, ctx: TurnContext):
    fmt = args["format"]
    if fmt not in _BUILDERS:
        raise GuardrailViolation(f"format must be one of {list(_BUILDERS)}, got {fmt!r}")

    source = args["source"]
    raw = ctx.manifest.get(source) if source in ctx.manifest.keys() else None
    if isinstance(raw, dict):
        # e.g. find_document -> {po_lines: [...], p2p_chain: [...], invoices: [...]}: one table per list,
        # scalars as a facts panel — never a single row of Python reprs.
        sections, rows = _dict_sections(raw)
        if not sections:
            raise GuardrailViolation(f"Source {source!r} returned no data — nothing to put in the report.")
    else:
        rows = _resolve_source(source, ctx)  # raises GuardrailViolation on a bad source
        if not rows:
            raise GuardrailViolation(f"Source {source!r} returned no data — nothing to put in the report.")
        sections = [{"heading": args.get("table_heading") or "Data", "kind": "table", "data": rows}]

    title = args.get("title") or "IntelliSource Report"

    chart_type = args.get("chart")
    if chart_type:
        if chart_type not in _CHART_TYPES:
            raise GuardrailViolation(f"chart must be one of {sorted(_CHART_TYPES)}, got {chart_type!r}")
        try:
            png = _render_chart_png(rows, chart_type, args.get("x"), args.get("y"), title)
            sections.insert(0, {"heading": "Chart", "kind": "chart", "chart_png": png})
        except (GuardrailViolation, ValueError):
            if not isinstance(raw, dict):   # for multi-table sources a missing chart is not fatal
                raise

    narrative = args.get("narrative")
    if narrative:
        sections.append({"heading": "Summary", "kind": "narrative", "narrative": _guard_narrative(narrative, ctx)})

    spec = {"title": title, "subtitle": args.get("subtitle", ""), "sections": sections}
    data = _BUILDERS[fmt](spec)
    record = save_artifact(ctx.session_id, f"{title}.{_EXTENSIONS[fmt]}", data, kind=fmt)
    artifact = {"id": record.artifact_id, "type": fmt, "filename": record.filename,
                "url": f"/api/chat/artifacts/{record.artifact_id}"}
    ctx.record_artifact(artifact)
    return {"artifact_id": record.artifact_id, "filename": record.filename, "url": artifact["url"],
            "sections": len(sections), "rows": len(rows)}


register(Tool(
    name="create_report",
    description=(
        "Generate a downloadable report (Excel, PPTX, or PDF) in ONE call — preferred over the "
        "start_report/add_*_section/finalize_report chain for a simple report. Builds a data table "
        "from `source` (a manifest key, metric key, or table name), plus an optional chart and "
        "optional summary text, and returns the download link. Use this for 'make a PPT/PDF/Excel of X'."
    ),
    parameters={
        "type": "object",
        "properties": {
            "title": {"type": "string", "description": "Report title."},
            "format": {"type": "string", "enum": ["excel", "pptx", "pdf"]},
            "source": {"type": "string", "description": "Manifest key from an earlier tool result, a metric key (e.g. spend_by_vendor), or a table name."},
            "chart": {"type": "string", "enum": ["bar", "hbar", "line", "pie", "donut", "scatter"],
                       "description": "Optional — include a chart of this type built from the source data."},
            "x": {"type": "string", "description": "Optional chart label column (auto-detected if omitted)."},
            "y": {"type": "string", "description": "Optional chart value column (auto-detected if omitted)."},
            "narrative": {"type": "string", "description": "Optional summary prose; numbers are verified against fetched data."},
            "table_heading": {"type": "string", "description": "Optional heading for the data table section."},
            "subtitle": {"type": "string", "description": "Optional subtitle shown on the cover slide."},
        },
        "required": ["format", "source"],
    },
    executor=create_report,
    manifest_hint="report",
))
