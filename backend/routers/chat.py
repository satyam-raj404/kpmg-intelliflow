"""Chat router — POST /api/chat for Ask IntelliSource AI, backed by the cascade
agent harness (services/agent/orchestrator.py). Also serves generated artifacts
(charts/Excel/PPTX/PDF) via GET /api/chat/artifacts/{id} — the first file-
download route in this backend — and persists conversations (chat_sessions /
chat_messages, app DB) so history survives a backend restart and users can
browse/resume past conversations.

services/chat_engine.py + services/chat_tools.py are kept as inert compat
shims — nothing else in the app imports them; they're not deleted in case
anything external still references the old module paths.
"""
import json
import threading

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional

from database import get_connection
from services.agent.config import ai_enabled
from services.agent.orchestrator import run_turn, clear_session_manifest
from services.artifacts import get_artifact
from services.audit import write_audit

_NO_KEY_MESSAGE = (
    "AI features aren't available on this deployment yet — no LLM API key is "
    "configured (OPENROUTER_API_KEY). Ask your admin to set one in .env, then "
    "restart the backend."
)

router = APIRouter()

# In-memory cache: session_id -> message history list. Avoids a DB round-trip
# on every turn of an active conversation; chat_messages (DB) is the durable
# copy that survives a restart — _load_history_from_db rehydrates on a cache miss.
_sessions: dict[str, list] = {}
_sessions_lock = threading.Lock()


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None


def _load_history_from_db(session_id: str) -> list[dict]:
    conn = get_connection()
    rows = conn.execute(
        "SELECT role, content FROM chat_messages WHERE session_id = ? ORDER BY id",
        (session_id,),
    ).fetchall()
    history = [{"role": r[0], "content": r[1]} for r in rows]
    return history[-20:]  # matches orchestrator's own history cap


def _persist_turn(session_id: str, user_message: str, reply: str, tools_used: list[str],
                   artifacts: list[dict]) -> None:
    conn = get_connection()
    existing = conn.execute(
        "SELECT session_id FROM chat_sessions WHERE session_id = ?", (session_id,)
    ).fetchone()
    if not existing:
        title = user_message.strip()[:60] or "New conversation"
        conn.execute(
            "INSERT INTO chat_sessions (session_id, title) VALUES (?, ?)",
            (session_id, title),
        )
    else:
        conn.execute(
            "UPDATE chat_sessions SET updated_at = NOW()::TEXT WHERE session_id = ?",
            (session_id,),
        )
    # Drop the heavy base64 `preview` before persisting — the frontend re-fetches
    # the image from `url`; storing base64 in every history row bloats the DB.
    slim_artifacts = [{k: v for k, v in a.items() if k != "preview"} for a in artifacts]
    conn.execute(
        "INSERT INTO chat_messages (session_id, role, content, tools_used, artifacts) VALUES (?, ?, ?, ?, ?)",
        (session_id, "user", user_message, "", "[]"),
    )
    conn.execute(
        "INSERT INTO chat_messages (session_id, role, content, tools_used, artifacts) VALUES (?, ?, ?, ?, ?)",
        (session_id, "assistant", reply, ",".join(tools_used), json.dumps(slim_artifacts)),
    )
    conn.commit()


@router.get("/chat/status")
def chat_status():
    """Lets the frontend gray out the Ask IntelliSource UI up front instead of
    letting the user send a message and get an error back."""
    return {"ai_enabled": ai_enabled()}


@router.post("/chat")
def chat(body: ChatRequest):
    sid = body.session_id or "default"

    if not ai_enabled():
        return {
            "reply": _NO_KEY_MESSAGE,
            "tools_used": [],
            "artifacts": [],
            "session_id": sid,
            "ai_enabled": False,
        }

    with _sessions_lock:
        history = _sessions.get(sid)
    if history is None:
        history = _load_history_from_db(sid)  # rehydrate after a restart

    try:
        result = run_turn(sid, body.message, history)
    except Exception as exc:
        import traceback
        return {
            "reply": f"Error: {exc}",
            "tools_used": [],
            "artifacts": [],
            "session_id": sid,
            "debug": traceback.format_exc(),
        }

    with _sessions_lock:
        _sessions[sid] = result["new_history"]

    try:
        _persist_turn(sid, body.message, result["reply"], result["tools_used"], result["artifacts"])
    except Exception as exc:
        print(f"[chat] failed to persist conversation for session {sid}: {exc}")

    write_audit(
        user_id="user",
        action="CHAT_QUERY",
        entity_type="CHAT",
        entity_id=sid,
        details=f"q={body.message[:120]} tools={','.join(result['tools_used'])}",
    )
    if result["artifacts"]:
        write_audit(
            user_id="user",
            action="ARTIFACT_GENERATED",
            entity_type="CHAT",
            entity_id=sid,
            details=f"count={len(result['artifacts'])} types={','.join(a['type'] for a in result['artifacts'])}",
        )

    return {
        "reply": result["reply"],
        "tools_used": result["tools_used"],
        "artifacts": result["artifacts"],
        "citations": result["citations"],
        "grounding": result["grounding"],
        "session_id": sid,
    }


@router.delete("/chat/session/{session_id}")
def clear_session(session_id: str):
    """Reset a session's working state (in-memory history + manifest) WITHOUT
    deleting its saved transcript — matches the existing frontend 'Clear chat'
    button, which starts a fresh session id anyway. Use DELETE
    /chat/sessions/{id} to actually delete a saved conversation."""
    with _sessions_lock:
        _sessions.pop(session_id, None)
    clear_session_manifest(session_id)
    return {"ok": True}


@router.get("/chat/artifacts/{artifact_id}")
def download_artifact(artifact_id: str):
    record = get_artifact(artifact_id)
    if record is None:
        raise HTTPException(404, "Artifact not found or expired.")
    return FileResponse(
        path=record.path,
        media_type=record.content_type,
        filename=record.filename,
    )


# ── Conversation persistence & browsing ──────────────────────────────────────────

@router.get("/chat/sessions")
def list_sessions(limit: int = 50):
    conn = get_connection()
    rows = conn.execute(
        "SELECT session_id, title, created_at, updated_at FROM chat_sessions "
        "ORDER BY updated_at DESC LIMIT ?",
        (limit,),
    ).fetchall()
    return [{"session_id": r[0], "title": r[1], "created_at": r[2], "updated_at": r[3]} for r in rows]


@router.get("/chat/sessions/{session_id}/messages")
def get_session_messages(session_id: str):
    conn = get_connection()
    rows = conn.execute(
        "SELECT role, content, tools_used, artifacts, created_at FROM chat_messages "
        "WHERE session_id = ? ORDER BY id",
        (session_id,),
    ).fetchall()
    out = []
    for r in rows:
        try:
            artifacts = json.loads(r[3] or "[]")
        except (json.JSONDecodeError, TypeError):
            artifacts = []
        out.append({
            "role": r[0], "content": r[1],
            "tools_used": [t for t in (r[2] or "").split(",") if t],
            "artifacts": artifacts, "created_at": r[4],
        })
    return out


class RenameSessionBody(BaseModel):
    title: str


@router.put("/chat/sessions/{session_id}")
def rename_session(session_id: str, body: RenameSessionBody):
    conn = get_connection()
    existing = conn.execute("SELECT session_id FROM chat_sessions WHERE session_id = ?", (session_id,)).fetchone()
    if not existing:
        raise HTTPException(404, "Session not found")
    conn.execute("UPDATE chat_sessions SET title = ? WHERE session_id = ?", (body.title.strip()[:60], session_id))
    conn.commit()
    return {"ok": True}


@router.delete("/chat/sessions/{session_id}")
def delete_session(session_id: str):
    """Permanently deletes a saved conversation (transcript + working state)."""
    conn = get_connection()
    conn.execute("DELETE FROM chat_messages WHERE session_id = ?", (session_id,))
    conn.execute("DELETE FROM chat_sessions WHERE session_id = ?", (session_id,))
    conn.commit()
    with _sessions_lock:
        _sessions.pop(session_id, None)
    clear_session_manifest(session_id)
    return {"ok": True}
