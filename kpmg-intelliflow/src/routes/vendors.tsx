import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard } from "@/components/KpiCard";
import { SectionCard } from "@/components/SectionCard";
import { brand } from "@/lib/brand";
import { formatINR } from "@/lib/format";
import { useKpi, useKpiValue, useKpiCompanies, useCharts } from "@/hooks/useKpi";

export const Route = createFileRoute("/vendors")({
  head: () => ({
    meta: [
      { title: "Vendor Performance — KPMG IntelliSource" },
      { name: "description", content: "Vendor delivery, compliance, and spend concentration analytics." },
    ],
  }),
  component: VendorDashboard,
});

function CompanyFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data } = useKpiCompanies("vendor");
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

function VendorDashboard() {
  const [company, setCompany] = useState("ALL");

  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <PageHeader title="Vendor Performance" subtitle="Delivery, compliance, and spend concentration analytics" />
        <CompanyFilter value={company} onChange={setCompany} />
      </div>
      <VendorHealthStats company={company} />
      <KpiRow company={company} />
      <div className="grid grid-cols-2 gap-4 mt-4">
        <VendorDeliveryChart company={company} />
        <ComplianceDonut />
      </div>
      <div className="grid grid-cols-2 gap-4 mt-4">
        <TopVendors company={company} />
        <VendorTypeChart />
      </div>
    </AppShell>
  );
}

function KpiRow({ company }: { company: string }) {
  const { isLoading } = useKpi("vendor", company);
  const v1 = useKpiValue("vendor", "ACTIVE_VENDOR_COUNT",    company);
  const v2 = useKpiValue("vendor", "VENDOR_COMPLIANCE_RATE", company);
  const v3 = useKpiValue("vendor", "VENDOR_DELIVERY_DAYS",   company);
  const v4 = useKpiValue("vendor", "AVG_DELIVERY_DELAY",     company);
  const v7 = useKpiValue("vendor", "BLOCKED_VENDOR_COUNT",   company);
  const v8 = useKpiValue("vendor", "VENDOR_MASTER_CHANGES",  company);

  const fmt = (v: number | null | undefined, unit: string | null | undefined) => {
    if (v == null) return isLoading ? "—" : "No data";
    if (unit === "INR") return formatINR(v);
    if (unit === "%") return `${v.toFixed(1)}%`;
    if (unit === "days") return `${v.toFixed(1)}d`;
    return v.toFixed(0);
  };

  return (
    <>
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="Active Vendor Count" value={fmt(v1?.value_numeric, v1?.unit)} size="lg" sublabel="Not deleted, not purchasing-blocked" index={0} />
        <KpiCard label="Vendor Active Rate" value={fmt(v2?.value_numeric, v2?.unit)} size="lg" sublabel="Not blocked & not deleted ÷ total" threshold={v2?.value_numeric != null && v2.value_numeric < 90 ? { label: "Below 90%", tone: "warning" } : { label: "Good", tone: "success" }} index={1} />
        <KpiCard label="Avg Delivery Lead Time" value={fmt(v3?.value_numeric, v3?.unit)} size="lg" sublabel="Avg days: expected delivery → first GRN (−=early, +=late)" threshold={v3?.value_numeric != null && v3.value_numeric > 0 ? { label: "Late on avg", tone: "warning" } : { label: "On / early", tone: "success" }} index={2} />
        <KpiCard label="Avg Delivery Delay" value={fmt(v4?.value_numeric, v4?.unit)} size="lg" sublabel="Late deliveries only (days past expected)" index={3} />
      </div>
      <div className="grid grid-cols-3 gap-3 mt-3">
        <KpiCard label="Blocked Vendor Count" value={fmt(v7?.value_numeric, v7?.unit)} size="md" sublabel="central_purchasing_block or posting_block = X" threshold={v7?.value_numeric != null && v7.value_numeric > 0 ? { label: "Review required", tone: "danger" } : undefined} index={4} />
        <KpiCard label="Vendor Master Changes" value={fmt(v8?.value_numeric, v8?.unit)} size="md" sublabel="KRED object changes this month" index={5} />
        <KpiCard label="Top Vendor Spend" value="See chart →" size="md" sublabel="Top-10 by spend share" index={6} />
      </div>
    </>
  );
}

function VendorHealthStats({ company }: { company: string }) {
  const { data: kpiData, isLoading } = useKpi("vendor", company);
  const v2 = kpiData?.kpis.find((k) => k.kpi_code === "VENDOR_BREAKDOWN");

  const h = (() => {
    try { return v2?.value_text ? JSON.parse(v2.value_text) : null; } catch { return null; }
  })();

  const stats: Array<{ label: string; value: number; color: string }> = h ? [
    { label: "Active",        value: h.active,        color: "text-emerald-600" },
    { label: "Non-Active",    value: h.non_active,     color: "text-red-500"    },
    { label: "One-Time",      value: h.one_time,       color: "text-amber-500"  },
    { label: "Domestic",      value: h.domestic,       color: "text-blue-500"   },
    { label: "International", value: h.international,  color: "text-purple-500" },
    { label: "MSME",          value: h.msme,           color: "text-teal-600"   },
  ] : [];

  return (
    <SectionCard title="Vendor Health Breakdown" subtitle="Master data segmentation · 3-block compliance check">
      {isLoading ? (
        <div className="text-sm text-muted-foreground py-4">Loading…</div>
      ) : !h ? (
        <div className="text-sm text-muted-foreground py-4">Upload vendor master</div>
      ) : (
        <div className="flex items-center gap-6 py-2 flex-wrap">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-0.5 min-w-[72px]">
              <span className={`text-2xl font-bold font-tabular ${s.color}`}>{s.value}</span>
              <span className="text-[11px] text-muted-foreground font-medium">{s.label}</span>
            </div>
          ))}
          <div className="ml-auto pl-6 border-l border-border flex flex-col items-end gap-0.5">
            <span className="text-2xl font-bold font-tabular text-foreground">{h.total}</span>
            <span className="text-[11px] text-muted-foreground">Total Vendors</span>
          </div>
          {h.compliance_rate != null && (
            <div className="flex flex-col items-end gap-0.5">
              <span className={`text-2xl font-bold font-tabular ${h.compliance_rate >= 90 ? "text-emerald-600" : "text-amber-500"}`}>
                {h.compliance_rate.toFixed(1)}%
              </span>
              <span className="text-[11px] text-muted-foreground">Compliance Rate</span>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}

function VendorDeliveryChart({ company }: { company: string }) {
  const { data: kpiData, isLoading } = useKpi("vendor", company);
  const kpi = kpiData?.kpis.find((k) => k.kpi_code === "VENDOR_DELIVERY_DAYS");

  let vendors: Array<{ vendor: string; name: string; avg_days: number; po_lines: number }> = [];
  if (kpi?.value_text) {
    try { vendors = JSON.parse(kpi.value_text).slice(0, 15); } catch {}
  }

  const chartData = vendors.map((v) => ({
    name: v.name.length > 20 ? v.name.slice(0, 20) + "…" : v.name,
    avg_days: v.avg_days,
    po_lines: v.po_lines,
  }));

  return (
    <SectionCard title="Vendor Delivery Lead Time" subtitle="Avg days: expected delivery → first GRN (−=early, +=late)">
      <div className="h-64">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
        ) : chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Upload PO and GRN data to view</div>
        ) : (
          <ResponsiveContainer>
            <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 40, left: 110, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
              <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(v) => `${v > 0 ? "+" : ""}${v}d`} />
              <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={110} tick={{ fontSize: 10 }} />
              <Tooltip
                formatter={(v: number, _n, props) => [
                  `${v > 0 ? "+" : ""}${v}d · ${props.payload.po_lines} PO lines`,
                  "Avg Lead Time",
                ]}
              />
              <Bar dataKey="avg_days" radius={[0, 3, 3, 0]}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={d.avg_days > 0 ? brand.colors.warning : brand.colors.success} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </SectionCard>
  );
}

function TopVendors({ company }: { company: string }) {
  const { data: kpiData, isLoading } = useKpi("vendor", company);
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
              {pieData.map(d => {
                const pct = comp.total > 0 ? ((d.value / comp.total) * 100).toFixed(1) : "0.0";
                return (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: d.fill }} />
                    <div>
                      <div className="text-[10px] text-muted-foreground">{d.name}</div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[16px] font-semibold font-tabular">{d.value}</span>
                        <span className="text-[11px] text-muted-foreground font-tabular">{pct}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="text-[10px] text-muted-foreground pt-1 border-t border-border">Total: {comp.total} vendors</div>
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
  const ALL_TYPES = ["DOMESTIC", "INTERNATIONAL", "MSME", "ONE_TIME"];
  const typeMap = new Map((raw?.vendor_types ?? []).map(t => [t.type, t.count]));
  const types = ALL_TYPES.map(t => ({ type: t, count: typeMap.get(t) ?? 0 }));
  const COLORS = [brand.colors.primary, brand.colors.teal, brand.colors.accent, "#470A68"];

  return (
    <SectionCard title="Vendor Type Breakdown" subtitle="Domestic / International / One-Time">
      <div className="h-64">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
        ) : types.every(t => t.count === 0) ? (
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
