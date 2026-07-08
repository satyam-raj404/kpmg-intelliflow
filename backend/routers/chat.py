"""Chat router — POST /api/chat for Ask IntelliSource AI."""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
import threading

from services.chat_engine import run_chat
from services.audit import write_audit

router = APIRouter()

# In-memory session store: session_id → message history list
_sessions: dict[str, list] = {}
_sessions_lock = threading.Lock()


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None


@router.post("/chat")
def chat(body: ChatRequest):
    sid = body.session_id or "default"
    with _sessions_lock:
        history = list(_sessions.get(sid, []))

    try:
        result = run_chat(body.message, history)
    except Exception as exc:
        import traceback
        return {
            "reply": f"Error: {exc}",
            "tools_used": [],
            "session_id": sid,
            "debug": traceback.format_exc(),
        }

    with _sessions_lock:
        _sessions[sid] = result["new_history"]

    write_audit(
        user_id="user",
        action="CHAT_QUERY",
        entity_type="CHAT",
        entity_id=sid,
        details=f"q={body.message[:120]}",
    )
    return {
        "reply": result["reply"],
        "tools_used": result["tools_used"],
        "session_id": sid,
    }


@router.delete("/chat/session/{session_id}")
def clear_session(session_id: str):
    with _sessions_lock:
        _sessions.pop(session_id, None)
    return {"ok": True}
