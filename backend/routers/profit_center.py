"""Profit Center CRUD — master table management with CAPEX/OPEX flag cascade."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from database import get_connection

router = APIRouter()

DEPT_NAMES = {
    "FAC": "Facilities", "ENG": "Engineering", "ADM": "Administration",
    "ITH": "IT Hardware", "ITS": "IT Software", "STR": "Strategy & Consulting",
    "SCM": "Supply Chain", "OPS": "Operations",
}


def _row_to_dict(r) -> dict:
    return {
        "id": r[0], "profit_center": r[1], "pc_name": r[2],
        "company_code": r[3], "dept_code": r[4], "plant": r[5],
        "material_group": r[6], "default_capex_opex": r[7],
        "capex_budget": r[8] or 0, "opex_budget": r[9] or 0,
        "bu_type": r[10], "responsible_person": r[11],
        "is_active": r[12],
        "actual_capex": round((r[13] or 0) / 1e7, 2),
        "actual_opex":  round((r[14] or 0) / 1e7, 2),
        "dept_name": DEPT_NAMES.get(r[4] or "", r[4] or ""),
    }


@router.get("/profit-centers")
def list_profit_centers():
    conn = get_connection()
    rows = conn.execute("""
        SELECT pcm.id, pcm.profit_center, pcm.pc_name, pcm.company_code,
               pcm.dept_code, pcm.plant, pcm.material_group,
               pcm.default_capex_opex, pcm.capex_budget, pcm.opex_budget,
               pcm.bu_type, pcm.responsible_person, pcm.is_active,
               COALESCE(SUM(CASE WHEN p.capex_opex_flag='CAPEX'
                   THEN CAST(p.net_order_value AS REAL) ELSE 0 END), 0) AS actual_capex,
               COALESCE(SUM(CASE WHEN p.capex_opex_flag='OPEX'
                   THEN CAST(p.net_order_value AS REAL) ELSE 0 END), 0) AS actual_opex
        FROM profit_center_master pcm
        LEFT JOIN po_dump p
               ON p.plant = pcm.plant AND p.material_group = pcm.material_group
        WHERE pcm.is_active = 1
        GROUP BY pcm.id
        ORDER BY (
            COALESCE(SUM(CASE WHEN p.capex_opex_flag='CAPEX' THEN CAST(p.net_order_value AS REAL) ELSE 0 END), 0) +
            COALESCE(SUM(CASE WHEN p.capex_opex_flag='OPEX'  THEN CAST(p.net_order_value AS REAL) ELSE 0 END), 0)
        ) DESC
    """).fetchall()
    return [_row_to_dict(r) for r in rows]


class PCBody(BaseModel):
    profit_center: str
    pc_name: str
    company_code: str = "1001"
    dept_code: str = ""
    plant: str = ""
    material_group: str = ""
    default_capex_opex: str = "OPEX"
    capex_budget: float = 0
    opex_budget: float = 0
    responsible_person: str = ""
    bu_type: str = "CORPORATE"


@router.post("/profit-centers", status_code=201)
def create_profit_center(body: PCBody):
    if body.default_capex_opex not in ("CAPEX", "OPEX"):
        raise HTTPException(400, "default_capex_opex must be CAPEX or OPEX")
    conn = get_connection()
    try:
        conn.execute("""
            INSERT INTO profit_center_master
              (profit_center, pc_name, company_code, dept_code, plant,
               material_group, default_capex_opex, capex_budget, opex_budget,
               responsible_person, bu_type, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        """, (body.profit_center, body.pc_name, body.company_code, body.dept_code,
              body.plant, body.material_group, body.default_capex_opex,
              body.capex_budget, body.opex_budget, body.responsible_person, body.bu_type))
        conn.commit()
    except Exception as exc:
        raise HTTPException(409, f"PC already exists or DB error: {exc}")
    return {"ok": True, "profit_center": body.profit_center}


class PCUpdateBody(BaseModel):
    pc_name: Optional[str] = None
    default_capex_opex: Optional[str] = None
    capex_budget: Optional[float] = None
    opex_budget: Optional[float] = None
    responsible_person: Optional[str] = None
    is_active: Optional[int] = None


@router.put("/profit-centers/{pc_code}")
def update_profit_center(pc_code: str, body: PCUpdateBody):
    conn = get_connection()
    existing = conn.execute(
        "SELECT profit_center FROM profit_center_master WHERE profit_center = ?", (pc_code,)
    ).fetchone()
    if not existing:
        raise HTTPException(404, "Profit center not found")

    if body.default_capex_opex is not None:
        if body.default_capex_opex not in ("CAPEX", "OPEX"):
            raise HTTPException(400, "Must be CAPEX or OPEX")
        conn.execute(
            "UPDATE profit_center_master SET default_capex_opex = ? WHERE profit_center = ?",
            (body.default_capex_opex, pc_code)
        )
        # Cascade: update SYSTEM-tagged po_categorization rows for this PC
        conn.execute("""
            UPDATE po_categorization SET capex_opex_flag = ?
            WHERE profit_center = ? AND tagged_by = 'SYSTEM'
        """, (body.default_capex_opex, pc_code))

    if body.pc_name is not None:
        conn.execute("UPDATE profit_center_master SET pc_name = ? WHERE profit_center = ?",
                     (body.pc_name, pc_code))
    if body.capex_budget is not None:
        conn.execute("UPDATE profit_center_master SET capex_budget = ? WHERE profit_center = ?",
                     (body.capex_budget, pc_code))
    if body.opex_budget is not None:
        conn.execute("UPDATE profit_center_master SET opex_budget = ? WHERE profit_center = ?",
                     (body.opex_budget, pc_code))
    if body.responsible_person is not None:
        conn.execute("UPDATE profit_center_master SET responsible_person = ? WHERE profit_center = ?",
                     (body.responsible_person, pc_code))
    if body.is_active is not None:
        conn.execute("UPDATE profit_center_master SET is_active = ? WHERE profit_center = ?",
                     (body.is_active, pc_code))

    conn.commit()
    return {"ok": True}


@router.delete("/profit-centers/{pc_code}")
def delete_profit_center(pc_code: str):
    conn = get_connection()
    conn.execute("UPDATE profit_center_master SET is_active = 0 WHERE profit_center = ?", (pc_code,))
    conn.commit()
    return {"ok": True}
