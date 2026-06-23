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
  PieChart,
  Pie,
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
    meta: [{ title: "CAPEX / OPEX — KPMG IntelliSource" }],
  }),
  component: UtilizationDashboard,
});

// ── Constants ──────────────────────────────────────────────────────────────────

const CAPEX_COLOR   = brand.colors.primary;
const OPEX_COLOR    = brand.colors.teal;

const DEPTS = [
  { value: "ALL",  label: "All Departments" },
  { value: "9901", label: "Civil Works" },
  { value: "9902", label: "Electrical Equipment" },
  { value: "9903", label: "Office & Admin" },
  { value: "9904", label: "IT Hardware" },
  { value: "9905", label: "IT Software" },
  { value: "9906", label: "Consulting" },
  { value: "9907", label: "Logistics" },
  { value: "9908", label: "Maintenance" },
];

const CAT_COLORS = [
  "#00338D", "#005EB8", "#0091DA", "#00A3A1", "#009A44",
  "#43B02A", "#F5A623", "#E8251F",
];

// ── Filters ────────────────────────────────────────────────────────────────────

function Filters({
  company, onCompany,
  dept, onDept,
}: {
  company: string; onCompany: (v: string) => void;
  dept: string; onDept: (v: string) => void;
}) {
  const { data } = useKpiCompanies("utilization");
  const companies = data?.companies ?? [];
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {companies.length > 1 && (
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground font-medium">Company</span>
          <select
            value={company}
            onChange={(e) => onCompany(e.target.value)}
            className="border border-border rounded-md px-2 py-1 text-[12px] bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="ALL">All</option>
            {companies.filter((c) => c !== "ALL").map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] text-muted-foreground font-medium">Department</span>
        <select
          value={dept}
          onChange={(e) => onDept(e.target.value)}
          className="border border-border rounded-md px-2 py-1 text-[12px] bg-background focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {DEPTS.map((d) => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

function UtilizationDashboard() {
  const [company, setCompany] = useState("ALL");
  const [dept, setDept] = useState("ALL");
  usePrefetchKpiCompanies("utilization");
  const { containerRef, exportPdf, isExporting } = useDashboardExport("CAPEX_OPEX Dashboard", company);

  return (
    <AppShell>
      <div ref={containerRef}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <PageHeader
            title="CAPEX / OPEX Dashboard"
            subtitle="Capital vs operational expenditure — by category, plant and trend"
            onExportPdf={exportPdf}
            isExporting={isExporting}
          />
          <Filters company={company} onCompany={setCompany} dept={dept} onDept={setDept} />
        </div>

        {/* KPI tiles */}
        <SpendRow company={company} dept={dept} />
        <CountRow company={company} dept={dept} />

        {/* Charts row 1 */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          <MonthlyTrend />
          <CapexOpexDonut company={company} dept={dept} />
        </div>

        {/* Charts row 2 */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          <PlantBreakdown company={company} />
          <CategoryBreakdown type="CAPEX" company={company} dept={dept} />
        </div>

        {/* Charts row 3 */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          <CategoryBreakdown type="OPEX" company={company} dept={dept} />
          <MaterialsKpiPanel company={company} dept={dept} />
        </div>

        {/* Materials charts */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          <VendorFillRate company={company} />
          <MaterialCategorySpend company={company} dept={dept} />
        </div>
      </div>
    </AppShell>
  );
}

// ── KPI Rows ───────────────────────────────────────────────────────────────────

function _deptSpend(kpiData: ReturnType<typeof useKpi>["data"], dept: string) {
  if (!kpiData || dept === "ALL") return null;
  const parse = (code: string) => {
    try { return JSON.parse(kpiData.kpis.find((k) => k.kpi_code === code)?.value_text ?? "[]"); }
    catch { return []; }
  };
  const cc = parse("CAPEX_BY_CATEGORY").find((c: { mg: string; value: number }) => c.mg === dept);
  const oc = parse("OPEX_BY_CATEGORY").find((c: { mg: string; value: number }) => c.mg === dept);
  const cv = cc?.value ?? 0;
  const ov = oc?.value ?? 0;
  const total = cv + ov || 1;
  return {
    capex: cv, opex: ov,
    capexPct: +((cv / total) * 100).toFixed(1),
    opexPct:  +((ov / total) * 100).toFixed(1),
    capexPoCount: cc?.po_count ?? 0,
    opexPoCount:  oc?.po_count ?? 0,
  };
}

function SpendRow({ company, dept }: { company: string; dept: string }) {
  const { isLoading, data: kpiData } = useKpi("utilization", company);
  const capex    = useKpiValue("utilization", "CAPEX_SPEND_YTD", company);
  const opex     = useKpiValue("utilization", "OPEX_SPEND_YTD",  company);
  const capexPct = useKpiValue("utilization", "CAPEX_PCT",       company);
  const opexPct  = useKpiValue("utilization", "OPEX_PCT",        company);

  const filtered = _deptSpend(kpiData, dept);
  const deptLabel = dept !== "ALL" ? ` — ${DEPTS.find((d) => d.value === dept)?.label ?? dept}` : "";

  const fmtINR = (v: number) => formatINR(v);
  const fmtPct = (v: number) => `${v.toFixed(1)}%`;

  const capexVal = filtered ? fmtINR(filtered.capex) : (capex?.value_numeric == null ? (isLoading ? "—" : "No data") : fmtINR(capex.value_numeric));
  const opexVal  = filtered ? fmtINR(filtered.opex)  : (opex?.value_numeric  == null ? (isLoading ? "—" : "No data") : fmtINR(opex.value_numeric));
  const cpctVal  = filtered ? fmtPct(filtered.capexPct) : (capexPct?.value_numeric == null ? "—" : fmtPct(capexPct.value_numeric));
  const opctVal  = filtered ? fmtPct(filtered.opexPct)  : (opexPct?.value_numeric  == null ? "—" : fmtPct(opexPct.value_numeric));

  return (
    <div className="grid grid-cols-4 gap-3">
      <KpiCard label={`Total CAPEX Spend${deptLabel}`} value={capexVal}
        size="xl" sublabel="Capital expenditure — hardware, electrical, assets" index={0} kpiCode="CAPEX_SPEND_YTD" />
      <KpiCard label={`Total OPEX Spend${deptLabel}`}  value={opexVal}
        size="xl" sublabel="Operational expenditure — services, maintenance, logistics" index={1} kpiCode="OPEX_SPEND_YTD" />
      <KpiCard label="CAPEX %" value={cpctVal}
        size="lg" sublabel={filtered ? "CAPEX share within selected dept" : "CAPEX share of total committed spend"} index={2} kpiCode="CAPEX_PCT" />
      <KpiCard label="OPEX %"  value={opctVal}
        size="lg" sublabel={filtered ? "OPEX share within selected dept" : "OPEX share of total committed spend"}  index={3} kpiCode="OPEX_PCT" />
    </div>
  );
}

function CountRow({ company, dept }: { company: string; dept: string }) {
  const { isLoading, data: kpiData } = useKpi("utilization", company);
  const capexPOs  = useKpiValue("utilization", "CAPEX_PO_COUNT",      company);
  const opexPOs   = useKpiValue("utilization", "OPEX_PO_COUNT",       company);
  const capexAvg  = useKpiValue("utilization", "CAPEX_AVG_PO_VALUE",  company);
  const opexAvg   = useKpiValue("utilization", "OPEX_AVG_PO_VALUE",   company);
  const capexPend = useKpiValue("utilization", "CAPEX_PENDING_VALUE", company);
  const opexPend  = useKpiValue("utilization", "OPEX_PENDING_VALUE",  company);

  const filtered = _deptSpend(kpiData, dept);

  const fmt = (v: number | null | undefined, u: string | null | undefined) => {
    if (v == null) return isLoading ? "—" : "No data";
    if (u === "INR") return formatINR(v);
    if (u === "%")   return `${v.toFixed(1)}%`;
    return v.toFixed(0);
  };

  return (
    <div className="grid grid-cols-6 gap-3 mt-3">
      <KpiCard label="CAPEX PO Count"
        value={filtered ? String(filtered.capexPoCount) : fmt(capexPOs?.value_numeric, capexPOs?.unit)}
        size="md" sublabel={filtered ? "CAPEX POs in selected dept" : "Distinct CAPEX POs this FY"} index={4} kpiCode="CAPEX_PO_COUNT" />
      <KpiCard label="OPEX PO Count"
        value={filtered ? String(filtered.opexPoCount) : fmt(opexPOs?.value_numeric, opexPOs?.unit)}
        size="md" sublabel={filtered ? "OPEX POs in selected dept" : "Distinct OPEX POs this FY"} index={5} kpiCode="OPEX_PO_COUNT" />
      <KpiCard label="Avg CAPEX PO Value"   value={fmt(capexAvg?.value_numeric,  capexAvg?.unit)}  size="md" sublabel="Mean value per CAPEX PO"  index={6} kpiCode="CAPEX_AVG_PO_VALUE" />
      <KpiCard label="Avg OPEX PO Value"    value={fmt(opexAvg?.value_numeric,   opexAvg?.unit)}   size="md" sublabel="Mean value per OPEX PO"   index={7} kpiCode="OPEX_AVG_PO_VALUE" />
      <KpiCard label="CAPEX Pending"        value={fmt(capexPend?.value_numeric, capexPend?.unit)} size="md" sublabel="CAPEX not yet delivery-complete"
        threshold={capexPend?.value_numeric ? { label: "Awaiting receipt", tone: "warning" } : undefined} index={8} kpiCode="CAPEX_PENDING_VALUE" />
      <KpiCard label="OPEX Pending"         value={fmt(opexPend?.value_numeric,  opexPend?.unit)}  size="md" sublabel="OPEX not yet delivery-complete" index={9} kpiCode="OPEX_PENDING_VALUE" />
    </div>
  );
}

// ── Monthly Trend ──────────────────────────────────────────────────────────────

function MonthlyTrend() {
  const { data, isLoading } = useCharts("utilization");
  const chartData = (data?.series ?? []).map((p) => ({
    month: p.month ?? "",
    CAPEX: +((((p.capex as number) ?? 0) / 1e7).toFixed(2)),
    OPEX:  +((((p.opex  as number) ?? 0) / 1e7).toFixed(2)),
  }));

  return (
    <SectionCard title="Monthly CAPEX vs OPEX Trend" subtitle="₹ Cr — committed PO value by month">
      <div className="h-72">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
        ) : chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Upload PO data to view trend</div>
        ) : (
          <ResponsiveContainer>
            <ComposedChart data={chartData} margin={{ top: 12, right: 20, left: 0, bottom: 4 }}>
              <defs>
                <linearGradient id="capexG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={CAPEX_COLOR} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={CAPEX_COLOR} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="opexG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={OPEX_COLOR} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={OPEX_COLOR} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}Cr`} tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #e5e7eb" }}
                formatter={(v: number, name: string) => [`₹${v.toFixed(2)} Cr`, name]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="CAPEX" stroke={CAPEX_COLOR} strokeWidth={2.5}
                fill="url(#capexG)" dot={{ r: 3, fill: CAPEX_COLOR }} activeDot={{ r: 5 }} />
              <Area type="monotone" dataKey="OPEX"  stroke={OPEX_COLOR}  strokeWidth={2.5}
                fill="url(#opexG)"  dot={{ r: 3, fill: OPEX_COLOR }}  activeDot={{ r: 5 }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </SectionCard>
  );
}

// ── CAPEX / OPEX Donut ─────────────────────────────────────────────────────────

function CapexOpexDonut({ company, dept }: { company: string; dept: string }) {
  const { data: kpiData } = useKpi("utilization", company);
  const capex = useKpiValue("utilization", "CAPEX_SPEND_YTD", company);
  const opex  = useKpiValue("utilization", "OPEX_SPEND_YTD",  company);

  const filtered = _deptSpend(kpiData, dept);
  const cv = filtered ? filtered.capex / 1e7 : (capex?.value_numeric ?? 0) / 1e7;
  const ov = filtered ? filtered.opex  / 1e7 : (opex?.value_numeric  ?? 0) / 1e7;
  const total = cv + ov || 1;

  const data = [
    { name: "CAPEX", value: +cv.toFixed(2), color: CAPEX_COLOR },
    { name: "OPEX",  value: +ov.toFixed(2), color: OPEX_COLOR  },
  ];

  const deptName = dept !== "ALL" ? DEPTS.find((d) => d.value === dept)?.label : null;
  return (
    <SectionCard title="CAPEX vs OPEX Split" subtitle={deptName ? `Filtered: ${deptName}` : "Total committed spend distribution"}>
      <div className="h-72 flex items-center gap-6">
        <div className="flex-1 h-full">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name"
                cx="50%" cy="50%" innerRadius="55%" outerRadius="80%"
                paddingAngle={3} strokeWidth={0}>
                {data.map((d) => <Cell key={d.name} fill={d.color} />)}
              </Pie>
              <Tooltip formatter={(v: number) => [`₹${v.toFixed(2)} Cr`]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="w-36 space-y-4 pr-2">
          {data.map((d) => (
            <div key={d.name} className="space-y-1">
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-sm" style={{ background: d.color }} />
                <span className="text-[12px] font-semibold">{d.name}</span>
              </div>
              <div className="text-[18px] font-bold font-tabular" style={{ color: d.color }}>
                ₹{d.value.toFixed(1)} Cr
              </div>
              <div className="text-[11px] text-muted-foreground">
                {((d.value / total) * 100).toFixed(1)}% of total
              </div>
            </div>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}

// ── Plant Breakdown ────────────────────────────────────────────────────────────

function PlantBreakdown({ company }: { company: string }) {
  const { data: kpiData, isLoading } = useKpi("utilization", company);
  const plantKpi = kpiData?.kpis.find((k) => k.kpi_code === "CAPEX_OPEX_BY_PLANT");

  let plants: Array<{ plant: string; capex: number; opex: number }> = [];
  if (plantKpi?.value_text) {
    try { plants = JSON.parse(plantKpi.value_text); } catch {}
  }

  const chartData = plants.map((p) => ({
    plant: p.plant,
    CAPEX: +(p.capex / 1e7).toFixed(2),
    OPEX:  +(p.opex  / 1e7).toFixed(2),
  }));

  return (
    <SectionCard title="CAPEX / OPEX by Plant" subtitle="₹ Cr — split per location">
      <div className="h-72">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
        ) : chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Upload PO data to view</div>
        ) : (
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 12, right: 20, left: 0, bottom: 4 }} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="plant" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}Cr`} tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #e5e7eb" }}
                formatter={(v: number) => [`₹${v.toFixed(2)} Cr`]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="CAPEX" fill={CAPEX_COLOR} radius={[4, 4, 0, 0]} maxBarSize={40} />
              <Bar dataKey="OPEX"  fill={OPEX_COLOR}  radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </SectionCard>
  );
}

// ── Category Breakdown (dept-filtered) ────────────────────────────────────────

function CategoryBreakdown({ type, company, dept }: { type: "CAPEX" | "OPEX"; company: string; dept: string }) {
  const { data: kpiData, isLoading } = useKpi("utilization", company);
  const kpi = kpiData?.kpis.find(
    (k) => k.kpi_code === (type === "CAPEX" ? "CAPEX_BY_CATEGORY" : "OPEX_BY_CATEGORY")
  );

  let cats: Array<{ mg: string; name: string; value: number; po_count: number }> = [];
  if (kpi?.value_text) {
    try { cats = JSON.parse(kpi.value_text); } catch {}
  }

  // Dept filter — client-side on mg code
  if (dept !== "ALL") cats = cats.filter((c) => c.mg === dept);

  const total = cats.reduce((s, c) => s + c.value, 0) || 1;
  const chartData = cats.map((c) => ({
    name:     c.name,
    value:    +(c.value / 1e7).toFixed(2),
    pct:      +((c.value / total) * 100).toFixed(1),
    po_count: c.po_count,
  }));

  const color = type === "CAPEX" ? CAPEX_COLOR : OPEX_COLOR;

  return (
    <SectionCard title={`${type} by Department`} subtitle={dept === "ALL" ? "All departments — ₹ Cr" : `Filtered: ${DEPTS.find(d => d.value === dept)?.label}`}>
      <div className="h-72">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
        ) : chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No {type} data{dept !== "ALL" ? " for selected department" : ""}</div>
        ) : (
          <div className="flex gap-3 h-full">
            <div className="flex-1">
              <ResponsiveContainer>
                <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 52, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false}
                    tickFormatter={(v) => `₹${v}Cr`} tick={{ fontSize: 9 }} />
                  <YAxis type="category" dataKey="name" tickLine={false} axisLine={false}
                    width={96} tick={{ fontSize: 9 }} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #e5e7eb" }}
                    formatter={(v: number, _n, p) =>
                      [`₹${v.toFixed(2)} Cr  (${p.payload.pct}%) — ${p.payload.po_count} POs`]
                    }
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="w-24 flex flex-col justify-center gap-2">
              {chartData.slice(0, 6).map((c, i) => (
                <div key={c.name} className="flex items-start gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-sm shrink-0 mt-0.5"
                    style={{ background: CAT_COLORS[i % CAT_COLORS.length] }} />
                  <div>
                    <div className="text-[9px] font-medium leading-tight">{c.name}</div>
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

// ── Materials KPI panel ────────────────────────────────────────────────────────

function MaterialsKpiPanel({ company, dept }: { company: string; dept: string }) {
  void dept; // dept doesn't apply to materials KPIs — materials shown as-is
  const { data: kpiData, isLoading } = useKpi("utilization", company);
  const kv  = (code: string) => kpiData?.kpis.find((k) => k.kpi_code === code);
  const num = (code: string) => kv(code)?.value_numeric ?? null;
  const fmt = (v: number | null, u?: string) => {
    if (v == null) return isLoading ? "—" : "No data";
    if (u === "INR Cr") return `₹${v.toFixed(2)} Cr`;
    if (u === "%")      return `${v.toFixed(1)}%`;
    return v.toFixed(0);
  };

  const delivUtil  = num("MAT_DELIV_UTIL_RATE");
  const delivComp  = num("MAT_DELIVERY_COMPLETE_PCT");
  const matchRate  = num("MAT_3WAY_MATCH");
  const openPO     = num("MAT_OPEN_PO_VALUE");
  const capexMat   = num("MAT_CAPEX_SPEND");
  const opexMat    = num("MAT_OPEX_SPEND");

  const items = [
    { label: "Delivery Utilization",  value: fmt(delivUtil, "%"),       color: OPEX_COLOR, bar: delivUtil },
    { label: "Delivery Complete %",   value: fmt(delivComp, "%"),       color: CAPEX_COLOR, bar: delivComp },
    { label: "3-Way Match Rate",       value: fmt(matchRate, "%"),       color: "#009A44",   bar: matchRate },
    { label: "Open PO Value",          value: fmt(openPO, "INR Cr"),     color: "#F5A623",   bar: null },
    { label: "Material CAPEX",         value: fmt(capexMat, "INR Cr"),   color: CAPEX_COLOR, bar: null },
    { label: "Material OPEX",          value: fmt(opexMat, "INR Cr"),    color: OPEX_COLOR,  bar: null },
  ];

  return (
    <SectionCard title="Materials Summary" subtitle="Delivery, matching and spend KPIs">
      <div className="space-y-3 pt-1">
        {items.map((item) => (
          <div key={item.label} className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-muted-foreground">{item.label}</span>
              <span className="text-[13px] font-semibold font-tabular" style={{ color: item.color }}>{item.value}</span>
            </div>
            {item.bar != null && (
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.min(item.bar, 100)}%`, background: item.color }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

// ── Vendor Fill Rate ───────────────────────────────────────────────────────────

function VendorFillRate({ company }: { company: string }) {
  const { data: kpiData, isLoading } = useKpi("utilization", company);
  const kpi = kpiData?.kpis.find((k) => k.kpi_code === "MAT_VENDOR_FILL_RATE");

  type FillRow = { vendor: string; fill_pct: number; grn_qty: number; po_qty: number };
  let rows: FillRow[] = [];
  if (kpi?.value_text) {
    try { rows = JSON.parse(kpi.value_text); } catch {}
  }

  return (
    <SectionCard title="Vendor GRN Fill Rate" subtitle="GRN qty ÷ PO qty — top vendors">
      <div className="h-64">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Upload GRN + PO data to view</div>
        ) : (
          <ResponsiveContainer>
            <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 52, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false}
                tickFormatter={(v) => `${v}%`} tick={{ fontSize: 9 }} />
              <YAxis type="category" dataKey="vendor" tickLine={false} axisLine={false}
                width={100} tick={{ fontSize: 9 }} />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #e5e7eb" }}
                formatter={(v: number, _n, p) =>
                  [`${v}%  (GRN: ${p.payload.grn_qty} / PO: ${p.payload.po_qty})`]}
              />
              <Bar dataKey="fill_pct" name="Fill Rate %" radius={[0, 4, 4, 0]}>
                {rows.map((r, i) => (
                  <Cell key={i} fill={r.fill_pct >= 90 ? "#22c55e" : r.fill_pct >= 70 ? "#f59e0b" : "#ef4444"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </SectionCard>
  );
}

// ── Material Category Spend (dept-filtered) ────────────────────────────────────

function MaterialCategorySpend({ company, dept }: { company: string; dept: string }) {
  const { data: kpiData, isLoading } = useKpi("utilization", company);
  const kpi = kpiData?.kpis.find((k) => k.kpi_code === "MAT_CAT_BREAKDOWN");

  type CatRow = { cat: string; spend_cr: number; po_count: number };
  let rows: CatRow[] = [];
  if (kpi?.value_text) {
    try { rows = JSON.parse(kpi.value_text); } catch {}
  }

  return (
    <SectionCard title="Material Spend by Category" subtitle="₹ Cr — material group breakdown">
      <div className="h-64">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No material data</div>
        ) : (
          <div className="flex gap-3 h-full">
            <div className="flex-1">
              <ResponsiveContainer>
                <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 48, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false}
                    tickFormatter={(v) => `₹${v}Cr`} tick={{ fontSize: 9 }} />
                  <YAxis type="category" dataKey="cat" tickLine={false} axisLine={false}
                    width={80} tick={{ fontSize: 9 }} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #e5e7eb" }}
                    formatter={(v: number, _n, p) => [`₹${v} Cr — ${p.payload.po_count} POs`]}
                  />
                  <Bar dataKey="spend_cr" name="Spend (Cr)" radius={[0, 4, 4, 0]}>
                    {rows.map((_, i) => (
                      <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="w-20 flex flex-col justify-center gap-1.5">
              {rows.slice(0, 6).map((c, i) => (
                <div key={c.cat} className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-sm shrink-0" style={{ background: CAT_COLORS[i % CAT_COLORS.length] }} />
                  <span className="text-[9px] truncate">{c.cat}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
