import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SectionCard } from "@/components/SectionCard";
import { auditLog } from "@/data/mock";
import { formatDateShort } from "@/lib/format";

export const Route = createFileRoute("/admin/audit")({
  head: () => ({ meta: [{ title: "Audit Trail — KPMG IntelliSource" }] }),
  component: AuditTrail,
});

function AuditTrail() {
  return (
    <AppShell>
      <PageHeader title="Audit Trail" subtitle="System activity log" />
      <SectionCard title="Recent Activity" subtitle={`${auditLog.length} entries`} bodyClassName="p-0">
        <table className="w-full text-[12px]">
          <thead className="bg-secondary text-muted-foreground">
            <tr className="text-left">
              <th className="px-4 py-2.5 font-semibold">Timestamp</th>
              <th className="px-4 py-2.5 font-semibold">User</th>
              <th className="px-4 py-2.5 font-semibold">Action</th>
              <th className="px-4 py-2.5 font-semibold">Entity</th>
              <th className="px-4 py-2.5 font-semibold">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {auditLog.map((a) => (
              <tr key={a.id} className="hover:bg-secondary/50">
                <td className="px-4 py-2.5 text-muted-foreground">{formatDateShort(a.timestamp)}</td>
                <td className="px-4 py-2.5 font-semibold">{a.user}</td>
                <td className="px-4 py-2.5">{a.action}</td>
                <td className="px-4 py-2.5 font-mono text-[11px]">{a.entity}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{a.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>
    </AppShell>
  );
}
