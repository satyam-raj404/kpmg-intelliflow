import { createFileRoute } from "@tanstack/react-router";
import {
  ResponsiveContainer,
  ComposedChart,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  RadialBarChart,
  RadialBar,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard } from "@/components/KpiCard";
import { SectionCard } from "@/components/SectionCard";
import { formatINR } from "@/lib/format";
import { brand } from "@/lib/brand";
import { useState } from "react";
import { useKpi, useKpiValue, useCharts, useKpiCompanies, usePrefetchKpiCompanies } from "@/hooks/useKpi";
import { useDashboardExport } from "@/hooks/useDashboardExport";

export const Route = createFileRoute("/utilization")({
  head: () => ({
    meta: [
      { title: "CAPEX / OPEX — KPMG IntelliSource" },
      { name: "description", content: "Capital and operational expenditure split, trends, and category breakdown." },
    ],
  }),
  component: UtilizationDashboard,
});

// ── Helpers ────────────────────────────────────────────────────────────────

const CAPEX_COLOR = brand.colors.primary;   // KPMG Blue
const OPEX_COLOR  = brand.colors.teal;       // KPMG Teal
const PENDING_COLOR = brand.colors.warning;

function pct(v: number | null | undefined): string {
  return v != null ? `${v.toFixed(1)}%` : "—";
}

// ── Company Filter ─────────────────────────────────────────────────────────

function CompanyFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data } = useKpiCompanies("utilization");
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

function UtilizationDashboard() {
  const [company, setCompany] = useState("ALL");
  usePrefetchKpiCompanies("utilization");
  const { containerRef, exportPdf, isExporting } = useDashboardExport("CAPEX_OPEX Dashboard", company);

  return (
    <AppShell>
      <div ref={containerRef}>
        <div className="flex items-center justify-between">
          <PageHeader
            title="CAPEX / OPEX Dashboard"
            subtitle="Capital vs operational expenditure split, category breakdown, and plant-level view"
            onExportPdf={exportPdf}
            isExporting={isExporting}
          />
          <CompanyFilter value={company} onChange={setCompany} />
        </div>

        {/* Row 1 — Spend totals */}
        <SpendRow company={company} />

        {/* Row 2 — Count / value KPIs */}
        <CountRow company={company} />

        {/* Charts */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          <MonthlyTrend />
          <PlantBreakdown company={company} />
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <CategoryBreakdown type="CAPEX" company={company} />
          <CategoryBreakdown type="OPEX" company={company} />
        </div>

        {/* Software Utilization Section */}
        <div className="mt-6">
          <h2 className="text-base font-semibold text-foreground mb-3 tracking-tight">
            Software License Utilization
          </h2>
          <SoftwareSection company={company} />
        </div>

        {/* Materials Utilization Section */}
        <div className="mt-6">
          <h2 className="text-base font-semibold text-foreground mb-3 tracking-tight">
            Materials Utilization
          </h2>
          <MaterialsSection company={company} />
        </div>
      </div>
    </AppShell>
  );
}

// ── KPI Rows ───────────────────────────────────────────────────────────────

function SpendRow({ company }: { company: string }) {
  const { isLoading } = useKpi("utilization", company);
  const capex     = useKpiValue("utilization", "CAPEX_SPEND_YTD", company);
  const opex      = useKpiValue("utilization", "OPEX_SPEND_YTD", company);
  const capexPct  = useKpiValue("utilization", "CAPEX_PCT", company);
  const opexPct   = useKpiValue("utilization", "OPEX_PCT", company);

  const fmt = (v: number | null | undefined, u: string | null | undefined) => {
    if (v == null) return isLoading ? "—" : "No data";
    if (u === "INR") return formatINR(v);
    if (u === "%")   return `${v.toFixed(1)}%`;
    return v.toFixed(0);
  };

  return (
    <div className="grid grid-cols-4 gap-3">
      <KpiCard
        label="Total CAPEX Spend (YTD)"
        value={fmt(capex?.value_numeric, capex?.unit)}
        size="xl"
        sublabel="Capital expenditure — hardware, software, electrical"
        index={0}
        kpiCode="CAPEX_SPEND_YTD"
      />
      <KpiCard
        label="Total OPEX Spend (YTD)"
        value={fmt(opex?.value_numeric, opex?.unit)}
        size="xl"
        sublabel="Operational expenditure — services, maintenance, logistics"
        index={1}
        kpiCode="OPEX_SPEND_YTD"
      />
      <KpiCard
        label="CAPEX %"
        value={fmt(capexPct?.value_numeric, capexPct?.unit)}
        size="lg"
        sublabel="CAPEX share of total committed spend"
        index={2}
        kpiCode="CAPEX_PCT"
      />
      <KpiCard
        label="OPEX %"
        value={fmt(opexPct?.value_numeric, opexPct?.unit)}
        size="lg"
        sublabel="OPEX share of total committed spend"
        index={3}
        kpiCode="OPEX_PCT"
      />
    </div>
  );
}

function CountRow({ company }: { company: string }) {
  const { isLoading } = useKpi("utilization", company);
  const capexPOs   = useKpiValue("utilization", "CAPEX_PO_COUNT",       company);
  const opexPOs    = useKpiValue("utilization", "OPEX_PO_COUNT",        company);
  const capexAvg   = useKpiValue("utilization", "CAPEX_AVG_PO_VALUE",   company);
  const opexAvg    = useKpiValue("utilization", "OPEX_AVG_PO_VALUE",    company);
  const capexPend  = useKpiValue("utilization", "CAPEX_PENDING_VALUE",  company);
  const opexPend   = useKpiValue("utilization", "OPEX_PENDING_VALUE",   company);

  const fmt = (v: number | null | undefined, u: string | null | undefined) => {
    if (v == null) return isLoading ? "—" : "No data";
    if (u === "INR") return formatINR(v);
    if (u === "%")   return `${v.toFixed(1)}%`;
    return v.toFixed(0);
  };

  return (
    <div className="grid grid-cols-6 gap-3 mt-3">
      <KpiCard label="CAPEX PO Count (YTD)" value={fmt(capexPOs?.value_numeric, capexPOs?.unit)} size="md" sublabel="Distinct CAPEX POs this FY" index={4} kpiCode="CAPEX_PO_COUNT" />
      <KpiCard label="OPEX PO Count (YTD)"  value={fmt(opexPOs?.value_numeric, opexPOs?.unit)}  size="md" sublabel="Distinct OPEX POs this FY"  index={5} kpiCode="OPEX_PO_COUNT" />
      <KpiCard label="Avg CAPEX PO Value"   value={fmt(capexAvg?.value_numeric, capexAvg?.unit)} size="md" sublabel="Mean value per CAPEX PO"  index={6} kpiCode="CAPEX_AVG_PO_VALUE" />
      <KpiCard label="Avg OPEX PO Value"    value={fmt(opexAvg?.value_numeric, opexAvg?.unit)}   size="md" sublabel="Mean value per OPEX PO"   index={7} kpiCode="OPEX_AVG_PO_VALUE" />
      <KpiCard
        label="CAPEX Pending Delivery"
        value={fmt(capexPend?.value_numeric, capexPend?.unit)}
        size="md"
        sublabel="CAPEX not yet delivery-complete"
        threshold={capexPend?.value_numeric != null && capexPend.value_numeric > 0
          ? { label: "Awaiting receipt", tone: "warning" } : undefined}
        index={8}
        kpiCode="CAPEX_PENDING_VALUE"
      />
      <KpiCard
        label="OPEX Pending Delivery"
        value={fmt(opexPend?.value_numeric, opexPend?.unit)}
        size="md"
        sublabel="OPEX not yet delivery-complete"
        index={9}
        kpiCode="OPEX_PENDING_VALUE"
      />
    </div>
  );
}

// ── Monthly CAPEX vs OPEX Trend ────────────────────────────────────────────

function MonthlyTrend() {
  const { data, isLoading } = useCharts("utilization");
  const chartData = (data?.series ?? []).map((p) => ({
    month:  p.month ?? "",
    capex:  ((p.capex as number) ?? 0) / 1_00_00_000,
    opex:   ((p.opex  as number) ?? 0) / 1_00_00_000,
  }));

  return (
    <SectionCard title="Monthly CAPEX vs OPEX Trend" subtitle="₹ Cr — committed PO value">
      <div className="h-64">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
        ) : chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Upload PO data to view trend</div>
        ) : (
          <ResponsiveContainer>
            <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
              <defs>
                <linearGradient id="capexGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CAPEX_COLOR} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={CAPEX_COLOR} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="opexGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={OPEX_COLOR} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={OPEX_COLOR} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v.toFixed(0)}Cr`} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number, name: string) => [`₹${v.toFixed(2)} Cr`, name]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="capex" name="CAPEX"
                stroke={CAPEX_COLOR} strokeWidth={2} fill="url(#capexGrad)" />
              <Area type="monotone" dataKey="opex" name="OPEX"
                stroke={OPEX_COLOR} strokeWidth={2} fill="url(#opexGrad)" />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </SectionCard>
  );
}

// ── Plant Breakdown ────────────────────────────────────────────────────────

function PlantBreakdown({ company }: { company: string }) {
  const { data: kpiData, isLoading } = useKpi("utilization", company);
  const plantKpi = kpiData?.kpis.find((k) => k.kpi_code === "CAPEX_OPEX_BY_PLANT");

  let plants: Array<{ plant: string; capex: number; opex: number; total: number }> = [];
  if (plantKpi?.value_text) {
    try { plants = JSON.parse(plantKpi.value_text); } catch {}
  }

  const chartData = plants.map((p) => ({
    plant: p.plant,
    CAPEX: +(p.capex / 1_00_00_000).toFixed(2),
    OPEX:  +(p.opex  / 1_00_00_000).toFixed(2),
  }));

  return (
    <SectionCard title="CAPEX / OPEX by Plant" subtitle="₹ Cr per plant">
      <div className="h-64">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
        ) : chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Upload PO data to view breakdown</div>
        ) : (
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
              <XAxis dataKey="plant" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}Cr`} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => [`₹${v.toFixed(2)} Cr`]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="CAPEX" fill={CAPEX_COLOR} radius={[3, 3, 0, 0]} stackId="a" />
              <Bar dataKey="OPEX"  fill={OPEX_COLOR}  radius={[3, 3, 0, 0]} stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </SectionCard>
  );
}

// ── Category Breakdown ─────────────────────────────────────────────────────

function CategoryBreakdown({ type, company }: { type: "CAPEX" | "OPEX"; company: string }) {
  const { data: kpiData, isLoading } = useKpi("utilization", company);
  const kpi = kpiData?.kpis.find(
    (k) => k.kpi_code === (type === "CAPEX" ? "CAPEX_BY_CATEGORY" : "OPEX_BY_CATEGORY")
  );

  let cats: Array<{ mg: string; name: string; value: number; po_count: number }> = [];
  if (kpi?.value_text) {
    try { cats = JSON.parse(kpi.value_text); } catch {}
  }

  const total = cats.reduce((s, c) => s + c.value, 0) || 1;
  const chartData = cats.map((c) => ({
    name:     c.name,
    value:    +(c.value / 1_00_00_000).toFixed(2),
    pct:      +((c.value / total) * 100).toFixed(1),
    po_count: c.po_count,
  }));

  const color = type === "CAPEX" ? CAPEX_COLOR : OPEX_COLOR;
  const shades = [
    `${color}FF`, `${color}CC`, `${color}99`,
    `${color}77`, `${color}55`, `${color}33`,
  ];

  return (
    <SectionCard
      title={`${type} by Category`}
      subtitle={`Top spend categories — ₹ Cr`}
    >
      <div className="h-64">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
        ) : chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No {type} data</div>
        ) : (
          <div className="flex gap-4 h-full">
            {/* Bar chart */}
            <div className="flex-1">
              <ResponsiveContainer>
                <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 48, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false}
                    tickFormatter={(v) => `₹${v}Cr`} tick={{ fontSize: 9 }} />
                  <YAxis type="category" dataKey="name" tickLine={false} axisLine={false}
                    width={90} tick={{ fontSize: 9 }} />
                  <Tooltip
                    formatter={(v: number, _n, p) =>
                      [`₹${v.toFixed(2)} Cr (${p.payload.pct}%) — ${p.payload.po_count} POs`]
                    }
                  />
                  <Bar dataKey="value" radius={[0, 3, 3, 0]}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={shades[i % shades.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Legend table */}
            <div className="w-28 flex flex-col justify-center gap-1.5 pr-1">
              {chartData.slice(0, 5).map((c, i) => (
                <div key={c.name} className="flex items-center gap-1.5">
                  <div
                    className="h-2.5 w-2.5 rounded-sm shrink-0"
                    style={{ background: shades[i % shades.length] }}
                  />
                  <div className="min-w-0">
                    <div className="text-[9px] font-medium truncate leading-tight">{c.name}</div>
                    <div className="text-[9px] text-muted-foreground font-tabular">{c.pct}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

// ── Software License Utilization Section ──────────────────────────────────────

const SW_COLOR   = brand.colors.primary;
const RISK_COLORS: Record<string, string> = { HIGH: "#ef4444", MEDIUM: "#f59e0b", LOW: "#22c55e" };

function SoftwareSection({ company }: { company: string }) {
  const { data: kpiData, isLoading } = useKpi("utilization", company);

  const kv = (code: string) => kpiData?.kpis.find((k) => k.kpi_code === code);
  const num = (code: string) => kv(code)?.value_numeric ?? null;
  const fmt = (v: number | null, u?: string) => {
    if (v == null) return isLoading ? "—" : "No data";
    if (u === "INR Cr") return `₹${v.toFixed(2)} Cr`;
    if (u === "INR")    return `₹${v.toLocaleString("en-IN")}`;
    if (u === "%")      return `${v.toFixed(1)}%`;
    return v.toFixed(0);
  };

  const utilRate    = num("SW_LIC_UTIL_RATE");
  const underUtil   = num("SW_UNDERUTIL_COUNT");
  const totalSeats  = num("SW_TOTAL_LICENSES");
  const activeUsers = num("SW_ACTIVE_USERS");
  const unusedSeats = num("SW_UNUSED_SEATS");
  const annualCost  = num("SW_ANNUAL_COST");
  const costPerUser = num("SW_COST_PER_USER");
  const wastedCost  = num("SW_WASTED_COST");
  const renewal90d  = num("SW_RENEWAL_90D");
  const capexSw     = num("SW_CAPEX_SPEND");
  const opexSw      = num("SW_OPEX_SPEND");
  const vendorConc  = num("SW_VENDOR_CONC");

  type ToolRow = { tool: string; total: number; active: number; unused: number; util_pct: number; cost_cr: number; renewal: string | null; risk: string };
  type VendorRow = { vendor: string; spend_cr: number; pct: number };

  let tools: ToolRow[] = [];
  let vendors: VendorRow[] = [];
  try { tools   = JSON.parse(kv("SW_TOOL_BREAKDOWN")?.value_text ?? "[]"); } catch {}
  try { vendors = JSON.parse(kv("SW_VENDOR_BREAKDOWN")?.value_text ?? "[]"); } catch {}

  const radialData = utilRate != null ? [{ name: "Utilization", value: utilRate, fill: SW_COLOR }] : [];

  return (
    <>
      {/* KPI bar */}
      <div className="grid grid-cols-5 gap-3">
        <KpiCard label="Avg License Utilization" value={fmt(utilRate, "%")} size="xl"
          sublabel="Active ÷ total licensed seats across all tools"
          threshold={utilRate != null && utilRate < 70 ? { label: "Below 70% target", tone: "warning" } : undefined}
          index={20} kpiCode="SW_LIC_UTIL_RATE" />
        <KpiCard label="Under-Utilized Tools" value={fmt(underUtil)} size="lg"
          sublabel="Tools with util < 70% — review or downsize"
          threshold={underUtil != null && underUtil > 0 ? { label: "Action needed", tone: "warning" } : undefined}
          index={21} kpiCode="SW_UNDERUTIL_COUNT" />
        <KpiCard label="Unused Seats" value={fmt(unusedSeats)} size="lg"
          sublabel="Licensed but inactive seats — cost waste"
          index={22} kpiCode="SW_UNUSED_SEATS" />
        <KpiCard label="Wasted License Cost" value={fmt(wastedCost, "INR Cr")} size="lg"
          sublabel="Cost of under-utilized licenses (< 70%)"
          threshold={wastedCost != null && wastedCost > 0 ? { label: "Recoverable savings", tone: "danger" } : undefined}
          index={23} kpiCode="SW_WASTED_COST" />
        <KpiCard label="Renewals in 90 Days" value={fmt(renewal90d)} size="lg"
          sublabel="Licenses expiring within 90 days"
          threshold={renewal90d != null && renewal90d > 0 ? { label: "Review before renewal", tone: "warning" } : undefined}
          index={24} kpiCode="SW_RENEWAL_90D" />
      </div>

      <div className="grid grid-cols-3 gap-3 mt-3">
        <KpiCard label="Annual SW License Cost" value={fmt(annualCost, "INR Cr")} size="md" sublabel="Total annual committed license spend" index={25} kpiCode="SW_ANNUAL_COST" />
        <KpiCard label="Cost Per Active User" value={fmt(costPerUser, "INR")} size="md" sublabel="Effective per-user license cost (INR)" index={26} kpiCode="SW_COST_PER_USER" />
        <KpiCard label="SW Vendor Concentration" value={fmt(vendorConc, "%")} size="md" sublabel="Top vendor share of SW spend — risk if > 50%" index={27} kpiCode="SW_VENDOR_CONC" />
      </div>

      <div className="grid grid-cols-2 gap-3 mt-3">
        <KpiCard label="Software CAPEX Spend (YTD)" value={fmt(capexSw, "INR Cr")} size="md" sublabel="Perpetual / one-time SW licenses" index={28} kpiCode="SW_CAPEX_SPEND" />
        <KpiCard label="Software OPEX Spend (YTD)" value={fmt(opexSw, "INR Cr")} size="md" sublabel="Subscription / SaaS / maintenance" index={29} kpiCode="SW_OPEX_SPEND" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-4 mt-4">
        {/* Utilization gauge */}
        <SectionCard title="License Utilization Rate" subtitle="Active ÷ total seats (%)">
          <div className="h-56 flex flex-col items-center justify-center">
            {radialData.length === 0 ? (
              <p className="text-sm text-muted-foreground">Upload license_usage data to view</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <RadialBarChart cx="50%" cy="80%" innerRadius="60%" outerRadius="90%"
                    startAngle={180} endAngle={0} data={radialData}>
                    <RadialBar dataKey="value" cornerRadius={6} background={{ fill: "#e5e7eb" }} />
                    <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, "Utilization"]} />
                  </RadialBarChart>
                </ResponsiveContainer>
                <p className="text-2xl font-bold -mt-6" style={{ color: SW_COLOR }}>
                  {utilRate?.toFixed(1)}%
                </p>
              </>
            )}
          </div>
        </SectionCard>

        {/* Per-tool breakdown */}
        <SectionCard title="Tool-Level License Breakdown" subtitle="Seats used vs licensed">
          <div className="h-56 overflow-y-auto">
            {tools.length === 0 ? (
              <p className="text-sm text-muted-foreground p-2">No license data — upload license_usage CSV</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-1 pr-2">Tool</th>
                    <th className="text-right pr-2">Util %</th>
                    <th className="text-right pr-2">Unused</th>
                    <th className="text-right pr-2">Cost (Cr)</th>
                    <th className="text-right">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {tools.map((t) => (
                    <tr key={t.tool} className="border-b border-border/40 hover:bg-muted/30">
                      <td className="py-1 pr-2 font-medium truncate max-w-[7rem]">{t.tool}</td>
                      <td className="text-right pr-2 font-tabular">{t.util_pct}%</td>
                      <td className="text-right pr-2 font-tabular">{t.unused}</td>
                      <td className="text-right pr-2 font-tabular">₹{t.cost_cr}</td>
                      <td className="text-right">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold text-white"
                          style={{ background: RISK_COLORS[t.risk] ?? "#6b7280" }}>
                          {t.risk}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </SectionCard>
      </div>

      {/* Vendor spend */}
      {vendors.length > 0 && (
        <SectionCard title="Software Vendor Spend" subtitle="₹ Cr — share of SW PO spend" className="mt-4">
          <div className="h-48">
            <ResponsiveContainer>
              <BarChart data={vendors} layout="vertical" margin={{ top: 4, right: 48, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false}
                  tickFormatter={(v) => `₹${v}Cr`} tick={{ fontSize: 9 }} />
                <YAxis type="category" dataKey="vendor" tickLine={false} axisLine={false}
                  width={100} tick={{ fontSize: 9 }} />
                <Tooltip formatter={(v: number, _n, p) => [`₹${v} Cr (${p.payload.pct}%)`]} />
                <Bar dataKey="spend_cr" fill={SW_COLOR} radius={[0, 3, 3, 0]} name="Spend (Cr)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      )}
    </>
  );
}

// ── Materials Utilization Section ─────────────────────────────────────────────

const MAT_COLOR  = brand.colors.teal;
const MAT2_COLOR = "#7c3aed";

function MaterialsSection({ company }: { company: string }) {
  const { data: kpiData, isLoading } = useKpi("utilization", company);

  const kv  = (code: string) => kpiData?.kpis.find((k) => k.kpi_code === code);
  const num = (code: string) => kv(code)?.value_numeric ?? null;
  const fmt = (v: number | null, u?: string) => {
    if (v == null) return isLoading ? "—" : "No data";
    if (u === "INR Cr") return `₹${v.toFixed(2)} Cr`;
    if (u === "%")      return `${v.toFixed(1)}%`;
    return v.toFixed(0);
  };

  const delivUtil   = num("MAT_DELIV_UTIL_RATE");
  const delivComp   = num("MAT_DELIVERY_COMPLETE_PCT");
  const openPO      = num("MAT_OPEN_PO_VALUE");
  const capexMat    = num("MAT_CAPEX_SPEND");
  const opexMat     = num("MAT_OPEX_SPEND");
  const licCost     = num("MAT_LICENSE_COST_TOT");
  const matchRate   = num("MAT_3WAY_MATCH");

  type FillRow = { vendor: string; fill_pct: number; grn_qty: number; po_qty: number };
  type LicRow  = { type: string; cost_cr: number };
  type CatRow  = { cat: string; spend_cr: number; po_count: number };

  let fillRows: FillRow[] = [];
  let licRows:  LicRow[]  = [];
  let catRows:  CatRow[]  = [];
  try { fillRows = JSON.parse(kv("MAT_VENDOR_FILL_RATE")?.value_text  ?? "[]"); } catch {}
  try { licRows  = JSON.parse(kv("MAT_LICENSE_BREAKDOWN")?.value_text ?? "[]"); } catch {}
  try { catRows  = JSON.parse(kv("MAT_CAT_BREAKDOWN")?.value_text     ?? "[]"); } catch {}

  const catShades = ["#0d6efd","#0dcaf0","#6f42c1","#fd7e14","#198754","#dc3545","#ffc107","#20c997"];

  return (
    <>
      {/* KPI bar */}
      <div className="grid grid-cols-5 gap-3">
        <KpiCard label="Delivery Utilization Rate" value={fmt(delivUtil, "%")} size="xl"
          sublabel="GRN qty received ÷ PO ordered qty"
          threshold={delivUtil != null && delivUtil < 80 ? { label: "Below 80% target", tone: "warning" } : undefined}
          index={30} kpiCode="MAT_DELIV_UTIL_RATE" />
        <KpiCard label="Delivery Complete POs" value={fmt(delivComp, "%")} size="lg"
          sublabel="% of material POs marked delivery-complete"
          index={31} kpiCode="MAT_DELIVERY_COMPLETE_PCT" />
        <KpiCard label="3-Way Match Rate" value={fmt(matchRate, "%")} size="lg"
          sublabel="Invoice ≈ GRN ≈ PO within 5% tolerance"
          threshold={matchRate != null && matchRate < 90 ? { label: "Below 90% threshold", tone: "warning" } : undefined}
          index={32} kpiCode="MAT_3WAY_MATCH" />
        <KpiCard label="Open PO Value (not GRN'd)" value={fmt(openPO, "INR Cr")} size="lg"
          sublabel="Committed spend awaiting goods receipt"
          threshold={openPO != null && openPO > 10 ? { label: "Monitor receipt", tone: "warning" } : undefined}
          index={33} kpiCode="MAT_OPEN_PO_VALUE" />
        <KpiCard label="Material Licensing Cost" value={fmt(licCost, "INR Cr")} size="lg"
          sublabel="Royalty + import license + patent fees total"
          index={34} kpiCode="MAT_LICENSE_COST_TOT" />
      </div>

      <div className="grid grid-cols-2 gap-3 mt-3">
        <KpiCard label="Material CAPEX Spend (YTD)" value={fmt(capexMat, "INR Cr")} size="md" sublabel="Capital material POs (machinery, assets)" index={35} kpiCode="MAT_CAPEX_SPEND" />
        <KpiCard label="Material OPEX Spend (YTD)" value={fmt(opexMat, "INR Cr")} size="md" sublabel="Operating material POs (consumables, royalties)" index={36} kpiCode="MAT_OPEX_SPEND" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-4 mt-4">
        {/* Vendor fill rate */}
        <SectionCard title="Vendor GRN Fill Rate" subtitle="GRN qty ÷ PO qty — top vendors">
          <div className="h-56">
            {fillRows.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                Upload GRN + PO data to view fill rates
              </div>
            ) : (
              <ResponsiveContainer>
                <BarChart data={fillRows} layout="vertical" margin={{ top: 4, right: 52, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false}
                    tickFormatter={(v) => `${v}%`} tick={{ fontSize: 9 }} />
                  <YAxis type="category" dataKey="vendor" tickLine={false} axisLine={false}
                    width={100} tick={{ fontSize: 9 }} />
                  <Tooltip formatter={(v: number, _n, p) =>
                    [`${v}% (GRN: ${p.payload.grn_qty} / PO: ${p.payload.po_qty})`]} />
                  <Bar dataKey="fill_pct" name="Fill Rate %" radius={[0, 3, 3, 0]}>
                    {fillRows.map((r, i) => (
                      <Cell key={i} fill={r.fill_pct >= 90 ? "#22c55e" : r.fill_pct >= 70 ? "#f59e0b" : "#ef4444"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </SectionCard>

        {/* Category spend */}
        <SectionCard title="Material Spend by Category" subtitle="₹ Cr — sub-category or material group">
          <div className="h-56">
            {catRows.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                No categorized material POs yet
              </div>
            ) : (
              <div className="flex gap-4 h-full">
                <div className="flex-1">
                  <ResponsiveContainer>
                    <BarChart data={catRows} layout="vertical" margin={{ top: 4, right: 48, left: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
                      <XAxis type="number" tickLine={false} axisLine={false}
                        tickFormatter={(v) => `₹${v}Cr`} tick={{ fontSize: 9 }} />
                      <YAxis type="category" dataKey="cat" tickLine={false} axisLine={false}
                        width={80} tick={{ fontSize: 9 }} />
                      <Tooltip formatter={(v: number, _n, p) =>
                        [`₹${v} Cr — ${p.payload.po_count} POs`]} />
                      <Bar dataKey="spend_cr" name="Spend (Cr)" radius={[0, 3, 3, 0]}>
                        {catRows.map((_, i) => (
                          <Cell key={i} fill={catShades[i % catShades.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-24 flex flex-col justify-center gap-1.5">
                  {catRows.slice(0, 6).map((c, i) => (
                    <div key={c.cat} className="flex items-center gap-1">
                      <div className="h-2 w-2 rounded-sm shrink-0" style={{ background: catShades[i % catShades.length] }} />
                      <span className="text-[9px] truncate">{c.cat}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      {/* License cost breakdown */}
      {licRows.length > 0 && (
        <SectionCard title="Material License Cost by Type" subtitle="₹ Cr — royalty / import / patent fees" className="mt-4">
          <div className="h-40">
            <ResponsiveContainer>
              <BarChart data={licRows} margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                <XAxis dataKey="type" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                <YAxis tickLine={false} axisLine={false}
                  tickFormatter={(v) => `₹${v}Cr`} tick={{ fontSize: 9 }} />
                <Tooltip formatter={(v: number) => [`₹${v} Cr`]} />
                <Bar dataKey="cost_cr" name="License Cost (Cr)" fill={MAT2_COLOR} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      )}
    </>
  );
}
