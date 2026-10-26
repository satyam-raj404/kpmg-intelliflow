"""create_visual — builds an interactive chart spec from an existing manifest dataset.
Numbers come only from the referenced manifest key; the model supplies chart
type + column names, never data. The browser draws the spec (recharts); PDF/PPTX
exports render it to PNG via charts.render_png.
"""
import json

from ...reports import charts
from ..context import TurnContext
from ..guardrails import GuardrailViolation, validate_tool_args
from ..registry import Tool, register


def create_visual(args: dict, ctx: TurnContext):
    validate_tool_args("create_visual", args)
    data_key = args["data_key"]
    title = args.get("title", "Chart")

    if data_key not in ctx.manifest.keys():
        raise GuardrailViolation(f"Unknown data_key {data_key!r}. Known: {ctx.manifest.keys()}")
    rows = ctx.manifest.get(data_key)
    if not isinstance(rows, list) or not rows:
        return {"error": "Referenced data is empty or not tabular."}

    spec = charts.build_spec(rows, args["chart_type"], args["x"], args.get("y"), title)

    from ...artifacts import save_artifact
    # Persisted like any artifact so add_chart_section can fetch it by id for report exports.
    record = save_artifact(ctx.session_id, f"{title.replace(' ', '_')}.json",
                           json.dumps(spec).encode(), kind="chart_spec")
    ctx.record_artifact({"id": record.artifact_id, "type": "chart_spec", "filename": record.filename, "spec": spec})
    return {"artifact_id": record.artifact_id, "chart_type": spec["chart_type"], "title": title,
            "points": len(spec["points"]),
            "note": "The chart is displayed to the user automatically below your reply. "
                    "Do NOT add image markdown, links or URLs for it."}


register(Tool(
    name="create_visual",
    description="Show an interactive chart in the chat from a previously fetched dataset (manifest data_key). Numbers come only from that data — never invent values.",
    parameters={
        "type": "object",
        "properties": {
            "data_key": {"type": "string", "description": "Manifest key from an earlier tool result (e.g. 'analysis1')."},
            "chart_type": {"type": "string", "enum": ["bar", "line", "pie", "donut", "hbar", "scatter"]},
            "x": {"type": "string", "description": "Column name for the x-axis / labels."},
            "y": {"type": "string", "description": "Column name for the y-axis / values."},
            "title": {"type": "string"},
        },
        "required": ["data_key", "chart_type", "x", "y"],
    },
    executor=create_visual,
    manifest_hint="chart",
))
