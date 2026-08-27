"""Analysis tools — parameterized pandas operations only. The model picks an
operation and arguments; it never writes analysis code. Source data comes from
an existing manifest key (previously fetched), a canonical metric, or a
whitelisted table (bounded SELECT, still routed through the read-only guard).
"""
import pandas as pd

from .. import metrics as metrics_registry
from ..context import TurnContext
from ..guardrails import GuardrailViolation, run_guarded_select, validate_tool_args
from ..registry import Tool, register
from ..schema_card import TABLES

_ALLOWED_TABLES = set(TABLES.keys())
_TABLE_SCAN_CAP = 2000  # pandas-side row cap for whole-table pulls; independent of MAX_ROWS


def _resolve_source(source: str, ctx: TurnContext) -> list[dict]:
    if source in ctx.manifest.keys():
        data = ctx.manifest.get(source)
        return data if isinstance(data, list) else [data]
    if source in metrics_registry.METRICS:
        rows, err = run_guarded_select(metrics_registry.get_metric(source).sql, trusted=True)
        if err:
            raise GuardrailViolation(err)
        return rows
    if source in _ALLOWED_TABLES:
        # backend-authored SQL, whitelisted table name, hardcoded cap — trusted
        rows, err = run_guarded_select(f"SELECT * FROM {source} LIMIT {_TABLE_SCAN_CAP}", trusted=True)
        if err:
            raise GuardrailViolation(err)
        return rows
    raise GuardrailViolation(
        f"Unknown source {source!r}. Must be a manifest key ({list(ctx.manifest.keys())}), "
        f"a metric key, or one of {sorted(_ALLOWED_TABLES)}."
    )


def analyze_data(args: dict, ctx: TurnContext):
    validate_tool_args("analyze_data", args)
    op = args["op"]
    rows = _resolve_source(args["source"], ctx)
    if not rows:
        return {"error": "No rows available from that source.", "row_count": 0}

    df = pd.DataFrame(rows)
    metric_col = args.get("metric")
    group_by = args.get("group_by")
    agg = args.get("agg", "sum")
    top_n = args.get("top_n", 10)

    if metric_col and metric_col in df.columns:
        df.loc[:, metric_col] = pd.to_numeric(df[metric_col], errors="coerce")

    if op == "describe":
        return df.describe(include="all").fillna("").reset_index().to_dict(orient="records")

    if op == "correlation":
        numeric_df = df.select_dtypes(include="number")
        if numeric_df.shape[1] < 2:
            return {"error": "Need at least 2 numeric columns for correlation."}
        return numeric_df.corr().reset_index().to_dict(orient="records")

    if op == "groupby":
        if not group_by or not metric_col:
            return {"error": "groupby requires group_by and metric."}
        grouped = df.groupby(group_by, dropna=False)[metric_col].agg(agg).reset_index()
        grouped = grouped.sort_values(metric_col, ascending=False).head(top_n)
        return grouped.to_dict(orient="records")

    if op == "top_n":
        if not metric_col:
            return {"error": "top_n requires metric."}
        ascending = args.get("ascending", False)
        result = df.sort_values(metric_col, ascending=ascending).head(top_n)
        return result.to_dict(orient="records")

    if op == "trend":
        date_col = args.get("date_col") or next((c for c in df.columns if "date" in c.lower()), None)
        if not date_col or not metric_col:
            return {"error": "trend requires date_col (or a column with 'date' in its name) and metric."}
        df[date_col] = pd.to_datetime(df[date_col], errors="coerce")
        df = df.dropna(subset=[date_col])
        monthly = df.set_index(date_col)[metric_col].resample("ME").agg(agg).reset_index()
        monthly[date_col] = monthly[date_col].dt.strftime("%Y-%m")
        return monthly.to_dict(orient="records")

    if op == "pivot":
        series_col = args.get("series")
        if not (group_by and series_col and metric_col):
            return {"error": "pivot requires group_by, series, and metric."}
        pivoted = df.pivot_table(index=group_by, columns=series_col, values=metric_col, aggfunc=agg, fill_value=0)
        return pivoted.reset_index().to_dict(orient="records")

    return {"error": f"Unknown op {op!r}. Use groupby|trend|top_n|describe|correlation|pivot."}


register(Tool(
    name="analyze_data",
    description=(
        "Run a parameterized data analysis operation (no code, fixed ops only). "
        "source = a manifest key from an earlier tool call, a metric key (see get_metric), "
        "or a table name. op = groupby|trend|top_n|describe|correlation|pivot."
    ),
    parameters={
        "type": "object",
        "properties": {
            "source": {"type": "string", "description": "Manifest key, metric key, or table name."},
            "op": {"type": "string", "enum": ["groupby", "trend", "top_n", "describe", "correlation", "pivot"]},
            "group_by": {"type": "string", "description": "Column to group by (groupby, pivot)."},
            "series": {"type": "string", "description": "Column to pivot into columns (pivot only)."},
            "metric": {"type": "string", "description": "Numeric column to aggregate."},
            "agg": {"type": "string", "enum": ["sum", "mean", "count", "min", "max"], "default": "sum"},
            "top_n": {"type": "integer", "default": 10, "minimum": 1, "maximum": 100},
            "date_col": {"type": "string", "description": "Date column for trend (auto-detected if omitted)."},
            "ascending": {"type": "boolean", "default": False},
        },
        "required": ["source", "op"],
    },
    executor=analyze_data,
    manifest_hint="analysis",
))
