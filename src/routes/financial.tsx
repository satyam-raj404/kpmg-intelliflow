import { createFileRoute } from "@tanstack/react-router";
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
  Legend,
  ComposedChart,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard } from "@/components/KpiCard";
import { SectionCard } from "@/components/SectionCard";
import { ProgressBar } from "@/components/ProgressBar";
import { StatusPill } from "@/components/StatusPill";
import { formatINR, formatPercent } from "@/lib/format";
import { divisionBudgets, projects, invoices } from "@/data/mock";
import { brand } from "@/lib/brand";

export const Route = createFileRoute("/financial")({
  head: () => ({
    meta: [
      { title: "Financial Dashboard — KPMG IntelliSource" },
      { name: "description", content: "Monitor financial performance, spending variances, budget compliance." },
    ],
  }),
  component: FinancialDashboard,
});

function FinancialDashboard() {
  const totalSpend = projects.reduce((s, p) => s + p.cost, 0);
  const totalBudget = projects.reduce((s, p) => s + p.budget, 0);
  const totalRevenue = projects.reduce((s, p) => s + p.revenue, 0);
  const utilization = (totalSpend / totalBudget) * 100;

  return (
    <AppShell>
      <PageHeader
        title="Financial Dashboard"
        subtitle="Spend, variance, budget compliance & invoice processing"
      />

      <div className="grid grid-cols-4 gap-4">
        <KpiCard
          label="Total Spend (YTD)"
          value={formatINR(totalSpend)}
          size="lg"
          delta={{ text: "↑ 12.4% YoY", positive: false }}
          sublabel="Across 50 active projects"
        />
        <KpiCard
          label="Budget Utilization"
          value={formatPercent(utilization)}
          size="lg"
          sublabel={
            <>
              <span className="font-semibold">{formatINR(totalSpend)}</span> of{" "}
              <span className="font-semibold">{formatINR(totalBudget)}</span> allocated
            </>
          }
          rightSlot={
            <div className="w-24">
              <ProgressBar value={utilization} />
            </div>
          }
        />
        <KpiCard
          label="Cost vs Revenue Variance"
          value={formatINR(totalRevenue - totalSpend)}
          size="lg"
          delta={{ text: "↑ 4.1%", positive: true }}
          sublabel="Favorable — margin held"
        />
        <KpiCard
          label="Margin Variance (Plan vs Actual)"
          value="−1.8 pp"
          size="lg"
          delta={{ text: "↓ 0.6 pp", positive: false }}
          sublabel="Erosion driven by Cloud div."
          threshold={{ label: "Watch", tone: "warning" }}
        />
      </div>

      <div className="mt-4">
        <DivisionBudgets />
      </div>

      <div className="grid grid-cols-2 gap-4 mt-4">
        <VarianceWaterfall />
        <InvoiceStatus />
      </div>

      <div className="mt-4">
        <ProjectPL />
      </div>

      <div className="grid grid-cols-3 gap-4 mt-4">
        <InvoiceAging />
        <TDSSummary />
        <GSTInputCredit />
      </div>
    </AppShell>
  );
}

function DivisionBudgets() {
  return (
    <SectionCard title="Budget Utilization by Division" subtitle="YTD actual vs allocated">
      <div className="h-80">
        <ResponsiveContainer>
          <BarChart data={divisionBudgets} layout="vertical" margin={{ top: 8, right: 24, left: 100, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E8" horizontal={false} />
            <XAxis type="number" tickFormatter={(v) => formatINR(v)} tickLine={false} axisLine={false} />
            <YAxis dataKey="division" type="category" tickLine={false} axisLine={false} width={100} />
            <Tooltip formatter={(v: number) => formatINR(v)} />
            <Legend wrapperStyle={{ fontSize: 11 }} iconType="square" />
            <Bar dataKey="budget" fill={brand.colors.neutral[200]} name="Budget" />
            <Bar dataKey="spend" fill={brand.colors.primary} name="Actual Spend" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}

function VarianceWaterfall() {
  // Build cumulative steps for a waterfall
  const steps = [
    { name: "Planned Budget", value: 398, base: 0, color: brand.colors.primary },
    { name: "Vendor Rate ↑", value: 18, base: 398, color: brand.colors.danger },
    { name: "Scope Change", value: 12, base: 416, color: brand.colors.danger },
    { name: "FX Impact", value: -8, base: 420, color: brand.colors.success },
    { name: "Volume Discount", value: -22, base: 412, color: brand.colors.success },
    { name: "Other", value: 6, base: 390, color: brand.colors.warning },
    { name: "Actual Spend", value: 396, base: 0, color: brand.colors.primary },
  ];

  // Recharts waterfall via stacked invisible base + visible delta
  const data = steps.map((s) => ({
    name: s.name,
    invisible: s.value < 0 ? s.base + s.value : s.base,
    delta: Math.abs(s.value),
    color: s.color,
    raw: s.value,
  }));

  return (
    <SectionCard title="Variance Waterfall — Planned to Actual Spend" subtitle="₹ Cr · YTD">
      <div className="h-80">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E8" vertical={false} />
            <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} fontSize={10} angle={-15} textAnchor="end" height={60} />
            <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}Cr`} />
            <Tooltip
              formatter={(_, n, props) => {
                if (n === "delta") return [`₹${props.payload.raw} Cr`, "Variance"];
                return null;
              }}
            />
            <Bar dataKey="invisible" stackId="a" fill="transparent" />
            <Bar dataKey="delta" stackId="a">
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}

function InvoiceStatus() {
  const data = [
    { name: "Paid", value: invoices.filter((i) => i.status === "Paid").length, color: brand.colors.success },
    { name: "Pending", value: invoices.filter((i) => i.status === "Pending").length, color: brand.colors.warning },
    { name: "Overdue", value: invoices.filter((i) => i.status === "Overdue").length, color: brand.colors.danger },
    { name: "Disputed", value: invoices.filter((i) => i.status === "Disputed").length, color: brand.colors.purple },
    { name: "Credit Memo", value: invoices.filter((i) => i.status === "Credit Memo").length, color: brand.colors.accent },
  ];
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <SectionCard title="Invoice Processing Status" subtitle={`${total} invoices in flight`}>
      <div className="h-80 relative">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} iconType="square" />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-[-30px]">
          <div className="text-3xl font-bold font-tabular">{total}</div>
          <div className="text-[11px] text-muted-foreground uppercase tracking-wider">invoices</div>
        </div>
      </div>
    </SectionCard>
  );
}

function ProjectPL() {
  const rows = [...projects].sort((a, b) => b.revenue - a.revenue).slice(0, 12);
  const totals = projects.reduce(
    (acc, p) => {
      acc.revenue += p.revenue;
      acc.cost += p.cost;
      acc.budget += p.budget;
      return acc;
    },
    { revenue: 0, cost: 0, budget: 0 },
  );

  return (
    <SectionCard title="Project-Level P&L" subtitle="Top 12 projects by revenue" bodyClassName="p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead className="bg-secondary text-muted-foreground">
            <tr className="text-left">
              <th className="px-4 py-2.5 font-semibold">Project Code</th>
              <th className="px-4 py-2.5 font-semibold">Client</th>
              <th className="px-4 py-2.5 font-semibold text-right">Revenue</th>
              <th className="px-4 py-2.5 font-semibold text-right">Cost</th>
              <th className="px-4 py-2.5 font-semibold text-right">GM %</th>
              <th className="px-4 py-2.5 font-semibold text-right">Budget</th>
              <th className="px-4 py-2.5 font-semibold text-right">Util %</th>
              <th className="px-4 py-2.5 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((p) => (
              <tr key={p.id} className="hover:bg-secondary/50">
                <td className="px-4 py-2.5 font-mono font-semibold text-primary">{p.code}</td>
                <td className="px-4 py-2.5 truncate max-w-[160px]">{p.client}</td>
                <td className="px-4 py-2.5 text-right font-tabular">{formatINR(p.revenue)}</td>
                <td className="px-4 py-2.5 text-right font-tabular">{formatINR(p.cost)}</td>
                <td className={`px-4 py-2.5 text-right font-tabular font-semibold ${p.gmPercent >= 30 ? "text-success" : p.gmPercent >= 15 ? "text-warning" : "text-danger"}`}>
                  {formatPercent(p.gmPercent)}
                </td>
                <td className="px-4 py-2.5 text-right font-tabular">{formatINR(p.budget)}</td>
                <td className={`px-4 py-2.5 text-right font-tabular font-semibold ${p.utilPercent > 100 ? "text-danger" : p.utilPercent >= 90 ? "text-warning" : "text-success"}`}>
                  {formatPercent(p.utilPercent)}
                </td>
                <td className="px-4 py-2.5">
                  <StatusPill tone={p.health === "Healthy" ? "success" : p.health === "At Risk" ? "warning" : "danger"} dot>
                    {p.health}
                  </StatusPill>
                </td>
              </tr>
            ))}
            <tr className="bg-secondary font-bold">
              <td className="px-4 py-3" colSpan={2}>TOTAL (all 50 projects)</td>
              <td className="px-4 py-3 text-right font-tabular">{formatINR(totals.revenue)}</td>
              <td className="px-4 py-3 text-right font-tabular">{formatINR(totals.cost)}</td>
              <td className="px-4 py-3 text-right font-tabular">{formatPercent(((totals.revenue - totals.cost) / totals.revenue) * 100)}</td>
              <td className="px-4 py-3 text-right font-tabular">{formatINR(totals.budget)}</td>
              <td className="px-4 py-3 text-right font-tabular">{formatPercent((totals.cost / totals.budget) * 100)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

function InvoiceAging() {
  const buckets = [
    { range: "0–30d", value: 142_50_000, color: brand.colors.success },
    { range: "31–60d", value: 78_20_000, color: brand.colors.warning },
    { range: "61–90d", value: 42_80_000, color: brand.colors.danger },
    { range: "90+", value: 18_60_000, color: brand.colors.purple },
  ];
  return (
    <SectionCard title="Invoice Aging" subtitle="Receivables buckets">
      <div className="h-56">
        <ResponsiveContainer>
          <ComposedChart data={buckets}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E8" vertical={false} />
            <XAxis dataKey="range" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => formatINR(v)} />
            <Tooltip formatter={(v: number) => formatINR(v)} />
            <Bar dataKey="value">
              {buckets.map((b, i) => (
                <Cell key={i} fill={b.color} />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}

function TDSSummary() {
  const items = [
    { type: "Company", value: 4_82_50_000 },
    { type: "HUF", value: 65_40_000 },
    { type: "Individual", value: 1_25_60_000 },
    { type: "Foreign", value: 2_18_30_000 },
  ];
  const total = items.reduce((s, i) => s + i.value, 0);
  return (
    <SectionCard title="TDS Summary (YTD)" subtitle={`Total deducted ${formatINR(total)}`}>
      <ul className="space-y-3 mt-1">
        {items.map((i) => (
          <li key={i.type}>
            <div className="flex items-baseline justify-between text-[12px] mb-1">
              <span className="text-muted-foreground">{i.type}</span>
              <span className="font-tabular font-semibold">{formatINR(i.value)}</span>
            </div>
            <ProgressBar value={(i.value / total) * 100} tone="info" />
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function GSTInputCredit() {
  const claimable = 8_42_00_000;
  const claimed = 6_18_50_000;
  const pct = (claimed / claimable) * 100;
  return (
    <SectionCard title="GST Input Credit" subtitle="Claimable vs Claimed">
      <div className="space-y-4 mt-2">
        <div>
          <div className="flex justify-between text-[12px] mb-2">
            <span className="text-muted-foreground">Claimed</span>
            <span className="font-tabular font-bold">{formatINR(claimed)}</span>
          </div>
          <ProgressBar value={pct} tone="info" />
        </div>
        <div className="text-[12px] text-muted-foreground">
          of <span className="font-semibold text-foreground">{formatINR(claimable)}</span> claimable ({formatPercent(pct)})
        </div>
        <div className="pt-3 border-t border-border space-y-2 text-[12px]">
          <div className="flex justify-between"><span className="text-muted-foreground">Pending claim</span><span className="font-tabular font-semibold">{formatINR(claimable - claimed)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Disputed</span><span className="font-tabular font-semibold text-warning">{formatINR(42_50_000)}</span></div>
        </div>
      </div>
    </SectionCard>
  );
}
