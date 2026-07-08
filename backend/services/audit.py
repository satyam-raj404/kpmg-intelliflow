"""Shared audit logging helper used by all routers."""
from database import get_connection


def write_audit(
    user_id: str,
    action: str,
    entity_type: str,
    entity_id: str = "",
    details: str = "",
    conn=None,
    commit: bool = True,
) -> None:
    """Insert one row into audit_log.

    Pass conn to share the caller's transaction (set commit=False).
    Omit conn to open a fresh connection and auto-commit.
    Never raises — audit failure must not break the main operation.
    """
    try:
        c = conn if conn is not None else get_connection()
        c.execute(
            "INSERT INTO audit_log (user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)",
            (str(user_id), action, entity_type, str(entity_id), str(details)),
        )
        if commit and conn is None:
            c.commit()
    except Exception as exc:
        print(f"[audit] write failed: {exc}")
