import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SectionCard } from "@/components/SectionCard";
import { StatusPill } from "@/components/StatusPill";
import { apiFetch } from "@/api/client";

export const Route = createFileRoute("/admin/audit")({
  head: () => ({ meta: [{ title: "Audit Trail — KPMG IntelliSource" }] }),
  component: AuditTrail,
});

interface AuditEntry {
  id: number;
  user: string;
  action: string;
  entity: string;
  entity_id: string;
  details: string;
  timestamp: string;
}

const ACTION_TONE: Record<string, "success" | "danger" | "warning" | "info"> = {
  LOGIN:              "success",
  LOGIN_FAILED:       "danger",
  LOGOUT:             "warning",
  USER_CREATED:       "success",
  USER_UPDATED:       "info",
  PASSWORD_RESET:     "warning",
  SELF_REGISTER:      "success",
  DATA_UPLOAD:        "success",
  UPLOAD_FAILED:      "danger",
  VENDOR_CREATED:     "success",
  PC_CREATED:         "success",
  PC_UPDATED:         "info",
  PC_DELETED:         "danger",
  KPI_CONFIG_UPDATED: "warning",
  ACTION_LOGGED:      "info",
  CHAT_QUERY:         "info",
  SESSION:            "info",
};

function formatTs(ts: string) {
  try {
    return new Date(ts).toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false,
    });
  } catch {
    return ts;
  }
}

function AuditTrail() {
  const { data, isLoading, isError } = useQuery<AuditEntry[]>({
    queryKey: ["audit-log"],
    queryFn: () => apiFetch<AuditEntry[]>("/audit?limit=200"),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  return (
    <AppShell>
      <PageHeader title="Audit Trail" subtitle="Real-time system activity log" />
      <SectionCard
        title={`${data?.length ?? 0} Entries`}
        subtitle="Last 200 events · Auto-refreshes every 30 s"
        bodyClassName="p-0"
      >
        {isLoading && (
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground p-6">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading audit log…
          </div>
        )}
        {isError && (
          <p className="text-[12px] text-danger p-4">Failed to load audit log from API.</p>
        )}
        {data && data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead className="bg-secondary text-muted-foreground sticky top-0">
                <tr className="text-left">
                  <th className="px-4 py-2.5 font-semibold whitespace-nowrap">Timestamp</th>
                  <th className="px-4 py-2.5 font-semibold">User</th>
                  <th className="px-4 py-2.5 font-semibold">Action</th>
                  <th className="px-4 py-2.5 font-semibold">Entity</th>
                  <th className="px-4 py-2.5 font-semibold">ID</th>
                  <th className="px-4 py-2.5 font-semibold">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.map((a) => (
                  <tr key={a.id} className="hover:bg-secondary/50">
                    <td className="px-4 py-2 text-muted-foreground whitespace-nowrap font-mono text-[11px]">
                      {formatTs(a.timestamp)}
                    </td>
                    <td className="px-4 py-2 font-semibold">{a.user}</td>
                    <td className="px-4 py-2">
                      <StatusPill tone={ACTION_TONE[a.action] ?? "info"}>
                        {a.action}
                      </StatusPill>
                    </td>
                    <td className="px-4 py-2 font-mono text-[11px] text-muted-foreground">{a.entity}</td>
                    <td className="px-4 py-2 font-mono text-[11px] text-muted-foreground truncate max-w-[120px]">{a.entity_id}</td>
                    <td className="px-4 py-2 text-muted-foreground truncate max-w-[240px]">{a.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.length === 0 && (
          <p className="text-[12px] text-muted-foreground p-6">No audit entries yet.</p>
        )}
      </SectionCard>
    </AppShell>
  );
}
