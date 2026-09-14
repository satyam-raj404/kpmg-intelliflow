import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Upload, Download, Trash2, FileText, CheckCircle, XCircle, Clock } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SectionCard } from "@/components/SectionCard";
import { useApp, type HistoryEntry } from "@/context/AppContext";

export const Route = createFileRoute("/history")({
  head: () => ({ meta: [{ title: "Activity History — KPMG IntelliSource" }] }),
  component: HistoryPage,
});

type Tab = "all" | "upload" | "download";

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function StatusBadge({ status }: { status: HistoryEntry["status"] }) {
  if (status === "success") return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
      <CheckCircle className="h-3 w-3" /> Success
    </span>
  );
  if (status === "failed") return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
      <XCircle className="h-3 w-3" /> Failed
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
      <Clock className="h-3 w-3" /> Pending
    </span>
  );
}

function TypeIcon({ type }: { type: HistoryEntry["type"] }) {
  if (type === "upload") return (
    <div className="h-8 w-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
      <Upload className="h-4 w-4 text-blue-600" />
    </div>
  );
  return (
    <div className="h-8 w-8 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center shrink-0">
      <Download className="h-4 w-4 text-purple-600" />
    </div>
  );
}

function HistoryPage() {
  const { activityLog, clearHistory } = useApp();
  const [tab, setTab] = useState<Tab>("all");
  const [confirmClear, setConfirmClear] = useState(false);

  const filtered = activityLog.filter((e) => tab === "all" || e.type === tab);

  const uploadCount   = activityLog.filter((e) => e.type === "upload").length;
  const downloadCount = activityLog.filter((e) => e.type === "download").length;

  const handleClear = () => {
    if (confirmClear) {
      clearHistory();
      setConfirmClear(false);
    } else {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000);
    }
  };

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "all",      label: "All",       count: activityLog.length },
    { key: "upload",   label: "Uploads",   count: uploadCount },
    { key: "download", label: "Downloads", count: downloadCount },
  ];

  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <PageHeader
          title="Activity History"
          subtitle="Record of all data uploads and report downloads"
        />
        {activityLog.length > 0 && (
          <button
            onClick={handleClear}
            className={`flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-md border transition-colors ${
              confirmClear
                ? "border-red-300 bg-red-50 text-red-600 hover:bg-red-100"
                : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-border/80"
            }`}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {confirmClear ? "Click again to confirm" : "Clear History"}
          </button>
        )}
      </div>

      {/* Stat chips */}
      <div className="flex gap-3 mt-1">
        {[
          { label: "Total Events",  value: activityLog.length, color: "text-foreground" },
          { label: "Uploads",       value: uploadCount,         color: "text-blue-600"   },
          { label: "Downloads",     value: downloadCount,       color: "text-purple-600" },
          { label: "Successful",    value: activityLog.filter(e => e.status === "success").length, color: "text-emerald-600" },
          { label: "Failed",        value: activityLog.filter(e => e.status === "failed").length,  color: "text-red-600"     },
        ].map((s) => (
          <div key={s.label} className="bg-secondary/50 border border-border rounded-lg px-4 py-2 flex flex-col items-center min-w-[88px]">
            <span className={`text-xl font-bold font-tabular ${s.color}`}>{s.value}</span>
            <span className="text-[10px] text-muted-foreground">{s.label}</span>
          </div>
        ))}
      </div>

      <SectionCard title="" subtitle="">
        {/* Tabs */}
        <div className="flex gap-1 border-b border-border mb-4 -mt-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-2 text-[13px] font-medium border-b-2 transition-colors -mb-px ${
                tab === t.key
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
              <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-tabular ${
                tab === t.key ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
              }`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <FileText className="h-10 w-10 opacity-20" />
            <div className="text-sm font-medium">No activity yet</div>
            <div className="text-[12px] opacity-60">
              {tab === "upload" ? "Upload a CSV file to see it here." :
               tab === "download" ? "Download a report to see it here." :
               "Upload data or download a report to get started."}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((entry) => (
              <div key={entry.id} className="flex items-center gap-3 py-3 hover:bg-secondary/30 rounded-md px-2 -mx-2 transition-colors">
                <TypeIcon type={entry.type} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium">{entry.label}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full uppercase tracking-wide ${
                      entry.type === "upload"
                        ? "bg-blue-50 text-blue-600 border border-blue-200"
                        : "bg-purple-50 text-purple-600 border border-purple-200"
                    }`}>
                      {entry.type}
                    </span>
                  </div>
                  <div className="text-[12px] text-muted-foreground mt-0.5 truncate">{entry.detail}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[11px] text-muted-foreground">{entry.user}</div>
                  <div className="text-[11px] text-muted-foreground/60 mt-0.5">{formatTime(entry.timestamp)}</div>
                </div>
                <div className="shrink-0 w-24 flex justify-end">
                  <StatusBadge status={entry.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </AppShell>
  );
}
