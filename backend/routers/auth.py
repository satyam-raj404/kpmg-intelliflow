"""Auth/session router — user login/logout event tracking."""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from database import get_connection

router = APIRouter()


class SessionEvent(BaseModel):
    user_name: str
    user_email: Optional[str] = None
    role: str
    action: str  # LOGIN | LOGOUT | ROLE_SWITCH


@router.post("/auth/session", status_code=201)
def record_session(body: SessionEvent):
    conn = get_connection()
    conn.execute(
        "INSERT INTO audit_log (user_id, action, entity_type, details) VALUES (?, ?, ?, ?)",
        (
            body.user_name,
            body.action,
            "SESSION",
            f"role={body.role}" + (f" | {body.user_email}" if body.user_email else ""),
        ),
    )
    conn.commit()
    return {"ok": True}


@router.get("/auth/sessions")
def get_sessions(limit: int = 30):
    conn = get_connection()
    rows = conn.execute(
        """
        SELECT user_id, action, details, created_at
        FROM audit_log
        WHERE entity_type = 'SESSION'
        ORDER BY created_at DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()
    return [
        {
            "user_name":  r[0],
            "action":     r[1],
            "details":    r[2],
            "created_at": r[3],
        }
        for r in rows
    ]
