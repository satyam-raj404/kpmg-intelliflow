export interface KpiResult {
  kpi_code: string;
  kpi_name: string;
  dashboard: string;
  value_numeric: number | null;
  value_text: string | null;
  unit: string | null;
  trend: string | null;
  computed_at: string | null;
}

export interface DashboardKpis {
  dashboard: string;
  company_code: string;
  computed_at: string | null;
  kpis: KpiResult[];
}

export interface CompaniesResponse {
  dashboard: string;
  companies: string[];
}

export interface ChartPoint {
  month?: string;
  tool?: string;
  [key: string]: string | number | undefined;
}

export interface ChartData {
  dashboard: string;
  series: ChartPoint[];
}

export interface BatchRejection {
  row: number;
  field: string;
  reason: string;
}

export interface UploadResponse {
  batch_id: string;
  status: string;
}

export interface BatchStatus {
  batch_id: string;
  filename: string | null;
  status: "PROCESSING" | "COMPLETED" | "FAILED";
  dataset_type: string | null;
  rows_accepted: number | null;
  rows_rejected: number | null;
  rejection_sample: BatchRejection[] | null;
  error_message: string | null;
  created_at: string | null;
  completed_at: string | null;
}

export interface LifecycleData {
  stage_counts: Record<string, number | null>;
  variants: Array<{ variant_class: string; count: number }>;
}

export interface AnomalyCount {
  anomaly_code: string;
  count: number;
  severity: string;
  description: string;
}

export interface P2PEvent {
  id: number;
  purchasing_document: string;
  item: string | null;
  vendor: string | null;
  purchase_requisition: string | null;
  activities: string | null;
  start_time: string | null;
  end_time: string | null;
  variant_class: string;
  anomaly_flags: string | null;
  anomaly_count: number;
}

export interface P2PEventsResponse {
  total: number;
  offset: number;
  limit: number;
  events: P2PEvent[];
}
