"""TurnContext + DataManifest — every tool result this turn is stored under a
key. Analysis/chart/report tools reference manifest keys, never re-query, never
invent. This is what makes grounding.py's numeric verifier meaningful: it
checks the answer against exactly what's in here.

DataManifest is SESSION-scoped (not per-turn): the orchestrator hands the same
instance across turns in a session so a follow-up like "chart that" or "export
this to Excel" can reference a manifest key from a previous turn's tool call.
put() is lock-guarded since Phase-4 parallel tool execution writes to the same
manifest from multiple threads within one turn.
"""
import threading
from dataclasses import dataclass, field
from typing import Any


@dataclass
class DataManifest:
    """key -> raw tool result (list[dict] | dict). Thread-safe; session-scoped.

    Also tracks a short description per key (_descriptions) so a FOLLOW-UP turn
    can be told what's already available — without this, the model has no way
    to know a manifest key exists past the turn that created it, since only the
    final user/assistant text (not the intermediate tool-call messages) carries
    over into the next turn's history."""
    _store: dict[str, Any] = field(default_factory=dict)
    _descriptions: dict[str, str] = field(default_factory=dict)
    _counter: int = 0
    _lock: threading.Lock = field(default_factory=threading.Lock)

    def put(self, value: Any, hint: str = "q", description: str = "") -> str:
        with self._lock:
            self._counter += 1
            key = f"{hint}{self._counter}"
            self._store[key] = value
            self._descriptions[key] = description or hint
            return key

    def get(self, key: str) -> Any:
        if key not in self._store:
            raise KeyError(f"No manifest entry {key!r}. Known keys: {list(self._store)}")
        return self._store[key]

    def all_values(self) -> list[Any]:
        return list(self._store.values())

    def keys(self) -> list[str]:
        return list(self._store)

    def render_available_data(self, max_entries: int = 15) -> str:
        """Short 'what's already fetched this session' listing for the system
        prompt — lets a follow-up turn ('chart that', 'export this') reference
        a prior turn's key without replaying the whole tool-call transcript."""
        items = list(self._descriptions.items())[-max_entries:]
        if not items:
            return "(none yet)"
        return "\n".join(f"- {key}: {desc}" for key, desc in items)

    def prune(self, max_entries: int) -> None:
        """Drop oldest entries beyond max_entries — bounds memory for a
        long-lived session manifest. Keys are f"{hint}{counter}" so insertion
        order == dict iteration order (Python 3.7+ dict ordering)."""
        with self._lock:
            excess = len(self._store) - max_entries
            if excess > 0:
                for key in list(self._store.keys())[:excess]:
                    del self._store[key]
                    self._descriptions.pop(key, None)


@dataclass
class TurnContext:
    session_id: str
    manifest: DataManifest = field(default_factory=DataManifest)
    tools_used: list[str] = field(default_factory=list)
    citations: list[dict] = field(default_factory=list)
    artifacts: list[dict] = field(default_factory=list)
    _lock: threading.Lock = field(default_factory=threading.Lock)

    def record_tool_call(self, name: str) -> None:
        with self._lock:
            self.tools_used.append(name)

    def record_artifact(self, artifact: dict) -> None:
        with self._lock:
            self.artifacts.append(artifact)

    def record_citation(self, tool_name: str, manifest_key: str, summary: str) -> None:
        with self._lock:
            self.citations.append({"tool": tool_name, "manifest_key": manifest_key, "summary": summary})

    def dedup_tools_used(self) -> list[str]:
        return list(dict.fromkeys(self.tools_used))


if __name__ == "__main__":
    ctx = TurnContext(session_id="s1")
    k1 = ctx.manifest.put([{"vendor": "Infosys", "spend": 100}], hint="q")
    assert ctx.manifest.get(k1)[0]["vendor"] == "Infosys"
    ctx.record_tool_call("get_kpis")
    ctx.record_tool_call("get_kpis")
    assert ctx.dedup_tools_used() == ["get_kpis"]
    ctx.record_citation("get_kpis", k1, "Procurement KPIs")
    assert ctx.citations[0]["manifest_key"] == k1
    assert k1 in ctx.manifest.render_available_data()

    # prune keeps newest N
    m = DataManifest()
    keys = [m.put(i, hint="x") for i in range(10)]
    m.prune(3)
    assert m.keys() == keys[-3:], m.keys()

    # thread-safety smoke check — concurrent put() must not lose entries
    import threading as _t
    m2 = DataManifest()
    def _writer():
        for _ in range(200):
            m2.put(1, hint="t")
    threads = [_t.Thread(target=_writer) for _ in range(8)]
    for t in threads: t.start()
    for t in threads: t.join()
    assert len(m2.keys()) == 1600, len(m2.keys())

    print("context OK")
