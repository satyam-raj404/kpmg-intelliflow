"""Tool registry — name -> {json_schema, executor}. The registry IS the read-only
tool surface (Layer 4 of the invariant): only read/analysis/report tools are ever
registered here. No write/DDL/DML tool exists to be called, by construction.

Executor signature: executor(args: dict, ctx: TurnContext) -> Any
The return value is what gets stored in the manifest AND (compressed) shown to the model.
"""
from dataclasses import dataclass
from typing import Any, Callable

from .context import TurnContext

Executor = Callable[[dict, TurnContext], Any]


@dataclass
class Tool:
    name: str
    description: str
    parameters: dict  # JSON schema "parameters" object
    executor: Executor
    manifest_hint: str = "q"  # prefix for the manifest key this tool's result gets


_REGISTRY: dict[str, Tool] = {}


def register(tool: Tool) -> None:
    if tool.name in _REGISTRY:
        raise ValueError(f"Tool {tool.name!r} already registered")
    _REGISTRY[tool.name] = tool


def get_tool(name: str) -> Tool:
    if name not in _REGISTRY:
        raise KeyError(f"Unknown tool {name!r}. Known: {list(_REGISTRY)}")
    return _REGISTRY[name]


def all_tools() -> list[Tool]:
    return list(_REGISTRY.values())


# Tools always offered — core data access, cheap to reason about.
CORE_TOOL_NAMES = {
    "query_database", "get_metric", "get_kpis", "find_document",
    "get_anomalies", "get_vendor_info", "get_p2p_stage_summary", "analyze_data",
}
# Only offered when the question signals intent for them — cuts prompt size
# and, more importantly, cuts the choice space a small model has to pick from.
REPORT_TOOL_NAMES = {
    "create_visual", "create_report", "start_report", "add_table_section",
    "add_chart_section", "add_narrative_section", "finalize_report",
}

REPORT_INTENT_KEYWORDS = (
    "chart", "graph", "plot", "visual", "visualise", "visualize",
    "report", "excel", "spreadsheet", "xlsx", "pdf", "ppt", "pptx",
    "powerpoint", "deck", "slide", "export", "download", "generate",
)


def openai_tool_schemas(names: set[str] | None = None) -> list[dict]:
    """OpenAI/OpenRouter/Ollama-compatible tool schema list.
    names=None -> every registered tool (unchanged default behaviour)."""
    tools = _REGISTRY.values() if names is None else (_REGISTRY[n] for n in names if n in _REGISTRY)
    return [
        {
            "type": "function",
            "function": {
                "name": t.name,
                "description": t.description,
                "parameters": t.parameters,
            },
        }
        for t in tools
    ]


def tool_subset_for_question(question: str) -> set[str]:
    """CORE tools always; REPORT tools only when the question signals intent
    for them. Smaller tool list = smaller prompt + far better tool selection
    from small/local models (12 options -> 4-8)."""
    names = set(CORE_TOOL_NAMES)
    q = question.lower()
    if any(kw in q for kw in REPORT_INTENT_KEYWORDS):
        names |= REPORT_TOOL_NAMES
    return names


def _load_all_tool_modules() -> None:
    """Import every tools/*.py submodule so their register() calls fire.
    Idempotent — safe to call more than once (Python caches imports)."""
    from .tools import analysis_tools, chart_tool, data_tools, report_tools  # noqa: F401


_load_all_tool_modules()


if __name__ == "__main__":
    names = sorted(t.name for t in all_tools())
    print("Registered tools:", names)
    assert "query_database" in names
    assert "get_kpis" in names
    schemas = openai_tool_schemas()
    assert all("function" in s for s in schemas)
    print("registry OK —", len(names), "tools")
