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
  ComposedChart,
  Line,
} from "recharts";
import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings2, CheckCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard } from "@/components/KpiCard";
import { SectionCard } from "@/components/SectionCard";
import { StatusPill } from "@/components/StatusPill";
import { formatINR } from "@/lib/format";
import { brand } from "@/lib/brand";
import { useKpi, useKpiValue, useCharts } from "@/hooks/useKpi";
import { apiFetch } from "@/api/client";

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

// ── Main Dashboard ─────────────────────────────────────────────────────────

function LeadershipDashboard() {
  return (
    <AppShell>
      <PageHeader
        title="Leadership Dashboard"
        subtitle="Strategic portfolio view · Scannable in 30 seconds"
        actions={<HighValueThresholdPanel />}
      />
      <KpiRow />
      <div className="grid grid-cols-2 gap-4 mt-4">
        <SpendTrend />
        <CapexOpexBreakdown />
      </div>
      <div className="grid grid-cols-2 gap-4 mt-4">
        <RiskIndicators />
        <SummaryCountsPanel />
      </div>
    </AppShell>
  );
}

// ── KPI Row ─────────────────────────────────────────────────────────────────

function KpiRow() {
  const { isLoading } = useKpi("leadership");
  const l1  = useKpiValue("leadership", "TOTAL_PROCUREMENT_YTD");
  const l2  = useKpiValue("leadership", "MAVERICK_BUY_RATE");
  const l3  = useKpiValue("leadership", "E2E_CYCLE_TIME");
  const l4  = useKpiValue("leadership", "VENDOR_CONCENTRATION");
  const l5  = useKpiValue("leadership", "NEGOTIATION_SAVINGS");
  const l6  = useKpiValue("leadership", "SUPPLY_RISK_SCORE");
  const l7  = useKpiValue("leadership", "SOD_CONFLICT_COUNT");
  const l8  = useKpiValue("leadership", "HIGH_VALUE_PO_COUNT");

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
        />
      </div>
      <div className="grid grid-cols-4 gap-3 mt-3">
        <KpiCard
          label="Negotiation Savings"
          value={fmt(l5?.value_numeric, l5?.unit)}
          size="md"
          sublabel="PR price − PO price × qty"
          index={4}
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
        />
        <KpiCard
          label="High-Value POs"
          value={fmt(l8?.value_numeric, l8?.unit)}
          size="md"
          sublabel="Threshold set in header above"
          index={7}
        />
      </div>
    </>
  );
}

// ── Spend Trend Chart ──────────────────────────────────────────────────────

function SpendTrend() {
  const { data, isLoading } = useCharts("leadership");
  const chartData = (data?.series ?? []).map((p) => ({
    month:  p.month ?? "",
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
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v.toFixed(0)}Cr`} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number, name: string) => [`₹${v.toFixed(2)} Cr`, name]} />
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

function CapexOpexBreakdown() {
  const { data: kpiData, isLoading } = useKpi("leadership");
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
              <BarChart data={barData} layout="vertical" margin={{ top: 4, right: 32, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v.toFixed(0)}Cr`} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={48} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [`₹${v.toFixed(2)} Cr`]} />
                <Bar dataKey="value" radius={[0, 3, 3, 0]}>
                  {barData.map((_, i) => (
                    <rect key={i} fill={i === 0 ? brand.colors.primary : brand.colors.success} />
                  ))}
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

function RiskIndicators() {
  const { data: kpiData, isLoading } = useKpi("leadership");

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
      <div className="h-56">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
        ) : (
          <ResponsiveContainer>
            <BarChart data={barData} layout="vertical" margin={{ top: 8, right: 48, left: 120, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
              <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(v) => `${v}`} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={120} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number, _n, p) => [`${v.toFixed(1)}`, p.payload.name]} />
              <Bar dataKey="value" radius={[0, 3, 3, 0]}>
                {barData.map((entry, i) => (
                  <rect key={i} fill={getColor(entry.value, entry.name)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </SectionCard>
  );
}

// ── Summary Counts Panel ───────────────────────────────────────────────────

function SummaryCountsPanel() {
  const { data: kpiData, isLoading } = useKpi("leadership");
  const countKpi = kpiData?.kpis.find((k) => k.kpi_code === "SUMMARY_COUNTS");

  let counts: Record<string, number> = {};
  if (countKpi?.value_text) {
    try { counts = JSON.parse(countKpi.value_text); } catch {}
  }

  const items = [
    { label: "Approved PRs",     key: "approved_pr",   tone: "success" as const },
    { label: "Approved POs",     key: "approved_po",   tone: "success" as const },
    { label: "GRN Lines",        key: "grn_lines",     tone: "info"    as const },
    { label: "Invoice Lines",    key: "invoice_lines", tone: "info"    as const },
    { label: "Payments",         key: "payments",      tone: "success" as const },
    { label: "POs Without PR",   key: "po_without_pr", tone: "danger"  as const },
  ];

  return (
    <SectionCard title="P2P Summary Counts" subtitle="Current data snapshot">
      {isLoading ? (
        <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
      ) : Object.keys(counts).length === 0 ? (
        <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">Upload P2P data to view counts</div>
      ) : (
        <div className="grid grid-cols-3 gap-3 mt-1">
          {items.map((item) => (
            <div key={item.key} className="bg-secondary/40 rounded-lg p-3">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{item.label}</div>
              <div className="text-[22px] font-semibold font-tabular">
                {counts[item.key] ?? "—"}
              </div>
              {item.key === "po_without_pr" && (counts[item.key] ?? 0) > 0 && (
                <StatusPill tone="danger" className="mt-1">Review</StatusPill>
              )}
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
