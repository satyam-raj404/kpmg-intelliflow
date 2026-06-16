import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as RadioGroup from "@radix-ui/react-radio-group";
import { Plus, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/StatusPill";
import { formatINR, formatDateShort } from "@/lib/format";
import { apiFetch } from "@/api/client";

export const Route = createFileRoute("/actions")({
  head: () => ({ meta: [{ title: "Log Action — IntelliSource" }] }),
  component: LogActionPage,
});

// ── Types ─────────────────────────────────────────────────────────────────────

interface OpenPO {
  purchasing_document: string;
  item: string;
  vendor: string;
  vendor_name: string;
  net_order_value: number;
  doc_date: string;
  material_description: string;
  material_group: string;
  company_code: string;
}

interface ClosedPO {
  purchasing_document: string;
  vendor: string;
  vendor_name: string;
  net_order_value: number;
  doc_date: string;
  invoice_doc: string | null;
  invoice_amount: number;
}

interface PRWithoutPO {
  purchase_requisition: string;
  item_of_requisition: string;
  material_description: string;
  quantity: number;
  unit: string;
  release_status: string;
  created_on: string;
  company_code: string;
}

interface LoggedAction {
  id: number;
  doc_type: string;
  doc_number: string;
  doc_item: string | null;
  vendor: string | null;
  changes: string;
  approver_email: string;
  notes: string | null;
  status: string;
  created_at: string;
}

interface DocOption {
  value: string;
  label: string;
  vendor_name?: string;
}

// ── Helper ────────────────────────────────────────────────────────────────────

function daysSince(dateStr: string): number {
  if (!dateStr) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000));
}

// ── Page ──────────────────────────────────────────────────────────────────────

function LogActionPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const qc = useQueryClient();

  const { data: openPOs = [],  isLoading: l1 } = useQuery<OpenPO[]>({
    queryKey: ["actions-open"],
    queryFn: () => apiFetch("/actions/open-pos"),
  });
  const { data: closedPOs = [], isLoading: l2 } = useQuery<ClosedPO[]>({
    queryKey: ["actions-closed"],
    queryFn: () => apiFetch("/actions/closed-pos"),
  });
  const { data: prNoPO = [],   isLoading: l3 } = useQuery<PRWithoutPO[]>({
    queryKey: ["actions-inprog"],
    queryFn: () => apiFetch("/actions/pr-without-po"),
  });
  const { data: logged = [],   isLoading: l4 } = useQuery<LoggedAction[]>({
    queryKey: ["actions-logged"],
    queryFn: () => apiFetch("/actions/logged"),
  });

  return (
    <AppShell>
      <PageHeader
        title="Log Action"
        subtitle="Review open POs, track PRs pending conversion, and log corrective actions for approval"
        actions={
          <button
            onClick={() => setModalOpen(true)}
            className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-[12px] font-semibold flex items-center gap-1.5 hover:opacity-90 transition-opacity"
          >
            <Plus className="h-3.5 w-3.5" />
            Log New Action
          </button>
        }
      />

      <div className="grid grid-cols-4 gap-4">
        <KanbanCol title="Open" count={openPOs.length} loading={l1} dot="bg-blue-500">
          {openPOs.map((po) => (
            <OpenPOCard key={po.purchasing_document} po={po} />
          ))}
        </KanbanCol>

        <KanbanCol title="In Progress" count={prNoPO.length} loading={l3} dot="bg-amber-500">
          {prNoPO.map((pr) => (
            <PRCard key={`${pr.purchase_requisition}/${pr.item_of_requisition}`} pr={pr} />
          ))}
        </KanbanCol>

        <KanbanCol title="Under Review" count={logged.length} loading={l4} dot="bg-purple-500">
          {logged.map((a) => (
            <LoggedCard key={a.id} action={a} />
          ))}
        </KanbanCol>

        <KanbanCol title="Closed" count={closedPOs.length} loading={l2} dot="bg-emerald-500">
          {closedPOs.map((po) => (
            <ClosedPOCard key={po.purchasing_document} po={po} />
          ))}
        </KanbanCol>
      </div>

      <LogActionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => {
          setModalOpen(false);
          qc.invalidateQueries({ queryKey: ["actions-logged"] });
        }}
      />
    </AppShell>
  );
}

// ── Kanban Column ─────────────────────────────────────────────────────────────

function KanbanCol({
  title, count, loading, dot, children,
}: {
  title: string;
  count: number;
  loading: boolean;
  dot: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-secondary rounded-lg flex flex-col">
      <div className="px-3 py-2.5 flex items-center justify-between border-b border-border rounded-t-lg">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${dot}`} />
          <span className="text-[12px] font-semibold uppercase tracking-wider">{title}</span>
        </div>
        <span className="text-[11px] font-tabular bg-background px-2 py-0.5 rounded-full border border-border">
          {count}
        </span>
      </div>
      <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[calc(100vh-260px)]">
        {loading ? (
          <p className="text-[11px] text-muted-foreground text-center py-8">Loading…</p>
        ) : count === 0 ? (
          <p className="text-[11px] text-muted-foreground text-center py-8">No items</p>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

// ── Open PO Card ──────────────────────────────────────────────────────────────

function OpenPOCard({ po }: { po: OpenPO }) {
  return (
    <div className="bg-background border border-border rounded-md p-3 hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between gap-1 mb-1.5">
        <span className="text-[12px] font-mono font-semibold text-primary leading-tight">
          {po.purchasing_document}
        </span>
        <StatusPill tone="info">Active</StatusPill>
      </div>
      <div className="text-[11px] space-y-0.5">
        <div className="font-medium text-foreground truncate">{po.vendor_name}</div>
        {po.material_description && (
          <div className="text-muted-foreground truncate">{po.material_description}</div>
        )}
        <div className="flex items-center justify-between pt-1.5">
          <span className="font-tabular font-semibold text-success text-[12px]">
            {formatINR(po.net_order_value ?? 0)}
          </span>
          <span className="text-muted-foreground">{formatDateShort(po.doc_date)}</span>
        </div>
        {po.material_group && (
          <span className="inline-block mt-0.5 bg-secondary px-1.5 py-0.5 rounded text-[10px] font-mono text-muted-foreground">
            {po.material_group}
          </span>
        )}
      </div>
    </div>
  );
}

// ── PR Without PO Card ────────────────────────────────────────────────────────

function PRCard({ pr }: { pr: PRWithoutPO }) {
  const days = daysSince(pr.created_on);
  const ageTone = days > 30 ? "text-danger" : days > 14 ? "text-warning" : "text-muted-foreground";

  return (
    <div className="bg-background border border-border rounded-md p-3 hover:border-warning/30 transition-colors">
      <div className="flex items-start justify-between gap-1 mb-1.5">
        <span className="text-[11px] font-mono font-semibold text-primary leading-tight">
          {pr.purchase_requisition}/{pr.item_of_requisition}
        </span>
        <StatusPill tone="warning">No PO</StatusPill>
      </div>
      <div className="text-[11px] space-y-0.5">
        {pr.material_description && (
          <div className="font-medium text-foreground truncate">{pr.material_description}</div>
        )}
        <div className="text-muted-foreground">
          Qty: <span className="font-semibold text-foreground">{pr.quantity} {pr.unit}</span>
        </div>
        <div className="flex items-center justify-between pt-1.5">
          <span className={`font-semibold ${ageTone}`}>{days}d open</span>
          <span className="text-muted-foreground">{formatDateShort(pr.created_on)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Logged Action Card ────────────────────────────────────────────────────────

function LoggedCard({ action }: { action: LoggedAction }) {
  const changed = (() => {
    try { return Object.keys(JSON.parse(action.changes || "{}")); } catch { return []; }
  })();

  return (
    <div className="bg-background border border-border rounded-md p-3 hover:border-purple-400/30 transition-colors">
      <div className="flex items-start justify-between gap-1 mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground font-medium">
            {action.doc_type}
          </span>
          <span className="text-[12px] font-mono font-semibold text-primary">{action.doc_number}</span>
        </div>
        <StatusPill tone="info">Review</StatusPill>
      </div>
      <div className="text-[11px] space-y-0.5">
        {changed.length > 0 && (
          <div className="text-muted-foreground">
            Changed:{" "}
            <span className="text-foreground font-medium">{changed.join(", ")}</span>
          </div>
        )}
        {action.notes && (
          <div className="text-muted-foreground truncate italic">{action.notes}</div>
        )}
        <div className="text-muted-foreground pt-0.5">
          Approver:{" "}
          <span className="text-foreground font-medium">{action.approver_email}</span>
        </div>
        <div className="text-muted-foreground">{formatDateShort(action.created_at)}</div>
      </div>
    </div>
  );
}

// ── Closed PO Card ────────────────────────────────────────────────────────────

function ClosedPOCard({ po }: { po: ClosedPO }) {
  return (
    <div className="bg-background border border-border rounded-md p-3 hover:border-success/30 transition-colors">
      <div className="flex items-start justify-between gap-1 mb-1.5">
        <span className="text-[12px] font-mono font-semibold text-primary leading-tight">
          {po.purchasing_document}
        </span>
        <StatusPill tone="success">Closed</StatusPill>
      </div>
      <div className="text-[11px] space-y-0.5">
        <div className="font-medium text-foreground truncate">{po.vendor_name}</div>
        {po.invoice_doc && (
          <div className="text-muted-foreground">
            Invoice:{" "}
            <span className="font-mono font-semibold text-foreground">{po.invoice_doc}</span>
          </div>
        )}
        <div className="flex items-center justify-between pt-1.5">
          <span className="font-tabular font-semibold text-success text-[12px]">
            {formatINR(po.invoice_amount > 0 ? po.invoice_amount : po.net_order_value)}
          </span>
          <span className="text-muted-foreground">{formatDateShort(po.doc_date)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Log Action Modal ──────────────────────────────────────────────────────────

const PO_FIELDS = [
  { key: "net_order_value",  label: "Net Order Value",  type: "number" },
  { key: "delivery_date",    label: "Delivery Date",    type: "date"   },
  { key: "vendor",           label: "Vendor Code",      type: "text"   },
] as const;

const PR_FIELDS = [
  { key: "material_description", label: "Material Description", type: "text"   },
  { key: "quantity",             label: "Quantity",             type: "number" },
  { key: "unit",                 label: "Unit of Measure",      type: "text"   },
] as const;

function LogActionModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [docType, setDocType]         = useState<"PO" | "PR">("PO");
  const [docValue, setDocValue]       = useState("");
  const [approverEmail, setApproverEmail] = useState("");
  const [notes, setNotes]             = useState("");
  const [fieldChanges, setFieldChanges] = useState<Record<string, string>>({});
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState("");

  const { data: poList = [] } = useQuery<DocOption[]>({
    queryKey: ["actions-po-list"],
    queryFn: () => apiFetch("/actions/po-list"),
    enabled: open,
  });
  const { data: prList = [] } = useQuery<DocOption[]>({
    queryKey: ["actions-pr-list"],
    queryFn: () => apiFetch("/actions/pr-list"),
    enabled: open,
  });

  const list   = docType === "PO" ? poList   : prList;
  const fields = docType === "PO" ? PO_FIELDS : PR_FIELDS;

  function reset() {
    setDocType("PO");
    setDocValue("");
    setApproverEmail("");
    setNotes("");
    setFieldChanges({});
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!docValue || !approverEmail) return;
    setError("");

    const [docNumber, docItem] =
      docType === "PR" ? docValue.split("|") : [docValue, undefined];

    const changes: Record<string, string> = {};
    for (const [k, v] of Object.entries(fieldChanges)) {
      if (v.trim()) changes[k] = v.trim();
    }

    setSubmitting(true);
    try {
      await apiFetch("/actions/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doc_type:       docType,
          doc_number:     docNumber,
          doc_item:       docItem ?? null,
          changes,
          approver_email: approverEmail,
          notes:          notes || null,
        }),
      });
      reset();
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log action");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) { reset(); onClose(); }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[500px] max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-background shadow-2xl p-6 focus:outline-none">

          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <Dialog.Title className="text-[15px] font-semibold">Log New Action</Dialog.Title>
              <Dialog.Description className="text-[12px] text-muted-foreground mt-0.5">
                Select a PO or PR, describe proposed changes, and assign an approver.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button className="rounded-md p-1.5 hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Document type */}
            <div>
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide block mb-2">
                Document Type
              </label>
              <RadioGroup.Root
                value={docType}
                onValueChange={(v) => {
                  setDocType(v as "PO" | "PR");
                  setDocValue("");
                  setFieldChanges({});
                }}
                className="flex gap-5"
              >
                {(["PO", "PR"] as const).map((t) => (
                  <div key={t} className="flex items-center gap-2">
                    <RadioGroup.Item
                      value={t}
                      id={`dtype-${t}`}
                      className="h-4 w-4 rounded-full border-2 border-border data-[state=checked]:border-primary focus:outline-none"
                    >
                      <RadioGroup.Indicator className="flex items-center justify-center w-full h-full after:block after:h-2 after:w-2 after:rounded-full after:bg-primary" />
                    </RadioGroup.Item>
                    <label htmlFor={`dtype-${t}`} className="text-sm cursor-pointer select-none">
                      {t === "PO" ? "Purchase Order" : "Purchase Requisition"}
                    </label>
                  </div>
                ))}
              </RadioGroup.Root>
            </div>

            {/* Document selector */}
            <div>
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">
                Select {docType === "PO" ? "Purchase Order" : "Requisition"} <span className="text-danger">*</span>
              </label>
              <select
                value={docValue}
                onChange={(e) => setDocValue(e.target.value)}
                required
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">-- Select document --</option>
                {list.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Editable fields */}
            {docValue && (
              <div>
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide block mb-2">
                  Proposed Changes
                  <span className="normal-case font-normal ml-1">(leave blank to skip)</span>
                </label>
                <div className="space-y-2 rounded-lg border border-border p-3 bg-secondary/30">
                  {fields.map((f) => (
                    <div key={f.key} className="grid grid-cols-[140px_1fr] items-center gap-2">
                      <label className="text-[11px] text-muted-foreground text-right">{f.label}</label>
                      <input
                        type={f.type}
                        value={fieldChanges[f.key] ?? ""}
                        onChange={(e) =>
                          setFieldChanges((prev) => ({ ...prev, [f.key]: e.target.value }))
                        }
                        placeholder={`New value…`}
                        className="border border-border rounded-md px-2.5 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/40 w-full"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">
                Notes / Reason
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Reason for this action…"
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background resize-none focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/40"
              />
            </div>

            {/* Approver email */}
            <div>
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">
                Approver Email <span className="text-danger">*</span>
              </label>
              <input
                type="email"
                value={approverEmail}
                onChange={(e) => setApproverEmail(e.target.value)}
                required
                placeholder="approver@company.com"
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/40"
              />
            </div>

            {/* Error */}
            {error && (
              <p className="text-[12px] text-danger bg-danger/10 rounded-md px-3 py-2">{error}</p>
            )}

            {/* Submit */}
            <div className="flex items-center justify-end gap-2 pt-1 border-t border-border">
              <Dialog.Close asChild>
                <button
                  type="button"
                  onClick={reset}
                  className="h-9 px-4 rounded-md border border-border text-sm hover:bg-secondary transition-colors"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={submitting || !docValue || !approverEmail}
                className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Logging…" : "Log Action →"}
              </button>
            </div>
          </form>

        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
