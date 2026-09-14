import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SectionCard } from "@/components/SectionCard";
import { StatusPill } from "@/components/StatusPill";
import { apiFetch } from "@/api/client";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export const Route = createFileRoute("/contract-center")({
  head: () => ({ meta: [{ title: "Contract Center — KPMG IntelliSource" }] }),
  component: ContractCenterPage,
});

// ── Types ──────────────────────────────────────────────────────────────────────

interface Contract {
  id: number;
  contract_number: string;
  contract_name: string;
  vendor: string;
  vendor_name: string;
  company_code: string;
  contract_type: string;
  contract_value: number;
  currency_key: string;
  start_date: string;
  end_date: string;
  status: "ACTIVE" | "EXPIRED" | "CANCELLED";
  owner: string;
  is_active: number;
  matched_po_count: number;
  matched_po_value: number;
}

interface Summary {
  total_contracts: number;
  active_contracts: number;
  po_matched: number;
  po_unmatched: number;
  po_no_contract: number;
  match_rate_pct: number;
}

interface UnmatchedPO {
  purchasing_document: string;
  item: string;
  contract_number: string;
  vendor_name: string;
  net_order_value: string;
  document_date: string;
  company_code: string;
}

const TYPE_OPTIONS = ["SERVICE", "GOODS", "FRAMEWORK"];

const EMPTY_FORM = {
  contract_number: "", contract_name: "", vendor: "", vendor_name: "",
  company_code: "1001", contract_type: "SERVICE", contract_value: 0,
  currency_key: "INR", start_date: "", end_date: "", owner: "",
};

// ── Verdict pill ───────────────────────────────────────────────────────────────

function verdictTone(v: string): "success" | "danger" | "neutral" {
  if (v === "MATCHED") return "success";
  if (v === "UNMATCHED") return "danger";
  return "neutral";
}

// ── Add / Edit Sheet ───────────────────────────────────────────────────────────

function ContractSheet({
  open, onClose, editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: Contract | null;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState(editing
    ? {
        contract_number: editing.contract_number,
        contract_name: editing.contract_name,
        vendor: editing.vendor,
        vendor_name: editing.vendor_name,
        company_code: editing.company_code,
        contract_type: editing.contract_type,
        contract_value: editing.contract_value,
        currency_key: editing.currency_key,
        start_date: editing.start_date,
        end_date: editing.end_date,
        owner: editing.owner,
      }
    : EMPTY_FORM
  );

  const set = (k: string, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  const mut = useMutation({
    mutationFn: () => editing
      ? apiFetch(`/contracts/${encodeURIComponent(editing.contract_number)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contract_name: form.contract_name,
            vendor: form.vendor,
            vendor_name: form.vendor_name,
            contract_type: form.contract_type,
            contract_value: form.contract_value,
            start_date: form.start_date,
            end_date: form.end_date,
            owner: form.owner,
          }),
        })
      : apiFetch("/contracts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contracts"] });
      qc.invalidateQueries({ queryKey: ["contracts-summary"] });
      qc.invalidateQueries({ queryKey: ["contracts-unmatched"] });
      toast.success(editing ? "Contract updated — PO check re-run" : "Contract created — PO check re-run");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const inputCls = "w-full h-9 px-3 rounded-md border border-border bg-background text-[13px] focus:outline-none focus:ring-1 focus:ring-ring";
  const labelCls = "block text-[11px] font-medium text-muted-foreground mb-1";

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-[400px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            {editing ? "Edit Contract" : "Create Contract"}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-5 space-y-3.5">
          {!editing && (
            <div>
              <label className={labelCls}>Contract Number</label>
              <input className={inputCls} placeholder="e.g. CTR-2026-0142"
                value={form.contract_number} onChange={(e) => set("contract_number", e.target.value)} />
            </div>
          )}
          <div>
            <label className={labelCls}>Contract Name</label>
            <input className={inputCls} placeholder="e.g. Annual IT Support Agreement"
              value={form.contract_name} onChange={(e) => set("contract_name", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Vendor Code</label>
              <input className={inputCls} placeholder="e.g. 700400"
                value={form.vendor} onChange={(e) => set("vendor", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Vendor Name</label>
              <input className={inputCls} placeholder="e.g. Infosys Ltd"
                value={form.vendor_name} onChange={(e) => set("vendor_name", e.target.value)} />
            </div>
          </div>
          {!editing && (
            <div>
              <label className={labelCls}>Company Code</label>
              <input className={inputCls} placeholder="1001"
                value={form.company_code} onChange={(e) => set("company_code", e.target.value)} />
            </div>
          )}
          <div>
            <label className={labelCls}>Contract Type</label>
            <div className="flex gap-2 mt-1">
              {TYPE_OPTIONS.map((t) => (
                <button key={t} type="button"
                  onClick={() => set("contract_type", t)}
                  className={cn(
                    "flex-1 h-9 rounded-md border text-[11px] font-semibold transition-colors",
                    form.contract_type === t
                      ? "bg-primary text-white border-primary"
                      : "border-border text-muted-foreground hover:border-accent/50",
                  )}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Contract Value</label>
              <input type="number" className={inputCls} placeholder="0"
                value={form.contract_value}
                onChange={(e) => set("contract_value", parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <label className={labelCls}>Currency</label>
              <input className={inputCls} placeholder="INR"
                value={form.currency_key} onChange={(e) => set("currency_key", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Start Date</label>
              <input type="date" className={inputCls}
                value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>End Date</label>
              <input type="date" className={inputCls}
                value={form.end_date} onChange={(e) => set("end_date", e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Owner</label>
            <input className={inputCls} placeholder="e.g. Priya Sharma"
              value={form.owner} onChange={(e) => set("owner", e.target.value)} />
          </div>
          <button
            onClick={() => mut.mutate()}
            disabled={mut.isPending || (!editing && !form.contract_number) || !form.contract_name}
            className="w-full h-9 rounded-md bg-primary text-white text-[13px] font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors mt-1"
          >
            {mut.isPending ? "Saving…" : editing ? "Save Changes" : "Create Contract"}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

function ContractCenterPage() {
  const qc = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Contract | null>(null);
  const [showUnmatched, setShowUnmatched] = useState(false);

  const { data: contracts = [], isLoading } = useQuery<Contract[]>({
    queryKey: ["contracts"],
    queryFn: () => apiFetch<Contract[]>("/contracts"),
    staleTime: 30_000,
  });

  const { data: summary } = useQuery<Summary>({
    queryKey: ["contracts-summary"],
    queryFn: () => apiFetch<Summary>("/contracts/summary"),
    staleTime: 30_000,
  });

  const { data: unmatchedPOs = [] } = useQuery<UnmatchedPO[]>({
    queryKey: ["contracts-unmatched"],
    queryFn: () => apiFetch<UnmatchedPO[]>("/contracts/unmatched-pos"),
    enabled: showUnmatched,
    staleTime: 30_000,
  });

  const deleteMut = useMutation({
    mutationFn: (num: string) =>
      apiFetch(`/contracts/${encodeURIComponent(num)}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contracts"] });
      qc.invalidateQueries({ queryKey: ["contracts-summary"] });
      qc.invalidateQueries({ queryKey: ["contracts-unmatched"] });
      toast.success("Contract deactivated — PO check re-run");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const runCheckMut = useMutation({
    mutationFn: () => apiFetch("/contracts/run-check", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contracts"] });
      qc.invalidateQueries({ queryKey: ["contracts-summary"] });
      qc.invalidateQueries({ queryKey: ["contracts-unmatched"] });
      toast.success("Contract check re-run across all POs");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell>
      <PageHeader
        title="Contract Center"
        subtitle="Manage contracts · Check PO contract numbers against active contracts"
        showExport={false}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => runCheckMut.mutate()}
              disabled={runCheckMut.isPending}
              className="h-8 px-3 rounded-md border border-border text-[12px] font-medium flex items-center gap-1.5 hover:bg-secondary/50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", runCheckMut.isPending && "animate-spin")} />
              Run Check
            </button>
            <button
              onClick={() => { setEditing(null); setSheetOpen(true); }}
              className="h-8 px-3 rounded-md bg-primary text-white text-[12px] font-medium flex items-center gap-1.5 hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Create Contract
            </button>
          </div>
        }
      />

      {/* Summary tiles */}
      <div className="grid grid-cols-5 gap-3 mb-4">
        {[
          { label: "Active Contracts", value: String(summary?.active_contracts ?? 0), color: "text-foreground" },
          { label: "Match Rate", value: `${summary?.match_rate_pct ?? 0}%`, color: "text-success" },
          { label: "PO Lines Matched", value: String(summary?.po_matched ?? 0), color: "text-success" },
          { label: "PO Lines Unmatched", value: String(summary?.po_unmatched ?? 0), color: "text-danger" },
          { label: "No Contract on PO", value: String(summary?.po_no_contract ?? 0), color: "text-muted-foreground" },
        ].map((t) => (
          <div key={t.label} className="bg-surface rounded-lg border border-border px-4 py-3">
            <div className="text-[11px] text-muted-foreground">{t.label}</div>
            <div className={`text-[22px] font-bold font-tabular mt-0.5 ${t.color}`}>{t.value}</div>
          </div>
        ))}
      </div>

      <SectionCard
        title="Contracts"
        subtitle={`${contracts.length} active — PO lines auto-checked against these on upload`}
        actions={
          <button
            onClick={() => setShowUnmatched((v) => !v)}
            className="border border-border rounded-md px-2.5 py-1 text-[11px] bg-background hover:bg-secondary/50 transition-colors"
          >
            {showUnmatched ? "Hide" : "Show"} Unmatched PO Lines
          </button>
        }
      >
        {isLoading ? (
          <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
        ) : contracts.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
            No contracts. Click <strong className="mx-1">Create Contract</strong> to add one.
          </div>
        ) : (
          <div className="overflow-auto -mx-1">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-border">
                  {["Contract #", "Name", "Vendor", "Type", "Value", "Status", "Matched POs", "Matched Value", "Actions"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap text-[11px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contracts.map((c) => (
                  <tr key={c.contract_number}
                    className="border-b border-border/40 hover:bg-secondary/30 transition-colors">
                    <td className="px-3 py-2.5 font-mono text-[11px] font-medium text-primary whitespace-nowrap">
                      {c.contract_number}
                    </td>
                    <td className="px-3 py-2.5 font-medium whitespace-nowrap max-w-[180px] truncate">{c.contract_name}</td>
                    <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap max-w-[140px] truncate">{c.vendor_name || c.vendor || "—"}</td>
                    <td className="px-3 py-2.5">
                      <StatusPill tone="info">{c.contract_type}</StatusPill>
                    </td>
                    <td className="px-3 py-2.5 font-tabular text-right">
                      {c.contract_value > 0 ? `${c.currency_key} ${c.contract_value.toLocaleString()}` : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusPill tone={c.status === "ACTIVE" ? "success" : c.status === "EXPIRED" ? "warning" : "danger"}>
                        {c.status}
                      </StatusPill>
                    </td>
                    <td className="px-3 py-2.5 font-tabular text-right font-semibold text-success">
                      {c.matched_po_count > 0 ? c.matched_po_count : "—"}
                    </td>
                    <td className="px-3 py-2.5 font-tabular text-right">
                      {c.matched_po_value > 0 ? `₹${c.matched_po_value.toFixed(2)} Cr` : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setEditing(c); setSheetOpen(true); }}
                          className="h-6 w-6 rounded border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-accent/50 transition-colors"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => deleteMut.mutate(c.contract_number)}
                          disabled={deleteMut.isPending}
                          className="h-6 w-6 rounded border border-border flex items-center justify-center text-muted-foreground hover:text-danger hover:border-danger/40 transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {showUnmatched && (
        <SectionCard
          title="Unmatched PO Lines"
          subtitle="PO lines citing a contract number not found in the Contract Center"
          className="mt-4"
        >
          {unmatchedPOs.length === 0 ? (
            <div className="h-24 flex items-center justify-center text-muted-foreground text-sm">
              No unmatched PO lines.
            </div>
          ) : (
            <div className="overflow-auto -mx-1">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-border">
                    {["PO", "Item", "Contract #", "Vendor", "Value", "Date", "Company"].map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap text-[11px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {unmatchedPOs.map((po, i) => (
                    <tr key={`${po.purchasing_document}-${po.item}-${i}`}
                      className="border-b border-border/40 hover:bg-secondary/30 transition-colors">
                      <td className="px-3 py-2.5 font-mono text-[11px] text-primary">{po.purchasing_document}</td>
                      <td className="px-3 py-2.5 font-tabular text-muted-foreground">{po.item}</td>
                      <td className="px-3 py-2.5">
                        <StatusPill tone={verdictTone("UNMATCHED")}>{po.contract_number}</StatusPill>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap max-w-[140px] truncate">{po.vendor_name || "—"}</td>
                      <td className="px-3 py-2.5 font-tabular text-right">{po.net_order_value || "—"}</td>
                      <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{po.document_date}</td>
                      <td className="px-3 py-2.5 font-tabular text-muted-foreground">{po.company_code}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}

      <ContractSheet
        open={sheetOpen}
        onClose={() => { setSheetOpen(false); setEditing(null); }}
        editing={editing}
      />
    </AppShell>
  );
}
