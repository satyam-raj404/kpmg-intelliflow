"""Minimal exact-match cache (Plan B6) — scoped deliberately narrow.

The harness's data source is local Postgres, which (per this build's own
harness-only-local design — see ASK_INTELLISOURCE_HARNESS_PLAN.md) doesn't
receive live uploads the way the app's Neon DB does, so there's no natural
"data_version" signal to invalidate on. A short TTL is the honest choice here
rather than pretending to track freshness we can't observe.

Only the fast-path METRIC lookup is cached (not document lookups, not the
full agentic loop): it's a pure function of (metric_key) with no session
side-effects beyond a manifest entry, so a cache hit can still populate a
fresh manifest entry for follow-up references — callers get a real citation
and a real, reusable manifest key even when the underlying LLM call was
skipped. Report/chart/document paths are NOT cached: they mutate more state
(artifacts, multi-step manifests) than is safe to shortcut generically.
"""
import threading
import time

TTL_SECONDS = 120
MAX_ENTRIES = 200

_lock = threading.Lock()
_store: dict[str, tuple[float, list, str]] = {}  # metric_key -> (expires_at, rows, narrator_reply)


def get(metric_key: str) -> tuple[list, str] | None:
    with _lock:
        entry = _store.get(metric_key)
        if entry is None:
            return None
        expires_at, rows, reply = entry
        if time.time() > expires_at:
            del _store[metric_key]
            return None
        return rows, reply


def put(metric_key: str, rows: list, reply: str) -> None:
    with _lock:
        if len(_store) >= MAX_ENTRIES:
            oldest_key = min(_store, key=lambda k: _store[k][0])
            del _store[oldest_key]
        _store[metric_key] = (time.time() + TTL_SECONDS, rows, reply)


def clear() -> None:
    with _lock:
        _store.clear()


if __name__ == "__main__":
    clear()
    assert get("total_po_value") is None
    put("total_po_value", [{"total_po_value": 100.0}], "**Total:** 100")
    hit = get("total_po_value")
    assert hit is not None and hit[1] == "**Total:** 100"

    # TTL expiry — negative TTL means "already expired"; reassigning a bare
    # name at module top-level rebinds it directly, no `global` needed here.
    TTL_SECONDS = -1
    put("expired_key", [{"x": 1}], "reply")
    assert get("expired_key") is None
    TTL_SECONDS = 120

    print("cache OK")
