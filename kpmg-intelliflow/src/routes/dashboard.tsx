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
  Cell,
  ComposedChart,
  Line,
  Legend,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { Trash2, AlertTriangle, Building2, ChevronDown, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard } from "@/components/KpiCard";
import { SectionCard } from "@/components/SectionCard";
import { StatusPill } from "@/components/StatusPill";
import { formatINR, formatDateShort } from "@/lib/format";
import { brand } from "@/lib/brand";
import { apiFetch } from "@/api/client";
import { useKpi, useKpiValue, useCharts, useCompanies } from "@/hooks/useKpi";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

function ProcurementDashboard() {
  const [companyCode, setCompanyCode] = useState("");
  const { data: companiesData } = useCompanies();
  const companies = companiesData?.companies ?? [];

  return (
    <AppShell>
      <PageHeader title="Procurement Dashboard" subtitle="Real-time visibility into PO activity, breaches, and operational priorities" />
      <CompanyFilter companies={companies} value={companyCode} onChange={setCompanyCode} />
      <KpiRow companyCode={companyCode} />
      <div className="grid grid-cols-2 gap-4 mt-4">
        <POValueTrend companyCode={companyCode} />
        <POCountAndMaverick companyCode={companyCode} />
      </div>
      <div className="mt-4">
        <POAgingBuckets companyCode={companyCode} />
      </div>
      <div className="mt-4">
        <PODeletionTrend companyCode={companyCode} />
      </div>
      <div className="mt-4">
        <PODeletionMonitor companyCode={companyCode} />
      </div>
    </AppShell>
  );
}

interface Company { company_code: string; company_name: string; }

function CompanyFilter({
  companies,
  value,
  onChange,
}: {
  companies: Company[];
  value: string;
  onChange: (v: string) => void;
}) {
  const selected = companies.find((c) => c.company_code === value);
  const label = selected
    ? `${selected.company_code} — ${selected.company_name}`
    : "All Companies";

  return (
    <div className="flex items-center gap-2 mb-4 p-3 rounded-lg border border-border bg-surface/50">
      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-[13px] text-muted-foreground font-medium">Entity:</span>
      <DropdownMenu>
        <DropdownMenuTrigger className="h-7 px-2.5 rounded-md border border-border bg-background text-[13px] flex items-center gap-1.5 hover:border-accent/40 hover:bg-secondary/50 transition-all duration-200 min-w-[180px]">
          <span className={value ? "font-medium text-foreground" : "text-muted-foreground"}>{label}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground ml-auto" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[240px]">
          <DropdownMenuItem onClick={() => onChange("")} className={!value ? "bg-secondary font-medium" : ""}>
            All Companies
            {!value && <span className="ml-auto text-accent text-[10px]">●</span>}
          </DropdownMenuItem>
          {companies.map((c) => (
            <DropdownMenuItem
              key={c.company_code}
              onClick={() => onChange(c.company_code)}
              className={value === c.company_code ? "bg-secondary font-medium" : ""}
            >
              <span className="font-mono text-[11px] text-muted-foreground mr-2">{c.company_code}</span>
              {c.company_name}
              {value === c.company_code && <span className="ml-auto text-accent text-[10px]">●</span>}
            </DropdownMenuItem>
          ))}
          {companies.length === 0 && (
            <DropdownMenuItem disabled className="text-muted-foreground text-[12px]">
              Upload PO data to see companies
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {value && (
        <button
          onClick={() => onChange("")}
          className="h-5 w-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          title="Clear filter"
        >
          <X className="h-3 w-3" />
        </button>
      )}
      {value && (
        <StatusPill tone="info" dot>Filtered</StatusPill>
      )}
    </div>
  );
}

function KpiRow({ companyCode }: { companyCode?: string }) {
  const { isLoading } = useKpi("procurement", companyCode);
  const p1 = useKpiValue("procurement", "TOTAL_PO_VALUE_MTD", companyCode);
  const p2 = useKpiValue("procurement", "PO_COUNT_MTD", companyCode);
  const p3 = useKpiValue("procurement", "AVG_PO_VALUE", companyCode);
  const p4 = useKpiValue("procurement", "OPEN_PO_AGING", companyCode);
  const p5 = useKpiValue("procurement", "MAVERICK_SPEND_RATE", companyCode);
  const p6 = useKpiValue("procurement", "HIGH_VALUE_PO_RATE", companyCode);
  const p7 = useKpiValue("procurement", "TOTAL_PO_VALUE_YTD", companyCode);
  const p8 = useKpiValue("procurement", "ACTIVE_VENDOR_COUNT_MTD", companyCode);
  const p9  = useKpiValue("procurement", "PR_TO_PO_DAYS", companyCode);
  const p10 = useKpiValue("procurement", "PO_DELETION_MTD", companyCode);
  const p11total    = useKpiValue("procurement", "APPROVED_PR_TOTAL", companyCode);
  const p11approved = useKpiValue("procurement", "APPROVED_PR_APPROVED", companyCode);
  const p12total    = useKpiValue("procurement", "APPROVED_PO_TOTAL", companyCode);
  const p12approved = useKpiValue("procurement", "APPROVED_PO_APPROVED", companyCode);

  const fmt = (v: number | null | undefined, unit: string | null | undefined) => {
    if (v == null) return isLoading ? "—" : "No data";
    if (unit === "INR") return formatINR(v);
    if (unit === "%") return `${v.toFixed(1)}%`;
    if (unit === "days") return `${v.toFixed(1)}d`;
    return v.toFixed(0);
  };

  const prFraction = p11approved?.value_numeric != null && p11total?.value_numeric != null
    ? `${Math.round(p11approved.value_numeric)} / ${Math.round(p11total.value_numeric)}`
    : isLoading ? "—" : "No data";

  const poFraction = p12approved?.value_numeric != null && p12total?.value_numeric != null
    ? `${Math.round(p12approved.value_numeric)} / ${Math.round(p12total.value_numeric)}`
    : isLoading ? "—" : "No data";

  return (
    <>
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="Total PO Value (MTD)" value={fmt(p1?.value_numeric, p1?.unit)} sublabel="Sum of net_order_value this month" size="lg" index={0} />
        <KpiCard label="PO Count (MTD)" value={fmt(p2?.value_numeric, p2?.unit)} size="lg" sublabel="Active POs created this month" index={1} />
        <KpiCard label="Average PO Value" value={fmt(p3?.value_numeric, p3?.unit)} size="lg" sublabel="Mean net_order_value MTD" index={2} />
        <KpiCard label="Open PO Aging" value={fmt(p4?.value_numeric, p4?.unit)} size="lg" sublabel="Overdue open PO line items · past expected delivery date" threshold={p4?.value_numeric != null && p4.value_numeric > 0 ? { label: "Overdue POs detected", tone: "danger" } : { label: "All deliveries on track", tone: "success" }} index={3} />
      </div>
      <div className="grid grid-cols-8 gap-3 mt-3">
        <KpiCard label="Maverick Spend Rate" value={fmt(p5?.value_numeric, p5?.unit)} size="md" sublabel="POs without approved PR" threshold={p5?.value_numeric != null && p5.value_numeric > 20 ? { label: "> 20% threshold", tone: "danger" } : { label: "Within target", tone: "success" }} index={4} />
        <KpiCard label="High-Value PO Rate" value={fmt(p6?.value_numeric, p6?.unit)} size="md" sublabel="POs above ₹1 Cr" index={5} />
        <KpiCard label="Total PO Value (YTD)" value={fmt(p7?.value_numeric, p7?.unit)} size="md" sublabel="Sum of active PO values this FY" index={6} />
        <KpiCard label="Active Vendors (YTD)" value={fmt(p8?.value_numeric, p8?.unit)} size="md" sublabel="Distinct vendors on POs this FY" index={7} />
        <KpiCard label="Avg PR-to-PO Time" value={fmt(p9?.value_numeric, p9?.unit)} size="md" sublabel="Avg days from PR requisition date to PO creation date" threshold={p9?.value_numeric != null && p9.value_numeric > 5 ? { label: "> 5 day target", tone: "warning" } : { label: "Within target", tone: "success" }} index={8} />
        <KpiCard label="PO Deletions (MTD)" value={fmt(p10?.value_numeric, p10?.unit)} size="md" sublabel="Deleted line items this month · item level" threshold={p10?.value_numeric != null && p10.value_numeric > 0 ? { label: "Deletions detected", tone: "danger" } : { label: "No deletions", tone: "success" }} index={9} />
        <KpiCard label="Approved PR Count" value={prFraction} size="md" sublabel="Approved / Total non-deleted PRs · EBAN-FRGZU LIKE 'X%'" threshold={p11approved?.value_numeric != null && p11approved.value_numeric > 0 ? { label: "PRs released", tone: "success" } : { label: "No approvals yet", tone: "info" }} index={10} />
        <KpiCard label="Approved PO Count" value={poFraction} size="md" sublabel="Approved / Total non-deleted POs · EKKO-FRGKE LIKE 'X%'" threshold={p12approved?.value_numeric != null && p12approved.value_numeric > 0 ? { label: "POs released", tone: "success" } : { label: "No approvals yet", tone: "info" }} index={11} />
      </div>
    </>
  );
}

function POAgingBuckets({ companyCode }: { companyCode?: string }) {
  const { data: kpiData, isLoading } = useKpi("procurement", companyCode);
  const bucketsKpi = kpiData?.kpis.find((k) => k.kpi_code === "OPEN_PO_AGING_BUCKETS");

  let buckets: Array<{ bucket: string; count: number; fill: string }> = [];
  if (bucketsKpi?.value_text) {
    try {
      const raw = JSON.parse(bucketsKpi.value_text) as Record<string, number>;
      const fills = ["#f59e0b", "#f97316", "#ef4444", "#b91c1c"];
      buckets = Object.entries(raw).map(([bucket, count], i) => ({
        bucket,
        count: count as number,
        fill: fills[i] ?? fills[fills.length - 1],
      }));
    } catch {}
  }

  const total = buckets.reduce((s, b) => s + b.count, 0);

  return (
    <SectionCard
      title="Open PO Aging Buckets"
      subtitle="Count of overdue open PO line items by delay band · source: po_delivery_dump.expected_delivery_date"
      actions={total > 0 ? <StatusPill tone="danger" dot>{total} overdue</StatusPill> : undefined}
    >
      <div className="h-56">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Loading…</div>
        ) : buckets.length === 0 || total === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            Upload PO Delivery data to view aging
          </div>
        ) : (
          <ResponsiveContainer>
            <BarChart data={buckets} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
              <XAxis dataKey="bucket" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip formatter={(v: number) => [`${v} line items`, "Overdue"]} />
              <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                {buckets.map((b) => (
                  <Cell key={b.bucket} fill={b.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </SectionCard>
  );
}

function PODeletionTrend({ companyCode }: { companyCode?: string }) {
  const { data, isLoading } = useCharts("procurement", companyCode);
  const chartData = (data?.series ?? []).map((p) => ({
    month:         p.month ?? "",
    "Deleted Lines": (p.deleted_lines as number) ?? 0,
  }));

  return (
    <SectionCard
      title="PO Deletion Trend"
      subtitle="Monthly deleted PO line items · by PO creation date · item level (purchasing_document + item)"
    >
      <div className="h-56">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Loading…</div>
        ) : chartData.length === 0 || chartData.every((d) => d["Deleted Lines"] === 0) ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No deleted PO line items in this period</div>
        ) : (
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip formatter={(v: number) => [`${v} line items deleted`, "Deletions"]} />
              <Bar dataKey="Deleted Lines" fill={brand.colors.danger} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </SectionCard>
  );
}

function PODeletionMonitor({ companyCode }: { companyCode?: string }) {
  const { data: rows = [], isLoading } = useQuery<DeletedPO[]>({
    queryKey: ["po-deletions", companyCode ?? ""],
    queryFn: () => apiFetch<DeletedPO[]>(
      `/p2p/po-deletions?limit=20${companyCode ? `&company_code=${encodeURIComponent(companyCode)}` : ""}`
    ),
  });

  const totalValue = rows.reduce((s, r) => s + parseFloat(r.net_order_value || "0"), 0);

  return (
    <SectionCard
      title="PO Deletion Anomaly Monitor (All Time)"
      subtitle={`deletion_indicator = L · ${rows.length} deleted PO line items total · ${formatINR(totalValue)} at risk · KPI card shows current month only`}
      actions={
        rows.length > 0 ? (
          <StatusPill tone="danger" dot>Requires Review</StatusPill>
        ) : undefined
      }
      bodyClassName="p-0"
    >
      {isLoading ? (
        <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">No deleted POs found</div>
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
              {rows.map((po) => {
                const flags = po.anomaly_flags
                  ? po.anomaly_flags.split(",").map((f) => f.trim()).filter(Boolean)
                  : [];
                const hasHighRisk = flags.some((f) => ["MAVERICK_BUY", "VENDOR_BLOCK", "PAYMENT_BEFORE_GRN"].includes(f));

                return (
                  <tr
                    key={`${po.purchasing_document}-${po.item}`}
                    className={`hover:bg-secondary/30 transition-colors ${hasHighRisk ? "bg-danger/3" : ""}`}
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
                                ["MAVERICK_BUY", "VENDOR_BLOCK", "PAYMENT_BEFORE_GRN", "THREE_WAY_MISMATCH"].includes(flag)
                                  ? "bg-danger/10 text-danger"
                                  : ["PRICE_DEVIATION", "BACKDATED_PO", "LATE_DELIVERY"].includes(flag)
                                  ? "bg-warning/10 text-warning"
                                  : "bg-secondary text-muted-foreground"
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

function POValueTrend({ companyCode }: { companyCode?: string }) {
  const { data, isLoading } = useCharts("procurement", companyCode);
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

function POCountAndMaverick({ companyCode }: { companyCode?: string }) {
  const { data, isLoading } = useCharts("procurement", companyCode);
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
