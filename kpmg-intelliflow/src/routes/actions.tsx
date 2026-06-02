import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SectionCard } from "@/components/SectionCard";
import { StatusPill } from "@/components/StatusPill";
import { actions } from "@/data/mock";
import { formatINR, formatDateShort } from "@/lib/format";

export const Route = createFileRoute("/actions")({
  head: () => ({ meta: [{ title: "Action Management — KPMG IntelliSource" }] }),
  component: ActionMgmt,
});

const COLUMNS = ["Open", "In Progress", "Under Review", "Closed"] as const;

function ActionMgmt() {
  return (
    <AppShell>
      <PageHeader
        title="Action Management"
        subtitle="Track procurement actions, owners and impact"
        actions={<button className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-[12px] font-semibold flex items-center gap-1.5 hover:bg-primary-dark"><Plus className="h-3.5 w-3.5" />Log New Action</button>}
      />

      <div className="grid grid-cols-4 gap-4">
        {COLUMNS.map((col) => {
          const items = actions.filter((a) => a.status === col);
          return (
            <div key={col} className="bg-secondary rounded-md flex flex-col">
              <div className="px-3 py-2.5 flex items-center justify-between border-b border-border">
                <span className="text-[12px] font-semibold uppercase tracking-wider">{col}</span>
                <span className="text-[11px] font-tabular bg-surface px-2 py-0.5 rounded">{items.length}</span>
              </div>
              <div className="p-2 space-y-2 flex-1">
                {items.map((a) => (
                  <div key={a.id} className="bg-surface border border-border rounded-md p-3 hover:border-accent cursor-pointer">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="text-[13px] font-semibold leading-snug">{a.title}</span>
                      <StatusPill tone={a.priority === "High" ? "danger" : a.priority === "Medium" ? "warning" : "info"}>{a.priority}</StatusPill>
                    </div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <StatusPill tone="info">{a.type}</StatusPill>
                    </div>
                    <div className="text-[11px] text-muted-foreground space-y-0.5">
                      <div>Owner: <span className="font-semibold text-foreground">{a.owner}</span></div>
                      <div>Due: <span className="font-semibold text-foreground">{formatDateShort(a.dueDate)}</span></div>
                      {a.impact > 0 && <div>Impact: <span className="font-tabular font-semibold text-success">{formatINR(a.impact)}</span></div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
