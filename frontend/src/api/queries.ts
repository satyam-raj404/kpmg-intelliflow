import { apiFetch } from "./client";
import type {
  DashboardKpis,
  ChartData,
  CompaniesResponse,
  UploadResponse,
  BatchStatus,
  LifecycleData,
  AnomalyCount,
  P2PEventsResponse,
} from "./types";

export const fetchKpis = (dashboard: string, companyCode = "ALL") =>
  apiFetch<DashboardKpis>(`/kpi/${dashboard}?company_code=${encodeURIComponent(companyCode)}`);

export const fetchKpiCompanies = (dashboard: string) =>
  apiFetch<CompaniesResponse>(`/kpi/${dashboard}/companies`);

export const fetchCharts = (dashboard: string) =>
  apiFetch<ChartData>(`/charts/${dashboard}`);

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

export interface AnomalyDetailRow {
  purchasing_document:  string;
  vendor:               string | null;
  purchase_requisition: string | null;
  anomaly_flags:        string | null;
  vendor_name:          string | null;
  net_order_value:      number | null;
  document_date:        string | null;
  material_description: string | null;
  material_group:       string | null;
  company_code:         string | null;
  created_by:           string | null;
}

export const fetchAnomalyDetail = (code: string, limit = 50) =>
  apiFetch<AnomalyDetailRow[]>(`/p2p/anomaly-detail?code=${encodeURIComponent(code)}&limit=${limit}`);

export const fetchP2PEvents = (params?: { limit?: number; offset?: number; variant_class?: string }) => {
  const qs = new URLSearchParams();
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));
  if (params?.variant_class) qs.set("variant_class", params.variant_class);
  return apiFetch<P2PEventsResponse>(`/p2p/events?${qs.toString()}`);
};

export interface VendorApiRow {
  id: number;
  vendor: string;
  vendor_name: string;
  vendor_address: string | null;
  country: string | null;
  city: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  spoc_name: string | null;
  tax_number_pan: string | null;
  msme_flag: string | null;
  payment_terms: string | null;
  service_description: string | null;
  added_by: string | null;
  vendor_type: string | null;
  uploaded_at: string | null;
}

export interface AddVendorPayload {
  vendor_code: string;
  vendor_name: string;
  vendor_address: string;
  country: string;
  contact_phone: string;
  contact_email: string;
  spoc_name: string;
  tax_number_pan: string;
  added_by: string;
  msme_flag: string;
  payment_terms: string;
  service_description: string;
}

export const fetchVendors = () => apiFetch<VendorApiRow[]>("/vendors");

export const addVendor = (payload: AddVendorPayload) =>
  apiFetch<VendorApiRow>("/vendors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
