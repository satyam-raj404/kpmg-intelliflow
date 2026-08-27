"""Prompt Library — reusable, shareable Ask IntelliSource prompts.

App metadata: reads/writes the main app DB (database.get_connection, same as
every other router) — NOT the harness's read-only connection. A saved prompt
is just text; running it goes through the normal /api/chat -> harness path
like any other question.
"""
import json

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from database import get_connection
from services.audit import write_audit

router = APIRouter()


def _row_to_dict(r) -> dict:
    try:
        params = json.loads(r[4] or "[]")
    except (json.JSONDecodeError, TypeError):
        params = []
    return {
        "id": r[0], "name": r[1], "category": r[2], "prompt_text": r[3],
        "params": params, "created_by": r[5], "is_shared": bool(r[6]),
        "use_count": r[7], "created_at": r[8],
    }


@router.get("/prompt-library")
def list_prompts(category: Optional[str] = None):
    conn = get_connection()
    if category and category != "All":
        rows = conn.execute(
            "SELECT id, name, category, prompt_text, params_json, created_by, "
            "is_shared, use_count, created_at FROM prompt_library "
            "WHERE category = ? ORDER BY use_count DESC, created_at DESC",
            (category,),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT id, name, category, prompt_text, params_json, created_by, "
            "is_shared, use_count, created_at FROM prompt_library "
            "ORDER BY use_count DESC, created_at DESC"
        ).fetchall()
    return [_row_to_dict(r) for r in rows]


@router.get("/prompt-library/categories")
def list_categories():
    conn = get_connection()
    rows = conn.execute(
        "SELECT DISTINCT category FROM prompt_library ORDER BY category"
    ).fetchall()
    return [r[0] for r in rows]


class PromptParam(BaseModel):
    key: str
    label: str
    default: str = ""


class CreatePromptBody(BaseModel):
    name: str
    category: str = "General"
    prompt_text: str
    params: list[PromptParam] = []
    created_by: str = "admin"
    is_shared: bool = True


@router.post("/prompt-library", status_code=201)
def create_prompt(body: CreatePromptBody):
    if not body.name.strip():
        raise HTTPException(400, "name is required")
    if not body.prompt_text.strip():
        raise HTTPException(400, "prompt_text is required")

    conn = get_connection()
    try:
        conn.execute(
            "INSERT INTO prompt_library (name, category, prompt_text, params_json, "
            "created_by, is_shared) VALUES (?, ?, ?, ?, ?, ?)",
            (body.name.strip(), body.category.strip() or "General", body.prompt_text.strip(),
             json.dumps([p.model_dump() for p in body.params]), body.created_by,
             1 if body.is_shared else 0),
        )
        conn.commit()
    except Exception as exc:
        raise HTTPException(409, f"Prompt name already exists or DB error: {exc}")

    write_audit(
        user_id=body.created_by, action="PROMPT_CREATED", entity_type="PROMPT_LIBRARY",
        entity_id=body.name.strip(), details=f"category={body.category}",
    )
    row = conn.execute(
        "SELECT id, name, category, prompt_text, params_json, created_by, "
        "is_shared, use_count, created_at FROM prompt_library WHERE name = ?",
        (body.name.strip(),),
    ).fetchone()
    return _row_to_dict(row)


class UpdatePromptBody(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    prompt_text: Optional[str] = None
    params: Optional[list[PromptParam]] = None
    is_shared: Optional[bool] = None


@router.put("/prompt-library/{prompt_id}")
def update_prompt(prompt_id: int, body: UpdatePromptBody):
    conn = get_connection()
    existing = conn.execute("SELECT id FROM prompt_library WHERE id = ?", (prompt_id,)).fetchone()
    if not existing:
        raise HTTPException(404, "Prompt not found")

    if body.name is not None:
        conn.execute("UPDATE prompt_library SET name = ? WHERE id = ?", (body.name.strip(), prompt_id))
    if body.category is not None:
        conn.execute("UPDATE prompt_library SET category = ? WHERE id = ?", (body.category.strip(), prompt_id))
    if body.prompt_text is not None:
        conn.execute("UPDATE prompt_library SET prompt_text = ? WHERE id = ?", (body.prompt_text.strip(), prompt_id))
    if body.params is not None:
        conn.execute("UPDATE prompt_library SET params_json = ? WHERE id = ?",
                      (json.dumps([p.model_dump() for p in body.params]), prompt_id))
    if body.is_shared is not None:
        conn.execute("UPDATE prompt_library SET is_shared = ? WHERE id = ?",
                      (1 if body.is_shared else 0, prompt_id))
    conn.commit()

    write_audit(
        user_id="admin", action="PROMPT_UPDATED", entity_type="PROMPT_LIBRARY",
        entity_id=str(prompt_id), details=str({k: v for k, v in body.model_dump().items() if v is not None}),
    )
    return {"ok": True}


@router.delete("/prompt-library/{prompt_id}")
def delete_prompt(prompt_id: int):
    conn = get_connection()
    conn.execute("DELETE FROM prompt_library WHERE id = ?", (prompt_id,))
    conn.commit()
    write_audit(
        user_id="admin", action="PROMPT_DELETED", entity_type="PROMPT_LIBRARY",
        entity_id=str(prompt_id), details="",
    )
    return {"ok": True}


@router.post("/prompt-library/{prompt_id}/use")
def use_prompt(prompt_id: int):
    """Increment use_count and return the resolved prompt text. Called right
    before firing the prompt into /api/chat — keeps 'most used' sort live."""
    conn = get_connection()
    row = conn.execute(
        "SELECT prompt_text FROM prompt_library WHERE id = ?", (prompt_id,)
    ).fetchone()
    if not row:
        raise HTTPException(404, "Prompt not found")
    conn.execute("UPDATE prompt_library SET use_count = use_count + 1 WHERE id = ?", (prompt_id,))
    conn.commit()
    return {"prompt_text": row[0]}
