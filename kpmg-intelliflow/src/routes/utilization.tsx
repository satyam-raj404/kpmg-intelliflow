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
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard } from "@/components/KpiCard";
import { SectionCard } from "@/components/SectionCard";
import { formatINR } from "@/lib/format";
import { brand } from "@/lib/brand";
import { useKpi, useKpiValue, useCharts } from "@/hooks/useKpi";
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

// ── Main Dashboard ─────────────────────────────────────────────────────────

function UtilizationDashboard() {
  const { containerRef, exportPdf, isExporting } = useDashboardExport("CAPEX_OPEX Dashboard");
  return (
    <AppShell>
      <div ref={containerRef}>
        <PageHeader
          title="CAPEX / OPEX Dashboard"
          subtitle="Capital vs operational expenditure split, category breakdown, and plant-level view"
          onExportPdf={exportPdf}
          isExporting={isExporting}
        />

        {/* Row 1 — Spend totals */}
        <SpendRow />

        {/* Row 2 — Count / value KPIs */}
        <CountRow />

        {/* Charts */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          <MonthlyTrend />
          <PlantBreakdown />
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <CategoryBreakdown type="CAPEX" />
          <CategoryBreakdown type="OPEX" />
        </div>
      </div>
    </AppShell>
  );
}

// ── KPI Rows ───────────────────────────────────────────────────────────────

function SpendRow() {
  const { isLoading } = useKpi("utilization");
  const capex     = useKpiValue("utilization", "CAPEX_SPEND_YTD");
  const opex      = useKpiValue("utilization", "OPEX_SPEND_YTD");
  const capexPct  = useKpiValue("utilization", "CAPEX_PCT");
  const opexPct   = useKpiValue("utilization", "OPEX_PCT");

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
      />
      <KpiCard
        label="Total OPEX Spend (YTD)"
        value={fmt(opex?.value_numeric, opex?.unit)}
        size="xl"
        sublabel="Operational expenditure — services, maintenance, logistics"
        index={1}
      />
      <KpiCard
        label="CAPEX %"
        value={fmt(capexPct?.value_numeric, capexPct?.unit)}
        size="lg"
        sublabel="CAPEX share of total committed spend"
        index={2}
      />
      <KpiCard
        label="OPEX %"
        value={fmt(opexPct?.value_numeric, opexPct?.unit)}
        size="lg"
        sublabel="OPEX share of total committed spend"
        index={3}
      />
    </div>
  );
}

function CountRow() {
  const { isLoading } = useKpi("utilization");
  const capexPOs   = useKpiValue("utilization", "CAPEX_PO_COUNT");
  const opexPOs    = useKpiValue("utilization", "OPEX_PO_COUNT");
  const capexAvg   = useKpiValue("utilization", "CAPEX_AVG_PO_VALUE");
  const opexAvg    = useKpiValue("utilization", "OPEX_AVG_PO_VALUE");
  const capexPend  = useKpiValue("utilization", "CAPEX_PENDING_VALUE");
  const opexPend   = useKpiValue("utilization", "OPEX_PENDING_VALUE");

  const fmt = (v: number | null | undefined, u: string | null | undefined) => {
    if (v == null) return isLoading ? "—" : "No data";
    if (u === "INR") return formatINR(v);
    if (u === "%")   return `${v.toFixed(1)}%`;
    return v.toFixed(0);
  };

  return (
    <div className="grid grid-cols-6 gap-3 mt-3">
      <KpiCard label="CAPEX PO Count (YTD)" value={fmt(capexPOs?.value_numeric, capexPOs?.unit)} size="md" sublabel="Distinct CAPEX POs this FY" index={4} />
      <KpiCard label="OPEX PO Count (YTD)"  value={fmt(opexPOs?.value_numeric, opexPOs?.unit)}  size="md" sublabel="Distinct OPEX POs this FY"  index={5} />
      <KpiCard label="Avg CAPEX PO Value"   value={fmt(capexAvg?.value_numeric, capexAvg?.unit)} size="md" sublabel="Mean value per CAPEX PO"  index={6} />
      <KpiCard label="Avg OPEX PO Value"    value={fmt(opexAvg?.value_numeric, opexAvg?.unit)}   size="md" sublabel="Mean value per OPEX PO"   index={7} />
      <KpiCard
        label="CAPEX Pending Delivery"
        value={fmt(capexPend?.value_numeric, capexPend?.unit)}
        size="md"
        sublabel="CAPEX not yet delivery-complete"
        threshold={capexPend?.value_numeric != null && capexPend.value_numeric > 0
          ? { label: "Awaiting receipt", tone: "warning" } : undefined}
        index={8}
      />
      <KpiCard
        label="OPEX Pending Delivery"
        value={fmt(opexPend?.value_numeric, opexPend?.unit)}
        size="md"
        sublabel="OPEX not yet delivery-complete"
        index={9}
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

function PlantBreakdown() {
  const { data: kpiData, isLoading } = useKpi("utilization");
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

function CategoryBreakdown({ type }: { type: "CAPEX" | "OPEX" }) {
  const { data: kpiData, isLoading } = useKpi("utilization");
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
