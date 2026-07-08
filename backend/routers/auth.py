"""Auth/session router — user management, login, session tracking."""
import secrets
import string
from uuid import uuid4
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from database import get_connection

router = APIRouter()

VALID_ROLES = {
    "Procurement Manager", "Delivery Manager", "Finance User",
    "Compliance Officer", "CXO", "Admin",
    "Leadership", "Partner", "Consultant",
    "Manager", "Director", "Associate Director",
}


def _generate_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    return "".join(secrets.choice(alphabet) for _ in range(length))


# ── Session tracking (existing) ────────────────────────────────────────────────

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
        {"user_name": r[0], "action": r[1], "details": r[2], "created_at": r[3]}
        for r in rows
    ]


# ── User management ────────────────────────────────────────────────────────────

class CreateUserBody(BaseModel):
    email: str
    full_name: str
    role: str


class UpdateUserBody(BaseModel):
    role: Optional[str] = None
    is_active: Optional[int] = None


class LoginBody(BaseModel):
    email: str
    password: str


@router.post("/auth/users", status_code=201)
def create_user(body: CreateUserBody):
    if body.role not in VALID_ROLES:
        raise HTTPException(400, f"Invalid role. Valid: {sorted(VALID_ROLES)}")

    password = _generate_password()
    user_id = str(uuid4())
    conn = get_connection()

    try:
        conn.execute(
            "INSERT INTO users (user_id, email, full_name, role, password, is_active) VALUES (?, ?, ?, ?, ?, 1)",
            (user_id, body.email.lower().strip(), body.full_name.strip(), body.role, password),
        )
        conn.execute(
            "INSERT INTO audit_log (user_id, action, entity_type, details) VALUES (?, ?, ?, ?)",
            ("admin", "USER_CREATED", "USER", f"email={body.email} role={body.role}"),
        )
        conn.commit()
    except Exception as exc:
        raise HTTPException(409, f"User already exists or DB error: {exc}")

    return {
        "user_id": user_id,
        "email": body.email.lower().strip(),
        "full_name": body.full_name.strip(),
        "role": body.role,
        "generated_password": password,
    }


@router.get("/auth/users")
def list_users():
    conn = get_connection()
    rows = conn.execute(
        "SELECT user_id, email, full_name, role, is_active, created_at FROM users ORDER BY created_at DESC"
    ).fetchall()
    return [
        {
            "user_id": r[0], "email": r[1], "full_name": r[2],
            "role": r[3], "is_active": r[4], "created_at": r[5],
        }
        for r in rows
    ]


@router.put("/auth/users/{user_id}")
def update_user(user_id: str, body: UpdateUserBody):
    conn = get_connection()
    user = conn.execute("SELECT user_id FROM users WHERE user_id = ?", (user_id,)).fetchone()
    if not user:
        raise HTTPException(404, "User not found")
    if body.role is not None:
        if body.role not in VALID_ROLES:
            raise HTTPException(400, f"Invalid role")
        conn.execute("UPDATE users SET role = ? WHERE user_id = ?", (body.role, user_id))
    if body.is_active is not None:
        conn.execute("UPDATE users SET is_active = ? WHERE user_id = ?", (body.is_active, user_id))
    conn.execute(
        "INSERT INTO audit_log (user_id, action, entity_type, details) VALUES (?, ?, ?, ?)",
        ("admin", "USER_UPDATED", "USER", f"user_id={user_id}"),
    )
    conn.commit()
    return {"ok": True}


@router.post("/auth/users/{user_id}/reset-password")
def reset_password(user_id: str):
    conn = get_connection()
    user = conn.execute(
        "SELECT email, full_name FROM users WHERE user_id = ?", (user_id,)
    ).fetchone()
    if not user:
        raise HTTPException(404, "User not found")

    password = _generate_password()
    conn.execute("UPDATE users SET password = ? WHERE user_id = ?", (password, user_id))
    conn.execute(
        "INSERT INTO audit_log (user_id, action, entity_type, details) VALUES (?, ?, ?, ?)",
        ("admin", "PASSWORD_RESET", "USER", f"user_id={user_id}"),
    )
    conn.commit()
    return {"generated_password": password, "email": user[0], "full_name": user[1]}


class RegisterBody(BaseModel):
    email: str
    full_name: str
    role: str
    password: str


@router.post("/auth/register", status_code=201)
def register(body: RegisterBody):
    if body.role not in VALID_ROLES:
        raise HTTPException(400, f"Invalid role. Valid: {sorted(VALID_ROLES)}")
    if len(body.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    user_id = str(uuid4())
    conn = get_connection()
    try:
        conn.execute(
            "INSERT INTO users (user_id, email, full_name, role, password, is_active) VALUES (?, ?, ?, ?, ?, 1)",
            (user_id, body.email.lower().strip(), body.full_name.strip(), body.role, body.password),
        )
        conn.execute(
            "INSERT INTO audit_log (user_id, action, entity_type, details) VALUES (?, ?, ?, ?)",
            (body.full_name.strip(), "SELF_REGISTER", "USER", f"email={body.email} role={body.role}"),
        )
        conn.commit()
    except Exception as exc:
        raise HTTPException(409, f"Email already registered: {exc}")
    return {
        "user_id": user_id,
        "email": body.email.lower().strip(),
        "full_name": body.full_name.strip(),
        "role": body.role,
    }


@router.post("/auth/login")
def login(body: LoginBody):
    conn = get_connection()
    user = conn.execute(
        "SELECT user_id, email, full_name, role, password, is_active FROM users WHERE email = ?",
        (body.email.lower().strip(),),
    ).fetchone()
    if not user:
        conn.execute(
            "INSERT INTO audit_log (user_id, action, entity_type, details) VALUES (?, ?, ?, ?)",
            ("unknown", "LOGIN_FAILED", "SESSION", f"email={body.email.lower().strip()}"),
        )
        conn.commit()
        raise HTTPException(401, "Invalid email or password")
    if not user[4] or user[4] != body.password:
        conn.execute(
            "INSERT INTO audit_log (user_id, action, entity_type, details) VALUES (?, ?, ?, ?)",
            (user[2], "LOGIN_FAILED", "SESSION", f"email={user[1]} role={user[3]}"),
        )
        conn.commit()
        raise HTTPException(401, "Invalid email or password")
    if not user[5]:
        raise HTTPException(403, "Account is deactivated")
    conn.execute(
        "INSERT INTO audit_log (user_id, action, entity_type, details) VALUES (?, ?, ?, ?)",
        (user[2], "LOGIN", "SESSION", f"email={user[1]} role={user[3]}"),
    )
    conn.commit()
    return {"user_id": user[0], "email": user[1], "full_name": user[2], "role": user[3]}


@router.get("/audit")
def get_audit_log(limit: int = Query(default=100, le=500)):
    conn = get_connection()
    rows = conn.execute(
        """
        SELECT log_id, user_id, action, entity_type, entity_id, details, created_at
        FROM audit_log
        ORDER BY created_at DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()
    return [
        {
            "id": r[0],
            "user": r[1],
            "action": r[2],
            "entity": r[3],
            "entity_id": r[4] or "",
            "details": r[5] or "",
            "timestamp": r[6],
        }
        for r in rows
    ]
