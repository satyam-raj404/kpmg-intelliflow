import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { fetchKpis, fetchCharts, fetchKpiCompanies } from "@/api/queries";
import type { DashboardKpis, ChartData, CompaniesResponse, KpiResult } from "@/api/types";

export type Dashboard = "procurement" | "financial" | "leadership" | "vendor" | "utilization";

const VALID_DASHBOARDS: Dashboard[] = ["procurement", "financial", "leadership", "vendor", "utilization"];

// Single SSE subscription — mount once in AppShell, not per hook call
export function useKpiEvents() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const base = import.meta.env.VITE_API_BASE_URL ?? "";
    const es = new EventSource(`${base}/api/stream`);
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

export function useKpi(dashboard: Dashboard, companyCode = "ALL") {
  return useQuery<DashboardKpis>({
    queryKey: ["kpi", dashboard, companyCode],
    queryFn: () => fetchKpis(dashboard, companyCode),
    staleTime: 5 * 60 * 1000,
    gcTime:    10 * 60 * 1000,
  });
}

export function useKpiCompanies(dashboard: Dashboard) {
  return useQuery<CompaniesResponse>({
    queryKey: ["kpi-companies", dashboard],
    queryFn: () => fetchKpiCompanies(dashboard),
    staleTime: 10 * 60 * 1000,
    gcTime:    20 * 60 * 1000,
  });
}

export function useCharts(dashboard: Dashboard) {
  return useQuery<ChartData>({
    queryKey: ["charts", dashboard],
    queryFn: () => fetchCharts(dashboard),
    staleTime: 5 * 60 * 1000,
    gcTime:    10 * 60 * 1000,
  });
}

export function useKpiValue(dashboard: Dashboard, kpiCode: string, companyCode = "ALL"): KpiResult | undefined {
  const { data } = useKpi(dashboard, companyCode);
  return data?.kpis.find((k) => k.kpi_code === kpiCode);
}

// Background-prefetch all company variants so switching companies is instant
export function usePrefetchKpiCompanies(dashboard: Dashboard) {
  const queryClient = useQueryClient();
  const { data: companiesData } = useKpiCompanies(dashboard);

  useEffect(() => {
    const companies = companiesData?.companies;
    if (!companies) return;
    companies.forEach((company) => {
      queryClient.prefetchQuery({
        queryKey: ["kpi", dashboard, company],
        queryFn: () => fetchKpis(dashboard, company),
        staleTime: 5 * 60 * 1000,
      });
    });
  }, [companiesData, dashboard, queryClient]);
}
