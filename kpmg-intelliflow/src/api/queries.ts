import { apiFetch } from "./client";
import type {
  DashboardKpis,
  ChartData,
  UploadResponse,
  BatchStatus,
  LifecycleData,
  AnomalyCount,
  P2PEventsResponse,
} from "./types";

export const fetchKpis = (dashboard: string, companyCode?: string) => {
  const qs = companyCode ? `?company_code=${encodeURIComponent(companyCode)}` : "";
  return apiFetch<DashboardKpis>(`/kpi/${dashboard}${qs}`);
};

export const fetchCharts = (dashboard: string, companyCode?: string) => {
  const qs = companyCode ? `?company_code=${encodeURIComponent(companyCode)}` : "";
  return apiFetch<ChartData>(`/charts/${dashboard}${qs}`);
};

export const fetchCompanies = () =>
  apiFetch<{ companies: { company_code: string; company_name: string }[] }>("/companies");

export const fetchBatchStatus = (batchId: string) =>
  apiFetch<BatchStatus>(`/upload/${batchId}`);

export const uploadFile = async (file: File): Promise<UploadResponse> => {
  const form = new FormData();
  form.append("file", file);
  return apiFetch<UploadResponse>("/upload", { method: "POST", body: form });
};

export const fetchLifecycle = () =>
  apiFetch<LifecycleData>("/p2p/lifecycle");

export const fetchAnomalies = () =>
  apiFetch<AnomalyCount[]>("/p2p/anomalies");

export const fetchP2PEvents = (params?: { limit?: number; offset?: number; variant_class?: string }) => {
  const qs = new URLSearchParams();
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));
  if (params?.variant_class) qs.set("variant_class", params.variant_class);
  return apiFetch<P2PEventsResponse>(`/p2p/events?${qs.toString()}`);
};
