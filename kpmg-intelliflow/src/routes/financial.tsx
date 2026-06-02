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
import { useKpi, useKpiValue, useCharts } from "@/hooks/useKpi";

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
  return (
    <AppShell>
      <PageHeader title="Financial Dashboard" subtitle="Spend vs budget tracking, cash flow, invoice/payment cycle health" />
      <KpiRow />
      <div className="grid grid-cols-2 gap-4 mt-4">
        <PaymentTrend />
        <PaymentBehavior />
      </div>
      <div className="grid grid-cols-2 gap-4 mt-4">
        <InvoiceAgingBuckets />
        <ThreeWayMatchTrend />
      </div>
    </AppShell>
  );
}

function KpiRow() {
  const { isLoading } = useKpi("financial");
  const f1 = useKpiValue("financial", "TOTAL_PAYMENTS_YTD");
  const f2 = useKpiValue("financial", "PAYMENT_TO_PO_RATIO");
  const f3 = useKpiValue("financial", "THREE_WAY_MATCH_RATE");
  const f4 = useKpiValue("financial", "INVOICE_PROCESSING_DAYS");
  const f5 = useKpiValue("financial", "ON_TIME_PAYMENT_RATE");
  const f6 = useKpiValue("financial", "AVG_PAYMENT_DELAY");
  const f7 = useKpiValue("financial", "OPEN_INVOICE_VALUE");
  const f8 = useKpiValue("financial", "DISCOUNT_CAPTURE_RATE");

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
        <KpiCard label="Invoice Processing Days" value={fmt(f4?.value_numeric, f4?.unit)} size="lg" sublabel="Avg vendor_invoice_date → posting_date" index={3} />
      </div>
      <div className="grid grid-cols-4 gap-3 mt-3">
        <KpiCard label="On-Time Payment Rate" value={fmt(f5?.value_numeric, f5?.unit)} size="md" sublabel="Paid on/before due_date" threshold={f5?.value_numeric != null && f5.value_numeric < 80 ? { label: "Below target", tone: "warning" } : { label: "On track", tone: "success" }} index={4} />
        <KpiCard label="Avg Payment Delay" value={fmt(f6?.value_numeric, f6?.unit)} size="md" sublabel="Late payments only (days past due)" index={5} />
        <KpiCard label="Open Invoice Value" value={fmt(f7?.value_numeric, f7?.unit)} size="md" sublabel="Invoices with no clearing doc" threshold={f7?.value_numeric != null && f7.value_numeric > 1_000_000 ? { label: "High outstanding", tone: "warning" } : undefined} index={6} />
        <KpiCard label="Discount Capture Rate" value={fmt(f8?.value_numeric, f8?.unit)} size="md" sublabel="Early pay discounts captured" index={7} />
      </div>
    </>
  );
}

function PaymentTrend() {
  const { data, isLoading } = useCharts("financial");
  const chartData = (data?.series ?? []).map((p) => ({
    month: p.month ?? "",
    payments: ((p.payments as number) ?? 0) / 1_00_00_000,
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
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v.toFixed(0)}Cr`} />
              <Tooltip formatter={(v: number) => [`₹${v.toFixed(2)} Cr`, "Payments"]} />
              <Area type="monotone" dataKey="payments" stroke={brand.colors.success} strokeWidth={2} fill="url(#payGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </SectionCard>
  );
}

function PaymentBehavior() {
  const { data, isLoading } = useCharts("financial");
  const raw = data?.series as unknown as { type?: string; payment_split?: { on_time: number; late: number; total: number } };
  const split = raw?.payment_split;

  const pieData = split ? [
    { name: "On-Time", value: split.on_time, fill: brand.colors.success },
    { name: "Late",    value: split.late,    fill: brand.colors.danger  },
  ] : [];

  return (
    <SectionCard title="Payment On-Time vs Late" subtitle="Count of payments vs due date">
      <div className="h-64">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
        ) : pieData.length === 0 || !split?.total ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Upload payment + invoice data</div>
        ) : (
          <div className="flex items-center h-full gap-6">
            <ResponsiveContainer width="60%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={52} outerRadius={88}
                  dataKey="value" paddingAngle={3} label={false}>
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip formatter={(v: number) => [`${v} payments`]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-3">
              {pieData.map(d => (
                <div key={d.name} className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-sm" style={{ background: d.fill }} />
                  <div>
                    <div className="text-[11px] font-medium">{d.name}</div>
                    <div className="text-[18px] font-semibold font-tabular">{d.value}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {split.total ? ((d.value / split.total) * 100).toFixed(1) : 0}%
                    </div>
                  </div>
                </div>
              ))}
              <div className="text-[10px] text-muted-foreground pt-1 border-t border-border">
                Total: {split?.total ?? 0} payments
              </div>
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

function InvoiceAgingBuckets() {
  const { data, isLoading } = useCharts("financial");
  const raw = data?.series as unknown as { type?: string; aging_buckets?: Array<{ bucket: string; value: number }> };
  const buckets = raw?.aging_buckets ?? [];

  const BUCKET_COLORS = [brand.colors.success, brand.colors.accent, brand.colors.warning, brand.colors.danger];

  return (
    <SectionCard title="Open Invoice Aging" subtitle="Unpaid invoices by age bucket — ₹ Cr">
      <div className="h-64">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
        ) : buckets.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Upload invoice data</div>
        ) : (
          <ResponsiveContainer>
            <BarChart data={buckets} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
              <XAxis dataKey="bucket" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}Cr`} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => [`₹${v.toFixed(2)} Cr`, "Outstanding"]} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {buckets.map((_, i) => <Cell key={i} fill={BUCKET_COLORS[i]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </SectionCard>
  );
}

function ThreeWayMatchTrend() {
  const { data, isLoading } = useCharts("financial");
  // Use monthly data as proxy for 3-way match trend over time
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
            <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v.toFixed(0)}Cr`} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => [`₹${v.toFixed(2)} Cr`, "Payments"]} />
              <Bar dataKey="payments" fill={brand.colors.success} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </SectionCard>
  );
}
