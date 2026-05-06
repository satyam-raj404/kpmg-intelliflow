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
import { financial as dd } from "@/data/kpiDrillDowns";

export const Route = createFileRoute("/financial")({
  head: () => ({
    meta: [
      { title: "Financial Dashboard — KPMG IntelliSource" },
      { name: "description", content: "Spend vs budget tracking, cash flow, invoice/payment cycle health." },
    ],
  }),
  component: FinancialDashboard,
});

function FinancialDashboard() {
  const totalSpend = projects.reduce((s, p) => s + p.cost, 0);
  const totalBudget = projects.reduce((s, p) => s + p.budget, 0);
  const budgetUtil = (totalSpend / totalBudget) * 100;

  return (
    <AppShell>
      <PageHeader title="Financial Dashboard" subtitle="Spend vs budget tracking, cash flow, invoice/payment cycle health" />

      {/* KPI 02-Financial: 8 KPIs */}
      <div className="grid grid-cols-4 gap-3">
        {/* KPI 1: Total Spend (YTD) */}
        <KpiCard label="Total Spend (YTD)" value={formatINR(totalSpend)} size="lg" delta={{ text: "↑ 12.4% YoY", positive: false }} sublabel="SUM(payment_dump.amount_local_ccy)" index={0} />
        {/* KPI 2: Budget Utilization % */}
        <KpiCard
          label="Budget Utilization %"
          value={formatPercent(budgetUtil)}
          size="lg"
          sublabel={<>{formatINR(totalSpend)} of {formatINR(totalBudget)}</>}
          threshold={budgetUtil > 100 ? { label: "> 100% — Over budget", tone: "danger" } : budgetUtil > 90 ? { label: "90-100% — Amber", tone: "warning" } : { label: "< 90% — Green", tone: "success" }}
          rightSlot={<div className="w-16"><ProgressBar value={budgetUtil} /></div>}
          index={1}
        />
        {/* KPI 3: Three-Way Match Success Rate */}
        <KpiCard label="Three-Way Match Success Rate" value="94.2%" size="lg" sublabel="PO + GRN + Invoice match" threshold={{ label: "Target: > 95%", tone: "warning" }} index={2} />
        {/* KPI 4: Invoice Processing Cycle Time */}
        <KpiCard label="Invoice Processing Cycle Time" value="4.8d" delta={{ text: "↓ 0.5d", positive: true }} size="lg" sublabel="Target: ≤ 5 days" threshold={{ label: "On target", tone: "success" }} index={3} />
      </div>

      <div className="grid grid-cols-4 gap-3 mt-3">
        {/* KPI 5: Payment On-Time Rate */}
        <KpiCard label="Payment On-Time Rate" value="91.3%" size="md" sublabel="Paid on or before due date" threshold={{ label: "> 90% target", tone: "success" }} index={4} />
        {/* KPI 6: Days Payable Outstanding (DPO) */}
        <KpiCard label="Days Payable Outstanding (DPO)" value="38d" size="md" sublabel="Match payment terms (30/45/60)" threshold={{ label: "Within terms", tone: "info" }} index={5} />
        {/* KPI 7: Open Invoice Aging (Total ₹) */}
        <KpiCard label="Open Invoice Aging (Total ₹)" value={formatINR(2_82_10_000)} size="md" sublabel="₹18.6L in 90+ bucket" threshold={{ label: "< ₹5 Cr in 90+", tone: "warning" }} index={6} />
        {/* KPI 8: Early Payment Discount Capture Rate */}
        <KpiCard label="Early Payment Discount Capture Rate" value="72%" size="md" sublabel="Of available discounts captured" threshold={{ label: "Target: > 80%", tone: "warning" }} index={7} />
      </div>

      {/* Drill-downs */}
      <div className="mt-4"><DivisionBudgets /></div>
      <div className="grid grid-cols-2 gap-4 mt-4">
        <VarianceWaterfall />
        <InvoiceStatus />
      </div>
      <div className="mt-4"><ProjectPL /></div>
      <div className="grid grid-cols-2 gap-4 mt-4">
        <InvoiceAging />
        <TaxSummary />
      </div>
    </AppShell>
  );
}

function DivisionBudgets() {
  return (
    <SectionCard title="Budget Utilization by Division" subtitle="KPI 2 segmented by business unit">
      <div className="h-72">
        <ResponsiveContainer>
          <BarChart data={divisionBudgets} layout="vertical" margin={{ top: 8, right: 24, left: 90, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
            <XAxis type="number" tickFormatter={(v) => formatINR(v)} tickLine={false} axisLine={false} />
            <YAxis dataKey="division" type="category" tickLine={false} axisLine={false} width={90} />
            <Tooltip formatter={(v: number) => formatINR(v)} />
            <Legend wrapperStyle={{ fontSize: 11 }} iconType="square" />
            <Bar dataKey="budget" fill={brand.colors.neutral[200]} name="Budget" radius={[0, 2, 2, 0]} />
            <Bar dataKey="spend" fill={brand.colors.primary} name="Actual" radius={[0, 2, 2, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}

function VarianceWaterfall() {
  const data = [
    { name: "Planned", delta: 398, color: brand.colors.primary },
    { name: "Rate ↑", delta: 18, color: brand.colors.danger },
    { name: "Scope", delta: 12, color: brand.colors.danger },
    { name: "FX", delta: -8, color: brand.colors.success },
    { name: "Discount", delta: -22, color: brand.colors.success },
    { name: "Other", delta: 6, color: brand.colors.warning },
    { name: "Actual", delta: 396, color: brand.colors.primary },
  ].map((s) => ({ ...s, value: Math.abs(s.delta), invisible: s.delta < 0 ? 390 + s.delta : s.name === "Planned" || s.name === "Actual" ? 0 : 398 }));

  return (
    <SectionCard title="Variance Waterfall" subtitle="Planned → Actual · ₹ Cr">
      <div className="h-72">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
            <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={10} />
            <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}`} />
            <Tooltip formatter={(v: number) => [`₹${v} Cr`, ""]} />
            <Bar dataKey="invisible" stackId="a" fill="transparent" />
            <Bar dataKey="value" stackId="a">
              {data.map((d, i) => <Cell key={i} fill={d.color} />)}
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
  ];
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <SectionCard title="Invoice Status Donut" subtitle={`${total} invoices from 06_Invoice_Dump`}>
      <div className="h-72 relative">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2}>
              {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} iconType="square" />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-[-20px]">
          <div className="text-2xl font-semibold font-tabular">{total}</div>
          <div className="text-[10px] text-muted-foreground">total</div>
        </div>
      </div>
    </SectionCard>
  );
}

function ProjectPL() {
  const rows = [...projects].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  return (
    <SectionCard title="Project P&L" subtitle="Revenue vs cost (07_Payment_Dump grouped by project)" bodyClassName="p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead className="bg-secondary/50 text-muted-foreground">
            <tr className="text-left">
              <th className="px-4 py-2 font-medium">Code</th>
              <th className="px-4 py-2 font-medium">Client</th>
              <th className="px-4 py-2 font-medium text-right">Revenue</th>
              <th className="px-4 py-2 font-medium text-right">Cost</th>
              <th className="px-4 py-2 font-medium text-right">GM %</th>
              <th className="px-4 py-2 font-medium text-right">Budget Util</th>
              <th className="px-4 py-2 font-medium">Health</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((p) => (
              <tr key={p.id} className="hover:bg-secondary/30 transition-colors">
                <td className="px-4 py-2 font-mono text-[11px] font-medium text-primary">{p.code}</td>
                <td className="px-4 py-2 truncate max-w-[140px]">{p.client}</td>
                <td className="px-4 py-2 text-right font-tabular">{formatINR(p.revenue)}</td>
                <td className="px-4 py-2 text-right font-tabular">{formatINR(p.cost)}</td>
                <td className={`px-4 py-2 text-right font-tabular font-medium ${p.gmPercent >= 25 ? "text-success" : p.gmPercent >= 15 ? "text-warning" : "text-danger"}`}>{formatPercent(p.gmPercent)}</td>
                <td className={`px-4 py-2 text-right font-tabular ${p.utilPercent > 100 ? "text-danger font-medium" : ""}`}>{formatPercent(p.utilPercent)}</td>
                <td className="px-4 py-2"><StatusPill tone={p.health === "Healthy" ? "success" : p.health === "At Risk" ? "warning" : "danger"} dot>{p.health}</StatusPill></td>
              </tr>
            ))}
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
    <SectionCard title="Invoice Aging Stack" subtitle="KPI 7 — 0-30/31-60/61-90/90+ buckets">
      <div className="h-52">
        <ResponsiveContainer>
          <BarChart data={buckets}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
            <XAxis dataKey="range" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => formatINR(v)} />
            <Tooltip formatter={(v: number) => formatINR(v)} />
            <Bar dataKey="value" radius={[3, 3, 0, 0]}>
              {buckets.map((b, i) => <Cell key={i} fill={b.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}

function TaxSummary() {
  const items = [
    { type: "TDS — Company", value: 4_82_50_000 },
    { type: "TDS — Individual", value: 1_25_60_000 },
    { type: "GST Input Claimed", value: 6_18_50_000 },
    { type: "GST Input Pending", value: 2_23_50_000 },
  ];
  const total = items.reduce((s, i) => s + i.value, 0);
  return (
    <SectionCard title="TDS + GST Input Credit" subtitle={`Total: ${formatINR(total)} from 06_Invoice_Dump`}>
      <ul className="space-y-3 mt-1">
        {items.map((i) => (
          <li key={i.type}>
            <div className="flex items-baseline justify-between text-[12px] mb-1">
              <span className="text-muted-foreground">{i.type}</span>
              <span className="font-tabular font-medium">{formatINR(i.value)}</span>
            </div>
            <ProgressBar value={(i.value / total) * 100} tone="info" />
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
