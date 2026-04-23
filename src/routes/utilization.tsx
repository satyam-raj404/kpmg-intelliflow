import { createFileRoute } from "@tanstack/react-router";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ScatterChart,
  Scatter,
  ZAxis,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
  ReferenceArea,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard } from "@/components/KpiCard";
import { SectionCard } from "@/components/SectionCard";
import { StatusPill } from "@/components/StatusPill";
import { formatINR, formatDateShort } from "@/lib/format";
import { utilization } from "@/data/mock";
import { brand, chartPalette } from "@/lib/brand";

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

  return (
    <AppShell>
      <PageHeader
        title="Utilization Dashboard"
        subtitle="Optimize tool & infrastructure utilization"
      />

      <div className="grid grid-cols-5 gap-4">
        <KpiCard label="Total Licenses Owned" value={totalLicenses.toLocaleString("en-IN")} size="lg" />
        <KpiCard label="Active Users" value={activeUsers.toLocaleString("en-IN")} size="lg" sublabel={`${utilPct.toFixed(1)}% utilization`} />
        <KpiCard label="Monthly Cost" value={formatINR(monthlyCost)} size="lg" delta={{ text: "↑ 4.2%", positive: false }} />
        <KpiCard label="Potential Savings Identified" value={`${formatINR(savings)}/mo`} size="lg" sublabel="From underutilized & over-provisioned tools" threshold={{ label: "Optimize →", tone: "info" }} />
        <KpiCard label="Renewals (30 days)" value="7 tools" size="lg" sublabel="₹1.42 Cr contract value" threshold={{ label: "Action needed", tone: "warning" }} />
      </div>

      <div className="grid grid-cols-5 gap-4 mt-4">
        <div className="col-span-3"><UtilByTool /></div>
        <div className="col-span-2"><CostVsUtil /></div>
      </div>

      <div className="mt-4">
        <OptimizationTable />
      </div>

      <div className="grid grid-cols-2 gap-4 mt-4">
        <InfraSpendBreakdown />
        <MonthlySpendTrend />
      </div>

      <div className="mt-4">
        <RenewalTimeline />
      </div>
    </AppShell>
  );
}

function UtilByTool() {
  const data = [...utilization]
    .sort((a, b) => b.monthlyCost - a.monthlyCost)
    .slice(0, 15)
    .map((u) => ({
      name: u.toolName,
      pct: u.utilPercent,
      cost: u.costPerActiveUser,
    }));

  return (
    <SectionCard title="Utilization by Tool" subtitle="Top 15 by monthly spend">
      <div className="h-96">
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 60, left: 100, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E8" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} />
            <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={100} fontSize={11} />
            <Tooltip
              formatter={(_, n, props) =>
                n === "pct" ? [`${props.payload.pct}% · ₹${props.payload.cost}/user`, "Utilization"] : null
              }
            />
            <Bar dataKey="pct" radius={[0, 2, 2, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.pct >= 80 ? brand.colors.success : d.pct >= 50 ? brand.colors.warning : brand.colors.danger} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}

function CostVsUtil() {
  const data = utilization.map((u) => ({
    name: u.toolName,
    util: u.utilPercent,
    cost: u.monthlyCost,
    users: u.activeUsers,
    color: u.optimizationFlag === "Underutilized" ? brand.colors.danger : u.optimizationFlag === "Over-provisioned" ? brand.colors.warning : brand.colors.success,
  }));
  return (
    <SectionCard title="Cost vs Utilization" subtitle="Bubble = active users · Ideal zone shaded">
      <div className="h-96">
        <ResponsiveContainer>
          <ScatterChart margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E8" />
            <XAxis type="number" dataKey="util" name="Utilization" unit="%" tickLine={false} axisLine={false} domain={[0, 100]} />
            <YAxis type="number" dataKey="cost" name="Cost" tickFormatter={(v) => formatINR(v)} tickLine={false} axisLine={false} />
            <ZAxis type="number" dataKey="users" range={[60, 600]} />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              formatter={(v: number, n) => (n === "Cost" ? formatINR(v) : `${v}%`)}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.name ?? ""}
            />
            <ReferenceArea x1={75} x2={100} y1={0} y2={Math.max(...data.map((d) => d.cost))} fill={brand.colors.success} fillOpacity={0.06} />
            <Scatter data={data}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}

function OptimizationTable() {
  const rows = [...utilization].sort((a, b) => b.potentialSavings - a.potentialSavings);
  return (
    <SectionCard title="License Optimization Opportunities" subtitle="Sorted by potential monthly savings" bodyClassName="p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead className="bg-secondary text-muted-foreground">
            <tr className="text-left">
              <th className="px-4 py-2.5 font-semibold">Tool</th>
              <th className="px-4 py-2.5 font-semibold">Vendor</th>
              <th className="px-4 py-2.5 font-semibold text-right">Owned</th>
              <th className="px-4 py-2.5 font-semibold text-right">Active</th>
              <th className="px-4 py-2.5 font-semibold text-right">Util %</th>
              <th className="px-4 py-2.5 font-semibold text-right">Monthly Cost</th>
              <th className="px-4 py-2.5 font-semibold text-right">Cost/Active</th>
              <th className="px-4 py-2.5 font-semibold">Renewal</th>
              <th className="px-4 py-2.5 font-semibold">Flag</th>
              <th className="px-4 py-2.5 font-semibold text-right">Potential Savings</th>
              <th className="px-4 py-2.5 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((u) => (
              <tr key={u.id} className={`hover:bg-secondary/50 ${u.optimizationFlag === "Underutilized" ? "border-l-4 border-l-danger" : ""}`}>
                <td className="px-4 py-2.5 font-semibold">{u.toolName}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{u.vendor}</td>
                <td className="px-4 py-2.5 text-right font-tabular">{u.licensesOwned.toLocaleString("en-IN")}</td>
                <td className="px-4 py-2.5 text-right font-tabular">{u.activeUsers.toLocaleString("en-IN")}</td>
                <td className={`px-4 py-2.5 text-right font-tabular font-semibold ${u.utilPercent >= 80 ? "text-success" : u.utilPercent >= 50 ? "text-warning" : "text-danger"}`}>
                  {u.utilPercent}%
                </td>
                <td className="px-4 py-2.5 text-right font-tabular">{formatINR(u.monthlyCost)}</td>
                <td className="px-4 py-2.5 text-right font-tabular">₹{u.costPerActiveUser.toLocaleString("en-IN")}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{formatDateShort(u.renewalDate)}</td>
                <td className="px-4 py-2.5">
                  <StatusPill tone={u.optimizationFlag === "Optimal" ? "success" : u.optimizationFlag === "Over-provisioned" ? "warning" : "danger"} dot>
                    {u.optimizationFlag}
                  </StatusPill>
                </td>
                <td className={`px-4 py-2.5 text-right font-tabular font-bold ${u.potentialSavings > 0 ? "text-success" : "text-muted-foreground"}`}>
                  {u.potentialSavings > 0 ? formatINR(u.potentialSavings) : "—"}
                </td>
                <td className="px-4 py-2.5">
                  {u.optimizationFlag === "Underutilized" ? (
                    <button className="text-[11px] px-2 py-1 rounded bg-danger text-white font-semibold">Review</button>
                  ) : u.optimizationFlag === "Over-provisioned" ? (
                    <button className="text-[11px] px-2 py-1 rounded bg-warning text-[#5A3A00] font-semibold">Optimize</button>
                  ) : (
                    <button className="text-[11px] px-2 py-1 rounded border border-border font-semibold">Keep</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

function InfraSpendBreakdown() {
  const cats = ["Compute", "Storage", "Networking", "Databases", "SaaS", "Security Tools"] as const;
  const data = cats.map((c, i) => ({
    name: c,
    value: utilization.filter((u) => u.category === c).reduce((s, u) => s + u.monthlyCost, 0) || (i + 1) * 1_20_000,
    color: chartPalette[i % chartPalette.length],
  }));
  return (
    <SectionCard title="Infrastructure Spend Breakdown" subtitle="Monthly · by category">
      <div className="h-64">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={50} outerRadius={90} paddingAngle={2}>
              {data.map((d, i) => (<Cell key={i} fill={d.color} />))}
            </Pie>
            <Tooltip formatter={(v: number) => formatINR(v)} />
            <Legend wrapperStyle={{ fontSize: 11 }} iconType="square" />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}

function MonthlySpendTrend() {
  const months = ["May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr"];
  const data = months.map((m, i) => ({
    month: m,
    Compute: 24 + i * 0.6,
    SaaS: 32 + (i % 3),
    Databases: 14 + (i % 4),
    Security: 9 + i * 0.3,
  }));
  return (
    <SectionCard title="Monthly Spend Trend" subtitle="Last 12 months · ₹ Lakh">
      <div className="h-64">
        <ResponsiveContainer>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E8" vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}L`} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} iconType="square" />
            <Area type="monotone" dataKey="Compute" stackId="1" fill={brand.colors.primary} stroke={brand.colors.primary} fillOpacity={0.7} />
            <Area type="monotone" dataKey="SaaS" stackId="1" fill={brand.colors.accent} stroke={brand.colors.accent} fillOpacity={0.7} />
            <Area type="monotone" dataKey="Databases" stackId="1" fill={brand.colors.teal} stroke={brand.colors.teal} fillOpacity={0.7} />
            <Area type="monotone" dataKey="Security" stackId="1" fill={brand.colors.purple} stroke={brand.colors.purple} fillOpacity={0.7} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}

function RenewalTimeline() {
  const upcoming = [...utilization]
    .filter((u) => +new Date(u.renewalDate) > Date.now())
    .sort((a, b) => +new Date(a.renewalDate) - +new Date(b.renewalDate))
    .slice(0, 12);
  return (
    <SectionCard title="Renewal Timeline" subtitle="Next 90 days">
      <div className="relative pt-4 pb-2">
        <div className="h-px bg-border w-full" />
        <div className="grid grid-cols-12 gap-2 mt-3">
          {upcoming.map((u, i) => {
            const days = Math.ceil((+new Date(u.renewalDate) - Date.now()) / 86400000);
            const tone = days <= 30 ? "danger" : days <= 60 ? "warning" : "info";
            return (
              <div key={u.id} className="text-center">
                <div className={`mx-auto h-3 w-3 rounded-full -mt-[14px] ${tone === "danger" ? "bg-danger" : tone === "warning" ? "bg-warning" : "bg-accent"}`} />
                <div className="text-[10px] mt-2 font-semibold truncate">{u.toolName}</div>
                <div className="text-[10px] text-muted-foreground font-tabular">{days}d</div>
                <div className="text-[10px] font-tabular">{formatINR(u.monthlyCost * 12)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </SectionCard>
  );
}
