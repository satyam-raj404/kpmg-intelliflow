"""create_visual — renders a matplotlib PNG from an existing manifest dataset.
Numbers come only from the referenced manifest key; the model supplies chart
type + column names, never data.
"""
import base64

from ...reports import charts
from ..context import TurnContext
from ..guardrails import GuardrailViolation, validate_tool_args
from ..registry import Tool, register


def create_visual(args: dict, ctx: TurnContext):
    validate_tool_args("create_visual", args)
    data_key = args["data_key"]
    chart_type = args["chart_type"]
    x_col = args["x"]
    y_col = args.get("y")
    title = args.get("title", "Chart")

    if data_key not in ctx.manifest.keys():
        raise GuardrailViolation(f"Unknown data_key {data_key!r}. Known: {ctx.manifest.keys()}")
    rows = ctx.manifest.get(data_key)
    if not isinstance(rows, list) or not rows:
        return {"error": "Referenced data is empty or not tabular."}

    labels = [str(r.get(x_col, "")) for r in rows]

    if chart_type in ("bar", "hbar"):
        values = [_to_float(r.get(y_col)) for r in rows]
        png = charts.bar_chart(labels, values, title, horizontal=(chart_type == "hbar"))
    elif chart_type == "line":
        values = [_to_float(r.get(y_col)) for r in rows]
        png = charts.line_chart(labels, {y_col: values}, title)
    elif chart_type in ("pie", "donut"):
        values = [_to_float(r.get(y_col)) for r in rows]
        png = charts.pie_chart(labels, values, title, donut=(chart_type == "donut"))
    elif chart_type == "scatter":
        y_values = [_to_float(r.get(y_col)) for r in rows]
        x_values = [_to_float(r.get(x_col)) for r in rows]
        png = charts.scatter_chart(x_values, y_values, title, x_label=x_col, y_label=y_col or "")
    else:
        return {"error": f"Unsupported chart_type {chart_type!r}."}

    from ...artifacts import save_artifact
    record = save_artifact(ctx.session_id, f"{title.replace(' ', '_')}.png", png, kind="chart_png")
    artifact = {
        "id": record.artifact_id,
        "type": "chart_png",
        "filename": record.filename,
        "url": f"/api/chat/artifacts/{record.artifact_id}",
        "preview": "data:image/png;base64," + base64.b64encode(png).decode(),
    }
    ctx.record_artifact(artifact)
    return {"artifact_id": record.artifact_id, "preview_url": artifact["url"], "chart_type": chart_type, "title": title}


def _to_float(v) -> float:
    if v is None:
        return 0.0
    try:
        return float(str(v).replace(",", "").replace("₹", "").replace("%", ""))
    except ValueError:
        return 0.0


register(Tool(
    name="create_visual",
    description="Render a chart (PNG) from a previously fetched dataset (manifest data_key). Numbers come only from that data — never invent values.",
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
