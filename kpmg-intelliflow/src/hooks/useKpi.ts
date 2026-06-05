import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { fetchKpis, fetchCharts, fetchCompanies } from "@/api/queries";
import type { DashboardKpis, ChartData, KpiResult } from "@/api/types";

export type Dashboard = "procurement" | "financial" | "leadership" | "vendor" | "utilization";

const VALID_DASHBOARDS: Dashboard[] = ["procurement", "financial", "leadership", "vendor", "utilization"];

/** Call ONCE per page — opens a single SSE connection and invalidates KPI cache on refresh events. */
export function useKpiStream() {
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
}

export function useKpi(dashboard: Dashboard, companyCode?: string) {
  return useQuery<DashboardKpis>({
    queryKey: ["kpi", dashboard, companyCode ?? ""],
    queryFn: () => fetchKpis(dashboard, companyCode),
  });
}

export function useCharts(dashboard: Dashboard, companyCode?: string) {
  return useQuery<ChartData>({
    queryKey: ["charts", dashboard, companyCode ?? ""],
    queryFn: () => fetchCharts(dashboard, companyCode),
  });
}

export function useKpiValue(dashboard: Dashboard, kpiCode: string, companyCode?: string): KpiResult | undefined {
  const { data } = useKpi(dashboard, companyCode);
  return data?.kpis.find((k) => k.kpi_code === kpiCode);
}

export function useCompanies() {
  return useQuery({
    queryKey: ["companies"],
    queryFn: fetchCompanies,
    staleTime: 5 * 60 * 1000,
  });
}
