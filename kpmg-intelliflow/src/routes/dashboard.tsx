import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  ComposedChart,
  Line,
  Legend,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { Trash2, AlertTriangle, ShieldAlert, Info, LogIn, LogOut, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard } from "@/components/KpiCard";
import { SectionCard } from "@/components/SectionCard";
import { StatusPill } from "@/components/StatusPill";
import { formatINR, formatDateShort } from "@/lib/format";
import { brand } from "@/lib/brand";
import { apiFetch } from "@/api/client";
import { fetchAnomalies } from "@/api/queries";
import type { AnomalyCount } from "@/api/types";
import { useKpi, useKpiValue, useKpiCompanies, useCharts, usePrefetchKpiCompanies } from "@/hooks/useKpi";
import { useDashboardExport } from "@/hooks/useDashboardExport";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Procurement Dashboard — KPMG IntelliSource" },
      { name: "description", content: "Real-time visibility into PO activity, breaches, and operational priorities." },
    ],
  }),
  component: ProcurementDashboard,
});

interface DeletedPO {
  purchasing_document: string;
  item: string;
  vendor: string;
  vendor_name: string | null;
  material_description: string | null;
  material_group: string | null;
  net_order_value: string;
  document_date: string | null;
  created_by: string | null;
  deletion_indicator: string;
  anomaly_flags: string | null;
}

function CompanyFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data } = useKpiCompanies("procurement");
  const companies = data?.companies ?? [];
  if (companies.length <= 1) return null;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground font-medium">Company:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-border rounded-md px-2 py-1 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="ALL">All Companies</option>
        {companies.filter((c) => c !== "ALL").map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
    </div>
  );
}

function VendorFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data: rows = [] } = useQuery<DeletedPO[]>({
    queryKey: ["po-deletions"],
    queryFn: () => apiFetch<DeletedPO[]>("/p2p/po-deletions?limit=20"),
    staleTime: 60_000,
  });

  // Build unique vendor list from already-fetched po-deletions data
  const vendorMap = new Map<string, string>();
  rows.forEach((r) => {
    if (r.vendor && !vendorMap.has(r.vendor)) {
      vendorMap.set(r.vendor, r.vendor_name ?? r.vendor);
    }
  });
  const vendors = Array.from(vendorMap.entries()).sort((a, b) => a[1].localeCompare(b[1]));

  if (vendors.length === 0) return null;

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground font-medium">Vendor:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-border rounded-md px-2 py-1 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="ALL">All Vendors</option>
        {vendors.map(([code, name]) => (
          <option key={code} value={code}>{name}</option>
        ))}
      </select>
    </div>
  );
}

function ProcurementDashboard() {
  const [company, setCompany] = useState("ALL");
  const [vendor, setVendor] = useState("ALL");
  usePrefetchKpiCompanies("procurement");
  const { containerRef, exportPdf, isExporting } = useDashboardExport("Procurement Dashboard", company);

  const handleCompanyChange = (v: string) => {
    setCompany(v);
    setVendor("ALL");
  };

  return (
    <AppShell>
      <div ref={containerRef}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <PageHeader
            title="Procurement Dashboard"
            subtitle="Real-time visibility into PO activity, breaches, and operational priorities"
            onExportPdf={exportPdf}
            isExporting={isExporting}
          />
          <div className="flex items-center gap-3">
            <VendorFilter value={vendor} onChange={setVendor} />
            <CompanyFilter value={company} onChange={handleCompanyChange} />
          </div>
        </div>
        <KpiRow company={company} />
        <div className="grid grid-cols-2 gap-4 mt-4">
          <POValueTrend />
          <POCountAndMaverick />
        </div>
        <div className="mt-4">
          <PODeletionMonitor selectedVendor={vendor} />
        </div>
        <div className="mt-4">
          <AlertCenter />
        </div>
      </div>
    </AppShell>
  );
}

function KpiRow({ company }: { company: string }) {
  const { isLoading } = useKpi("procurement", company);
  // KPI 1 — Total PO Value MTD
  const p1 = useKpiValue("procurement", "TOTAL_PO_VALUE_MTD", company);
  // KPI 2 — Active PO Count (all active, no date filter)
  const p2 = useKpiValue("procurement", "ACTIVE_PO_COUNT", company);
  // KPI 3 — High-Value PO Count (threshold configurable)
  const p3 = useKpiValue("procurement", "HIGH_VALUE_PO_COUNT", company);
  // KPI 4 — Avg PR-to-PO Conversion Time
  const p4 = useKpiValue("procurement", "PR_TO_PO_DAYS", company);
  // KPI 5 — PO Cycle Time (Creation → Approval)
  const p5 = useKpiValue("procurement", "PO_APPROVAL_CYCLE", company);
  // KPI 6 — PO Deletion Frequency MTD
  const p6 = useKpiValue("procurement", "PO_DELETION_MTD", company);
  // KPI 7 — PO Amendment Rate
  const p7 = useKpiValue("procurement", "PO_AMENDMENT_RATE", company);
  // KPI 8 — Open PR Aging > 7 days without PO
  const p8 = useKpiValue("procurement", "OPEN_PR_AGING", company);

  const fmt = (v: number | null | undefined, unit: string | null | undefined) => {
    if (v == null) return isLoading ? "—" : "No data";
    if (unit === "INR") return formatINR(v);
    if (unit === "%") return `${v.toFixed(1)}%`;
    if (unit === "days") return `${v.toFixed(1)}d`;
    return v.toFixed(0);
  };

  // Extract threshold label from kpi_name for P3 (e.g. "High-Value PO Count (>₹1,00,00,000)")
  const hvLabel = p3?.kpi_name?.match(/>\s*(₹[\d,]+)/)?.[1] ?? "₹1 Cr";

  return (
    <>
      {/* Row 1 — Spend & Volume */}
      <div className="grid grid-cols-4 gap-3">
        <KpiCard
          label="Total PO Value (MTD)"
          value={fmt(p1?.value_numeric, p1?.unit)}
          sublabel="SUM net_order_value · created_on in current month · active POs only"
          size="lg"
          index={0}
          kpiCode="TOTAL_PO_VALUE_MTD"
        />
        <KpiCard
          label="Active PO Count"
          value={fmt(p2?.value_numeric, p2?.unit)}
          sublabel="COUNT DISTINCT purchasing_document · not delivery-complete · not deleted"
          size="lg"
          index={1}
          kpiCode="ACTIVE_PO_COUNT"
        />
        <KpiCard
          label="High-Value PO Count"
          value={fmt(p3?.value_numeric, p3?.unit)}
          sublabel={`POs above ${hvLabel} · threshold configurable in Admin → Settings`}
          size="lg"
          index={2}
          kpiCode="HIGH_VALUE_PO_COUNT"
        />
        <KpiCard
          label="Open PR Aging (>7d)"
          value={fmt(p8?.value_numeric, p8?.unit)}
          sublabel="Released PR items with no PO > 7 days old · item-level check"
          size="lg"
          threshold={
            p8?.value_numeric != null && p8.value_numeric > 10
              ? { label: "> 10 target", tone: "danger" }
              : p8?.value_numeric != null
              ? { label: "Within target (≤ 10)", tone: "success" }
              : undefined
          }
          index={3}
          kpiCode="OPEN_PR_AGING"
        />
      </div>

      {/* Row 2 — Cycle Times & Rate KPIs */}
      <div className="grid grid-cols-4 gap-3 mt-3">
        <KpiCard
          label="Avg PR→PO Time"
          value={fmt(p4?.value_numeric, p4?.unit)}
          sublabel="AVG days from PR created_on to first PO created_on · item level"
          size="md"
          threshold={
            p4?.value_numeric != null && p4.value_numeric > 5
              ? { label: "> 5d target", tone: "danger" }
              : p4?.value_numeric != null
              ? { label: "Within target (≤ 5d)", tone: "success" }
              : undefined
          }
          index={4}
          kpiCode="PR_TO_PO_DAYS"
        />
        <KpiCard
          label="PO Cycle Time"
          value={fmt(p5?.value_numeric, p5?.unit)}
          sublabel="AVG days from PO created_on to approval (change_log FRGZU=X)"
          size="md"
          threshold={
            p5?.value_numeric != null && p5.value_numeric > 3
              ? { label: "> 3d target", tone: "warning" }
              : p5?.value_numeric != null
              ? { label: "Within target (≤ 3d)", tone: "success" }
              : undefined
          }
          index={5}
          kpiCode="PO_APPROVAL_CYCLE"
        />
        <KpiCard
          label="PO Deletions (MTD)"
          value={fmt(p6?.value_numeric, p6?.unit)}
          sublabel="COUNT deletion_indicator = L · document_date in current month"
          size="md"
          threshold={
            p6?.value_numeric != null && p6.value_numeric > 5
              ? { label: "> 5 target", tone: "danger" }
              : p6?.value_numeric != null
              ? { label: "Within target (≤ 5)", tone: "success" }
              : undefined
          }
          index={6}
          kpiCode="PO_DELETION_MTD"
        />
        <KpiCard
          label="PO Amendment Rate"
          value={fmt(p7?.value_numeric, p7?.unit)}
          sublabel="% POs with post-creation changes · excludes release approvals"
          size="md"
          threshold={
            p7?.value_numeric != null && p7.value_numeric > 15
              ? { label: "> 15% target", tone: "danger" }
              : p7?.value_numeric != null
              ? { label: "Within target (< 15%)", tone: "success" }
              : undefined
          }
          index={7}
          kpiCode="PO_AMENDMENT_RATE"
        />
      </div>
    </>
  );
}

interface SessionEvent {
  user_name: string;
  action: string;
  details: string;
  created_at: string;
}

function humanize(code: string) {
  return code.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function AlertCenter() {
  const { data: anomalies = [], isLoading: loadingAnom } = useQuery<AnomalyCount[]>({
    queryKey: ["anomalies"],
    queryFn: fetchAnomalies,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const { data: sessions = [], isLoading: loadingSessions } = useQuery<SessionEvent[]>({
    queryKey: ["auth-sessions"],
    queryFn: () => apiFetch<SessionEvent[]>("/auth/sessions?limit=25"),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const sorted = [...anomalies].sort((a, b) => {
    const rank: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return (rank[a.severity] ?? 3) - (rank[b.severity] ?? 3);
  });

  const highCount = sorted.filter(a => a.severity === "HIGH").length;

  function actionIcon(action: string) {
    if (action === "LOGIN")       return <LogIn className="h-3 w-3 text-success" />;
    if (action === "LOGOUT")      return <LogOut className="h-3 w-3 text-danger" />;
    return <RefreshCw className="h-3 w-3 text-warning" />;
  }

  function actionColor(action: string) {
    if (action === "LOGIN")  return "bg-success/10 text-success";
    if (action === "LOGOUT") return "bg-danger/10 text-danger";
    return "bg-warning/10 text-warning";
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Anomaly Alerts */}
      <SectionCard
        title="Anomaly Alerts"
        subtitle={`${sorted.length} active anomaly types · refreshes every 2 min`}
        actions={
          highCount > 0 ? (
            <StatusPill tone="danger" dot>{highCount} High Risk</StatusPill>
          ) : sorted.length > 0 ? (
            <StatusPill tone="warning" dot>Review Required</StatusPill>
          ) : (
            <StatusPill tone="success" dot>All Clear</StatusPill>
          )
        }
        bodyClassName="p-0"
      >
        {loadingAnom ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
        ) : sorted.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No anomalies detected</div>
        ) : (
          <div className="max-h-[320px] overflow-y-auto divide-y divide-border">
            {sorted.map((a) => (
              <div key={a.anomaly_code} className="flex items-start gap-2.5 px-4 py-2.5 hover:bg-secondary/30 transition-colors">
                <div className={`mt-0.5 h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${
                  a.severity === "HIGH"   ? "bg-danger/10" :
                  a.severity === "MEDIUM" ? "bg-warning/10" : "bg-accent/10"
                }`}>
                  {a.severity === "HIGH"   ? <ShieldAlert className="h-3 w-3 text-danger" />  :
                   a.severity === "MEDIUM" ? <AlertTriangle className="h-3 w-3 text-warning" /> :
                                             <Info className="h-3 w-3 text-accent" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-medium truncate">{humanize(a.anomaly_code)}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                      a.severity === "HIGH"   ? "bg-danger/10 text-danger" :
                      a.severity === "MEDIUM" ? "bg-warning/10 text-warning" : "bg-accent/10 text-accent"
                    }`}>{a.count} PO{a.count !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{a.description}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* User Activity */}
      <SectionCard
        title="User Activity"
        subtitle="Login, logout, and role-switch events"
        bodyClassName="p-0"
      >
        {loadingSessions ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
        ) : sessions.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No activity recorded yet</div>
        ) : (
          <div className="max-h-[320px] overflow-y-auto divide-y divide-border">
            {sessions.map((s, i) => (
              <div key={i} className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-secondary/30 transition-colors">
                <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${
                  s.action === "LOGIN"       ? "bg-success/10" :
                  s.action === "LOGOUT"      ? "bg-danger/10"  : "bg-warning/10"
                }`}>
                  {actionIcon(s.action)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-medium truncate">{s.user_name}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0 ${actionColor(s.action)}`}>
                      {s.action.replace("_", " ")}
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                    {s.details}
                    {s.created_at ? ` · ${formatDateShort(s.created_at.split("T")[0] || s.created_at.slice(0, 10))}` : ""}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function PODeletionMonitor({ selectedVendor }: { selectedVendor: string }) {
  const { data: rows = [], isLoading } = useQuery<DeletedPO[]>({
    queryKey: ["po-deletions"],
    queryFn: () => apiFetch<DeletedPO[]>("/p2p/po-deletions?limit=20"),
    staleTime: 60_000,
  });

  // Filter display only — KPI logic and fetch unchanged
  const filtered = selectedVendor === "ALL" ? rows : rows.filter((r) => r.vendor === selectedVendor);
  const totalValue = filtered.reduce((s, r) => s + parseFloat(r.net_order_value || "0"), 0);

  const vendorLabel = selectedVendor !== "ALL"
    ? ` · ${rows.find((r) => r.vendor === selectedVendor)?.vendor_name ?? selectedVendor}`
    : "";

  return (
    <SectionCard
      title="PO Deletion Anomaly Monitor"
      subtitle={`deletion_indicator = L · ${filtered.length} deleted POs${vendorLabel} · ${formatINR(totalValue)} at risk`}
      actions={
        rows.length > 0 ? (
          <StatusPill tone="danger" dot>Requires Review</StatusPill>
        ) : undefined
      }
      bodyClassName="p-0"
    >
      {isLoading ? (
        <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          {selectedVendor === "ALL" ? "No deleted POs found" : "No deleted POs for selected vendor"}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-secondary/50 text-muted-foreground border-b border-border">
              <tr className="text-left">
                <th className="px-4 py-2.5 font-medium">PO Number</th>
                <th className="px-4 py-2.5 font-medium">Vendor</th>
                <th className="px-4 py-2.5 font-medium">Material</th>
                <th className="px-4 py-2.5 font-medium">Group</th>
                <th className="px-4 py-2.5 font-medium text-right">Value</th>
                <th className="px-4 py-2.5 font-medium">Doc Date</th>
                <th className="px-4 py-2.5 font-medium">Anomalies</th>
                <th className="px-4 py-2.5 font-medium">Created By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((po) => {
                const flags = po.anomaly_flags
                  ? po.anomaly_flags.split(",").map((f) => f.trim()).filter(Boolean)
                  : [];
                const HIGH_FLAGS = ["MAVERICK_BUY", "VENDOR_BLOCK", "PAYMENT_BEFORE_GRN", "THREE_WAY_MISMATCH", "DUPLICATE_INVOICE", "GRN_WITHOUT_PO"];
                const MED_FLAGS  = ["PRICE_DEVIATION", "LATE_DELIVERY", "SPLIT_PO", "OVERDUE_INVOICE"];
                const hasHighRisk = flags.some((f) => HIGH_FLAGS.includes(f));

                return (
                  <tr
                    key={`${po.purchasing_document}-${po.item}`}
                    className={`hover:bg-secondary/30 transition-colors ${hasHighRisk ? "bg-danger/[0.03]" : ""}`}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <Trash2 className="h-3 w-3 text-danger shrink-0" />
                        <span className="font-mono font-medium text-[11px] text-primary">
                          {po.purchasing_document}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="truncate max-w-[140px]" title={po.vendor_name ?? po.vendor}>
                        {po.vendor_name ?? po.vendor}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono">{po.vendor}</div>
                    </td>
                    <td className="px-4 py-2.5 truncate max-w-[160px] text-muted-foreground" title={po.material_description ?? ""}>
                      {po.material_description ?? "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded font-mono">
                        {po.material_group ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-tabular font-medium">
                      {formatINR(parseFloat(po.net_order_value || "0"))}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {po.document_date ? formatDateShort(po.document_date) : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      {flags.length === 0 ? (
                        <span className="text-muted-foreground text-[10px]">None</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {flags.map((flag) => (
                            <span
                              key={flag}
                              title={flag}
                              className={`inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded font-medium ${
                                HIGH_FLAGS.includes(flag)
                                  ? "bg-danger/10 text-danger"
                                  : MED_FLAGS.includes(flag)
                                  ? "bg-warning/10 text-warning"
                                  : "bg-accent/10 text-accent"
                              }`}
                            >
                              <AlertTriangle className="h-2 w-2" />
                              {flag.replace(/_/g, " ")}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{po.created_by ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

function POValueTrend() {
  const { data, isLoading } = useCharts("procurement");
  const chartData = (data?.series ?? []).map((p) => ({
    period: p.month ?? "",
    spend: ((p.total_value as number) ?? 0) / 1_00_00_000,
  }));

  return (
    <SectionCard title="PO Value Trend" subtitle="Monthly · ₹ Cr">
      <div className="h-64">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
        ) : chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Upload PO data to view trend</div>
        ) : (
          <ResponsiveContainer>
            <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
              <defs>
                <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={brand.colors.primary} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={brand.colors.primary} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
              <XAxis dataKey="period" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v.toFixed(0)}Cr`} />
              <Tooltip formatter={(v: number) => [`₹${v.toFixed(2)} Cr`, "Spend"]} />
              <Area type="monotone" dataKey="spend" stroke={brand.colors.primary} strokeWidth={2} fill="url(#spendGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </SectionCard>
  );
}

function POCountAndMaverick() {
  const { data, isLoading } = useCharts("procurement");
  const chartData = (data?.series ?? []).map((p) => ({
    month:          p.month ?? "",
    "PO Count":     (p.po_count as number) ?? 0,
    "Maverick (₹Cr)": ((p.maverick_value as number) ?? 0) / 1_00_00_000,
  }));

  return (
    <SectionCard title="PO Count vs Maverick Spend" subtitle="Monthly — Maverick = POs without PR">
      <div className="h-64">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
        ) : chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Upload PO data</div>
        ) : (
          <ResponsiveContainer>
            <ComposedChart data={chartData} margin={{ top: 8, right: 32, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
              <YAxis yAxisId="left" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
              <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false}
                tickFormatter={(v) => `₹${v}Cr`} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="left" dataKey="PO Count" fill={brand.colors.primary} radius={[3, 3, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="Maverick (₹Cr)"
                stroke={brand.colors.danger} strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </SectionCard>
  );
}
