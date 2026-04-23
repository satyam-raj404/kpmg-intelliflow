import { createFileRoute } from "@tanstack/react-router";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  BarChart,
  Bar,
  Legend,
  Area,
  AreaChart,
} from "recharts";
import {
  AlertTriangle,
  Trash2,
  CalendarClock,
  ChevronRight,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard } from "@/components/KpiCard";
import { SectionCard } from "@/components/SectionCard";
import { StatusPill } from "@/components/StatusPill";
import {
  formatINR,
  formatPercent,
  formatDateShort,
  formatDelta,
} from "@/lib/format";
import {
  purchaseOrders,
  financialHistory,
  vendors,
  complianceChecks,
} from "@/data/mock";
import { brand } from "@/lib/brand";
import { useState } from "react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Procurement Dashboard — KPMG IntelliSource" },
      { name: "description", content: "Real-time visibility into active procurement, breaches, and priorities." },
    ],
  }),
  component: ProcurementDashboard,
});

function ProcurementDashboard() {
  return (
    <AppShell>
      <PageHeader
        title="Procurement Dashboard"
        subtitle="Real-time visibility into active procurement activities, breaches, and priorities"
      />

      <KpiRow />

      <div className="grid grid-cols-2 gap-4 mt-4">
        <GrossMarginTrend />
        <POStatusBreakdown />
      </div>

      <div className="mt-4">
        <HighValuePOMonitor />
      </div>

      <div className="grid grid-cols-3 gap-4 mt-4">
        <ComplianceAlerts />
        <PODeletions />
        <UpcomingRenewals />
      </div>
    </AppShell>
  );
}

// ===================== KPI ROW =====================
function KpiRow() {
  const totalMTD = purchaseOrders.reduce((s, p) => s + p.value, 0);
  const prevMTD = totalMTD * 0.92;
  const delta = formatDelta(totalMTD, prevMTD);

  const approved = purchaseOrders.filter((p) => p.status === "Approved").length;
  const pending = purchaseOrders.filter((p) => p.status === "Pending").length;
  const review = purchaseOrders.filter((p) => p.status === "Under Review").length;
  const deleted = purchaseOrders.filter((p) => p.status === "Deleted").length;

  const highValue = purchaseOrders.filter((p) => p.value >= 1_00_00_000).length;
  const breachCount = purchaseOrders.filter((p) => p.hasComplianceBreach).length;
  const breachRate = (breachCount / purchaseOrders.length) * 100;

  // Sparkline data
  const spark = financialHistory.slice(-12).map((p) => ({ x: p.period, y: p.spend }));

  return (
    <div className="grid grid-cols-6 gap-4">
      <KpiCard
        label="Total PO Value (MTD)"
        value={formatINR(47_85_00_000)}
        delta={{ text: delta.text, positive: delta.positive }}
        sublabel="vs ₹44.1 Cr last month"
        size="lg"
        sparkline={
          <ResponsiveContainer>
            <AreaChart data={spark} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
              <Area
                type="monotone"
                dataKey="y"
                stroke={brand.colors.accent}
                fill={brand.colors.accent}
                fillOpacity={0.18}
                strokeWidth={1.5}
              />
            </AreaChart>
          </ResponsiveContainer>
        }
      />
      <KpiCard
        label="Active POs"
        value={approved + pending + review}
        size="lg"
        sublabel={
          <>
            <span className="text-success font-semibold">{approved} approved</span> ·{" "}
            <span className="text-warning font-semibold">{pending} pending</span> ·{" "}
            <span className="text-accent font-semibold">{review} under review</span>
          </>
        }
      />
      <KpiCard
        label="High-Value POs"
        value={highValue}
        size="lg"
        sublabel="> ₹1 Cr threshold"
        threshold={{ label: "● Monitor", tone: "warning" }}
      />
      <KpiCard
        label="Avg PO Cycle Time"
        value="4.2d"
        delta={{ text: "↑ 0.3d", positive: false }}
        size="lg"
        sublabel="Target: 3.0 days"
        threshold={{ label: "Above target", tone: "warning" }}
      />
      <KpiCard
        label="Compliance Breach Rate"
        value="3.2%"
        delta={{ text: "↓ 0.4%", positive: true }}
        size="lg"
        sublabel={`${breachCount} of ${purchaseOrders.length} POs flagged this month`}
        threshold={{ label: "Within tolerance", tone: "success" }}
      />
      <KpiCard
        label="PO Deletion Frequency"
        value={deleted}
        delta={{ text: "↓ 25%", positive: true }}
        size="lg"
        sublabel="MoM — investigate spikes"
      />
    </div>
  );
}

// ===================== GROSS MARGIN TREND =====================
function GrossMarginTrend() {
  const data = financialHistory.slice(-12).map((p) => ({
    period: p.period,
    margin: p.margin,
    revenue: p.revenue,
    cost: p.cost,
  }));

  return (
    <SectionCard title="Gross Margin Trend" subtitle="Last 12 months · Target line at 25%">
      <div className="h-72">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E8" vertical={false} />
            <XAxis dataKey="period" tickLine={false} axisLine={false} />
            <YAxis
              tickLine={false}
              axisLine={false}
              domain={[15, 35]}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              formatter={(v: number, n) => {
                if (n === "margin") return [`${v}%`, "Margin"];
                return [formatINR(v), n];
              }}
            />
            <ReferenceLine y={25} stroke={brand.colors.warning} strokeDasharray="4 4" label={{ value: "Target 25%", fill: brand.colors.warning, fontSize: 10, position: "right" }} />
            <Line
              type="monotone"
              dataKey="margin"
              stroke={brand.colors.primary}
              strokeWidth={2.5}
              dot={{ r: 3, fill: brand.colors.primary }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}

// ===================== PO STATUS BREAKDOWN =====================
function POStatusBreakdown() {
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const wk = `W${i + 1}`;
    return {
      wk,
      Approved: 18 + Math.floor(Math.sin(i) * 4) + i,
      Pending: 6 + (i % 3) * 2,
      "Under Review": 3 + (i % 2),
      Deleted: i === 5 ? 3 : i % 4 === 0 ? 1 : 0,
    };
  });

  return (
    <SectionCard title="PO Status by Week" subtitle="Last 8 weeks">
      <div className="h-72">
        <ResponsiveContainer>
          <BarChart data={weeks} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E8" vertical={false} />
            <XAxis dataKey="wk" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="square" />
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

// ===================== HIGH-VALUE PO MONITOR =====================
function HighValuePOMonitor() {
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const filters = ["All", "Approved", "Pending", "Under Review", "Deleted"];

  const rows = purchaseOrders
    .filter((p) => p.value >= 50_00_000)
    .filter((p) => statusFilter === "All" || p.status === statusFilter)
    .slice(0, 10);

  return (
    <SectionCard
      title="High-Value PO Monitor"
      subtitle="POs above ₹50 L — sorted by days open"
      actions={
        <div className="flex gap-1">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`text-[11px] px-2 py-1 rounded border ${
                statusFilter === f
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-surface text-muted-foreground border-border hover:border-accent"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      }
      bodyClassName="p-0"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead className="bg-secondary text-muted-foreground">
            <tr className="text-left">
              <th className="px-4 py-2.5 font-semibold">PO Number</th>
              <th className="px-4 py-2.5 font-semibold">Vendor</th>
              <th className="px-4 py-2.5 font-semibold">Project</th>
              <th className="px-4 py-2.5 font-semibold text-right">Value</th>
              <th className="px-4 py-2.5 font-semibold">Status</th>
              <th className="px-4 py-2.5 font-semibold">DOA</th>
              <th className="px-4 py-2.5 font-semibold text-right">Days Open</th>
              <th className="px-4 py-2.5 font-semibold">Created By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((po) => (
              <tr
                key={po.id}
                className={`hover:bg-secondary/50 cursor-pointer ${po.hasComplianceBreach ? "border-l-4 border-l-danger" : ""}`}
              >
                <td className="px-4 py-2.5 font-mono font-semibold text-primary">{po.poNumber}</td>
                <td className="px-4 py-2.5 truncate max-w-[160px]">{po.vendorName}</td>
                <td className="px-4 py-2.5 truncate max-w-[200px] text-muted-foreground">{po.projectName}</td>
                <td className="px-4 py-2.5 text-right font-tabular font-semibold">{formatINR(po.value)}</td>
                <td className="px-4 py-2.5">
                  <StatusPill
                    tone={
                      po.status === "Approved"
                        ? "success"
                        : po.status === "Pending"
                        ? "warning"
                        : po.status === "Under Review"
                        ? "info"
                        : "danger"
                    }
                    dot
                  >
                    {po.status}
                  </StatusPill>
                </td>
                <td className="px-4 py-2.5 font-mono text-[11px]">{po.doaLevel}</td>
                <td className={`px-4 py-2.5 text-right font-tabular ${po.daysOpen > 14 ? "text-danger font-semibold" : ""}`}>
                  {po.daysOpen}d
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{po.createdBy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

// ===================== COMPLIANCE ALERTS =====================
function ComplianceAlerts() {
  const alerts = complianceChecks.filter((c) => c.status === "Fail").slice(0, 5);
  return (
    <SectionCard
      title="Compliance Alerts"
      subtitle="Latest breaches requiring action"
      accent="danger"
    >
      <ul className="space-y-3">
        {alerts.map((a) => (
          <li key={a.id} className="flex items-start gap-2.5 pb-3 border-b border-border last:border-b-0 last:pb-0">
            <AlertTriangle className="h-4 w-4 text-danger shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-semibold truncate">{a.vendorName}</div>
              <div className="text-[11px] text-muted-foreground">{a.type}</div>
            </div>
            <StatusPill tone={a.severity === "Critical" || a.severity === "High" ? "danger" : "warning"}>
              {a.severity}
            </StatusPill>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

// ===================== PO DELETIONS =====================
function PODeletions() {
  const deletions = purchaseOrders.filter((p) => p.status === "Deleted").slice(0, 5);
  return (
    <SectionCard title="PO Deletions — Anomaly Monitor" subtitle="Last 5 deletions" accent="warning">
      <ul className="space-y-3">
        {deletions.map((p) => (
          <li key={p.id} className="flex items-start gap-2.5 pb-3 border-b border-border last:border-b-0 last:pb-0">
            <Trash2 className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-semibold font-mono truncate">{p.poNumber}</div>
              <div className="text-[11px] text-muted-foreground truncate">{p.vendorName}</div>
              <div className="text-[10px] text-muted-foreground">By {p.createdBy} · {formatDateShort(p.createdAt)}</div>
            </div>
            <span className="text-[12px] font-tabular font-semibold">{formatINR(p.value)}</span>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

// ===================== UPCOMING RENEWALS =====================
function UpcomingRenewals() {
  const renewals = vendors
    .filter((v) => v.contractStatus === "Expiring Soon")
    .sort((a, b) => +new Date(a.contractEnd) - +new Date(b.contractEnd))
    .slice(0, 5);
  return (
    <SectionCard title="Upcoming Contract Renewals" subtitle="Within next 60 days" accent="info">
      <ul className="space-y-3">
        {renewals.map((v) => {
          const days = Math.ceil(
            (+new Date(v.contractEnd) - Date.now()) / (1000 * 60 * 60 * 24),
          );
          return (
            <li key={v.id} className="flex items-start gap-2.5 pb-3 border-b border-border last:border-b-0 last:pb-0">
              <CalendarClock className="h-4 w-4 text-accent shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold truncate">{v.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  Value at risk: <span className="font-semibold text-foreground">{formatINR(v.spendYTD)}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[14px] font-bold text-warning font-tabular">{days}d</div>
                <ChevronRight className="h-3 w-3 text-muted-foreground inline" />
              </div>
            </li>
          );
        })}
        {renewals.length === 0 && (
          <li className="text-[12px] text-muted-foreground text-center py-4">No upcoming renewals</li>
        )}
      </ul>
      {/* keep formatPercent ref so tree-shaking doesn't worry */}
      <span className="hidden">{formatPercent(0)}</span>
    </SectionCard>
  );
}
