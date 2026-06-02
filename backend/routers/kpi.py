"""KPI router — dashboard KPIs, charts, and kpi_config management."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from database import get_connection
from services.kpi_engine import compute_all, compute_chart_data

router = APIRouter()

VALID_DASHBOARDS = {"procurement", "financial", "leadership", "vendor", "utilization"}


# ── Dashboard KPIs ─────────────────────────────────────────────────────────────

@router.get("/kpi/{dashboard}")
def get_kpis(dashboard: str):
    if dashboard not in VALID_DASHBOARDS:
        raise HTTPException(404, f"Dashboard '{dashboard}' not found.")
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM kpi_results WHERE dashboard = ? ORDER BY kpi_code",
        (dashboard,),
    ).fetchall()
    kpis = [dict(r) for r in rows]
    computed_at = kpis[0]["computed_at"] if kpis else None
    return {"dashboard": dashboard, "computed_at": computed_at, "kpis": kpis}


@router.get("/charts/{dashboard}")
def get_charts(dashboard: str):
    if dashboard not in VALID_DASHBOARDS:
        raise HTTPException(404, f"Dashboard '{dashboard}' not found.")
    conn = get_connection()
    data = compute_chart_data(conn, dashboard)
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
