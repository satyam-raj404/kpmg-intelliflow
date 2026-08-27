"""Artifact store — generated files (charts, Excel, PPTX, PDF) live on disk under
backend/_artifacts/{session_id}/, tracked in an in-memory registry keyed by a
UUID. The download endpoint (routers/chat.py) validates artifact_id ownership
before serving — no path traversal, no cross-session access.
"""
import mimetypes
import os
import threading
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path

ARTIFACTS_ROOT = Path(__file__).parent.parent / "_artifacts"
ARTIFACTS_ROOT.mkdir(exist_ok=True)

MAX_ARTIFACT_BYTES = 25 * 1024 * 1024  # 25 MB
TTL_SECONDS = 24 * 3600
MAX_PER_SESSION = 50


@dataclass
class ArtifactRecord:
    artifact_id: str
    session_id: str
    path: Path
    filename: str
    kind: str  # chart_png | excel | pptx | pdf
    created_at: float = field(default_factory=time.time)

    @property
    def content_type(self) -> str:
        return mimetypes.guess_type(self.filename)[0] or "application/octet-stream"


_lock = threading.Lock()
_registry: dict[str, ArtifactRecord] = {}
_session_order: dict[str, list[str]] = {}


class ArtifactError(Exception):
    pass


def save_artifact(session_id: str, filename: str, data: bytes, kind: str) -> ArtifactRecord:
    if len(data) > MAX_ARTIFACT_BYTES:
        raise ArtifactError(f"Artifact exceeds {MAX_ARTIFACT_BYTES} bytes.")

    safe_session = "".join(c for c in session_id if c.isalnum() or c in "-_") or "default"
    session_dir = ARTIFACTS_ROOT / safe_session
    session_dir.mkdir(parents=True, exist_ok=True)

    artifact_id = str(uuid.uuid4())
    safe_filename = "".join(c for c in filename if c.isalnum() or c in "-_. ") or "artifact"
    path = session_dir / f"{artifact_id}_{safe_filename}"
    path.write_bytes(data)

    record = ArtifactRecord(artifact_id=artifact_id, session_id=safe_session, path=path,
                             filename=safe_filename, kind=kind)

    with _lock:
        _registry[artifact_id] = record
        order = _session_order.setdefault(safe_session, [])
        order.append(artifact_id)
        while len(order) > MAX_PER_SESSION:
            evict_id = order.pop(0)
            evicted = _registry.pop(evict_id, None)
            if evicted:
                evicted.path.unlink(missing_ok=True)
    return record


def get_artifact(artifact_id: str) -> ArtifactRecord | None:
    with _lock:
        record = _registry.get(artifact_id)
    if record is None:
        return None
    if time.time() - record.created_at > TTL_SECONDS or not record.path.exists():
        with _lock:
            _registry.pop(artifact_id, None)
        return None
    return record


def artifact_url(artifact_id: str) -> str:
    return f"/api/chat/artifacts/{artifact_id}"


if __name__ == "__main__":
    rec = save_artifact("test-session", "hello.txt", b"hello world", kind="test")
    assert get_artifact(rec.artifact_id) is not None
    assert get_artifact("nonexistent-id") is None
    rec.path.unlink()
    print("artifacts OK")
