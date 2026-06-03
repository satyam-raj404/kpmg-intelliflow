import { createFileRoute } from "@tanstack/react-router";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard } from "@/components/KpiCard";
import { SectionCard } from "@/components/SectionCard";
import { brand } from "@/lib/brand";
import { formatINR } from "@/lib/format";
import { useKpi, useKpiValue, useCharts } from "@/hooks/useKpi";

export const Route = createFileRoute("/vendors")({
  head: () => ({
    meta: [
      { title: "Vendor Performance — KPMG IntelliSource" },
      { name: "description", content: "Vendor delivery, compliance, and spend concentration analytics." },
    ],
  }),
  component: VendorDashboard,
});

function VendorDashboard() {
  return (
    <AppShell>
      <PageHeader title="Vendor Performance" subtitle="Delivery, compliance, and spend concentration analytics" />
      <KpiRow />
      <div className="grid grid-cols-2 gap-4 mt-4">
        <OTIFTrend />
        <ComplianceDonut />
      </div>
      <div className="grid grid-cols-2 gap-4 mt-4">
        <TopVendors />
        <VendorTypeChart />
      </div>
    </AppShell>
  );
}

function KpiRow() {
  const { isLoading } = useKpi("vendor");
  // KPI 1 — Total Active Vendors (all 5 blocks clear)
  const v1 = useKpiValue("vendor", "ACTIVE_VENDOR_COUNT");
  // KPI 2 — Vendor Compliance Rate + Breakdown
  const v2 = useKpiValue("vendor", "VENDOR_COMPLIANCE_RATE");
  const vBreakdown = useKpiValue("vendor", "VENDOR_BREAKDOWN");
  // KPI 3 — OTIF Rate
  const v3 = useKpiValue("vendor", "OTIF_RATE");
  // KPI 4 — Avg Delivery Delay
  const v4 = useKpiValue("vendor", "AVG_DELIVERY_DELAY");
  // KPI 5 — Quantity Variance Rate
  const v5 = useKpiValue("vendor", "QTY_VARIANCE_RATE");
  // KPI 9 — MSME Vendor Count
  const v9 = useKpiValue("vendor", "MSME_VENDOR_COUNT");

  const fmt = (v: number | null | undefined, unit: string | null | undefined) => {
    if (v == null) return isLoading ? "—" : "No data";
    if (unit === "INR") return formatINR(v);
    if (unit === "%") return `${v.toFixed(1)}%`;
    if (unit === "days") return `${v.toFixed(1)}d`;
    return v.toFixed(0);
  };

  // Parse vendor breakdown JSON for sublabel
  let breakdown: { active?: number; blocked?: number; one_time?: number; domestic?: number; international?: number; msme?: number; total?: number } = {};
  if (vBreakdown?.value_text) {
    try { breakdown = JSON.parse(vBreakdown.value_text); } catch {}
  }
  const bdSublabel = breakdown.total
    ? `Active ${breakdown.active ?? 0} · Blocked ${breakdown.blocked ?? 0} · Domestic ${breakdown.domestic ?? 0} · Intl ${breakdown.international ?? 0} · One-time ${breakdown.one_time ?? 0}`
    : "All 5 block flags · purchasing, posting, payment, CC";

  return (
    <>
      {/* Row 1 — Vendor Status & Delivery */}
      <div className="grid grid-cols-4 gap-3">
        <KpiCard
          label="Total Active Vendors"
          value={fmt(v1?.value_numeric, v1?.unit)}
          sublabel="All 5 blocks clear: purchasing, posting (central + CC), payment, deletion"
          size="lg"
          index={0}
        />
        <KpiCard
          label="Vendor Compliance Rate"
          value={fmt(v2?.value_numeric, v2?.unit)}
          sublabel={bdSublabel}
          size="lg"
          threshold={
            v2?.value_numeric != null && v2.value_numeric < 95
              ? { label: "Below 95% target", tone: "warning" }
              : { label: "On target (> 95%)", tone: "success" }
          }
          index={1}
        />
        <KpiCard
          label="OTIF Rate"
          value={fmt(v3?.value_numeric, v3?.unit)}
          sublabel="On-time GRN ÷ delivery-completed POs · GRN posting_date ≤ expected_delivery_date"
          size="lg"
          threshold={
            v3?.value_numeric != null && v3.value_numeric < 90
              ? { label: "Below 90% target", tone: "danger" }
              : v3?.value_numeric != null
              ? { label: "On target (> 90%)", tone: "success" }
              : undefined
          }
          index={2}
        />
        <KpiCard
          label="Avg Delivery Delay"
          value={fmt(v4?.value_numeric, v4?.unit)}
          sublabel="Late deliveries only · AVG(GRN posting_date − expected_delivery_date)"
          size="lg"
          threshold={
            v4?.value_numeric != null && v4.value_numeric > 3
              ? { label: "> 3d target", tone: "danger" }
              : v4?.value_numeric != null
              ? { label: "Within target (≤ 3d)", tone: "success" }
              : undefined
          }
          index={3}
        />
      </div>

      {/* Row 2 — Variance, MSME, Spend */}
      <div className="grid grid-cols-4 gap-3 mt-3">
        <KpiCard
          label="Quantity Variance Rate"
          value={fmt(v5?.value_numeric, v5?.unit)}
          sublabel="Net GRN qty < PO order_qty · multiple GRNs netted for Db/Cr indicator"
          size="md"
          threshold={
            v5?.value_numeric != null && v5.value_numeric > 5
              ? { label: "> 5% target", tone: "danger" }
              : v5?.value_numeric != null
              ? { label: "Within target (< 5%)", tone: "success" }
              : undefined
          }
          index={4}
        />
        <KpiCard
          label="MSME Vendor Count"
          value={fmt(v9?.value_numeric, v9?.unit)}
          sublabel="msme_flag = M (Micro) or S (Small) · active vendors only"
          size="md"
          index={5}
        />
        <KpiCard
          label="Vendor Spend Analysis"
          value="See chart →"
          sublabel="Top-10 vendors by PO value · spend concentration risk"
          size="md"
          index={6}
        />
        <KpiCard
          label="Vendor Type Mix"
          value={breakdown.total ? `${breakdown.domestic ?? 0}D · ${breakdown.international ?? 0}I · ${breakdown.one_time ?? 0}OT` : isLoading ? "—" : "No data"}
          sublabel="Domestic · International · One-time vendors"
          size="md"
          index={7}
        />
      </div>
    </>
  );
}

function OTIFTrend() {
  const { data, isLoading } = useCharts("vendor");
  const raw = data?.series as unknown as { otif?: Array<{ month: string; otif_pct: number }> };
  const otifSeries = Array.isArray(data?.series) ? data.series : (raw?.otif ?? []);
  const chartData = otifSeries.map((p) => ({
    month: (p as { month?: string }).month ?? "",
    otif: ((p as { otif_pct?: number }).otif_pct) ?? 0,
  }));

  return (
    <SectionCard title="OTIF Rate Trend" subtitle="Monthly on-time in-full %">
      <div className="h-64">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
        ) : chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Upload GRN and delivery data to view trend</div>
        ) : (
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, "OTIF"]} />
              <Line type="monotone" dataKey="otif" stroke={brand.colors.success} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </SectionCard>
  );
}

function TopVendors() {
  const { data: kpiData, isLoading } = useKpi("vendor");
  const v6 = kpiData?.kpis.find((k) => k.kpi_code === "TOP_VENDOR_SPEND");

  let vendors: Array<{ vendor: string; name: string; spend: number; share_pct: number }> = [];
  if (v6?.value_text) {
    try {
      vendors = JSON.parse(v6.value_text).slice(0, 10);
    } catch {}
  }

  const barData = vendors.map((v) => ({ name: v.name ?? v.vendor, spend: v.spend / 1_00_00_000 }));

  return (
    <SectionCard title="Top-10 Vendors by Spend" subtitle="₹ Cr">
      <div className="h-64">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
        ) : barData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Upload PO data to view vendor spend</div>
        ) : (
          <ResponsiveContainer>
            <BarChart data={barData} layout="vertical" margin={{ top: 4, right: 32, left: 100, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
              <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v.toFixed(0)}Cr`} />
              <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={100} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => [`₹${v.toFixed(2)} Cr`, "Spend"]} />
              <Bar dataKey="spend" fill={brand.colors.primary} radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </SectionCard>
  );
}

function ComplianceDonut() {
  const { data, isLoading } = useCharts("vendor");
  const raw = data?.series as unknown as { type?: string; compliance?: { active: number; purchase_blocked: number; payment_blocked: number; deleted: number; total: number } };
  const comp = raw?.compliance;
  const pieData = comp ? [
    { name: "Active",           value: comp.active,           fill: brand.colors.success },
    { name: "Purchase Blocked", value: comp.purchase_blocked, fill: brand.colors.warning },
    { name: "Payment Blocked",  value: comp.payment_blocked,  fill: brand.colors.danger  },
    { name: "Deleted",          value: comp.deleted,          fill: "#999" },
  ].filter(d => d.value > 0) : [];

  return (
    <SectionCard title="Vendor Compliance Status" subtitle="All 5 block flags checked">
      <div className="h-64">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
        ) : !comp ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Upload vendor master</div>
        ) : (
          <div className="flex items-center h-full gap-4">
            <ResponsiveContainer width="55%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={48} outerRadius={80}
                  dataKey="value" paddingAngle={3}>
                  {pieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Pie>
                <Tooltip formatter={(v: number) => [`${v} vendors`]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-2.5">
              {pieData.map(d => (
                <div key={d.name} className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: d.fill }} />
                  <div>
                    <div className="text-[10px] text-muted-foreground">{d.name}</div>
                    <div className="text-[16px] font-semibold font-tabular">{d.value}</div>
                  </div>
                </div>
              ))}
              <div className="text-[10px] text-muted-foreground pt-1 border-t border-border">Total: {comp.total}</div>
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

function VendorTypeChart() {
  const { data, isLoading } = useCharts("vendor");
  const raw = data?.series as unknown as { type?: string; vendor_types?: Array<{ type: string; count: number }> };
  const types = raw?.vendor_types ?? [];
  const COLORS = [brand.colors.primary, brand.colors.teal, brand.colors.accent, "#470A68"];

  return (
    <SectionCard title="Vendor Type Breakdown" subtitle="Domestic / International / One-Time">
      <div className="h-64">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
        ) : types.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Upload vendor master</div>
        ) : (
          <ResponsiveContainer>
            <BarChart data={types} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
              <XAxis dataKey="type" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => [`${v} vendors`]} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {types.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </SectionCard>
  );
}
