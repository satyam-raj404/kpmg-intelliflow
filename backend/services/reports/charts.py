"""matplotlib chart helpers, KPMG-themed. Shared by chart_tool.py (chat inline
charts) and pdf.py/pptx.py (embedded report charts). Every function takes only
already-computed data — never a query, never a model-authored value.
"""
import io

import matplotlib
matplotlib.use("Agg")  # headless — no display backend needed on a server
import matplotlib.pyplot as plt

from . import theme

plt.rcParams["font.family"] = "sans-serif"
plt.rcParams["axes.edgecolor"] = theme.GRAY
plt.rcParams["axes.labelcolor"] = theme.DARK
plt.rcParams["text.color"] = theme.DARK
plt.rcParams["xtick.color"] = theme.GRAY
plt.rcParams["ytick.color"] = theme.GRAY


def _new_fig(width=7.5, height=4.5):
    fig, ax = plt.subplots(figsize=(width, height), dpi=150)
    fig.patch.set_facecolor("white")
    ax.set_facecolor("white")
    for spine in ("top", "right"):
        ax.spines[spine].set_visible(False)
    return fig, ax


def _finish(fig, title: str) -> bytes:
    fig.suptitle(title, fontsize=13, fontweight="bold", color=theme.NAVY, x=0.02, ha="left")
    fig.tight_layout(rect=(0, 0, 1, 0.94))
    buf = io.BytesIO()
    fig.savefig(buf, format="png", facecolor="white")
    plt.close(fig)
    return buf.getvalue()


def bar_chart(labels: list[str], values: list[float], title: str, horizontal: bool = False) -> bytes:
    fig, ax = _new_fig()
    colors = [theme.CHART_PALETTE[i % len(theme.CHART_PALETTE)] for i in range(len(labels))]
    if horizontal:
        ax.barh(labels, values, color=colors)
        ax.invert_yaxis()
    else:
        ax.bar(labels, values, color=colors)
        plt.setp(ax.get_xticklabels(), rotation=30, ha="right")
    return _finish(fig, title)


def line_chart(x: list, series: dict[str, list[float]], title: str) -> bytes:
    fig, ax = _new_fig()
    for i, (name, ys) in enumerate(series.items()):
        ax.plot(x, ys, marker="o", markersize=3, linewidth=2,
                 color=theme.CHART_PALETTE[i % len(theme.CHART_PALETTE)], label=name)
    if len(series) > 1:
        ax.legend(frameon=False, fontsize=9)
    plt.setp(ax.get_xticklabels(), rotation=30, ha="right")
    return _finish(fig, title)


def pie_chart(labels: list[str], values: list[float], title: str, donut: bool = False) -> bytes:
    fig, ax = _new_fig(width=6, height=5)
    colors = [theme.CHART_PALETTE[i % len(theme.CHART_PALETTE)] for i in range(len(labels))]
    wedge_kw = {"width": 0.4} if donut else {}
    ax.pie(values, labels=labels, autopct="%1.1f%%", colors=colors,
           wedgeprops={**wedge_kw, "edgecolor": "white"}, textprops={"fontsize": 9})
    ax.axis("equal")
    return _finish(fig, title)


def scatter_chart(x: list[float], y: list[float], title: str, x_label: str = "", y_label: str = "") -> bytes:
    fig, ax = _new_fig()
    ax.scatter(x, y, color=theme.NAVY, alpha=0.7, edgecolors="white", s=40)
    ax.set_xlabel(x_label)
    ax.set_ylabel(y_label)
    return _finish(fig, title)


if __name__ == "__main__":
    png = bar_chart(["A", "B", "C"], [10, 20, 15], "Test Bar Chart")
    assert png[:8] == b"\x89PNG\r\n\x1a\n", "not a valid PNG"
    assert len(png) > 1000
    print("charts OK —", len(png), "bytes")
