"""KPI router — dashboard KPIs, charts, and kpi_config management."""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from database import get_connection
from services.kpi_engine import compute_all, compute_chart_data, compute_procurement_live

router = APIRouter()

VALID_DASHBOARDS = {"procurement", "financial", "leadership", "vendor", "utilization"}


# ── Company list ───────────────────────────────────────────────────────────────

@router.get("/companies")
def get_companies():
    """Return distinct company codes present in po_dump, joined with company_plant_master for names."""
    conn = get_connection()
    rows = conn.execute("""
        SELECT DISTINCT p.company_code,
               COALESCE(c.company_name, p.company_code) AS company_name
        FROM po_dump p
        LEFT JOIN company_plant_master c ON c.company_code = p.company_code
        WHERE p.company_code IS NOT NULL AND p.company_code != ''
        ORDER BY p.company_code
    """).fetchall()
    return {"companies": [dict(r) for r in rows]}


# ── Dashboard KPIs ─────────────────────────────────────────────────────────────

@router.get("/kpi/{dashboard}")
def get_kpis(dashboard: str, company_code: str = Query("")):
    if dashboard not in VALID_DASHBOARDS:
        raise HTTPException(404, f"Dashboard '{dashboard}' not found.")
    conn = get_connection()

    if company_code and dashboard == "procurement":
        # Validate company_code exists in po_dump
        exists = conn.execute(
            "SELECT 1 FROM po_dump WHERE company_code = ? LIMIT 1", (company_code,)
        ).fetchone()
        if not exists:
            raise HTTPException(404, f"Company '{company_code}' not found in po_dump.")
        kpis = compute_procurement_live(conn, company_code)
        computed_at = kpis[0]["computed_at"] if kpis else None
        return {"dashboard": dashboard, "computed_at": computed_at, "kpis": kpis}

    rows = conn.execute(
        "SELECT * FROM kpi_results WHERE dashboard = ? ORDER BY kpi_code",
        (dashboard,),
    ).fetchall()
    kpis = [dict(r) for r in rows]
    computed_at = kpis[0]["computed_at"] if kpis else None
    return {"dashboard": dashboard, "computed_at": computed_at, "kpis": kpis}


@router.get("/charts/{dashboard}")
def get_charts(dashboard: str, company_code: str = Query("")):
    if dashboard not in VALID_DASHBOARDS:
        raise HTTPException(404, f"Dashboard '{dashboard}' not found.")
    conn = get_connection()
    data = compute_chart_data(conn, dashboard, company_code)
    return {"dashboard": dashboard, "series": data}


# ── KPI Config ────────────────────────────────────────────────────────────────

@router.get("/kpi-config")
def get_kpi_config():
    """Return all kpi_config key-value pairs."""
    conn = get_connection()
    rows = conn.execute("SELECT config_key, config_value, description, updated_at FROM kpi_config").fetchall()
    return {"config": [dict(r) for r in rows]}


class ConfigUpdate(BaseModel):
    value: str


@router.put("/kpi-config/{key}")
def update_kpi_config(key: str, body: ConfigUpdate):
    """Update a single kpi_config value and re-run all KPIs."""
    conn = get_connection()
    existing = conn.execute(
        "SELECT config_key FROM kpi_config WHERE config_key = ?", (key,)
    ).fetchone()
    if not existing:
        raise HTTPException(404, f"Config key '{key}' not found.")

    conn.execute(
        "UPDATE kpi_config SET config_value = ?, updated_at = datetime('now') WHERE config_key = ?",
        (body.value, key),
    )
    conn.commit()

    # Re-compute all KPIs with the new threshold
    compute_all(conn)

    return {"config_key": key, "config_value": body.value, "status": "updated"}
