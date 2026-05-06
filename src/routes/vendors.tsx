import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
  ComposedChart,
  Line,
} from "recharts";
import { ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard } from "@/components/KpiCard";
import { SectionCard } from "@/components/SectionCard";
import { StatusPill } from "@/components/StatusPill";
import { ProgressBar } from "@/components/ProgressBar";
import { formatINR } from "@/lib/format";
import { vendors, totalActiveVendors } from "@/data/mock";
import { brand } from "@/lib/brand";
import { roleInitials } from "@/context/AppContext";

export const Route = createFileRoute("/vendors")({
  head: () => ({
    meta: [
      { title: "Vendor Performance — KPMG IntelliSource" },
      { name: "description", content: "Vendor scorecards, compliance, delivery performance and risk." },
    ],
  }),
  component: VendorPerformance,
});

function VendorPerformance() {
  const compliant = vendors.filter((v) => v.compliance === "Compliant").length;
  const complianceRate = ((compliant / vendors.length) * 100).toFixed(1);
  const blocked = vendors.filter((v) => v.compliance === "Non-Compliant").length;
  const avgOTIF = (vendors.reduce((s, v) => s + v.otifRate, 0) / vendors.length).toFixed(1);
  const avgDelay = (vendors.reduce((s, v) => s + v.responsivenessDays, 0) / vendors.length).toFixed(1);

  return (
    <AppShell>
      <PageHeader title="Vendor Performance Dashboard" subtitle="Assess vendor performance, compliance, and concentration risk" />

      {/* KPI 04-Vendor: 8 KPIs */}
      <div className="grid grid-cols-4 gap-3">
        {/* KPI 1: Total Active Vendors */}
        <KpiCard label="Total Active Vendors" value={totalActiveVendors} size="lg" sublabel="deletion_flag ≠ X, not blocked" index={0} />
        {/* KPI 2: Compliance Pass Rate */}
        <KpiCard label="Compliance Pass Rate" value={`${complianceRate}%`} size="lg" sublabel={`${compliant} of ${vendors.length} compliant`} threshold={parseFloat(complianceRate) > 95 ? { label: "> 95% target", tone: "success" } : { label: "Below 95%", tone: "warning" }} index={1} />
        {/* KPI 3: On-Time Delivery Rate (OTIF) */}
        <KpiCard label="On-Time Delivery Rate (OTIF)" value={`${avgOTIF}%`} size="lg" sublabel="GRN ≤ expected delivery date" threshold={parseFloat(avgOTIF) > 90 ? { label: "> 90% target", tone: "success" } : { label: "Below target", tone: "warning" }} index={2} />
        {/* KPI 4: Average Delivery Delay */}
        <KpiCard label="Avg Delivery Delay" value={`${avgDelay}d`} size="lg" sublabel="Late deliveries only · Target: ≤ 3d" threshold={parseFloat(avgDelay) <= 3 ? { label: "≤ 3d target", tone: "success" } : { label: "Above target", tone: "danger" }} index={3} />
      </div>

      <div className="grid grid-cols-4 gap-3 mt-3">
        {/* KPI 5: Quantity Variance Rate */}
        <KpiCard label="Quantity Variance Rate" value="3.8%" size="md" sublabel="Short supply vs PO · Target: < 5%" threshold={{ label: "< 5% target", tone: "success" }} index={4} />
        {/* KPI 6: Vendor Spend Share % */}
        <KpiCard label="Top Vendor Spend Share" value="18.4%" size="md" sublabel="Highest single vendor · Target: < 20%" threshold={{ label: "< 20% target", tone: "success" }} index={5} />
        {/* KPI 7: Payment Block Vendors */}
        <KpiCard label="Payment Block Vendors" value={blocked} size="md" sublabel="payment_block = * or posting_block" threshold={blocked > 5 ? { label: "Investigate each", tone: "danger" } : { label: "≤ 5 limit", tone: "info" }} index={6} />
        {/* KPI 8: Vendor Master Change Frequency */}
        <KpiCard label="Vendor Master Change Freq." value="28" size="md" sublabel="object_class = KRED this month" threshold={{ label: "< 3/vendor/mo", tone: "info" }} index={7} />
      </div>

      {/* Drill-downs */}
      <div className="grid grid-cols-2 gap-4 mt-4">
        <RatingHistogram />
        <ComplianceStatusPie />
      </div>

      <div className="mt-4"><ScorecardTable /></div>

      <div className="grid grid-cols-2 gap-4 mt-4">
        <SpendConcentration />
        <PerformanceTrend />
      </div>
    </AppShell>
  );
}

function RatingHistogram() {
  const buckets = [
    { range: "1.0–1.9", count: 0 },
    { range: "2.0–2.9", count: 0 },
    { range: "3.0–3.9", count: 0 },
    { range: "4.0–4.4", count: 0 },
    { range: "4.5–5.0", count: 0 },
  ];
  vendors.forEach((v) => {
    if (v.rating < 2) buckets[0].count++;
    else if (v.rating < 3) buckets[1].count++;
    else if (v.rating < 4) buckets[2].count++;
    else if (v.rating < 4.5) buckets[3].count++;
    else buckets[4].count++;
  });
  return (
    <SectionCard title="Vendor Rating Distribution" subtitle={`${vendors.length} vendors`}>
      <div className="h-56">
        <ResponsiveContainer>
          <BarChart data={buckets}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
            <XAxis dataKey="range" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} />
            <Tooltip />
            <Bar dataKey="count" fill={brand.colors.primary} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}

function ComplianceStatusPie() {
  const data = [
    { name: "Compliant", value: vendors.filter((v) => v.compliance === "Compliant").length, color: brand.colors.success },
    { name: "Under Review", value: vendors.filter((v) => v.compliance === "Under Review").length, color: brand.colors.warning },
    { name: "Non-Compliant", value: vendors.filter((v) => v.compliance === "Non-Compliant").length, color: brand.colors.danger },
  ];
  return (
    <SectionCard title="Compliance Status" subtitle="Blocked vs unblocked from 08_Vendor_Master">
      <div className="h-56">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" outerRadius={80} label={(e) => `${e.value}`} labelLine={false}>
              {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} iconType="square" />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}

function ScorecardTable() {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"spend" | "rating">("spend");

  const rows = useMemo(() => {
    let r = [...vendors];
    if (search) r = r.filter((v) => v.name.toLowerCase().includes(search.toLowerCase()));
    r.sort((a, b) => (sort === "spend" ? b.spendYTD - a.spendYTD : b.rating - a.rating));
    return r.slice(0, 20);
  }, [search, sort]);

  return (
    <SectionCard
      title="Vendor Scorecard"
      subtitle="KPIs 3, 4, 5, 6, 7 per vendor"
      bodyClassName="p-0"
      actions={
        <div className="flex gap-2">
          <input type="search" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="h-7 px-2.5 rounded-md border border-border text-[11px] bg-background w-36 focus:border-accent focus:outline-none" />
          {(["spend", "rating"] as const).map((s) => (
            <button key={s} onClick={() => setSort(s)}
              className={`text-[10px] px-2 py-1 rounded-md border transition-colors capitalize ${sort === s ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-accent/50"}`}
            >{s}</button>
          ))}
        </div>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead className="bg-secondary/50 text-muted-foreground">
            <tr className="text-left">
              <th className="px-4 py-2 font-medium">Vendor</th>
              <th className="px-4 py-2 font-medium">Category</th>
              <th className="px-4 py-2 font-medium">Rating</th>
              <th className="px-4 py-2 font-medium w-24">Delivery</th>
              <th className="px-4 py-2 font-medium">Compliance</th>
              <th className="px-4 py-2 font-medium text-right">Active POs</th>
              <th className="px-4 py-2 font-medium text-right">Spend YTD</th>
              <th className="px-4 py-2 font-medium">Contract</th>
              <th className="px-4 py-2 font-medium">Risk</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((v) => (
              <tr key={v.id} className="hover:bg-secondary/30 transition-colors">
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center shrink-0">
                      {roleInitials(v.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate text-[11px]">{v.name}</div>
                      <div className="text-[9px] text-muted-foreground font-mono">{v.code}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2"><StatusPill tone="info">{v.category}</StatusPill></td>
                <td className="px-4 py-2 font-tabular font-medium">{v.rating.toFixed(1)}</td>
                <td className="px-4 py-2"><ProgressBar value={v.deliveryScore} tone={v.deliveryScore >= 85 ? "success" : v.deliveryScore >= 70 ? "warning" : "danger"} /></td>
                <td className="px-4 py-2">
                  {v.compliance === "Compliant" && <ShieldCheck className="h-3.5 w-3.5 text-success" />}
                  {v.compliance === "Under Review" && <ShieldAlert className="h-3.5 w-3.5 text-warning" />}
                  {v.compliance === "Non-Compliant" && <ShieldX className="h-3.5 w-3.5 text-danger" />}
                </td>
                <td className="px-4 py-2 text-right font-tabular">{v.activePOs}</td>
                <td className="px-4 py-2 text-right font-tabular font-medium">{formatINR(v.spendYTD)}</td>
                <td className="px-4 py-2">
                  <StatusPill tone={v.contractStatus === "Active" ? "success" : v.contractStatus === "Expiring Soon" ? "warning" : "danger"}>{v.contractStatus}</StatusPill>
                </td>
                <td className="px-4 py-2">
                  <StatusPill tone={v.riskTier === "Low" ? "success" : v.riskTier === "Medium" ? "warning" : "danger"} dot>{v.riskTier}</StatusPill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

function SpendConcentration() {
  const sorted = [...vendors].sort((a, b) => b.spendYTD - a.spendYTD).slice(0, 10);
  const total = vendors.reduce((s, v) => s + v.spendYTD, 0);
  return (
    <SectionCard title="Vendor Spend Concentration" subtitle="KPI 6 — Top 10 by spend share">
      <div className="h-56">
        <ResponsiveContainer>
          <BarChart data={sorted.map((v) => ({ name: v.name, pct: (v.spendYTD / total) * 100 }))} layout="vertical" margin={{ top: 4, right: 40, left: 80, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
            <XAxis type="number" tickFormatter={(v) => `${v.toFixed(0)}%`} tickLine={false} axisLine={false} />
            <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} fontSize={10} width={80} />
            <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
            <Bar dataKey="pct" fill={brand.colors.primary} radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}

function PerformanceTrend() {
  const data = ["Q3-22", "Q4-22", "Q1-23", "Q2-23", "Q3-23", "Q4-23"].map((q, i) => ({
    quarter: q,
    rating: 3.6 + i * 0.08,
    compliance: 78 + i * 1.5,
  }));
  return (
    <SectionCard title="Performance Trend" subtitle="Last 6 quarters">
      <div className="h-56">
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
            <XAxis dataKey="quarter" tickLine={false} axisLine={false} />
            <YAxis yAxisId="left" tickLine={false} axisLine={false} domain={[3, 5]} tickFormatter={(v) => v.toFixed(1)} />
            <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} iconType="line" />
            <Line yAxisId="left" type="monotone" dataKey="rating" stroke={brand.colors.primary} strokeWidth={2} name="Avg Rating" />
            <Line yAxisId="right" type="monotone" dataKey="compliance" stroke={brand.colors.success} strokeWidth={2} name="Compliance %" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}
