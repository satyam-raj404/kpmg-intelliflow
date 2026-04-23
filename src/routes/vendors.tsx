import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  ComposedChart,
} from "recharts";
import { Star, Plus, ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SectionCard } from "@/components/SectionCard";
import { StatusPill } from "@/components/StatusPill";
import { ProgressBar } from "@/components/ProgressBar";
import { formatINR, formatDateShort } from "@/lib/format";
import { vendors, totalActiveVendors, abacCertifiedCount, expiringContracts, singleSourceCount } from "@/data/mock";
import { brand } from "@/lib/brand";
import { roleInitials } from "@/context/AppContext";

export const Route = createFileRoute("/vendors")({
  head: () => ({
    meta: [
      { title: "Vendor Performance — KPMG IntelliSource" },
      { name: "description", content: "Vendor scorecards, compliance, ratings and risk." },
    ],
  }),
  component: VendorPerformance,
});

function VendorPerformance() {
  return (
    <AppShell>
      <PageHeader
        title="Vendor Performance"
        subtitle="Assess vendor performance, compliance and portfolio risk"
        actions={
          <button className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-[12px] font-semibold flex items-center gap-1.5 hover:bg-primary-dark">
            <Plus className="h-3.5 w-3.5" />
            Add Vendor
          </button>
        }
      />

      <SummaryRibbon />

      <div className="grid grid-cols-2 gap-4 mt-4">
        <RatingHistogram />
        <ComplianceStatusPie />
      </div>

      <div className="mt-4">
        <ScorecardTable />
      </div>

      <div className="grid grid-cols-2 gap-4 mt-4">
        <RenewalCalendar />
        <PerformanceTrend />
      </div>
    </AppShell>
  );
}

function SummaryRibbon() {
  const breaches = 18;
  const avgRating = (vendors.reduce((s, v) => s + v.rating, 0) / vendors.length).toFixed(1);
  const items = [
    { label: "Total Active Vendors", value: totalActiveVendors + 437 }, // pad to 487 to match brief feel
    { label: "ABAC Certified", value: `${abacCertifiedCount + 365} (${(((abacCertifiedCount + 365) / (totalActiveVendors + 437)) * 100).toFixed(1)}%)` },
    { label: "Compliance Breaches (YTD)", value: breaches },
    { label: "Avg Vendor Rating", value: `${avgRating} / 5.0` },
    { label: "Contracts Expiring (60d)", value: expiringContracts + 5 },
    { label: "Single-Source Vendors", value: `${singleSourceCount + 17} ⚠`, danger: true },
  ];
  return (
    <div className="bg-surface border border-border rounded-md p-4 grid grid-cols-6 divide-x divide-border">
      {items.map((i) => (
        <div key={i.label} className="px-4 first:pl-0 last:pr-0">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{i.label}</div>
          <div className={`text-xl font-bold font-tabular mt-1 ${i.danger ? "text-warning" : ""}`}>{i.value}</div>
        </div>
      ))}
    </div>
  );
}

function RatingHistogram() {
  const buckets = [
    { range: "1.0–1.9", count: 0 },
    { range: "2.0–2.9", count: 0 },
    { range: "3.0–3.9", count: 0 },
    { range: "4.0–4.4", count: 0 },
    { range: "4.5–5.0", count: 0 },
  ];
  vendors.forEach((v) => {
    if (v.rating < 2) buckets[0].count++;
    else if (v.rating < 3) buckets[1].count++;
    else if (v.rating < 4) buckets[2].count++;
    else if (v.rating < 4.5) buckets[3].count++;
    else buckets[4].count++;
  });

  return (
    <SectionCard title="Vendor Rating Distribution" subtitle="50 active vendors">
      <div className="h-64">
        <ResponsiveContainer>
          <BarChart data={buckets}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E8" vertical={false} />
            <XAxis dataKey="range" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} />
            <Tooltip />
            <Bar dataKey="count" fill={brand.colors.primary} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}

function ComplianceStatusPie() {
  const compliant = vendors.filter((v) => v.compliance === "Compliant").length;
  const review = vendors.filter((v) => v.compliance === "Under Review").length;
  const non = vendors.filter((v) => v.compliance === "Non-Compliant").length;
  const data = [
    { name: "Compliant", value: compliant, color: brand.colors.success },
    { name: "Under Review", value: review, color: brand.colors.warning },
    { name: "Non-Compliant", value: non, color: brand.colors.danger },
  ];
  return (
    <SectionCard title="Compliance Status" subtitle="Vendor portfolio">
      <div className="h-64">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" outerRadius={90} label={(e) => `${e.value}`} labelLine={false}>
              {data.map((d, i) => (<Cell key={i} fill={d.color} />))}
            </Pie>
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} iconType="square" />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}

function ScorecardTable() {
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState<string>("All");
  const [sort, setSort] = useState<"spend" | "rating">("spend");

  const rows = useMemo(() => {
    let r = [...vendors];
    if (search) r = r.filter((v) => v.name.toLowerCase().includes(search.toLowerCase()));
    if (region !== "All") r = r.filter((v) => v.region === region);
    r.sort((a, b) => (sort === "spend" ? b.spendYTD - a.spendYTD : b.rating - a.rating));
    return r.slice(0, 25);
  }, [search, region, sort]);

  return (
    <SectionCard
      title="Vendor Scorecard"
      subtitle="Top 25 by selected sort"
      bodyClassName="p-0"
      actions={
        <div className="flex gap-2">
          <input
            type="search"
            placeholder="Search vendors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 px-3 rounded border border-border text-[12px] bg-surface w-44 focus:border-accent focus:outline-none"
          />
          {["All", "APAC", "EMEA", "Americas"].map((r) => (
            <button
              key={r}
              onClick={() => setRegion(r)}
              className={`text-[11px] px-2 py-1 rounded border ${region === r ? "bg-primary text-primary-foreground border-primary" : "bg-surface border-border hover:border-accent"}`}
            >
              {r}
            </button>
          ))}
        </div>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead className="bg-secondary text-muted-foreground">
            <tr className="text-left">
              <th className="px-4 py-2.5 font-semibold">Vendor</th>
              <th className="px-4 py-2.5 font-semibold">Category</th>
              <th className="px-4 py-2.5 font-semibold">Region</th>
              <th className="px-4 py-2.5 font-semibold cursor-pointer" onClick={() => setSort("rating")}>Rating</th>
              <th className="px-4 py-2.5 font-semibold w-32">Delivery</th>
              <th className="px-4 py-2.5 font-semibold w-32">Quality</th>
              <th className="px-4 py-2.5 font-semibold">Compliance</th>
              <th className="px-4 py-2.5 font-semibold text-right">Active POs</th>
              <th className="px-4 py-2.5 font-semibold text-right cursor-pointer" onClick={() => setSort("spend")}>Spend YTD</th>
              <th className="px-4 py-2.5 font-semibold">Contract</th>
              <th className="px-4 py-2.5 font-semibold">Risk</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((v) => (
              <tr key={v.id} className="hover:bg-secondary/50 cursor-pointer">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shrink-0">
                      {roleInitials(v.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{v.name}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{v.code}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <StatusPill tone="info">{v.category}</StatusPill>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{v.region}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 fill-warning text-warning" />
                    <span className="font-semibold font-tabular">{v.rating.toFixed(1)}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5"><ProgressBar value={v.deliveryScore} tone={v.deliveryScore >= 85 ? "success" : v.deliveryScore >= 70 ? "warning" : "danger"} /></td>
                <td className="px-4 py-2.5"><ProgressBar value={v.qualityScore} tone={v.qualityScore >= 85 ? "success" : v.qualityScore >= 70 ? "warning" : "danger"} /></td>
                <td className="px-4 py-2.5">
                  {v.compliance === "Compliant" && <ShieldCheck className="h-4 w-4 text-success" />}
                  {v.compliance === "Under Review" && <ShieldAlert className="h-4 w-4 text-warning" />}
                  {v.compliance === "Non-Compliant" && <ShieldX className="h-4 w-4 text-danger" />}
                </td>
                <td className="px-4 py-2.5 text-right font-tabular">{v.activePOs}</td>
                <td className="px-4 py-2.5 text-right font-tabular font-semibold">{formatINR(v.spendYTD)}</td>
                <td className="px-4 py-2.5">
                  <StatusPill tone={v.contractStatus === "Active" ? "success" : v.contractStatus === "Expiring Soon" ? "warning" : "danger"}>
                    {v.contractStatus}
                  </StatusPill>
                </td>
                <td className="px-4 py-2.5">
                  <StatusPill tone={v.riskTier === "Low" ? "success" : v.riskTier === "Medium" ? "warning" : "danger"} dot>
                    {v.riskTier}
                  </StatusPill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

function RenewalCalendar() {
  const upcoming = vendors
    .filter((v) => v.contractStatus !== "Expired")
    .sort((a, b) => +new Date(a.contractEnd) - +new Date(b.contractEnd))
    .slice(0, 8);
  return (
    <SectionCard title="Contract Renewal Calendar" subtitle="Next 90 days">
      <ul className="space-y-2.5">
        {upcoming.map((v) => {
          const days = Math.ceil((+new Date(v.contractEnd) - Date.now()) / 86400000);
          const tone = days <= 30 ? "danger" : days <= 60 ? "warning" : "info";
          const pct = Math.max(0, Math.min(100, ((90 - Math.max(0, days)) / 90) * 100));
          return (
            <li key={v.id}>
              <div className="flex items-baseline justify-between text-[12px] mb-1">
                <span className="font-semibold truncate flex-1">{v.name}</span>
                <span className={`font-tabular font-semibold ${tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-accent"}`}>{days}d</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1"><ProgressBar value={pct} tone={tone} /></div>
                <span className="text-[11px] text-muted-foreground font-tabular w-20 text-right">{formatINR(v.spendYTD)}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}

function PerformanceTrend() {
  const data = ["Q3-22", "Q4-22", "Q1-23", "Q2-23", "Q3-23", "Q4-23"].map((q, i) => ({
    quarter: q,
    rating: 3.6 + i * 0.08,
    compliance: 78 + i * 1.5,
  }));
  return (
    <SectionCard title="Vendor Performance Trend" subtitle="Last 6 quarters">
      <div className="h-64">
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E8" vertical={false} />
            <XAxis dataKey="quarter" tickLine={false} axisLine={false} />
            <YAxis yAxisId="left" tickLine={false} axisLine={false} domain={[3, 5]} tickFormatter={(v) => v.toFixed(1)} />
            <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} iconType="line" />
            <Line yAxisId="left" type="monotone" dataKey="rating" stroke={brand.colors.primary} strokeWidth={2} name="Avg Rating" />
            <Line yAxisId="right" type="monotone" dataKey="compliance" stroke={brand.colors.success} strokeWidth={2} name="Compliance Pass %" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}
