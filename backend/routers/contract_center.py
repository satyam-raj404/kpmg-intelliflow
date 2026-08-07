"""Contract Center CRUD — contract master + PO contract-number check."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from database import get_connection
from services.audit import write_audit
from services.contract_check import run_contract_check

router = APIRouter()


def _row_to_dict(r) -> dict:
    return {
        "id": r[0], "contract_number": r[1], "contract_name": r[2],
        "vendor": r[3], "vendor_name": r[4], "company_code": r[5],
        "contract_type": r[6], "contract_value": r[7] or 0,
        "currency_key": r[8], "start_date": r[9], "end_date": r[10],
        "status": r[11], "owner": r[12], "is_active": r[13],
        "matched_po_count": r[14] or 0,
        "matched_po_value": round((r[15] or 0) / 1e7, 2),
    }


@router.get("/contracts")
def list_contracts():
    conn = get_connection()
    rows = conn.execute("""
        SELECT cm.id, cm.contract_number, cm.contract_name, cm.vendor, cm.vendor_name,
               cm.company_code, cm.contract_type, cm.contract_value, cm.currency_key,
               cm.start_date, cm.end_date, cm.status, cm.owner, cm.is_active,
               COUNT(p.id) AS matched_po_count,
               COALESCE(SUM(CAST(NULLIF(p.net_order_value,'') AS REAL)), 0) AS matched_po_value
        FROM contract_master cm
        LEFT JOIN po_dump p
               ON UPPER(TRIM(p.contract_number)) = UPPER(TRIM(cm.contract_number))
              AND p.contract_check = 'MATCHED'
        WHERE cm.is_active = 1
        GROUP BY cm.id
        ORDER BY cm.created_at DESC
    """).fetchall()
    return [_row_to_dict(r) for r in rows]


@router.get("/contracts/summary")
def contract_summary():
    conn = get_connection()
    total = conn.execute(
        "SELECT COUNT(*) FROM contract_master WHERE is_active = 1"
    ).fetchone()[0]
    active = conn.execute(
        "SELECT COUNT(*) FROM contract_master WHERE is_active = 1 AND status = 'ACTIVE'"
    ).fetchone()[0]
    rows = conn.execute(
        "SELECT contract_check, COUNT(*) FROM po_dump GROUP BY contract_check"
    ).fetchall()
    counts = {"MATCHED": 0, "UNMATCHED": 0, "NO_CONTRACT": 0}
    for verdict, n in rows:
        if verdict in counts:
            counts[verdict] = n
        elif not verdict:
            counts["NO_CONTRACT"] += n
    checked_total = counts["MATCHED"] + counts["UNMATCHED"]
    match_rate = round(100 * counts["MATCHED"] / checked_total, 1) if checked_total else 0.0
    return {
        "total_contracts": total,
        "active_contracts": active,
        "po_matched": counts["MATCHED"],
        "po_unmatched": counts["UNMATCHED"],
        "po_no_contract": counts["NO_CONTRACT"],
        "match_rate_pct": match_rate,
    }


@router.get("/contracts/unmatched-pos")
def unmatched_pos(limit: int = 50):
    conn = get_connection()
    rows = conn.execute("""
        SELECT purchasing_document, item, contract_number, vendor_name,
               net_order_value, document_date, company_code
        FROM po_dump
        WHERE contract_check = 'UNMATCHED'
        ORDER BY document_date DESC
        LIMIT ?
    """, (limit,)).fetchall()
    cols = ["purchasing_document", "item", "contract_number", "vendor_name",
            "net_order_value", "document_date", "company_code"]
    return [dict(zip(cols, r)) for r in rows]


class ContractBody(BaseModel):
    contract_number: str
    contract_name: str
    vendor: str = ""
    vendor_name: str = ""
    company_code: str = "1001"
    contract_type: str = "SERVICE"
    contract_value: float = 0
    currency_key: str = "INR"
    start_date: str = ""
    end_date: str = ""
    owner: str = ""


@router.post("/contracts", status_code=201)
def create_contract(body: ContractBody):
    conn = get_connection()
    try:
        conn.execute("""
            INSERT INTO contract_master
              (contract_number, contract_name, vendor, vendor_name, company_code,
               contract_type, contract_value, currency_key, start_date, end_date,
               owner, status, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 1)
        """, (body.contract_number, body.contract_name, body.vendor, body.vendor_name,
              body.company_code, body.contract_type, body.contract_value,
              body.currency_key, body.start_date, body.end_date, body.owner))
        conn.commit()
    except Exception as exc:
        raise HTTPException(409, f"Contract already exists or DB error: {exc}")

    run_contract_check(conn)

    write_audit(
        user_id="admin",
        action="CONTRACT_CREATED",
        entity_type="CONTRACT",
        entity_id=body.contract_number,
        details=f"name={body.contract_name} vendor={body.vendor_name} value={body.contract_value}",
    )
    return {"ok": True, "contract_number": body.contract_number}


class ContractUpdateBody(BaseModel):
    contract_name: Optional[str] = None
    vendor: Optional[str] = None
    vendor_name: Optional[str] = None
    contract_type: Optional[str] = None
    contract_value: Optional[float] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: Optional[str] = None
    owner: Optional[str] = None
    is_active: Optional[int] = None


@router.put("/contracts/{contract_number}")
def update_contract(contract_number: str, body: ContractUpdateBody):
    conn = get_connection()
    existing = conn.execute(
        "SELECT contract_number FROM contract_master WHERE contract_number = ?",
        (contract_number,),
    ).fetchone()
    if not existing:
        raise HTTPException(404, "Contract not found")

    if body.status is not None and body.status not in ("ACTIVE", "EXPIRED", "CANCELLED"):
        raise HTTPException(400, "status must be ACTIVE, EXPIRED, or CANCELLED")

    fields = {
        "contract_name": body.contract_name, "vendor": body.vendor,
        "vendor_name": body.vendor_name, "contract_type": body.contract_type,
        "contract_value": body.contract_value, "start_date": body.start_date,
        "end_date": body.end_date, "status": body.status, "owner": body.owner,
        "is_active": body.is_active,
    }
    for col, val in fields.items():
        if val is not None:
            conn.execute(
                f"UPDATE contract_master SET {col} = ? WHERE contract_number = ?",
                (val, contract_number),
            )
    conn.commit()

    run_contract_check(conn)

    write_audit(
        user_id="admin",
        action="CONTRACT_UPDATED",
        entity_type="CONTRACT",
        entity_id=contract_number,
        details=str({k: v for k, v in body.model_dump().items() if v is not None}),
    )
    return {"ok": True}


@router.delete("/contracts/{contract_number}")
def delete_contract(contract_number: str):
    conn = get_connection()
    conn.execute(
        "UPDATE contract_master SET is_active = 0 WHERE contract_number = ?",
        (contract_number,),
    )
    conn.commit()

    run_contract_check(conn)

    write_audit(
        user_id="admin",
        action="CONTRACT_DELETED",
        entity_type="CONTRACT",
        entity_id=contract_number,
        details="is_active set to 0",
    )
    return {"ok": True}


@router.post("/contracts/run-check")
def manual_run_check():
    conn = get_connection()
    counts = run_contract_check(conn)
    write_audit(
        user_id="admin",
        action="CONTRACT_CHECK_RUN",
        entity_type="CONTRACT",
        entity_id="ALL",
        details=str(counts),
    )
    return {"ok": True, **counts}
