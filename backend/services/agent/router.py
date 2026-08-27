"""Fast-path intent router — rule-based, zero LLM latency. Runs before the
agentic loop; decides whether a question can skip straight to a tool call
instead of burning a planner round-trip to (re-)discover what's obvious from
the text alone.

Three outcomes:
  - ("metric", key)     -> call get_metric(key) directly
  - ("document", num)   -> call find_document directly (doc_type left to the
                            tool's own dispatch since prefix alone is ambiguous
                            across PO/PR/GRN/Invoice in this dataset)
  - (None, None)        -> no confident match, fall through to the full
                            agentic loop unchanged

Deliberately conservative: a false-positive fast-path (confidently answering
the wrong thing) is worse than falling through to the loop, so both matchers
require a fairly specific signal before firing.
"""
import re

from . import metrics

# 8-10 digit standalone tokens are PO/PR/GRN/Invoice numbers in this dataset
# (2000xxxxxx=PO, 1000xxxx=PR, 5000xxxxxx/5105xxxxxx=GRN/Invoice). Require a
# document-ish keyword nearby so a bare large number in prose doesn't misfire.
_DOC_NUMBER_RE = re.compile(r"\b(\d{8,10})\b")
_DOC_CONTEXT_RE = re.compile(
    r"\b(po|purchase order|pr|requisition|grn|goods receipt|invoice|document|doc)\b",
    re.IGNORECASE,
)

# Report/analysis intent (chart/export/report) should NOT fast-path even if it
# also matches a metric alias — those need the full loop to build the artifact.
from .registry import REPORT_INTENT_KEYWORDS  # noqa: E402


def route(question: str) -> tuple[str | None, str | None]:
    q = question.lower()

    if any(kw in q for kw in REPORT_INTENT_KEYWORDS):
        return None, None

    doc_match = _DOC_NUMBER_RE.search(question)
    if doc_match and _DOC_CONTEXT_RE.search(question):
        return "document", doc_match.group(1)

    metric_key = metrics.match_alias(question)
    if metric_key:
        return "metric", metric_key

    return None, None


if __name__ == "__main__":
    assert route("What is the total PO value?") == ("metric", "total_po_value")
    assert route("Who are the top vendors by spend?") == ("metric", "spend_by_vendor")
    assert route("Tell me about PO 2000001004") == ("document", "2000001004")
    assert route("What happened with document 2000001004 and its GRNs?") == ("document", "2000001004")
    assert route("Chart the top vendors by spend") == (None, None)  # report intent wins
    assert route("Make a PDF report of total PO value") == (None, None)
    assert route("What's the weather like today?") == (None, None)
    assert route("How many POs were touched by vendor 700200 last quarter with unusual terms?") == (None, None)
    print("router OK")
