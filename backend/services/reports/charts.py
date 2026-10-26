"""Chart helpers. `build_spec` turns manifest rows into a small JSON chart spec —
that is what the chat UI draws interactively (recharts). `render_png` renders the
same spec with matplotlib, KPMG-themed, for the PDF/PPTX exports. Every function
takes only already-computed data — never a query, never a model-authored value.

matplotlib is used through the object API (Figure, no pyplot) because pyplot keeps
global state and the orchestrator runs tools on several threads.
"""
import io

import matplotlib
from matplotlib.figure import Figure
from matplotlib.ticker import FuncFormatter

from . import theme

matplotlib.rcParams["font.family"] = "sans-serif"
matplotlib.rcParams["axes.edgecolor"] = theme.GRAY
matplotlib.rcParams["axes.labelcolor"] = theme.DARK
matplotlib.rcParams["text.color"] = theme.DARK
matplotlib.rcParams["xtick.color"] = theme.GRAY
matplotlib.rcParams["ytick.color"] = theme.GRAY

MAX_CHART_POINTS = 50  # bounds the chat payload / history row; SQL rows can be up to 150
_INR_HINTS = ("value", "amount", "spend", "cost", "price", "inr", "revenue", "budget", "capex", "opex")
_PCT_HINTS = ("pct", "percent", "rate", "ratio")
_COUNT_HINTS = ("count", "days", "qty", "quantity", "num")


def to_float(v) -> float:
    if v is None:
        return 0.0
    try:
        return float(str(v).replace(",", "").replace("₹", "").replace("%", ""))
    except ValueError:
        return 0.0


def _unit_for(y_name: str | None, title: str = "") -> str:
    """Unit from the value column name; the title is a fallback for bare names like "total"."""
    n = (y_name or "").lower()
    if any(h in n for h in _COUNT_HINTS):
        return "number"
    if any(h in n for h in _PCT_HINTS):
        return "pct"
    if any(h in n or h in title.lower() for h in _INR_HINTS):
        return "inr"
    return "number"


def _is_numeric(rows: list[dict], col: str) -> bool:
    vals = [r.get(col) for r in rows[:MAX_CHART_POINTS] if r.get(col) is not None]
    try:
        for v in vals:
            float(str(v).replace(",", "").replace("₹", "").replace("%", ""))
    except ValueError:
        return False
    return bool(vals)


def _resolve_columns(rows: list[dict], chart_type: str, x: str, y: str | None) -> tuple[str, str]:
    """Map the model's column names onto real ones. The model guesses names on
    cross-turn reuse and sees '<col>_cr' display hints that exist only in its view
    of the data — a silently missing column used to chart as all zeros."""
    cols = list(rows[0].keys())
    fix = lambda c: c[:-3] if c and c not in cols and c.endswith("_cr") and c[:-3] in cols else c
    x, y = fix(x), fix(y)
    missing = [c for c in (x, y) if c not in cols]
    if missing:
        raise ValueError(f"Column(s) {missing} not in this data. Available columns: {cols}. "
                         "Call create_visual again with exact column names.")
    if chart_type != "scatter" and not _is_numeric(rows, y) and _is_numeric(rows, x):
        x, y = y, x  # label/value swapped (common for hbar)
    if not _is_numeric(rows, y):
        raise ValueError(f"Value column {y!r} is not numeric. Available columns: {cols}.")
    return x, y


def build_spec(rows: list[dict], chart_type: str, x: str, y: str | None, title: str) -> dict:
    """Manifest rows -> JSON-serialisable chart spec (first MAX_CHART_POINTS rows)."""
    x, y = _resolve_columns(rows, chart_type, x, y)
    scatter = chart_type == "scatter"
    points = [
        {"x": to_float(r.get(x)) if scatter else str(r.get(x, "")), "y": to_float(r.get(y))}
        for r in rows[:MAX_CHART_POINTS]
    ]
    return {"chart_type": chart_type, "title": title, "x": x, "y": y or "",
            "unit": _unit_for(y, title), "points": points, "total_points": len(rows)}


def _fmt(v: float, unit: str) -> str:
    if unit == "pct":
        return f"{v:.1f}%"
    if unit == "inr":
        a, sign = abs(v), "-" if v < 0 else ""
        if a >= 1_00_00_000:
            return f"{sign}₹{a / 1_00_00_000:.2f} Cr"
        if a >= 1_00_000:
            return f"{sign}₹{a / 1_00_000:.2f} L"
        if a >= 1_000:
            return f"{sign}₹{a / 1_000:.1f} K"
        return f"{sign}₹{a:.0f}"
    return f"{v:,.0f}" if abs(v) >= 1000 else f"{v:g}"


def _new_fig(width=7.5, height=4.5, size=None):
    """size=(w_in, h_in) overrides the default so a chart can be rendered at the
    aspect ratio of the slide/page slot it will occupy."""
    if size:
        width, height = size
    fig = Figure(figsize=(width, height), dpi=150)
    fig.patch.set_facecolor("white")
    ax = fig.subplots()
    ax.set_facecolor("white")
    for spine in ("top", "right"):
        ax.spines[spine].set_visible(False)
    return fig, ax


def _finish(fig, title: str) -> bytes:
    if title:
        fig.suptitle(title, fontsize=13, fontweight="bold", color=theme.NAVY, x=0.02, ha="left")
    fig.tight_layout(rect=(0, 0, 1, 0.94 if title else 1))
    buf = io.BytesIO()
    fig.savefig(buf, format="png", facecolor="white", bbox_inches="tight", pad_inches=0.15)
    return buf.getvalue()


def _slant_xlabels(ax):
    for lbl in ax.get_xticklabels():
        lbl.set_rotation(30)
        lbl.set_ha("right")


def _value_labels(ax, bars, values, unit, horizontal=False):
    """Direct value labels at bar ends; skipped when there are too many bars to read."""
    if len(values) <= 14:
        ax.bar_label(bars, labels=[_fmt(v, unit) for v in values], fontsize=8,
                     color=theme.DARK, padding=3)


def bar_chart(labels: list[str], values: list[float], title: str, horizontal: bool = False,
              unit: str = "number", size=None) -> bytes:
    fig, ax = _new_fig(size=size)
    colors = theme.NAVY   # one message per chart: a single solid colour, value-labelled
    fmt = FuncFormatter(lambda v, _: _fmt(v, unit))
    if horizontal:
        bars = ax.barh(labels, values, color=colors)
        ax.invert_yaxis()
        ax.xaxis.set_major_formatter(fmt)
        ax.margins(x=0.18)
    else:
        bars = ax.bar(labels, values, color=colors)
        ax.yaxis.set_major_formatter(fmt)
        ax.margins(y=0.15)
        _slant_xlabels(ax)
    _value_labels(ax, bars, values, unit, horizontal)
    return _finish(fig, title)


def grouped_bar(labels: list[str], series: dict[str, list[float]], title: str,
                unit: str = "number", size=None) -> bytes:
    """Side-by-side bars per label, one colour per series (e.g. vendor vs portfolio)."""
    fig, ax = _new_fig(size=size)
    n = max(len(series), 1)
    width = 0.8 / n
    for i, (name, vals) in enumerate(series.items()):
        xs = [j + (i - (n - 1) / 2) * width for j in range(len(labels))]
        bars = ax.bar(xs, vals, width=width * 0.92, label=name,
                      color=theme.CHART_PALETTE[i % len(theme.CHART_PALETTE)])
        ax.bar_label(bars, labels=[_fmt(v, unit) for v in vals], fontsize=8, color=theme.DARK, padding=2)
    ax.set_xticks(range(len(labels)), labels)
    ax.yaxis.set_major_formatter(FuncFormatter(lambda v, _: _fmt(v, unit)))
    ax.margins(y=0.15)
    ax.legend(frameon=False, fontsize=9)
    return _finish(fig, title)


def line_chart(x: list, series: dict[str, list[float]], title: str, unit: str = "number", size=None) -> bytes:
    fig, ax = _new_fig(size=size)
    for i, (name, ys) in enumerate(series.items()):
        ax.plot(x, ys, marker="o", markersize=3, linewidth=2,
                 color=theme.CHART_PALETTE[i % len(theme.CHART_PALETTE)], label=name)
    if len(series) > 1:
        ax.legend(frameon=False, fontsize=9)
    ax.yaxis.set_major_formatter(FuncFormatter(lambda v, _: _fmt(v, unit)))
    if len(x) > 12:  # thin the crowded category axis
        step = max(len(x) // 10, 1)
        ax.set_xticks(range(0, len(x), step))
    _slant_xlabels(ax)
    return _finish(fig, title)


def pie_chart(labels: list[str], values: list[float], title: str, donut: bool = False, size=None) -> bytes:
    fig, ax = _new_fig(width=6, height=5, size=size)
    colors = [theme.CHART_PALETTE[i % len(theme.CHART_PALETTE)] for i in range(len(labels))]
    total = sum(values) or 1
    wedges, _, pct = ax.pie(
        values, colors=colors, startangle=90, counterclock=False,
        autopct=lambda p: f"{p:.0f}%" if p >= 6 else "", pctdistance=0.78 if donut else 0.6,
        wedgeprops={**({"width": 0.4} if donut else {}), "edgecolor": "white"},
        textprops={"fontsize": 9, "color": "white", "fontweight": "bold"})
    ax.legend(wedges, [f"{str(l)[:28]} — {100 * v / total:.0f}%" for l, v in zip(labels, values)],
              loc="center left", bbox_to_anchor=(1.0, 0.5), frameon=False, fontsize=9)
    ax.axis("equal")
    return _finish(fig, title)


def scatter_chart(x: list[float], y: list[float], title: str, x_label: str = "", y_label: str = "", size=None) -> bytes:
    fig, ax = _new_fig(size=size)
    ax.scatter(x, y, color=theme.NAVY, alpha=0.7, edgecolors="white", s=40)
    ax.set_xlabel(x_label)
    ax.set_ylabel(y_label)
    return _finish(fig, title)


def render_png(spec: dict, size=None, title: bool = True) -> bytes:
    """Render a chart spec to PNG bytes (PDF/PPTX exports).
    Either a build_spec() dict, or a "grouped" spec built by the deep-dive analysts:
    {"chart_type": "grouped", "title", "unit", "labels": [...], "series": {name: [...]}}.
    size=(w_in, h_in) fits the target slot; title=False leaves the heading to the slide."""
    ct, unit = spec["chart_type"], spec.get("unit", "number")
    heading = spec["title"] if title else ""
    if ct == "grouped":
        return grouped_bar(spec["labels"], spec["series"], heading, unit=unit, size=size)
    pts = spec["points"]
    xs, ys = [p["x"] for p in pts], [p["y"] for p in pts]
    if ct in ("bar", "hbar"):
        return bar_chart(xs, ys, heading, horizontal=(ct == "hbar"), unit=unit, size=size)
    if ct == "line":
        return line_chart(xs, {spec["y"] or "value": ys}, heading, unit=unit, size=size)
    if ct in ("pie", "donut"):
        return pie_chart(xs, ys, heading, donut=(ct == "donut"), size=size)
    if ct == "scatter":
        return scatter_chart(xs, ys, heading, x_label=spec["x"], y_label=spec["y"], size=size)
    raise ValueError(f"Unsupported chart_type {ct!r}")


if __name__ == "__main__":
    png = bar_chart(["A", "B", "C"], [10, 20, 15], "Test Bar Chart")
    assert png[:8] == b"\x89PNG\r\n\x1a\n", "not a valid PNG"
    assert len(png) > 1000
    rows = [{"vendor": f"V{i}", "total_po_value": 1e7 * (i + 1), "pct": 5} for i in range(150)]
    spec = build_spec(rows, "bar", "vendor", "total_po_value", "Spend")
    assert len(spec["points"]) == MAX_CHART_POINTS and spec["total_points"] == 150 and spec["unit"] == "inr"
    assert build_spec(rows, "line", "vendor", "pct", "t")["unit"] == "pct"
    assert build_spec([{"a": "x", "total": 1}], "bar", "a", "total", "CAPEX vs OPEX Spend")["unit"] == "inr"
    assert build_spec([{"a": "x", "po_count": 1}], "bar", "a", "po_count", "Spend by vendor")["unit"] == "number"
    for ct in ("bar", "hbar", "line", "pie", "donut", "scatter"):
        assert render_png(build_spec(rows, ct, "vendor" if ct != "scatter" else "pct", "total_po_value", "t"))[:8] == b"\x89PNG\r\n\x1a\n"
    assert _fmt(2.5e7, "inr") == "₹2.50 Cr"
    g = {"chart_type": "grouped", "title": "Vendor vs portfolio", "unit": "number", "labels": ["PO→GRN", "GRN→Inv"],
         "series": {"Vendor": [44.4, 9.4], "Portfolio": [39.9, 8.0]}}
    assert render_png(g, size=(6, 3.2), title=False)[:8] == b"\x89PNG\r\n\x1a\n"
    # model-guessed columns: _cr hint maps to the base column, swapped x/y is fixed, unknown names fail loudly
    cx = [{"capex_opex_flag": "CAPEX", "total": 1.9e10}, {"capex_opex_flag": "OPEX", "total": 2.0e10}]
    assert build_spec(cx, "pie", "capex_opex_flag", "total_cr", "t")["points"][0]["y"] == 1.9e10
    assert build_spec(cx, "hbar", "total", "capex_opex_flag", "t")["points"][1] == {"x": "OPEX", "y": 2.0e10}
    try:
        build_spec(cx, "pie", "capex_opex_flag", "total_spend", "t")
        raise AssertionError("unknown column should raise")
    except ValueError as e:
        assert "Available columns" in str(e)
    print("charts OK —", len(png), "bytes")
