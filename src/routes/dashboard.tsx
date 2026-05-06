import { createFileRoute } from "@tanstack/react-router";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { CalendarClock, Trash2 } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard } from "@/components/KpiCard";
import { SectionCard } from "@/components/SectionCard";
import { StatusPill } from "@/components/StatusPill";
import { formatINR, formatDateShort } from "@/lib/format";
import { purchaseOrders, financialHistory, vendors } from "@/data/mock";
import { brand } from "@/lib/brand";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Procurement Dashboard — KPMG IntelliSource" },
      { name: "description", content: "Real-time visibility into PO activity, breaches, and operational priorities." },
    ],
  }),
  component: ProcurementDashboard,
});

function ProcurementDashboard() {
  return (
    <AppShell>
      <PageHeader title="Procurement Dashboard" subtitle="Real-time visibility into PO activity, breaches, and operational priorities" />
      <KpiRow />
      <div className="grid grid-cols-2 gap-4 mt-4">
        <POValueTrend />
        <POStatusBreakdown />
      </div>
      <div className="mt-4"><HighValuePOMonitor /></div>
      <div className="grid grid-cols-2 gap-4 mt-4">
        <PODeletions />
        <UpcomingRenewals />
      </div>
    </AppShell>
  );
}

/* ── KPI 01-Procurement: 8 KPIs ── */
function KpiRow() {
  const activePOs = purchaseOrders.filter((p) => p.status !== "Deleted" && p.status !== "Cancelled");
  const totalMTD = activePOs.reduce((s, p) => s + p.value, 0);
  const highValue = activePOs.filter((p) => p.value >= 1_00_00_000).length;
  const deleted = purchaseOrders.filter((p) => p.status === "Deleted").length;
  const amended = purchaseOrders.filter((p) => p.amended).length;
  const amendRate = ((amended / purchaseOrders.length) * 100).toFixed(1);
  const spark = financialHistory.slice(-12).map((p) => ({ x: p.period, y: p.spend }));

  return (
    <>
      <div className="grid grid-cols-4 gap-3">
        {/* KPI 1: Total PO Value (MTD) */}
        <KpiCard
          label="Total PO Value (MTD)"
          value={formatINR(totalMTD)}
          delta={{ text: "↑ 8.7%", positive: true }}
          sublabel="SUM of net_order_value this month"
          size="lg"
          index={0}
          sparkline={
            <ResponsiveContainer>
              <AreaChart data={spark} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                <Area type="monotone" dataKey="y" stroke={brand.colors.accent} fill={brand.colors.accent} fillOpacity={0.12} strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          }
        />
        {/* KPI 2: Active PO Count */}
        <KpiCard label="Active PO Count" value={activePOs.length} size="lg" sublabel="delivery_completed ≠ X, not deleted" index={1} />
        {/* KPI 3: High-Value PO Count */}
        <KpiCard label="High-Value PO Count" value={highValue} size="lg" sublabel="net_order_value > ₹1 Cr" threshold={{ label: "Configurable threshold", tone: "info" }} index={2} />
        {/* KPI 4: Avg PR→PO Conversion Time */}
        <KpiCard label="Average PR-to-PO Conversion Time" value="4.2d" delta={{ text: "↑ 0.3d", positive: false }} size="lg" sublabel="Target: ≤ 5 days" threshold={{ label: "Within target", tone: "success" }} index={3} />
      </div>
      <div className="grid grid-cols-4 gap-3 mt-3">
        {/* KPI 5: PO Cycle Time (Creation → Approval) */}
        <KpiCard label="PO Cycle Time (Creation → Approval)" value="2.6d" size="md" sublabel="Target: ≤ 3 days" threshold={{ label: "Within target", tone: "success" }} index={4} />
        {/* KPI 6: PO Deletion Frequency (MTD) */}
        <KpiCard label="PO Deletion Frequency (MTD)" value={deleted} size="md" sublabel="Target: ≤ 5 per month" threshold={deleted > 5 ? { label: "Above target", tone: "danger" } : { label: "Within limit", tone: "success" }} index={5} />
        {/* KPI 7: PO Amendment Rate */}
        <KpiCard label="PO Amendment Rate" value={`${amendRate}%`} size="md" sublabel={`${amended} of ${purchaseOrders.length} POs modified`} threshold={parseFloat(amendRate) > 15 ? { label: "> 15% threshold", tone: "danger" } : { label: "< 15% target", tone: "success" }} index={6} />
        {/* KPI 8: Open PR Aging (> 7 days) */}
        <KpiCard label="Open PR Aging (> 7 days)" value="14" size="md" sublabel="PRs stuck without conversion" threshold={{ label: "Target: ≤ 10", tone: "warning" }} index={7} />
      </div>
    </>
  );
}

/* ── Drill-down: PO Value Trend (12 months) ── */
function POValueTrend() {
  const data = financialHistory.slice(-12).map((p) => ({ period: p.period, spend: p.spend / 1_00_00_000 }));
  return (
    <SectionCard title="PO Value Trend (MTD)" subtitle="Last 12 months · ₹ Cr">
      <div className="h-64">
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
            <defs>
              <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={brand.colors.primary} stopOpacity={0.2} />
                <stop offset="100%" stopColor={brand.colors.primary} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
            <XAxis dataKey="period" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v.toFixed(0)}Cr`} />
            <Tooltip formatter={(v: number) => [`₹${v.toFixed(2)} Cr`, "Spend"]} />
            <Area type="monotone" dataKey="spend" stroke={brand.colors.primary} strokeWidth={2} fill="url(#spendGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}

/* ── Drill-down: PO Status Bar (weekly) ── */
function POStatusBreakdown() {
  const weeks = Array.from({ length: 8 }, (_, i) => ({
    wk: `W${i + 1}`,
    Approved: 18 + Math.floor(Math.sin(i) * 4) + i,
    Pending: 6 + (i % 3) * 2,
    "Under Review": 3 + (i % 2),
    Deleted: i === 5 ? 3 : i % 4 === 0 ? 1 : 0,
  }));
  return (
    <SectionCard title="PO Status by Week" subtitle="Active / Approved / Pending / Deleted">
      <div className="h-64">
        <ResponsiveContainer>
          <BarChart data={weeks} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
            <XAxis dataKey="wk" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} iconType="square" />
            <Bar dataKey="Approved" stackId="a" fill={brand.colors.success} />
            <Bar dataKey="Pending" stackId="a" fill={brand.colors.warning} />
            <Bar dataKey="Under Review" stackId="a" fill={brand.colors.accent} />
            <Bar dataKey="Deleted" stackId="a" fill={brand.colors.danger} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}

/* ── Drill-down: High-Value PO Monitor Table ── */
function HighValuePOMonitor() {
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const filters = ["All", "Approved", "Pending", "Under Review"];
  const rows = purchaseOrders
    .filter((p) => p.value >= 1_00_00_000)
    .filter((p) => statusFilter === "All" || p.status === statusFilter)
    .slice(0, 10);

  return (
    <SectionCard
      title="High-Value PO Monitor"
      subtitle="POs above ₹1 Cr (configurable threshold)"
      actions={
        <div className="flex gap-1">
          {filters.map((f) => (
            <button key={f} onClick={() => setStatusFilter(f)}
              className={`text-[10px] px-2 py-1 rounded-md border transition-colors ${statusFilter === f ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:border-accent/50"}`}
            >{f}</button>
          ))}
        </div>
      }
      bodyClassName="p-0"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead className="bg-secondary/50 text-muted-foreground">
            <tr className="text-left">
              <th className="px-4 py-2 font-medium">PO Number</th>
              <th className="px-4 py-2 font-medium">Vendor</th>
              <th className="px-4 py-2 font-medium">Project</th>
              <th className="px-4 py-2 font-medium text-right">Value</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium text-right">Days Open</th>
              <th className="px-4 py-2 font-medium">Created By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((po) => (
              <tr key={po.id} className="hover:bg-secondary/30 transition-colors">
                <td className="px-4 py-2 font-mono font-medium text-primary text-[11px]">{po.poNumber}</td>
                <td className="px-4 py-2 truncate max-w-[140px]">{po.vendorName}</td>
                <td className="px-4 py-2 truncate max-w-[180px] text-muted-foreground">{po.projectName}</td>
                <td className="px-4 py-2 text-right font-tabular font-medium">{formatINR(po.value)}</td>
                <td className="px-4 py-2">
                  <StatusPill tone={po.status === "Approved" ? "success" : po.status === "Pending" ? "warning" : po.status === "Under Review" ? "info" : "danger"} dot>
                    {po.status}
                  </StatusPill>
                </td>
                <td className={`px-4 py-2 text-right font-tabular ${po.daysOpen > 14 ? "text-danger font-medium" : ""}`}>{po.daysOpen}d</td>
                <td className="px-4 py-2 text-muted-foreground">{po.createdBy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

/* ── Drill-down: PO Deletions ── */
function PODeletions() {
  const deletions = purchaseOrders.filter((p) => p.status === "Deleted").slice(0, 5);
  return (
    <SectionCard title="PO Deletions (Anomaly Monitor)" subtitle="deletion_indicator = L">
      <ul className="space-y-2.5">
        {deletions.map((p) => (
          <li key={p.id} className="flex items-start gap-2 pb-2.5 border-b border-border last:border-b-0 last:pb-0">
            <Trash2 className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-mono font-medium truncate">{p.poNumber}</div>
              <div className="text-[10px] text-muted-foreground truncate">{p.vendorName} · {p.createdBy}</div>
            </div>
            <span className="text-[11px] font-tabular font-medium">{formatINR(p.value)}</span>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

/* ── Drill-down: Upcoming Contract Renewals ── */
function UpcomingRenewals() {
  const renewals = vendors
    .filter((v) => v.contractStatus === "Expiring Soon")
    .sort((a, b) => +new Date(a.contractEnd) - +new Date(b.contractEnd))
    .slice(0, 5);
  return (
    <SectionCard title="Upcoming Contract Renewals" subtitle="end_date < today + 60 days">
      <ul className="space-y-2.5">
        {renewals.map((v) => {
          const days = Math.ceil((+new Date(v.contractEnd) - Date.now()) / (1000 * 60 * 60 * 24));
          return (
            <li key={v.id} className="flex items-start gap-2 pb-2.5 border-b border-border last:border-b-0 last:pb-0">
              <CalendarClock className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-medium truncate">{v.name}</div>
                <div className="text-[10px] text-muted-foreground">{formatINR(v.spendYTD)} at risk</div>
              </div>
              <div className="text-[13px] font-semibold text-warning font-tabular">{days}d</div>
            </li>
          );
        })}
        {renewals.length === 0 && <li className="text-[11px] text-muted-foreground text-center py-3">No upcoming renewals</li>}
      </ul>
    </SectionCard>
  );
}
