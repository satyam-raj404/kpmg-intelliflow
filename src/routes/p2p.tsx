import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";
import { ChevronRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SectionCard } from "@/components/SectionCard";
import { StatusPill } from "@/components/StatusPill";
import { formatINR } from "@/lib/format";
import { stageCounts, p2pItems } from "@/data/mock";
import { brand } from "@/lib/brand";
import type { P2PStage } from "@/types";

export const Route = createFileRoute("/p2p")({
  head: () => ({ meta: [{ title: "P2P Lifecycle Tracker — KPMG IntelliSource" }] }),
  component: P2PTracker,
});

const STAGES = Object.keys(stageCounts) as P2PStage[];

function P2PTracker() {
  const [filter, setFilter] = useState<P2PStage | "All">("All");
  const max = Math.max(...Object.values(stageCounts));
  const items = filter === "All" ? p2pItems : p2pItems.filter((i) => i.stage === filter);

  return (
    <AppShell>
      <PageHeader title="P2P Lifecycle Tracker" subtitle="16-stage Procure-to-Pay flow with bottleneck monitoring" />

      <SectionCard title="Lifecycle Flow" subtitle="Click a stage to filter the table below">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilter("All")}
            className={`text-[11px] px-2.5 py-1.5 rounded border ${filter === "All" ? "bg-primary text-primary-foreground border-primary" : "bg-surface border-border"}`}
          >
            All Stages
          </button>
          {STAGES.map((s, i) => {
            const count = stageCounts[s];
            const bottleneck = count > max * 0.85;
            const active = filter === s;
            return (
              <div key={s} className="flex items-center gap-0.5">
                <button
                  onClick={() => setFilter(s)}
                  className={`relative text-[11px] px-2.5 py-1.5 rounded border flex items-center gap-2 ${active ? "bg-primary text-primary-foreground border-primary" : "bg-surface border-border hover:border-accent"}`}
                >
                  {bottleneck && <span className="h-1.5 w-1.5 rounded-full bg-danger" />}
                  <span className="font-semibold">{s}</span>
                  <span className={`font-tabular text-[10px] px-1.5 py-0.5 rounded ${active ? "bg-white/20" : "bg-secondary"}`}>{count}</span>
                </button>
                {i < STAGES.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
              </div>
            );
          })}
        </div>
      </SectionCard>

      <div className="grid grid-cols-2 gap-4 mt-4">
        <SectionCard title="Funnel Conversion" subtitle="Major checkpoints">
          <ul className="space-y-3">
            {[
              { name: "Requirements Raised", val: 1200 },
              { name: "RFPs Issued", val: 480 },
              { name: "POs Created", val: 312 },
              { name: "GRN Received", val: 298 },
              { name: "Invoices Paid", val: 284 },
            ].map((s, i, arr) => {
              const pct = (s.val / arr[0].val) * 100;
              const conv = i > 0 ? ((s.val / arr[i - 1].val) * 100).toFixed(0) : null;
              return (
                <li key={s.name}>
                  <div className="flex items-baseline justify-between text-[12px] mb-1">
                    <span className="font-semibold">{s.name}</span>
                    <span className="font-tabular">
                      {s.val} {conv && <span className="text-muted-foreground ml-2">({conv}% from prev)</span>}
                    </span>
                  </div>
                  <div className="h-6 bg-secondary rounded-sm overflow-hidden">
                    <div className="h-full bg-primary flex items-center px-2 text-white text-[10px] font-semibold" style={{ width: `${pct}%` }}>
                      {pct.toFixed(0)}%
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </SectionCard>

        <SectionCard title="Cycle Time by Stage" subtitle="Avg days · top 8 longest">
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={STAGES.slice(0, 16).map((s) => ({ s, p50: 1 + (stageCounts[s] / 30), p90: 2 + (stageCounts[s] / 18) })).sort((a, b) => b.p90 - a.p90).slice(0, 8)} layout="vertical" margin={{ left: 110 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E8" horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(v) => `${v.toFixed(0)}d`} />
                <YAxis dataKey="s" type="category" tickLine={false} axisLine={false} fontSize={10} width={110} />
                <Tooltip formatter={(v: number) => `${v.toFixed(1)} days`} />
                <Bar dataKey="p50" fill={brand.colors.accent} name="P50" />
                <Bar dataKey="p90" fill={brand.colors.primary} name="P90" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Current P2P Items" subtitle={filter === "All" ? "All active items" : `Filtered: ${filter}`} bodyClassName="p-0" className="mt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-secondary text-muted-foreground">
              <tr className="text-left">
                <th className="px-4 py-2.5 font-semibold">Txn ID</th>
                <th className="px-4 py-2.5 font-semibold">Type</th>
                <th className="px-4 py-2.5 font-semibold">Stage</th>
                <th className="px-4 py-2.5 font-semibold">Vendor</th>
                <th className="px-4 py-2.5 font-semibold">Project</th>
                <th className="px-4 py-2.5 font-semibold text-right">Value</th>
                <th className="px-4 py-2.5 font-semibold text-right">Days in Stage</th>
                <th className="px-4 py-2.5 font-semibold">Owner</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold">Next Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.slice(0, 30).map((it) => (
                <tr key={it.id} className={`hover:bg-secondary/50 ${it.daysInStage > it.slaDays ? "border-l-4 border-l-danger" : ""}`}>
                  <td className="px-4 py-2.5 font-mono font-semibold text-primary">{it.txnId}</td>
                  <td className="px-4 py-2.5"><StatusPill tone="info">{it.type}</StatusPill></td>
                  <td className="px-4 py-2.5">{it.stage}</td>
                  <td className="px-4 py-2.5 truncate max-w-[140px]">{it.vendor}</td>
                  <td className="px-4 py-2.5 truncate max-w-[160px] text-muted-foreground">{it.project}</td>
                  <td className="px-4 py-2.5 text-right font-tabular">{formatINR(it.value)}</td>
                  <td className={`px-4 py-2.5 text-right font-tabular ${it.daysInStage > it.slaDays ? "text-danger font-bold" : ""}`}>{it.daysInStage}d</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{it.owner}</td>
                  <td className="px-4 py-2.5"><StatusPill tone={it.status === "On Track" ? "success" : "danger"} dot>{it.status}</StatusPill></td>
                  <td className="px-4 py-2.5 text-muted-foreground">{it.nextAction}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </AppShell>
  );
}
