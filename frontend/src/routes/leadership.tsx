import { createFileRoute } from "@tanstack/react-router";
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
  LabelList,
  Cell,
  ComposedChart,
  Line,
} from "recharts";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings2, CheckCircle, FileCheck2, Package, PackageCheck, FileText, Banknote, AlertTriangle, Store, FileX2, Copy, ShieldAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { KpiCard } from "@/components/KpiCard";
import { SectionCard } from "@/components/SectionCard";
import { StatusPill } from "@/components/StatusPill";
import { formatINR } from "@/lib/format";
import { brand } from "@/lib/brand";
import { useKpi, useKpiValue, useKpiCompanies, useCharts, usePrefetchKpiCompanies } from "@/hooks/useKpi";
import { useDashboardExport } from "@/hooks/useDashboardExport";
import { apiFetch } from "@/api/client";

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
function fmtMonth(raw: string): string {
  if (!raw) return raw;
  const m = raw.match(/^(\d{4})-(\d{2})/);
  if (m) return `${MONTH_NAMES[parseInt(m[2], 10) - 1]}'${m[1].slice(2)}`;
  return raw;
}

export const Route = createFileRoute("/leadership")({
  head: () => ({
    meta: [
      { title: "Leadership Dashboard — KPMG IntelliSource" },
      { name: "description", content: "Strategic portfolio-level procurement view for executives." },
    ],
  }),
  component: LeadershipDashboard,
});

// ── Types ──────────────────────────────────────────────────────────────────

interface ConfigEntry {
  config_key: string;
  config_value: string;
  description: string;
}

interface KpiConfigResponse {
  config: ConfigEntry[];
}

// ── High-Value Threshold Panel ─────────────────────────────────────────────

function HighValueThresholdPanel() {
  const queryClient = useQueryClient();
  const [inputVal, setInputVal] = useState<string>("");
  const [saved, setSaved] = useState(false);

  const { data: configData } = useQuery<KpiConfigResponse>({
    queryKey: ["kpi-config"],
    queryFn: () => apiFetch<KpiConfigResponse>("/kpi-config"),
  });

  useEffect(() => {
    const entry = configData?.config?.find(
      (c) => c.config_key === "HIGH_VALUE_PO_THRESHOLD"
    );
    if (entry && !inputVal) {
      // Show in Crores for readability
      const crVal = parseInt(entry.config_value, 10) / 1_00_00_000;
      setInputVal(crVal.toFixed(2));
    }
  }, [configData]);

  const mutation = useMutation({
    mutationFn: (valueCr: number) =>
      apiFetch<{ status: string }>("/kpi-config/HIGH_VALUE_PO_THRESHOLD", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: String(Math.round(valueCr * 1_00_00_000)) }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kpi", "leadership"] });
      queryClient.invalidateQueries({ queryKey: ["kpi-config"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const handleApply = () => {
    const crores = parseFloat(inputVal);
    if (!isNaN(crores) && crores > 0) {
      mutation.mutate(crores);
    }
  };

  const currentEntry = configData?.config?.find(
    (c) => c.config_key === "HIGH_VALUE_PO_THRESHOLD"
  );
  const currentCr = currentEntry
    ? parseInt(currentEntry.config_value, 10) / 1_00_00_000
    : 1;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Settings2 className="h-3.5 w-3.5" />
        <span>High-Value Threshold:</span>
        <span className="font-medium text-foreground">₹{currentCr.toFixed(2)} Cr</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-[11px] text-muted-foreground">₹</span>
        <input
          type="number"
          min="0.01"
          step="0.25"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          className="h-7 w-20 px-2 text-[11px] rounded border border-border bg-surface focus:border-primary focus:outline-none font-tabular"
          placeholder="Cr"
        />
        <span className="text-[11px] text-muted-foreground">Cr</span>
        <button
          onClick={handleApply}
          disabled={mutation.isPending}
          className="h-7 px-3 rounded bg-primary text-white text-[11px] font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {mutation.isPending ? "Saving…" : "Apply"}
        </button>
        {saved && (
          <span className="flex items-center gap-1 text-[11px] text-success">
            <CheckCircle className="h-3 w-3" /> Saved & KPIs refreshed
          </span>
        )}
      </div>
    </div>
  );
}

// ── Company Filter ─────────────────────────────────────────────────────────

function CompanyFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data } = useKpiCompanies("leadership");
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

// ── Main Dashboard ─────────────────────────────────────────────────────────

function LeadershipDashboard() {
  const [company, setCompany] = useState("ALL");
  usePrefetchKpiCompanies("leadership");
  const { containerRef, exportPdf, isExporting } = useDashboardExport("Leadership Dashboard", company);

  return (
    <AppShell>
      <div ref={containerRef}>
        <div className="flex items-center justify-between">
          <PageHeader
            title="Leadership Dashboard"
            subtitle="Strategic portfolio view · Scannable in 30 seconds"
            actions={<HighValueThresholdPanel />}
            onExportPdf={exportPdf}
            isExporting={isExporting}
          />
          <CompanyFilter value={company} onChange={setCompany} />
        </div>
        <SummaryCountsPanel company={company} />
        <div className="mt-6">
          <KpiRow company={company} />
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <SpendTrend />
          <CapexOpexBreakdown company={company} />
        </div>
        <div className="mt-4">
          <RiskIndicators company={company} />
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <InvoiceByVendor />
          <InvoiceByVendorType />
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <PrAging />
          <PrQuantityByProduct />
        </div>
        <div className="mt-4">
          <InvoiceVsPayment />
        </div>
      </div>
    </AppShell>
  );
}

// ── KPI Row ─────────────────────────────────────────────────────────────────

function KpiRow({ company }: { company: string }) {
  const { isLoading } = useKpi("leadership", company);
  const l1  = useKpiValue("leadership", "TOTAL_SPEND_YTD",       company);
  const l2  = useKpiValue("leadership", "MAVERICK_BUY_RATE",     company);
  const l3  = useKpiValue("leadership", "E2E_CYCLE_TIME",        company);
  const l4  = useKpiValue("leadership", "VENDOR_CONCENTRATION",  company);
  const l5  = useKpiValue("leadership", "NEGOTIATION_SAVINGS",   company);
  const l6  = useKpiValue("leadership", "SUPPLY_RISK_SCORE",     company);
  const l7  = useKpiValue("leadership", "SOD_CONFLICT_COUNT",    company);
  const l8  = useKpiValue("leadership", "HIGH_VALUE_PO_COUNT",   company);

  const fmt = (v: number | null | undefined, unit: string | null | undefined) => {
    if (v == null) return isLoading ? "—" : "No data";
    if (unit === "INR")   return formatINR(v);
    if (unit === "%")     return `${v.toFixed(1)}%`;
    if (unit === "days")  return `${v.toFixed(1)}d`;
    if (unit === "score") return v.toFixed(1);
    return v.toFixed(0);
  };

  return (
    <>
      <div className="grid grid-cols-4 gap-3">
        <KpiCard
          label="Total Spend YTD"
          value={fmt(l1?.value_numeric, l1?.unit)}
          size="xl"
          sublabel="Active POs this Indian FY"
          index={0}
          kpiCode="TOTAL_SPEND_YTD"
        />
        <KpiCard
          label="Maverick PO Rate"
          value={fmt(l2?.value_numeric, l2?.unit)}
          size="lg"
          sublabel="POs with no upstream PR"
          threshold={
            l2?.value_numeric != null && l2.value_numeric > 15
              ? { label: "Above 15% limit", tone: "danger" }
              : { label: "Acceptable", tone: "success" }
          }
          index={1}
          kpiCode="MAVERICK_BUY_RATE"
        />
        <KpiCard
          label="End-to-End Cycle"
          value={fmt(l3?.value_numeric, l3?.unit)}
          size="lg"
          sublabel="PR release → payment (avg)"
          threshold={
            l3?.value_numeric != null && l3.value_numeric > 45
              ? { label: "> 45 day target", tone: "warning" }
              : { label: "Within target", tone: "success" }
          }
          index={2}
          kpiCode="E2E_CYCLE_TIME"
        />
        <KpiCard
          label="Vendor Concentration"
          value={fmt(l4?.value_numeric, l4?.unit)}
          size="lg"
          sublabel="Top-3 vendors' spend share"
          threshold={
            l4?.value_numeric != null && l4.value_numeric > 60
              ? { label: "High concentration", tone: "warning" }
              : undefined
          }
          index={3}
          kpiCode="VENDOR_CONCENTRATION"
        />
      </div>
      <div className="grid grid-cols-4 gap-3 mt-3">
        <KpiCard
          label="Negotiation Savings"
          value={fmt(l5?.value_numeric, l5?.unit)}
          size="md"
          sublabel="PR price − PO price × qty"
          index={4}
          kpiCode="NEGOTIATION_SAVINGS"
        />
        <KpiCard
          label="Supply Risk Score"
          value={fmt(l6?.value_numeric, l6?.unit)}
          size="md"
          sublabel="Concentration + Maverick + Anomaly"
          threshold={
            l6?.value_numeric != null && l6.value_numeric > 50
              ? { label: "High risk", tone: "danger" }
              : { label: "Moderate", tone: "warning" }
          }
          index={5}
          kpiCode="SUPPLY_RISK_SCORE"
        />
        <KpiCard
          label="SOD Conflicts"
          value={fmt(l7?.value_numeric, l7?.unit)}
          size="md"
          sublabel="PR creator = PO approver"
          threshold={
            l7?.value_numeric != null && l7.value_numeric > 0
              ? { label: "Requires review", tone: "danger" }
              : undefined
          }
          index={6}
          kpiCode="SOD_CONFLICT_COUNT"
        />
        <KpiCard
          label="High-Value POs"
          value={fmt(l8?.value_numeric, l8?.unit)}
          size="md"
          sublabel="Threshold set in header above"
          index={7}
          kpiCode="HIGH_VALUE_PO_COUNT"
        />
      </div>
    </>
  );
}

// ── Spend Trend Chart ──────────────────────────────────────────────────────

function SpendTrend() {
  const { data, isLoading } = useCharts("leadership");
  const raw = data?.series as unknown as { type?: string; monthly?: Array<Record<string, unknown>> };
  const chartData = (raw?.monthly ?? []).map((p: Record<string, unknown>) => ({
    month:  (p.month as string) ?? "",
    spend:  ((p.spend as number)  ?? 0) / 1_00_00_000,
    capex:  ((p.capex as number)  ?? 0) / 1_00_00_000,
    opex:   ((p.opex  as number)  ?? 0) / 1_00_00_000,
  }));

  return (
    <SectionCard title="Monthly Spend Trend" subtitle="₹ Cr — Total / CAPEX / OPEX">
      <div className="h-64">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
        ) : chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Upload PO data to view trend</div>
        ) : (
          <ResponsiveContainer>
            <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
              <defs>
                <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={brand.colors.accent} stopOpacity={0.15} />
                  <stop offset="100%" stopColor={brand.colors.accent} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} tickFormatter={fmtMonth} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v.toFixed(0)}Cr`} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number, name: string) => [`₹${v.toFixed(2)} Cr`, name]} labelFormatter={fmtMonth} />
              <Area type="monotone" dataKey="spend" name="Total"
                stroke={brand.colors.accent} strokeWidth={2} fill="url(#spendGrad)" />
              <Line type="monotone" dataKey="capex" name="CAPEX"
                stroke={brand.colors.primary} strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
              <Line type="monotone" dataKey="opex" name="OPEX"
                stroke={brand.colors.success} strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </SectionCard>
  );
}

// ── CAPEX vs OPEX Breakdown ────────────────────────────────────────────────

function CapexOpexBreakdown({ company }: { company: string }) {
  const { data: kpiData, isLoading } = useKpi("leadership", company);
  const coKpi = kpiData?.kpis.find((k) => k.kpi_code === "CAPEX_OPEX_SPLIT");

  let split: { capex: number; opex: number; capex_pct: number; opex_pct: number } | null = null;
  if (coKpi?.value_text) {
    try { split = JSON.parse(coKpi.value_text); } catch {}
  }

  const barData = split
    ? [
        { name: "CAPEX", value: split.capex / 1_00_00_000, pct: split.capex_pct },
        { name: "OPEX",  value: split.opex  / 1_00_00_000, pct: split.opex_pct  },
      ]
    : [];

  return (
    <SectionCard title="CAPEX vs OPEX Split" subtitle="YTD committed spend">
      <div className="h-64">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
        ) : barData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Upload PO data with capex_opex_flag</div>
        ) : (
          <>
            <div className="flex gap-6 mb-4 px-1">
              {barData.map((b) => (
                <div key={b.name} className="flex-1 bg-secondary/50 rounded-lg p-3">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{b.name}</div>
                  <div className="text-[20px] font-semibold font-tabular mt-0.5">{b.pct.toFixed(1)}%</div>
                  <div className="text-[11px] text-muted-foreground">₹{b.value.toFixed(2)} Cr</div>
                </div>
              ))}
            </div>
            <ResponsiveContainer height={120}>
              <BarChart data={barData} layout="vertical" margin={{ top: 4, right: 80, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v.toFixed(0)}Cr`} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={48} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [`₹${v.toFixed(2)} Cr`]} />
                <Bar dataKey="value" radius={[0, 3, 3, 0]}>
                  {barData.map((_, i) => (
                    <rect key={i} fill={i === 0 ? brand.colors.primary : brand.colors.success} />
                  ))}
                  <LabelList dataKey="value" position="right" formatter={(v: number) => `₹${v.toFixed(1)}Cr`} style={{ fontSize: 9, fill: "#555" }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </>
        )}
      </div>
    </SectionCard>
  );
}

// ── Risk Indicators ────────────────────────────────────────────────────────

function RiskIndicators({ company }: { company: string }) {
  const { data: kpiData, isLoading } = useKpi("leadership", company);

  const barData = [
    { name: "Vendor Concentration", value: kpiData?.kpis.find(k => k.kpi_code === "VENDOR_CONCENTRATION")?.value_numeric ?? 0 },
    { name: "Maverick PO Rate",     value: kpiData?.kpis.find(k => k.kpi_code === "MAVERICK_BUY_RATE")?.value_numeric ?? 0 },
    { name: "Risk Score",           value: kpiData?.kpis.find(k => k.kpi_code === "SUPPLY_RISK_SCORE")?.value_numeric ?? 0 },
    { name: "SOD Conflicts",        value: (kpiData?.kpis.find(k => k.kpi_code === "SOD_CONFLICT_COUNT")?.value_numeric ?? 0) },
  ];

  const getColor = (val: number, name: string) => {
    if (name === "SOD Conflicts") return val > 0 ? brand.colors.danger : brand.colors.success;
    if (val > 60) return brand.colors.danger;
    if (val > 30) return brand.colors.warning;
    return brand.colors.success;
  };

  return (
    <SectionCard title="Risk Indicators" subtitle="Key compliance & concentration metrics">
      <div className="h-64">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
        ) : (
          <ResponsiveContainer>
            <BarChart data={barData} layout="vertical" margin={{ top: 8, right: 80, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
              <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(v) => `${v}`} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={120} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number, _n, p) => [`${v.toFixed(1)}`, p.payload.name]} />
              <Bar dataKey="value" radius={[0, 3, 3, 0]}>
                {barData.map((entry, i) => (
                  <rect key={i} fill={getColor(entry.value, entry.name)} />
                ))}
                <LabelList dataKey="value" position="right" formatter={(v: number) => v.toFixed(1)} style={{ fontSize: 9, fill: "#555" }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </SectionCard>
  );
}

// ── Invoice by Vendor ──────────────────────────────────────────────────────

function InvoiceByVendor() {
  const { data, isLoading } = useCharts("leadership");
  const raw = data?.series as unknown as { type?: string; invoice_by_vendor?: Array<{ vendor: string; vendor_name: string; total_amount: number; invoice_count: number }> };
  const vendorData = raw?.invoice_by_vendor ?? [];

  return (
    <SectionCard title="Invoice Summary by Vendor" subtitle="Top 10 vendors by invoice amount">
      <div className="h-64">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
        ) : vendorData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Upload invoice data to view</div>
        ) : (
          <ResponsiveContainer>
            <BarChart data={vendorData} layout="vertical" margin={{ top: 8, right: 88, left: 80, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
              <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(v) => `₹${(v / 1_00_00_000).toFixed(0)}Cr`} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="vendor_name" tickLine={false} axisLine={false} width={76} tick={{ fontSize: 9 }} />
              <Tooltip formatter={(v: number) => [`₹${(v / 1_00_00_000).toFixed(2)} Cr`]} />
              <Bar dataKey="total_amount" fill={brand.colors.accent} radius={[0, 3, 3, 0]} name="Invoice Amount">
                <LabelList dataKey="total_amount" position="right" formatter={(v: number) => `₹${(v / 1_00_00_000).toFixed(1)}Cr`} style={{ fontSize: 9, fill: "#555" }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </SectionCard>
  );
}

// ── Invoice by Vendor Type ─────────────────────────────────────────────────

function InvoiceByVendorType() {
  const { data, isLoading } = useCharts("leadership");
  const raw = data?.series as unknown as { type?: string; invoice_by_vendor_type?: Array<{ vendor_type: string; total_amount: number; invoice_count: number }> };
  const ALL_VENDOR_TYPES = ["DOMESTIC", "INTERNATIONAL", "MSME", "ONE_TIME"];
  const typeMap = new Map((raw?.invoice_by_vendor_type ?? []).map(t => [t.vendor_type, t]));
  const typeData = ALL_VENDOR_TYPES.map(vt => typeMap.get(vt) ?? { vendor_type: vt, total_amount: 0, invoice_count: 0 });

  const COLORS = [brand.colors.primary, brand.colors.success, brand.colors.warning, brand.colors.danger, brand.colors.accent];

  return (
    <SectionCard title="Invoice Summary by Vendor Type" subtitle="DOMESTIC / INTERNATIONAL / ONE-TIME">
      <div className="h-64">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
        ) : typeData.every(t => t.total_amount === 0) ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Upload invoice & vendor data to view</div>
        ) : (
          <div className="flex flex-col gap-2 mt-2 px-1">
            {typeData.map((t, i) => {
              const total = typeData.reduce((s, x) => s + x.total_amount, 0);
              const pct = total > 0 ? ((t.total_amount / total) * 100) : 0;
              return (
                <div key={t.vendor_type} className="bg-secondary/40 rounded-lg p-3">
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-[12px] font-medium">{t.vendor_type}</span>
                    </div>
                    <span className="text-[12px] font-tabular text-muted-foreground">{pct.toFixed(1)}%</span>
                  </div>
                  <div className="text-[18px] font-semibold font-tabular">₹{(t.total_amount / 1_00_00_000).toFixed(2)}Cr</div>
                  <div className="text-[10px] text-muted-foreground">{t.invoice_count} invoices</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SectionCard>
  );
}

// ── PR Aging ───────────────────────────────────────────────────────────────

function PrAging() {
  const { data, isLoading } = useCharts("leadership");
  const raw = data?.series as unknown as { type?: string; pr_aging?: Array<{ bucket: string; value: number }> };
  const aging = raw?.pr_aging ?? [];

  return (
    <SectionCard title="Aging of Open PR Lines" subtitle="Days since PR release without PO conversion">
      <div className="h-64">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
        ) : aging.length === 0 || aging.every((a) => a.value === 0) ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No open PRs without PO</div>
        ) : (
          <ResponsiveContainer>
            <BarChart data={aging} margin={{ top: 24, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
              <XAxis dataKey="bucket" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => [`${v.toFixed(0)} PR lines`]} />
              <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                {aging.map((_, i) => (
                  <rect key={i} fill={i === 3 ? brand.colors.danger : i === 2 ? brand.colors.warning : brand.colors.success} />
                ))}
                <LabelList dataKey="value" position="top" formatter={(v: number) => v.toFixed(0)} style={{ fontSize: 9, fill: "#555" }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </SectionCard>
  );
}

// ── PR Quantity by Product ─────────────────────────────────────────────────

function PrQuantityByProduct() {
  const { data, isLoading } = useCharts("leadership");
  const raw = data?.series as unknown as { type?: string; pr_qty_by_material?: Array<{ material_group: string; total_qty: number; pr_lines: number }> };
  const qtyData = raw?.pr_qty_by_material ?? [];

  return (
    <SectionCard title="PR Quantity by Product (Material Group)" subtitle="Top material groups by order quantity">
      <div className="h-64">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
        ) : qtyData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Upload PR data to view</div>
        ) : (
          <ResponsiveContainer>
            <BarChart data={qtyData} layout="vertical" margin={{ top: 8, right: 72, left: 56, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
              <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="material_group" tickLine={false} axisLine={false} width={52} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number, _n, p) => [`${v.toFixed(0)} (${p.payload.pr_lines} PR lines)`, "Qty"]} />
              <Bar dataKey="total_qty" fill={brand.colors.success} radius={[0, 3, 3, 0]}>
                <LabelList dataKey="total_qty" position="right" formatter={(v: number) => v.toFixed(0)} style={{ fontSize: 9, fill: "#555" }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </SectionCard>
  );
}

// ── Invoice vs Payment ────────────────────────────────────────────────────

function InvoiceVsPayment() {
  const { data, isLoading } = useCharts("leadership");
  const raw = data?.series as unknown as { type?: string; invoice_vs_payment?: Array<{ month: string; invoice_amount: number; payment_amount: number }> };
  const chartData = (raw?.invoice_vs_payment ?? []).map((p) => ({
    month: p.month,
    invoice: Math.round(p.invoice_amount / 1_00_00_000 * 100) / 100,
    payment: Math.round(p.payment_amount / 1_00_00_000 * 100) / 100,
  }));

  return (
    <SectionCard title="Invoice vs Payment Trend" subtitle="Monthly comparison — ₹ Cr">
      <div className="h-64">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
        ) : chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Upload invoice & payment data to view</div>
        ) : (
          <ResponsiveContainer>
            <ComposedChart data={chartData} margin={{ top: 24, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} tickFormatter={fmtMonth} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v.toFixed(0)}Cr`} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number, name: string) => [`₹${v.toFixed(2)} Cr`, name]} labelFormatter={fmtMonth} />
              <Bar dataKey="invoice" name="Invoiced" fill={brand.colors.primary} radius={[2, 2, 0, 0]} opacity={0.8}>
                <LabelList dataKey="invoice" position="top" formatter={(v: number) => `₹${v.toFixed(1)}Cr`} style={{ fontSize: 8, fill: "#555" }} />
              </Bar>
              <Bar dataKey="payment" name="Paid" fill={brand.colors.success} radius={[2, 2, 0, 0]} opacity={0.8}>
                <LabelList dataKey="payment" position="top" formatter={(v: number) => `₹${v.toFixed(1)}Cr`} style={{ fontSize: 8, fill: "#555" }} />
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </SectionCard>
  );
}

// ── Summary Counts Panel ───────────────────────────────────────────────────

type SummaryTone = "success" | "info" | "warning" | "danger";

interface CountItem {
  label: string;
  key: string;
  tone: SummaryTone;
  Icon: LucideIcon;
}

const TILE_PALETTE: Record<SummaryTone, {
  bg: string;
  borderL: string;
  iconCls: string;
  alertValCls: string;
}> = {
  success: { bg: "bg-success/6",  borderL: "border-l-success",  iconCls: "text-success", alertValCls: "text-success" },
  info:    { bg: "bg-accent/6",   borderL: "border-l-accent",   iconCls: "text-accent",  alertValCls: "text-accent" },
  warning: { bg: "bg-warning/6",  borderL: "border-l-warning",  iconCls: "text-warning", alertValCls: "text-[#A56500]" },
  danger:  { bg: "bg-danger/6",   borderL: "border-l-danger",   iconCls: "text-danger",  alertValCls: "text-danger" },
};

const HEALTH_ITEMS: CountItem[] = [
  { label: "Approved PRs",    key: "approved_pr",    tone: "success", Icon: FileCheck2 },
  { label: "Approved POs",    key: "approved_po",    tone: "success", Icon: Package },
  { label: "GRN Lines",       key: "grn_lines",      tone: "info",    Icon: PackageCheck },
  { label: "Invoice Lines",   key: "invoice_lines",  tone: "info",    Icon: FileText },
  { label: "Payments",        key: "payments",       tone: "success", Icon: Banknote },
];

const RISK_ITEMS: CountItem[] = [
  { label: "POs Without PR",       key: "po_without_pr",      tone: "danger",  Icon: AlertTriangle },
  { label: "One-Time Vendors",     key: "one_time_vendors",   tone: "warning", Icon: Store },
  { label: "POs Without Contract", key: "po_no_contract",     tone: "warning", Icon: FileX2 },
  { label: "Duplicate Invoices",   key: "duplicate_invoices", tone: "danger",  Icon: Copy },
  { label: "SOD Conflicts",        key: "sod_conflicts",      tone: "danger",  Icon: ShieldAlert },
];

interface SummaryDetail {
  key: string;
  columns: string[];
  rows: string[][];
  count: number;
}

function CountTile({ item, counts, delay, company }: {
  item: CountItem;
  counts: Record<string, number>;
  delay: number;
  company: string;
}) {
  const [open, setOpen] = useState(false);
  const [limit, setLimit] = useState(15);

  useEffect(() => {
    if (!open) setLimit(15);
  }, [open]);

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ["summary-detail", item.key, company, limit],
    queryFn: () => apiFetch<SummaryDetail>(`/summary-detail/${item.key}?company_code=${company}&limit=${limit}`),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const val = counts[item.key];
  const palette = TILE_PALETTE[item.tone];
  const isRisk = item.tone === "danger" || item.tone === "warning";
  const hasAlert = isRisk && val != null && val > 0;
  const { Icon } = item;
  const canLoadMore = !!detail && detail.count >= limit && limit < 200;

  return (
    <HoverCard open={open} onOpenChange={setOpen} openDelay={400} closeDelay={150}>
      <HoverCardTrigger asChild>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay }}
          className={cn(
            "rounded-lg p-3 border border-border/40 border-l-2 flex flex-col gap-1 transition-colors cursor-default",
            palette.bg,
            palette.borderL,
          )}
        >
          <div className="flex items-center gap-1.5">
            <Icon className={cn("h-3 w-3 shrink-0", palette.iconCls)} />
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground truncate">{item.label}</span>
          </div>
          <div className={cn(
            "text-[24px] font-bold font-tabular leading-none mt-1",
            hasAlert ? palette.alertValCls : "text-foreground",
          )}>
            {val ?? "—"}
          </div>
          <div className="mt-0.5 h-[18px] flex items-center">
            {hasAlert && (
              <StatusPill tone={item.tone} className="text-[10px] leading-none px-1.5 py-0.5">Review</StatusPill>
            )}
          </div>
        </motion.div>
      </HoverCardTrigger>
      <HoverCardContent side="top" align="start" sideOffset={6} className="w-[500px] p-0 overflow-hidden">
        <div className="px-3 py-2 border-b border-border flex items-center justify-between bg-secondary/30">
          <div className="flex items-center gap-2">
            <Icon className={cn("h-3.5 w-3.5", palette.iconCls)} />
            <span className="text-[13px] font-semibold">{item.label}</span>
          </div>
          {detail && (
            <span className="text-[11px] text-muted-foreground tabular-nums">{detail.count} rows</span>
          )}
        </div>
        <div className="max-h-[260px] overflow-auto">
          {detailLoading ? (
            <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">Loading…</div>
          ) : !detail || detail.rows.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">No data available</div>
          ) : (
            <table className="w-full text-[11px] border-separate border-spacing-0">
              <thead className="sticky top-0">
                <tr>
                  {detail.columns.map((col) => (
                    <th key={col} className="px-2.5 py-1.5 text-left font-semibold text-muted-foreground whitespace-nowrap bg-secondary/60 border-b border-border">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {detail.rows.map((row, ri) => (
                  <tr key={ri} className={ri % 2 === 0 ? "bg-background" : "bg-secondary/20"}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-2.5 py-1 text-foreground font-tabular max-w-[140px] overflow-hidden text-ellipsis whitespace-nowrap">
                        {cell || "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="px-3 py-1.5 border-t border-border bg-secondary/30 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">
            Showing {detail?.count ?? 0} of up to {limit} rows
          </span>
          {canLoadMore && (
            <button
              onClick={() => setLimit(200)}
              className="text-[10px] font-medium text-primary hover:underline"
            >
              Load more (up to 200)
            </button>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

function SummaryCountsPanel({ company }: { company: string }) {
  const { data: kpiData, isLoading } = useKpi("leadership", company);
  const countKpi = kpiData?.kpis.find((k) => k.kpi_code === "SUMMARY_COUNTS");

  let counts: Record<string, number> = {};
  if (countKpi?.value_text) {
    try { counts = JSON.parse(countKpi.value_text); } catch {}
  }

  const alertCount = RISK_ITEMS.filter(item => (counts[item.key] ?? 0) > 0).length;

  return (
    <SectionCard
      title="P2P Summary Counts"
      subtitle="Current data snapshot"
      actions={
        alertCount > 0 ? (
          <span className="flex items-center gap-1 text-[11px] font-medium text-danger bg-danger/8 px-2 py-0.5 rounded-full">
            <AlertTriangle className="h-3 w-3" />
            {alertCount} flagged
          </span>
        ) : undefined
      }
    >
      {isLoading ? (
        <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
      ) : Object.keys(counts).length === 0 ? (
        <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">Upload P2P data to view counts</div>
      ) : (
        <div className="flex flex-col gap-4 mt-1">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/50">Pipeline Health</span>
              <div className="flex-1 h-px bg-border/50" />
            </div>
            <div className="grid grid-cols-5 gap-2">
              {HEALTH_ITEMS.map((item, i) => (
                <CountTile key={item.key} item={item} counts={counts} delay={i * 0.04} company={company} />
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/50">Risk & Exceptions</span>
              <div className="flex-1 h-px bg-border/50" />
            </div>
            <div className="grid grid-cols-5 gap-2">
              {RISK_ITEMS.map((item, i) => (
                <CountTile key={item.key} item={item} counts={counts} delay={0.2 + i * 0.04} company={company} />
              ))}
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
