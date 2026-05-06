import { createFileRoute } from "@tanstack/react-router";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  AreaChart,
  Area,
  Legend,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard } from "@/components/KpiCard";
import { SectionCard } from "@/components/SectionCard";
import { StatusPill } from "@/components/StatusPill";
import { formatINR, formatDateShort } from "@/lib/format";
import { utilization } from "@/data/mock";
import { brand } from "@/lib/brand";

export const Route = createFileRoute("/utilization")({
  head: () => ({
    meta: [
      { title: "Utilization Dashboard — KPMG IntelliSource" },
      { name: "description", content: "Tool & infrastructure utilization, optimization opportunities." },
    ],
  }),
  component: UtilizationDashboard,
});

function UtilizationDashboard() {
  const totalLicenses = utilization.reduce((s, u) => s + u.licensesOwned, 0);
  const activeUsers = utilization.reduce((s, u) => s + u.activeUsers, 0);
  const monthlyCost = utilization.reduce((s, u) => s + u.monthlyCost, 0);
  const savings = utilization.reduce((s, u) => s + u.potentialSavings, 0);
  const utilPct = (activeUsers / totalLicenses) * 100;
  const underutil = utilization.filter((u) => u.optimizationFlag === "Underutilized").length;
  const renewals = utilization.filter((u) => {
    const days = Math.ceil((+new Date(u.renewalDate) - Date.now()) / 86400000);
    return days > 0 && days <= 60;
  }).length;

  return (
    <AppShell>
      <PageHeader title="Utilization Dashboard" subtitle="Optimize tool & infrastructure utilization" />

      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Total IT/Tool Spend (YTD)" value={formatINR(monthlyCost * 12)} size="lg" delta={{ text: "↑ 4.2%", positive: false }} sublabel="Annual projected from monthly" />
        <KpiCard label="License Utilization Rate" value={`${utilPct.toFixed(1)}%`} size="lg" sublabel={`${activeUsers.toLocaleString("en-IN")} active of ${totalLicenses.toLocaleString("en-IN")} owned`} threshold={utilPct > 80 ? { label: ">80% target", tone: "success" } : { label: "Below 80%", tone: "warning" }} />
        <KpiCard label="Potential Savings" value={`${formatINR(savings)}/mo`} size="lg" sublabel={`${underutil} underutilized tools identified`} threshold={{ label: "Optimize →", tone: "info" }} />
      </div>

      <div className="grid grid-cols-3 gap-3 mt-3">
        <KpiCard label="Underutilized Licenses" value={underutil} size="md" sublabel="Tools with <50% utilization" threshold={underutil > 5 ? { label: "Review needed", tone: "danger" } : { label: "Within limit", tone: "success" }} />
        <KpiCard label="Upcoming Renewals (60d)" value={renewals} size="md" sublabel="Contracts renewing soon" threshold={{ label: "Track", tone: "warning" }} />
        <KpiCard label="Avg Cost/Active User" value={`₹${Math.round(monthlyCost / activeUsers).toLocaleString("en-IN")}`} size="md" sublabel="Monthly per active user" />
      </div>

      <div className="grid grid-cols-5 gap-4 mt-4">
        <div className="col-span-3"><UtilByTool /></div>
        <div className="col-span-2"><MonthlyTrend /></div>
      </div>

      <div className="mt-4"><OptimizationTable /></div>
    </AppShell>
  );
}

function UtilByTool() {
  const data = [...utilization].sort((a, b) => b.monthlyCost - a.monthlyCost).slice(0, 12).map((u) => ({ name: u.toolName, pct: u.utilPercent }));
  return (
    <SectionCard title="Utilization by Tool" subtitle="Top 12 by cost">
      <div className="h-80">
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 50, left: 90, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} />
            <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={90} fontSize={11} />
            <Tooltip formatter={(v: number) => `${v}%`} />
            <Bar dataKey="pct" radius={[0, 3, 3, 0]}>
              {data.map((d, i) => <Cell key={i} fill={d.pct >= 80 ? brand.colors.success : d.pct >= 50 ? brand.colors.warning : brand.colors.danger} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}

function MonthlyTrend() {
  const months = ["May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr"];
  const data = months.map((m, i) => ({ month: m, SaaS: 32 + (i % 3), Compute: 24 + i * 0.6, Security: 9 + i * 0.3 }));
  return (
    <SectionCard title="Monthly Spend Trend" subtitle="₹ Lakh · Last 12 months">
      <div className="h-80">
        <ResponsiveContainer>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}L`} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} iconType="square" />
            <Area type="monotone" dataKey="SaaS" stackId="1" fill={brand.colors.accent} stroke={brand.colors.accent} fillOpacity={0.6} />
            <Area type="monotone" dataKey="Compute" stackId="1" fill={brand.colors.primary} stroke={brand.colors.primary} fillOpacity={0.6} />
            <Area type="monotone" dataKey="Security" stackId="1" fill={brand.colors.teal} stroke={brand.colors.teal} fillOpacity={0.6} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}

function OptimizationTable() {
  const rows = [...utilization].sort((a, b) => b.potentialSavings - a.potentialSavings);
  return (
    <SectionCard title="License Optimization" subtitle="Sorted by potential savings" bodyClassName="p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead className="bg-secondary/50 text-muted-foreground">
            <tr className="text-left">
              <th className="px-4 py-2 font-medium">Tool</th>
              <th className="px-4 py-2 font-medium">Vendor</th>
              <th className="px-4 py-2 font-medium text-right">Owned</th>
              <th className="px-4 py-2 font-medium text-right">Active</th>
              <th className="px-4 py-2 font-medium text-right">Util %</th>
              <th className="px-4 py-2 font-medium text-right">Monthly Cost</th>
              <th className="px-4 py-2 font-medium">Renewal</th>
              <th className="px-4 py-2 font-medium">Flag</th>
              <th className="px-4 py-2 font-medium text-right">Savings</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((u) => (
              <tr key={u.id} className="hover:bg-secondary/30 transition-colors">
                <td className="px-4 py-2 font-medium">{u.toolName}</td>
                <td className="px-4 py-2 text-muted-foreground">{u.vendor}</td>
                <td className="px-4 py-2 text-right font-tabular">{u.licensesOwned.toLocaleString("en-IN")}</td>
                <td className="px-4 py-2 text-right font-tabular">{u.activeUsers.toLocaleString("en-IN")}</td>
                <td className={`px-4 py-2 text-right font-tabular font-medium ${u.utilPercent >= 80 ? "text-success" : u.utilPercent >= 50 ? "text-warning" : "text-danger"}`}>{u.utilPercent}%</td>
                <td className="px-4 py-2 text-right font-tabular">{formatINR(u.monthlyCost)}</td>
                <td className="px-4 py-2 text-muted-foreground text-[11px]">{formatDateShort(u.renewalDate)}</td>
                <td className="px-4 py-2">
                  <StatusPill tone={u.optimizationFlag === "Optimal" ? "success" : u.optimizationFlag === "Over-provisioned" ? "warning" : "danger"} dot>{u.optimizationFlag}</StatusPill>
                </td>
                <td className={`px-4 py-2 text-right font-tabular font-medium ${u.potentialSavings > 0 ? "text-success" : "text-muted-foreground"}`}>
                  {u.potentialSavings > 0 ? formatINR(u.potentialSavings) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
