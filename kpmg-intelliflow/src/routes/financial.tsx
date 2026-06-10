import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
  LabelList,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard } from "@/components/KpiCard";
import { SectionCard } from "@/components/SectionCard";
import { formatINR } from "@/lib/format";
import { brand } from "@/lib/brand";
import { useKpi, useKpiValue, useKpiCompanies, useCharts, usePrefetchKpiCompanies } from "@/hooks/useKpi";

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function fmtMonth(raw: string): string {
  if (!raw) return raw;
  const m = raw.match(/^(\d{4})-(\d{2})/);
  if (m) return `${MONTH_NAMES[parseInt(m[2], 10) - 1]}'${m[1].slice(2)}`;
  return raw;
}

export const Route = createFileRoute("/financial")({
  head: () => ({
    meta: [
      { title: "Financial Dashboard — KPMG IntelliSource" },
      { name: "description", content: "Spend vs budget tracking, cash flow, invoice/payment cycle health." },
    ],
  }),
  component: FinancialDashboard,
});

function CompanyFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data } = useKpiCompanies("financial");
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

function FinancialDashboard() {
  const [company, setCompany] = useState("ALL");
  usePrefetchKpiCompanies("financial");

  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <PageHeader title="Financial Dashboard" subtitle="Spend vs budget tracking, cash flow, invoice/payment cycle health" />
        <CompanyFilter value={company} onChange={setCompany} />
      </div>
      <KpiRow company={company} />
      <PaymentTimingRow company={company} />
      <div className="grid grid-cols-2 gap-4 mt-4">
        <PaymentTrend />
        <PaymentBehavior company={company} />
      </div>
      <div className="mt-4">
        <ThreeWayMatchTrend />
      </div>
    </AppShell>
  );
}

function KpiRow({ company }: { company: string }) {
  const { isLoading } = useKpi("financial", company);
  const f1 = useKpiValue("financial", "TOTAL_PAYMENTS_YTD", company);
  const f2 = useKpiValue("financial", "PAYMENT_TO_PO_RATIO", company);
  const f3 = useKpiValue("financial", "THREE_WAY_MATCH_RATE", company);
  const f4 = useKpiValue("financial", "INVOICE_PROCESSING_DAYS", company);
  const f5 = useKpiValue("financial", "ON_TIME_PAYMENT_RATE", company);
  const f7 = useKpiValue("financial", "OPEN_INVOICE_VALUE", company);
  const fpr = useKpiValue("financial", "APPROVED_PR_COUNT", company);

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
        <KpiCard label="Total Payments (YTD)" value={fmt(f1?.value_numeric, f1?.unit)} size="lg" sublabel="SUM payment_dump this FY" index={0} />
        <KpiCard label="Payment-to-PO Ratio" value={fmt(f2?.value_numeric, f2?.unit)} size="lg" sublabel="Payments ÷ Total PO Value" index={1} />
        <KpiCard label="3-Way Match Rate" value={fmt(f3?.value_numeric, f3?.unit)} size="lg" sublabel="GRN qty ≈ Invoice qty (±5%)" threshold={f3?.value_numeric != null && f3.value_numeric < 85 ? { label: "Below 85% target", tone: "danger" } : { label: "Good", tone: "success" }} index={2} />
        <KpiCard label="Invoice Processing Days" value={fmt(f4?.value_numeric, f4?.unit)} size="lg" sublabel="Avg vendor_invoice_date → clearing_date" index={3} />
      </div>
      <div className="grid grid-cols-3 gap-3 mt-3">
        <KpiCard label="On-Time Payment Rate" value={fmt(f5?.value_numeric, f5?.unit)} size="md" sublabel="Paid on/before due_date" threshold={f5?.value_numeric != null && f5.value_numeric < 80 ? { label: "Below target", tone: "warning" } : { label: "On track", tone: "success" }} index={4} />
        <KpiCard label="Open Invoice Value" value={fmt(f7?.value_numeric, f7?.unit)} size="md" sublabel="Unpaid invoices net of credit notes" threshold={f7?.value_numeric != null && f7.value_numeric > 1_000_000 ? { label: "High outstanding", tone: "warning" } : undefined} index={5} />
        <KpiCard label="Approved PRs (YTD)" value={fmt(fpr?.value_numeric, fpr?.unit)} size="md" sublabel="Distinct approved PR line items this FY" index={6} />
      </div>
    </>
  );
}

function PaymentTimingRow({ company }: { company: string }) {
  const { isLoading } = useKpi("financial", company);
  const early  = useKpiValue("financial", "EARLY_PAYMENT_COUNT",   company);
  const ontime = useKpiValue("financial", "ON_TIME_PAYMENT_COUNT", company);
  const late   = useKpiValue("financial", "LATE_PAYMENT_COUNT",    company);
  const summary = useKpiValue("financial", "PAYMENT_TIMING_SUMMARY", company);

  const parsed = (() => {
    try { return summary?.value_text ? JSON.parse(summary.value_text) : null; } catch { return null; }
  })();

  const fmt = (v: number | null | undefined) =>
    v == null ? (isLoading ? "—" : "No data") : v.toFixed(0);

  return (
    <div className="grid grid-cols-3 gap-3 mt-3">
      <KpiCard
        label="Early Payments"
        value={fmt(early?.value_numeric)}
        size="md"
        sublabel={parsed?.avg_days_early ? `Avg ${parsed.avg_days_early}d before due` : "Cleared before due date"}
        threshold={{ label: "Favourable", tone: "success" }}
        index={8}
      />
      <KpiCard
        label="On-Time Payments"
        value={fmt(ontime?.value_numeric)}
        size="md"
        sublabel="Cleared exactly on due date"
        threshold={{ label: "Ideal", tone: "success" }}
        index={9}
      />
      <KpiCard
        label="Late Payments"
        value={fmt(late?.value_numeric)}
        size="md"
        sublabel={parsed?.avg_days_late ? `Avg ${parsed.avg_days_late}d past due` : "Cleared after due date"}
        threshold={late?.value_numeric != null && late.value_numeric > 0 ? { label: "Needs attention", tone: "danger" } : { label: "None", tone: "success" }}
        index={10}
      />
    </div>
  );
}

function PaymentTrend() {
  const { data, isLoading } = useCharts("financial");
  const raw = data?.series as unknown as { type?: string; monthly?: Array<{ month: string; payments: number }> };
  const chartData = (raw?.monthly ?? []).map((p) => ({
    month: p.month ?? "",
    payments: (p.payments ?? 0) / 1_00_00_000,
  }));

  return (
    <SectionCard title="Monthly Payments" subtitle="Last 12 months · ₹ Cr">
      <div className="h-64">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
        ) : chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Upload payment data to view trend</div>
        ) : (
          <ResponsiveContainer>
            <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
              <defs>
                <linearGradient id="payGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={brand.colors.success} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={brand.colors.success} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tickFormatter={fmtMonth} tick={{ fontSize: 10 }} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v.toFixed(0)}Cr`} />
              <Tooltip formatter={(v: number) => [`₹${v.toFixed(2)} Cr`, "Payments"]} labelFormatter={fmtMonth} />
              <Area type="monotone" dataKey="payments" stroke={brand.colors.success} strokeWidth={2} fill="url(#payGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </SectionCard>
  );
}

function PaymentBehavior({ company }: { company: string }) {
  const summary = useKpiValue("financial", "PAYMENT_TIMING_SUMMARY", company);
  const { isLoading } = useKpi("financial", company);

  const parsed = (() => {
    try { return summary?.value_text ? JSON.parse(summary.value_text) : null; } catch { return null; }
  })();

  const pieData = parsed ? [
    { name: "Early",   value: parsed.early,   fill: brand.colors.accent   },
    { name: "On-Time", value: parsed.on_time,  fill: brand.colors.success  },
    { name: "Late",    value: parsed.late,     fill: brand.colors.danger   },
  ] : [];

  const total = parsed?.total ?? 0;

  return (
    <SectionCard title="Payment Timing Breakdown" subtitle="Early / On-Time / Late vs due date">
      <div className="h-64">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
        ) : !parsed || total === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Upload payment + invoice data</div>
        ) : (
          <div className="flex items-center h-full gap-6">
            <ResponsiveContainer width="55%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={48} outerRadius={82}
                  dataKey="value" paddingAngle={3} label={false}>
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip formatter={(v: number) => [`${v} payments`]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-3 flex-1">
              {pieData.map((d) => (
                <div key={d.name} className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-sm flex-shrink-0" style={{ background: d.fill }} />
                  <div className="min-w-0">
                    <div className="text-[11px] font-medium">{d.name}</div>
                    <div className="text-[18px] font-semibold font-tabular">{d.value}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {total ? ((d.value / total) * 100).toFixed(1) : 0}%
                    </div>
                  </div>
                </div>
              ))}
              <div className="text-[10px] text-muted-foreground pt-1 border-t border-border">
                Total: {total} payments
                {parsed?.avg_days_early ? ` · Avg early: ${parsed.avg_days_early}d` : ""}
                {parsed?.avg_days_late  ? ` · Avg late: ${parsed.avg_days_late}d`  : ""}
              </div>
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}


function ThreeWayMatchTrend() {
  const { data, isLoading } = useCharts("financial");
  const raw = data?.series as unknown;
  const monthly = Array.isArray(raw)
    ? raw
    : (raw as { monthly?: Array<{ month: string; payments: number }> })?.monthly ?? [];

  const chartData = monthly.map((p: { month?: string; payments?: number }) => ({
    month: p.month ?? "",
    payments: ((p.payments as number) ?? 0) / 1_00_00_000,
  }));

  return (
    <SectionCard title="Monthly Payment Volume" subtitle="₹ Cr per month">
      <div className="h-64">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
        ) : chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Upload payment data to view</div>
        ) : (
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 24, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} tickFormatter={fmtMonth} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v.toFixed(0)}Cr`} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => [`₹${v.toFixed(2)} Cr`, "Payments"]} labelFormatter={fmtMonth} />
              <Bar dataKey="payments" fill={brand.colors.success} radius={[3, 3, 0, 0]}>
                <LabelList dataKey="payments" position="top" formatter={(v: number) => `₹${v.toFixed(1)}Cr`} style={{ fontSize: 9, fill: "#555" }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </SectionCard>
  );
}
