import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ShieldAlert,
  AlertTriangle,
  Info,
  Trash2,
  Loader2,
  X,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SectionCard } from "@/components/SectionCard";
import { StatusPill } from "@/components/StatusPill";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { apiFetch } from "@/api/client";
import { fetchAnomalies, fetchAnomalyDetail, type AnomalyDetailRow } from "@/api/queries";
import type { AnomalyCount } from "@/api/types";
import { formatINR, formatDateShort } from "@/lib/format";

export const Route = createFileRoute("/alerts")({
  head: () => ({ meta: [{ title: "Alerts — KPMG IntelliSource" }] }),
  component: AlertsPage,
});

// ── helpers ────────────────────────────────────────────────────────────────────

function humanize(code: string) {
  return code
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const HIGH_FLAGS = new Set([
  "MAVERICK_BUY",
  "VENDOR_BLOCK",
  "PAYMENT_BEFORE_GRN",
  "THREE_WAY_MISMATCH",
  "DUPLICATE_INVOICE",
  "GRN_WITHOUT_PO",
]);
const MED_FLAGS = new Set(["PRICE_DEVIATION", "LATE_DELIVERY", "SPLIT_PO", "OVERDUE_INVOICE"]);

function severityOf(code: string) {
  if (HIGH_FLAGS.has(code)) return "HIGH";
  if (MED_FLAGS.has(code))  return "MEDIUM";
  return "LOW";
}

// ── Anomaly detail sheet ───────────────────────────────────────────────────────

interface DetailSheetProps {
  anomaly: AnomalyCount | null;
  onClose: () => void;
}

function DetailSheet({ anomaly, onClose }: DetailSheetProps) {
  const open = anomaly !== null;

  const { data = [], isLoading, isError } = useQuery<AnomalyDetailRow[]>({
    queryKey: ["anomaly-detail", anomaly?.anomaly_code],
    queryFn: () => fetchAnomalyDetail(anomaly!.anomaly_code, 100),
    enabled: open,
    staleTime: 60_000,
  });

  const severityColor =
    anomaly?.severity === "HIGH"
      ? "text-danger"
      : anomaly?.severity === "MEDIUM"
      ? "text-warning"
      : "text-accent";

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full max-w-4xl overflow-y-auto">
        <SheetHeader className="mb-4">
          <div className="flex items-center gap-2">
            {anomaly?.severity === "HIGH" ? (
              <ShieldAlert className={`h-5 w-5 ${severityColor}`} />
            ) : anomaly?.severity === "MEDIUM" ? (
              <AlertTriangle className={`h-5 w-5 ${severityColor}`} />
            ) : (
              <Info className={`h-5 w-5 ${severityColor}`} />
            )}
            <SheetTitle className="text-[16px]">
              {anomaly ? humanize(anomaly.anomaly_code) : ""}
            </SheetTitle>
          </div>
          <SheetDescription className="text-[12px] mt-1">
            {anomaly?.description} &nbsp;·&nbsp;{" "}
            <span className={`font-semibold ${severityColor}`}>
              {anomaly?.count} affected PO{anomaly?.count !== 1 ? "s" : ""}
            </span>
          </SheetDescription>
        </SheetHeader>

        {isLoading && (
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading records…
          </div>
        )}
        {isError && (
          <p className="text-[12px] text-danger py-4">Failed to load detail records.</p>
        )}
        {!isLoading && !isError && data.length === 0 && (
          <p className="text-[12px] text-muted-foreground py-8 text-center">
            No matching PO records found.
          </p>
        )}
        {data.length > 0 && (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-[12px]">
              <thead className="bg-secondary text-muted-foreground">
                <tr className="text-left">
                  <th className="px-3 py-2.5 font-semibold whitespace-nowrap">PO Number</th>
                  <th className="px-3 py-2.5 font-semibold">Vendor</th>
                  <th className="px-3 py-2.5 font-semibold">Material</th>
                  <th className="px-3 py-2.5 font-semibold">Group</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Value</th>
                  <th className="px-3 py-2.5 font-semibold">Date</th>
                  <th className="px-3 py-2.5 font-semibold">PR</th>
                  <th className="px-3 py-2.5 font-semibold">All Flags</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.map((row, i) => {
                  const flags = row.anomaly_flags
                    ? row.anomaly_flags.split(",").map((f) => f.trim()).filter(Boolean)
                    : [];
                  return (
                    <tr key={`${row.purchasing_document}-${i}`} className="hover:bg-secondary/40">
                      <td className="px-3 py-2 font-mono font-medium text-primary text-[11px]">
                        {row.purchasing_document}
                      </td>
                      <td className="px-3 py-2">
                        <div className="truncate max-w-[140px]" title={row.vendor_name ?? row.vendor ?? ""}>
                          {row.vendor_name ?? row.vendor ?? "—"}
                        </div>
                        {row.vendor && row.vendor !== row.vendor_name && (
                          <div className="text-[10px] text-muted-foreground font-mono">{row.vendor}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 truncate max-w-[140px] text-muted-foreground text-[11px]" title={row.material_description ?? ""}>
                        {row.material_description ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded font-mono">
                          {row.material_group ?? "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">
                        {row.net_order_value != null ? formatINR(row.net_order_value) : "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                        {row.document_date ? formatDateShort(row.document_date) : "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">
                        {row.purchase_requisition ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {flags.map((f) => (
                            <span
                              key={f}
                              className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                                HIGH_FLAGS.has(f)
                                  ? "bg-danger/10 text-danger"
                                  : MED_FLAGS.has(f)
                                  ? "bg-warning/10 text-warning"
                                  : "bg-accent/10 text-accent"
                              }`}
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ── Anomaly Alerts list ────────────────────────────────────────────────────────

function AnomalyAlertsList() {
  const [selected, setSelected] = useState<AnomalyCount | null>(null);

  const { data: anomalies = [], isLoading } = useQuery<AnomalyCount[]>({
    queryKey: ["anomalies"],
    queryFn: fetchAnomalies,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const sorted = [...anomalies].sort((a, b) => {
    const rank: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return (rank[a.severity] ?? 3) - (rank[b.severity] ?? 3);
  });

  const highCount   = sorted.filter((a) => a.severity === "HIGH").length;
  const medCount    = sorted.filter((a) => a.severity === "MEDIUM").length;
  const lowCount    = sorted.filter((a) => a.severity === "LOW").length;

  return (
    <>
      <SectionCard
        title="Anomaly Alerts"
        subtitle={`${sorted.length} active anomaly types · click to inspect affected POs · refreshes every 2 min`}
        actions={
          highCount > 0 ? (
            <StatusPill tone="danger" dot>{highCount} High Risk</StatusPill>
          ) : sorted.length > 0 ? (
            <StatusPill tone="warning" dot>Review Required</StatusPill>
          ) : (
            <StatusPill tone="success" dot>All Clear</StatusPill>
          )
        }
        bodyClassName="p-0"
      >
        {/* severity summary strip */}
        {sorted.length > 0 && (
          <div className="flex gap-4 px-4 py-2.5 border-b border-border text-[11px]">
            <span className="text-danger font-semibold">{highCount} High</span>
            <span className="text-warning font-semibold">{medCount} Medium</span>
            <span className="text-accent font-semibold">{lowCount} Low</span>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground p-6 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading anomalies…
          </div>
        ) : sorted.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No anomalies detected</div>
        ) : (
          <div className="divide-y divide-border">
            {sorted.map((a) => (
              <button
                key={a.anomaly_code}
                onClick={() => setSelected(a)}
                className="w-full text-left flex items-start gap-2.5 px-4 py-3 hover:bg-secondary/40 transition-colors group"
              >
                <div
                  className={`mt-0.5 h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${
                    a.severity === "HIGH"
                      ? "bg-danger/10"
                      : a.severity === "MEDIUM"
                      ? "bg-warning/10"
                      : "bg-accent/10"
                  }`}
                >
                  {a.severity === "HIGH" ? (
                    <ShieldAlert className="h-3 w-3 text-danger" />
                  ) : a.severity === "MEDIUM" ? (
                    <AlertTriangle className="h-3 w-3 text-warning" />
                  ) : (
                    <Info className="h-3 w-3 text-accent" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-medium truncate group-hover:text-primary transition-colors">
                      {humanize(a.anomaly_code)}
                    </span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                        a.severity === "HIGH"
                          ? "bg-danger/10 text-danger"
                          : a.severity === "MEDIUM"
                          ? "bg-warning/10 text-warning"
                          : "bg-accent/10 text-accent"
                      }`}
                    >
                      {a.count} PO{a.count !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                    {a.description}
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1">
                  View →
                </span>
              </button>
            ))}
          </div>
        )}
      </SectionCard>

      <DetailSheet anomaly={selected} onClose={() => setSelected(null)} />
    </>
  );
}

// ── PO Deletion Monitor ────────────────────────────────────────────────────────

interface DeletedPO {
  purchasing_document: string;
  item:                string;
  vendor:              string;
  vendor_name:         string | null;
  net_order_value:     string;
  document_date:       string | null;
  material_description: string | null;
  material_group:      string | null;
  anomaly_flags:       string | null;
  created_by:          string | null;
}

function PODeletionMonitor() {
  const { data: rows = [], isLoading } = useQuery<DeletedPO[]>({
    queryKey: ["po-deletions"],
    queryFn: () => apiFetch<DeletedPO[]>("/p2p/po-deletions?limit=20"),
    staleTime: 60_000,
  });

  const totalValue = rows.reduce((s, r) => s + parseFloat(r.net_order_value || "0"), 0);

  return (
    <SectionCard
      title="PO Deletion Anomaly Monitor"
      subtitle={`deletion_indicator = L · ${rows.length} deleted POs · ${formatINR(totalValue)} at risk`}
      actions={
        rows.length > 0 ? (
          <StatusPill tone="danger" dot>Requires Review</StatusPill>
        ) : undefined
      }
      bodyClassName="p-0"
    >
      {isLoading ? (
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground p-6 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : rows.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">No deleted POs found</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-secondary/50 text-muted-foreground border-b border-border">
              <tr className="text-left">
                <th className="px-4 py-2.5 font-medium">PO Number</th>
                <th className="px-4 py-2.5 font-medium">Vendor</th>
                <th className="px-4 py-2.5 font-medium">Material</th>
                <th className="px-4 py-2.5 font-medium">Group</th>
                <th className="px-4 py-2.5 font-medium text-right">Value</th>
                <th className="px-4 py-2.5 font-medium">Doc Date</th>
                <th className="px-4 py-2.5 font-medium">Anomalies</th>
                <th className="px-4 py-2.5 font-medium">Created By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((po) => {
                const flags = po.anomaly_flags
                  ? po.anomaly_flags.split(",").map((f) => f.trim()).filter(Boolean)
                  : [];
                const hasHighRisk = flags.some((f) => HIGH_FLAGS.has(f));
                return (
                  <tr
                    key={`${po.purchasing_document}-${po.item}`}
                    className={`hover:bg-secondary/30 transition-colors ${hasHighRisk ? "bg-danger/[0.03]" : ""}`}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <Trash2 className="h-3 w-3 text-danger shrink-0" />
                        <span className="font-mono font-medium text-[11px] text-primary">
                          {po.purchasing_document}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="truncate max-w-[140px]" title={po.vendor_name ?? po.vendor}>
                        {po.vendor_name ?? po.vendor}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono">{po.vendor}</div>
                    </td>
                    <td
                      className="px-4 py-2.5 truncate max-w-[160px] text-muted-foreground"
                      title={po.material_description ?? ""}
                    >
                      {po.material_description ?? "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded font-mono">
                        {po.material_group ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                      {formatINR(parseFloat(po.net_order_value || "0"))}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                      {po.document_date ? formatDateShort(po.document_date) : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      {flags.length === 0 ? (
                        <span className="text-muted-foreground text-[10px]">None</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {flags.map((flag) => (
                            <span
                              key={flag}
                              className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                                HIGH_FLAGS.has(flag)
                                  ? "bg-danger/10 text-danger"
                                  : MED_FLAGS.has(flag)
                                  ? "bg-warning/10 text-warning"
                                  : "bg-secondary text-muted-foreground"
                              }`}
                            >
                              {flag}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground text-[11px]">
                      {po.created_by ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

function AlertsPage() {
  return (
    <AppShell>
      <PageHeader
        title="Alerts"
        subtitle="Anomaly alerts detected across the P2P pipeline · click any alert to inspect affected POs"
      />
      <div className="flex flex-col gap-6">
        <AnomalyAlertsList />
        <PODeletionMonitor />
      </div>
    </AppShell>
  );
}
