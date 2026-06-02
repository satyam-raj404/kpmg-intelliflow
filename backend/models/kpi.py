from pydantic import BaseModel
from typing import Optional


class KpiResult(BaseModel):
    kpi_code: str
    kpi_name: str
    dashboard: str
    value_numeric: Optional[float] = None
    value_text: Optional[str] = None
    unit: Optional[str] = None
    trend: Optional[str] = None
    computed_at: Optional[str] = None


class DashboardKpis(BaseModel):
    dashboard: str
    computed_at: Optional[str] = None
    kpis: list[KpiResult]
