import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { fetchKpis, fetchCharts } from "@/api/queries";
import type { DashboardKpis, ChartData, KpiResult } from "@/api/types";

export type Dashboard = "procurement" | "financial" | "leadership" | "vendor" | "utilization";

const VALID_DASHBOARDS: Dashboard[] = ["procurement", "financial", "leadership", "vendor", "utilization"];

export function useKpi(dashboard: Dashboard) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const es = new EventSource("/api/stream");
    es.addEventListener("message", (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "KPI_REFRESH") {
          const dashboards: string[] = data.dashboards ?? VALID_DASHBOARDS;
          dashboards.forEach((d) => {
            queryClient.invalidateQueries({ queryKey: ["kpi", d] });
            queryClient.invalidateQueries({ queryKey: ["charts", d] });
          });
        }
      } catch {}
    });
    return () => es.close();
  }, [queryClient]);

  return useQuery<DashboardKpis>({
    queryKey: ["kpi", dashboard],
    queryFn: () => fetchKpis(dashboard),
  });
}

export function useCharts(dashboard: Dashboard) {
  return useQuery<ChartData>({
    queryKey: ["charts", dashboard],
    queryFn: () => fetchCharts(dashboard),
  });
}

export function useKpiValue(dashboard: Dashboard, kpiCode: string): KpiResult | undefined {
  const { data } = useKpi(dashboard);
  return data?.kpis.find((k) => k.kpi_code === kpiCode);
}
