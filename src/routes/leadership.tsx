import { createFileRoute } from "@tanstack/react-router";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { ArrowRight, AlertCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard } from "@/components/KpiCard";
import { SectionCard } from "@/components/SectionCard";
import { StatusPill } from "@/components/StatusPill";
import { ProgressBar } from "@/components/ProgressBar";
import { formatINR, formatPercent } from "@/lib/format";
import { financialHistory, projects, spendByCategory, topVendorsBySpend, complianceChecks } from "@/data/mock";
import { brand, chartPalette } from "@/lib/brand";

export const Route = createFileRoute("/leadership")({
  head: () => ({
    meta: [
      { title: "Leadership Dashboard — KPMG IntelliSource" },
      { name: "description", content: "Strategic portfolio-level procurement view for executives." },
    ],
  }),
  component: LeadershipDashboard,
});

function LeadershipDashboard() {
  return (
    <AppShell>
      <PageHeader title="Leadership Dashboard" subtitle="Strategic portfolio view · 30-second scan" />

      <div className="grid grid-cols-4 gap-3">
        <KpiCard
          label="Portfolio Gross Margin"
          value="27.4%"
          delta={{ text: "↑ 2.1 pp", positive: true }}
          size="xl"
          sublabel="Target: >25%"
          threshold={{ label: "Above target", tone: "success" }}
          sparkline={
            <ResponsiveContainer>
              <AreaChart data={financialHistory.slice(-12)}>
                <Area type="monotone" dataKey="margin" stroke={brand.colors.success} fill={brand.colors.success} fillOpacity={0.12} strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          }
        />
        <KpiCard label="Total Procurement (YTD)" value="₹128 Cr" delta={{ text: "↑ 8.3% YoY", positive: true }} size="xl" sublabel="Committed PO value" />
        <KpiCard
          label="Strategic Risk Index"
          value={<span className="text-warning">Medium</span>}
          size="xl"
          sublabel="Vendor concentration + compliance + anomalies"
          rightSlot={<StatusPill tone="warning" dot>Watch</StatusPill>}
        />
        <KpiCard
          label="Cost Savings (YTD)"
          value="₹14.2 Cr"
          size="xl"
          sublabel={<>Target ₹18 Cr · 79% achieved</>}
          rightSlot={<div className="w-16"><ProgressBar value={79} tone="success" /></div>}
        />
      </div>

      <div className="grid grid-cols-4 gap-3 mt-3">
        <KpiCard label="Vendor Concentration (Top 3)" value="38.2%" size="md" sublabel="Target: <40%" threshold={{ label: "Near limit", tone: "warning" }} />
        <KpiCard label="Maverick PO Rate" value="4.1%" size="md" sublabel="POs without upstream PR" threshold={{ label: "< 5% target", tone: "success" }} />
        <KpiCard label="E2E P2P Cycle Time" value="42d" size="md" sublabel="PR → Payment avg" threshold={{ label: "Target: ≤45d", tone: "success" }} />
        <KpiCard label="Procurement ROI" value="3.4x" size="md" sublabel="Savings / function cost" threshold={{ label: "> 3x target", tone: "success" }} />
      </div>

      <div className="grid grid-cols-5 gap-4 mt-4">
        <div className="col-span-3"><PortfolioGMTrend /></div>
        <div className="col-span-2"><TopProjectsByMargin /></div>
      </div>

      <div className="grid grid-cols-3 gap-4 mt-4">
        <ComplianceHealthRing />
        <SpendByCategory />
        <TopVendors />
      </div>

      <div className="mt-4"><BottomRibbon /></div>
      <div className="mt-4"><NeedsAttention /></div>
    </AppShell>
  );
}

function PortfolioGMTrend() {
  const data = financialHistory.slice(-12);
  return (
    <SectionCard title="Portfolio Gross Margin Trend" subtitle="12 months">
      <div className="h-64">
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
            <defs>
              <linearGradient id="gmFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={brand.colors.primary} stopOpacity={0.2} />
                <stop offset="100%" stopColor={brand.colors.primary} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
            <XAxis dataKey="period" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} domain={[18, 32]} />
            <Tooltip formatter={(v: number) => [`${v}%`, "Margin"]} />
            <ReferenceLine y={25} stroke={brand.colors.warning} strokeDasharray="4 4" label={{ value: "Target", fill: brand.colors.warning, fontSize: 10, position: "right" }} />
            <Area type="monotone" dataKey="margin" stroke={brand.colors.primary} strokeWidth={2} fill="url(#gmFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}

function TopProjectsByMargin() {
  const top = [...projects].sort((a, b) => b.gmPercent - a.gmPercent).slice(0, 5);
  return (
    <SectionCard title="Top 5 Projects by Margin">
      <ul className="space-y-3">
        {top.map((p) => (
          <li key={p.id}>
            <div className="flex items-baseline justify-between text-[12px] mb-1">
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{p.name}</div>
                <div className="text-muted-foreground text-[10px] truncate">{p.client}</div>
              </div>
              <span className="font-tabular font-semibold text-success ml-2">{formatPercent(p.gmPercent)}</span>
            </div>
            <ProgressBar value={p.gmPercent} max={50} tone={p.gmPercent >= 30 ? "success" : p.gmPercent >= 15 ? "warning" : "danger"} />
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function ComplianceHealthRing() {
  const pass = complianceChecks.filter((c) => c.status === "Pass").length;
  const fail = complianceChecks.filter((c) => c.status === "Fail").length;
  const pending = complianceChecks.filter((c) => c.status === "Pending").length;
  const total = pass + fail + pending;
  const pct = (pass / total) * 100;
  const data = [
    { name: "Pass", value: pass, color: brand.colors.success },
    { name: "Fail", value: fail, color: brand.colors.danger },
    { name: "Pending", value: pending, color: brand.colors.warning },
  ];

  return (
    <SectionCard title="Compliance Health" subtitle={`${total} checks YTD`}>
      <div className="flex items-center gap-4">
        <div className="relative w-28 h-28 shrink-0">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={data} dataKey="value" innerRadius={38} outerRadius={52} paddingAngle={2}>
                {data.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-xl font-semibold font-tabular text-success">{pct.toFixed(0)}%</div>
            <div className="text-[9px] text-muted-foreground">pass</div>
          </div>
        </div>
        <ul className="flex-1 text-[11px] space-y-1.5">
          {data.map((d) => (
            <li key={d.name} className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm" style={{ background: d.color }} />
                {d.name}
              </span>
              <span className="font-medium font-tabular">{d.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </SectionCard>
  );
}

function SpendByCategory() {
  const data = spendByCategory.map((s, i) => ({ ...s, color: chartPalette[i % chartPalette.length] }));
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <SectionCard title="Spend by Category" subtitle="YTD">
      <div className="h-40">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={35} outerRadius={60} paddingAngle={2}>
              {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
            <Tooltip formatter={(v: number) => formatINR(v)} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="text-[10px] space-y-1 mt-1">
        {data.map((d) => (
          <li key={d.name} className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 truncate">
              <span className="h-1.5 w-1.5 rounded-sm shrink-0" style={{ background: d.color }} />
              {d.name}
            </span>
            <span className="font-tabular">{((d.value / total) * 100).toFixed(0)}%</span>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function TopVendors() {
  const total = topVendorsBySpend.reduce((s, v) => s + v.spendYTD, 0);
  return (
    <SectionCard title="Top 10 Vendors" subtitle="By spend YTD">
      <div className="h-64">
        <ResponsiveContainer>
          <BarChart data={topVendorsBySpend.map((v) => ({ name: v.name, spend: v.spendYTD }))} layout="vertical" margin={{ top: 4, right: 16, left: 80, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
            <XAxis type="number" hide />
            <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} fontSize={10} width={80} />
            <Tooltip formatter={(v: number) => [`${formatINR(v)} · ${((v / total) * 100).toFixed(1)}%`, "Spend"]} />
            <Bar dataKey="spend" fill={brand.colors.primary} radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}

function BottomRibbon() {
  const items = [
    { label: "Vendors Onboarded", value: "47" },
    { label: "Contracts Signed", value: "32" },
    { label: "Avg Contract Cycle", value: "18d" },
    { label: "Active RFPs", value: "12" },
    { label: "PO→Payment Cycle", value: "42d" },
    { label: "Pending Approvals", value: "18" },
  ];
  return (
    <div className="bg-surface border border-border rounded-lg p-3.5 grid grid-cols-6 divide-x divide-border">
      {items.map((i) => (
        <div key={i.label} className="px-3 first:pl-0 last:pr-0">
          <div className="text-[9px] uppercase tracking-[0.06em] text-muted-foreground font-medium">{i.label}</div>
          <div className="text-xl font-semibold font-tabular mt-0.5">{i.value}</div>
        </div>
      ))}
    </div>
  );
}

function NeedsAttention() {
  const items = [
    { title: "Wipro contract renewal — decision needed", date: "Decision by 15-May", severity: "warning" as const },
    { title: "Q1 compliance audit: 4 high-severity findings", date: "Submitted 2 days ago", severity: "critical" as const },
    { title: "3 projects showing margin erosion >5%", date: "PRJ-2024000, PRJ-2024003, PRJ-2024007", severity: "warning" as const },
    { title: "Splunk vendor delisting recommendation", date: "Awaiting CXO sign-off", severity: "critical" as const },
  ];
  return (
    <SectionCard title="Needs Your Attention" subtitle="Items requiring leadership action" accent="warning">
      <ul className="divide-y divide-border">
        {items.map((it, i) => (
          <li key={i} className="py-2.5 first:pt-0 last:pb-0 flex items-center gap-2.5">
            <AlertCircle className={`h-3.5 w-3.5 shrink-0 ${it.severity === "critical" ? "text-danger" : "text-warning"}`} />
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-medium">{it.title}</div>
              <div className="text-[10px] text-muted-foreground">{it.date}</div>
            </div>
            <button className="text-[10px] text-accent font-medium flex items-center gap-0.5 hover:underline">
              Review <ArrowRight className="h-3 w-3" />
            </button>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
