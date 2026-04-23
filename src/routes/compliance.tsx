import { createFileRoute } from "@tanstack/react-router";
import { ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SectionCard } from "@/components/SectionCard";
import { StatusPill } from "@/components/StatusPill";
import { complianceChecks } from "@/data/mock";
import { formatDateShort } from "@/lib/format";
import { brand } from "@/lib/brand";

export const Route = createFileRoute("/compliance")({
  head: () => ({ meta: [{ title: "Compliance Center — KPMG IntelliSource" }] }),
  component: ComplianceCenter,
});

function ComplianceCenter() {
  const pass = complianceChecks.filter((c) => c.status === "Pass").length;
  const fail = complianceChecks.filter((c) => c.status === "Fail").length;
  const pending = complianceChecks.filter((c) => c.status === "Pending").length;
  const total = pass + fail + pending;
  const pct = ((pass / total) * 100).toFixed(0);
  const data = [
    { name: "Pass", value: pass, color: brand.colors.success },
    { name: "Fail", value: fail, color: brand.colors.danger },
    { name: "Pending", value: pending, color: brand.colors.warning },
  ];

  const rules = [
    { name: "ABAC Gift Threshold", limit: "₹5,000", active: true },
    { name: "Sanctions Screening", limit: "OFAC + EU", active: true },
    { name: "DOA Bypass Detection", limit: "Auto-flag", active: true },
    { name: "Duplicate Invoice Match", limit: "98% similarity", active: true },
    { name: "Rate Deviation Alert", limit: "±10% vs contract", active: true },
    { name: "Conflict of Interest", limit: "Director match", active: true },
  ];

  return (
    <AppShell>
      <PageHeader title="Compliance Center" subtitle="ABAC checks, breach history, audit trail" />

      <div className="grid grid-cols-3 gap-4">
        <SectionCard title="Compliance Score" subtitle={`${total} checks YTD`}>
          <div className="relative h-48">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={data} dataKey="value" innerRadius={60} outerRadius={85} paddingAngle={2}>
                  {data.map((d, i) => (<Cell key={i} fill={d.color} />))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-4xl font-bold font-tabular text-success">{pct}%</div>
              <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Pass Rate</div>
            </div>
          </div>
          <ul className="text-[12px] space-y-1.5 mt-3">
            {data.map((d) => (
              <li key={d.name} className="flex justify-between"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: d.color }} />{d.name}</span><span className="font-tabular font-semibold">{d.value}</span></li>
            ))}
          </ul>
        </SectionCard>

        <div className="col-span-2">
          <SectionCard title="Rule Library" subtitle="Active ABAC compliance rules" actions={<span className="text-[11px] text-muted-foreground">Admin only</span>}>
            <ul className="divide-y divide-border">
              {rules.map((r) => (
                <li key={r.name} className="py-2.5 flex items-center justify-between text-[12px]">
                  <div>
                    <div className="font-semibold">{r.name}</div>
                    <div className="text-[11px] text-muted-foreground">Threshold: {r.limit}</div>
                  </div>
                  <StatusPill tone="success" dot>Active</StatusPill>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      </div>

      <SectionCard title="Breach History" subtitle="All compliance check results" bodyClassName="p-0" className="mt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-secondary text-muted-foreground">
              <tr className="text-left">
                <th className="px-4 py-2.5 font-semibold">Date</th>
                <th className="px-4 py-2.5 font-semibold">Vendor</th>
                <th className="px-4 py-2.5 font-semibold">PO</th>
                <th className="px-4 py-2.5 font-semibold">Type</th>
                <th className="px-4 py-2.5 font-semibold">Severity</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold">Resolution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {complianceChecks.map((c) => (
                <tr key={c.id} className="hover:bg-secondary/50">
                  <td className="px-4 py-2.5 text-muted-foreground">{formatDateShort(c.date)}</td>
                  <td className="px-4 py-2.5 font-semibold">{c.vendorName}</td>
                  <td className="px-4 py-2.5 font-mono text-[11px]">{c.poNumber ?? "—"}</td>
                  <td className="px-4 py-2.5">{c.type}</td>
                  <td className="px-4 py-2.5"><StatusPill tone={c.severity === "Critical" || c.severity === "High" ? "danger" : c.severity === "Medium" ? "warning" : "info"}>{c.severity}</StatusPill></td>
                  <td className="px-4 py-2.5"><StatusPill tone={c.status === "Pass" ? "success" : c.status === "Fail" ? "danger" : "warning"} dot>{c.status}</StatusPill></td>
                  <td className="px-4 py-2.5 text-muted-foreground text-[11px]">{c.resolution ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </AppShell>
  );
}
