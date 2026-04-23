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
      { name: "description", content: "Strategic, portfolio-level procurement view for executives." },
    ],
  }),
  component: LeadershipDashboard,
});

function LeadershipDashboard() {
  return (
    <AppShell>
      <PageHeader
        title="Leadership Dashboard"
        subtitle="Strategic portfolio view · Designed for 30-second scans"
      />

      {/* Hero KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <KpiCard label="Portfolio Gross Margin" value="27.4%" delta={{ text: "↑ 2.1 pp", positive: true }} size="xl" sublabel="vs Q1 FY24"
          sparkline={
            <ResponsiveContainer>
              <AreaChart data={financialHistory.slice(-12)}>
                <Area type="monotone" dataKey="margin" stroke={brand.colors.success} fill={brand.colors.success} fillOpacity={0.18} strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          }
        />
        <KpiCard label="Total Procurement Value" value="₹128 Cr" delta={{ text: "↑ 8.3% YoY", positive: true }} size="xl" sublabel="FY24 to date" />
        <KpiCard
          label="Strategic Risk Index"
          value={<span className="text-warning">Medium</span>}
          size="xl"
          sublabel="2 high-risk vendors under review"
          rightSlot={<StatusPill tone="warning" dot>Watch</StatusPill>}
        />
        <KpiCard
          label="Cost Savings (YTD)"
          value="₹14.2 Cr"
          size="xl"
          sublabel={
            <>
              Target <span className="font-semibold">₹18 Cr</span> · 79% achieved
            </>
          }
          rightSlot={<div className="w-20"><ProgressBar value={79} tone="success" /></div>}
        />
      </div>

      <div className="grid grid-cols-5 gap-4 mt-4">
        <div className="col-span-3">
          <PortfolioGMTrend />
        </div>
        <div className="col-span-2">
          <TopProjectsByMargin />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mt-4">
        <ComplianceHealthRing />
        <SpendByCategory />
        <TopVendors />
      </div>

      <div className="mt-4">
        <BottomRibbon />
      </div>

      <div className="mt-4">
        <NeedsAttention />
      </div>
    </AppShell>
  );
}

function PortfolioGMTrend() {
  const data = financialHistory.slice(-12);
  return (
    <SectionCard title="Portfolio Gross Margin Trend" subtitle="12 months · Initiative launches overlaid">
      <div className="h-72">
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
            <defs>
              <linearGradient id="gmFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={brand.colors.primary} stopOpacity={0.35} />
                <stop offset="100%" stopColor={brand.colors.primary} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E8" vertical={false} />
            <XAxis dataKey="period" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} domain={[18, 32]} />
            <Tooltip formatter={(v: number) => [`${v}%`, "Margin"]} />
            <ReferenceLine x={data[3]?.period} stroke={brand.colors.warning} strokeDasharray="4 4" label={{ value: "Vendor Consol.", fontSize: 10, fill: brand.colors.warning, position: "top" }} />
            <ReferenceLine x={data[8]?.period} stroke={brand.colors.teal} strokeDasharray="4 4" label={{ value: "Cloud Repricing", fontSize: 10, fill: brand.colors.teal, position: "top" }} />
            <Area type="monotone" dataKey="margin" stroke={brand.colors.primary} strokeWidth={2.5} fill="url(#gmFill)" />
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
                <div className="font-semibold truncate">{p.name}</div>
                <div className="text-muted-foreground text-[11px] truncate">{p.client}</div>
              </div>
              <span className="font-tabular font-bold text-success ml-2">{formatPercent(p.gmPercent)}</span>
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
  const recent = complianceChecks.filter((c) => c.status === "Fail").slice(0, 3);

  return (
    <SectionCard title="Compliance Health" subtitle={`${total} checks YTD`}>
      <div className="flex items-center gap-4">
        <div className="relative w-32 h-32 shrink-0">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={data} dataKey="value" innerRadius={42} outerRadius={60} paddingAngle={2}>
                {data.map((d, i) => (<Cell key={i} fill={d.color} />))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-2xl font-bold font-tabular text-success">{pct.toFixed(0)}%</div>
            <div className="text-[9px] text-muted-foreground uppercase tracking-wider">pass</div>
          </div>
        </div>
        <ul className="flex-1 text-[11px] space-y-1.5">
          {data.map((d) => (
            <li key={d.name} className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm" style={{ background: d.color }} />
                {d.name}
              </span>
              <span className="font-semibold font-tabular">{d.value}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-3 pt-3 border-t border-border space-y-1.5">
        {recent.map((c) => (
          <div key={c.id} className="flex items-center justify-between text-[11px]">
            <span className="truncate flex-1 text-muted-foreground">{c.vendorName} · {c.type}</span>
            <StatusPill tone="danger">{c.severity}</StatusPill>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function SpendByCategory() {
  const data = spendByCategory.map((s, i) => ({ ...s, color: chartPalette[i % chartPalette.length] }));
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <SectionCard title="Spend by Category" subtitle="YTD · ₹">
      <div className="h-44">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={40} outerRadius={70} paddingAngle={2}>
              {data.map((d, i) => (<Cell key={i} fill={d.color} />))}
            </Pie>
            <Tooltip formatter={(v: number) => formatINR(v)} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="text-[11px] space-y-1 mt-2">
        {data.map((d) => (
          <li key={d.name} className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 truncate">
              <span className="h-2 w-2 rounded-sm shrink-0" style={{ background: d.color }} />
              {d.name}
            </span>
            <span className="font-tabular">{formatINR(d.value)} · {((d.value / total) * 100).toFixed(0)}%</span>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function TopVendors() {
  const total = topVendorsBySpend.reduce((s, v) => s + v.spendYTD, 0);
  return (
    <SectionCard title="Top 10 Vendors by Spend" subtitle="YTD">
      <div className="h-72">
        <ResponsiveContainer>
          <BarChart data={topVendorsBySpend.map((v) => ({ name: v.name, spend: v.spendYTD }))} layout="vertical" margin={{ top: 4, right: 16, left: 90, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E8" horizontal={false} />
            <XAxis type="number" hide />
            <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} fontSize={10} width={90} />
            <Tooltip formatter={(v: number) => [`${formatINR(v)} · ${((v / total) * 100).toFixed(1)}%`, "Spend"]} />
            <Bar dataKey="spend" fill={brand.colors.primary} radius={[0, 2, 2, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}

function BottomRibbon() {
  const items = [
    { label: "Vendors Onboarded (YTD)", value: "47" },
    { label: "Contracts Signed (YTD)", value: "32" },
    { label: "Avg Contract Cycle Time", value: "18d" },
    { label: "Active RFPs", value: "12" },
    { label: "PO-to-Payment Cycle", value: "42d" },
    { label: "Pending Approvals", value: "18" },
  ];
  return (
    <div className="bg-secondary border border-border rounded-md p-4 grid grid-cols-6 divide-x divide-border">
      {items.map((i) => (
        <div key={i.label} className="px-4 first:pl-0 last:pr-0">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{i.label}</div>
          <div className="text-2xl font-bold font-tabular mt-1">{i.value}</div>
        </div>
      ))}
    </div>
  );
}

function NeedsAttention() {
  const items = [
    { title: "Wipro contract renewal — decision needed", date: "Decision by 15-May-2024", severity: "warning" as const },
    { title: "Q1 compliance audit findings ready for review", date: "Submitted 2 days ago · 4 high-severity items", severity: "critical" as const },
    { title: "Top 3 projects showing margin erosion > 5%", date: "PRJ-2024000, PRJ-2024003, PRJ-2024007", severity: "warning" as const },
    { title: "Splunk vendor delisting recommendation", date: "Compliance flagged · awaiting CXO sign-off", severity: "critical" as const },
  ];
  return (
    <SectionCard title="Needs Your Attention" subtitle="Items requiring leadership awareness or sign-off" accent="warning">
      <ul className="divide-y divide-border">
        {items.map((it, i) => (
          <li key={i} className="py-3 first:pt-0 last:pb-0 flex items-center gap-3">
            <AlertCircle className={`h-4 w-4 shrink-0 ${it.severity === "critical" ? "text-danger" : "text-warning"}`} />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold">{it.title}</div>
              <div className="text-[11px] text-muted-foreground">{it.date}</div>
            </div>
            <button className="text-[11px] text-accent font-semibold flex items-center gap-1 hover:underline">
              Review <ArrowRight className="h-3 w-3" />
            </button>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
