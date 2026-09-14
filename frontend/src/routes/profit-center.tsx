import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
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

export const Route = createFileRoute("/profit-center")({
  head: () => ({ meta: [{ title: "Profit Centers — KPMG IntelliSource" }] }),
  component: ProfitCenterPage,
});

// ── Types ──────────────────────────────────────────────────────────────────────

interface PC {
  id: number;
  profit_center: string;
  pc_name: string;
  company_code: string;
  dept_code: string;
  dept_name: string;
  plant: string;
  material_group: string;
  default_capex_opex: "CAPEX" | "OPEX";
  capex_budget: number;
  opex_budget: number;
  responsible_person: string;
  is_active: number;
  actual_capex: number;
  actual_opex: number;
}

const DEPT_OPTIONS = [
  { value: "FAC", label: "Facilities" },
  { value: "ENG", label: "Engineering" },
  { value: "ADM", label: "Administration" },
  { value: "ITH", label: "IT Hardware" },
  { value: "ITS", label: "IT Software" },
  { value: "STR", label: "Strategy & Consulting" },
  { value: "SCM", label: "Supply Chain" },
  { value: "OPS", label: "Operations" },
];

const PLANT_OPTIONS = [
  { value: "MNAL", label: "MNAL — Mumbai" },
  { value: "DELP", label: "DELP — Delhi North" },
  { value: "SDPL", label: "SDPL — South Delhi" },
  { value: "BLRP", label: "BLRP — Bengaluru" },
  { value: "HYDP", label: "HYDP — Hyderabad" },
];

const MG_OPTIONS = [
  { value: "9901", label: "9901 — Civil Works" },
  { value: "9902", label: "9902 — Electrical Equipment" },
  { value: "9903", label: "9903 — Office Supplies" },
  { value: "9904", label: "9904 — IT Hardware" },
  { value: "9905", label: "9905 — IT Software" },
  { value: "9906", label: "9906 — Consulting" },
  { value: "9907", label: "9907 — Logistics" },
  { value: "9908", label: "9908 — Maintenance" },
];

const EMPTY_FORM = {
  profit_center: "", pc_name: "", company_code: "1001",
  dept_code: "FAC", plant: "MNAL", material_group: "9901",
  default_capex_opex: "OPEX" as "CAPEX" | "OPEX",
  capex_budget: 0, opex_budget: 0, responsible_person: "",
};

// ── Flag Toggle ────────────────────────────────────────────────────────────────

function FlagToggle({ pc, current }: { pc: string; current: "CAPEX" | "OPEX" }) {
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: (flag: string) =>
      apiFetch(`/profit-centers/${encodeURIComponent(pc)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ default_capex_opex: flag }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profit-centers"] });
      toast.success("Flag updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const next = current === "CAPEX" ? "OPEX" : "CAPEX";
  return (
    <button
      onClick={() => mut.mutate(next)}
      disabled={mut.isPending}
      className={cn(
        "h-6 px-2.5 rounded-full text-[10px] font-bold tracking-wide border transition-colors",
        current === "CAPEX"
          ? "bg-primary/10 text-primary border-primary/30 hover:bg-primary/20"
          : "bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100",
      )}
    >
      {current}
    </button>
  );
}

// ── Add / Edit Sheet ───────────────────────────────────────────────────────────

function PCSheet({
  open, onClose, editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: PC | null;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState(editing
    ? {
        profit_center: editing.profit_center,
        pc_name: editing.pc_name,
        company_code: editing.company_code,
        dept_code: editing.dept_code,
        plant: editing.plant,
        material_group: editing.material_group,
        default_capex_opex: editing.default_capex_opex,
        capex_budget: editing.capex_budget,
        opex_budget: editing.opex_budget,
        responsible_person: editing.responsible_person,
      }
    : EMPTY_FORM
  );

  const set = (k: string, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  const mut = useMutation({
    mutationFn: () => editing
      ? apiFetch(`/profit-centers/${encodeURIComponent(editing.profit_center)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pc_name: form.pc_name,
            default_capex_opex: form.default_capex_opex,
            capex_budget: form.capex_budget,
            opex_budget: form.opex_budget,
            responsible_person: form.responsible_person,
          }),
        })
      : apiFetch("/profit-centers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profit-centers"] });
      toast.success(editing ? "Profit center updated" : "Profit center created");
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
            {editing ? "Edit Profit Center" : "Add Profit Center"}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-5 space-y-3.5">
          {!editing && (
            <div>
              <label className={labelCls}>PC Code</label>
              <input className={inputCls} placeholder="e.g. 1001-FAC-MUM"
                value={form.profit_center} onChange={(e) => set("profit_center", e.target.value)} />
            </div>
          )}
          <div>
            <label className={labelCls}>Name</label>
            <input className={inputCls} placeholder="e.g. Facilities — Mumbai"
              value={form.pc_name} onChange={(e) => set("pc_name", e.target.value)} />
          </div>
          {!editing && (
            <>
              <div>
                <label className={labelCls}>Department</label>
                <select className={inputCls} value={form.dept_code}
                  onChange={(e) => set("dept_code", e.target.value)}>
                  {DEPT_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Plant</label>
                <select className={inputCls} value={form.plant}
                  onChange={(e) => set("plant", e.target.value)}>
                  {PLANT_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Material Group</label>
                <select className={inputCls} value={form.material_group}
                  onChange={(e) => set("material_group", e.target.value)}>
                  {MG_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            </>
          )}
          <div>
            <label className={labelCls}>Default Classification</label>
            <div className="flex gap-2 mt-1">
              {(["CAPEX", "OPEX"] as const).map((f) => (
                <button key={f} type="button"
                  onClick={() => set("default_capex_opex", f)}
                  className={cn(
                    "flex-1 h-9 rounded-md border text-[12px] font-semibold transition-colors",
                    form.default_capex_opex === f
                      ? f === "CAPEX" ? "bg-primary text-white border-primary" : "bg-teal-600 text-white border-teal-600"
                      : "border-border text-muted-foreground hover:border-accent/50",
                  )}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>CAPEX Budget (₹ Cr)</label>
              <input type="number" className={inputCls} placeholder="0"
                value={form.capex_budget}
                onChange={(e) => set("capex_budget", parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <label className={labelCls}>OPEX Budget (₹ Cr)</label>
              <input type="number" className={inputCls} placeholder="0"
                value={form.opex_budget}
                onChange={(e) => set("opex_budget", parseFloat(e.target.value) || 0)} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Responsible Person</label>
            <input className={inputCls} placeholder="e.g. Priya Sharma"
              value={form.responsible_person}
              onChange={(e) => set("responsible_person", e.target.value)} />
          </div>
          <button
            onClick={() => mut.mutate()}
            disabled={mut.isPending || (!editing && !form.profit_center) || !form.pc_name}
            className="w-full h-9 rounded-md bg-primary text-white text-[13px] font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors mt-1"
          >
            {mut.isPending ? "Saving…" : editing ? "Save Changes" : "Create Profit Center"}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

function ProfitCenterPage() {
  const qc = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<PC | null>(null);
  const [deptFilter, setDeptFilter] = useState("ALL");

  const { data: pcs = [], isLoading } = useQuery<PC[]>({
    queryKey: ["profit-centers"],
    queryFn: () => apiFetch<PC[]>("/profit-centers"),
    staleTime: 30_000,
  });

  const deleteMut = useMutation({
    mutationFn: (pc: string) =>
      apiFetch(`/profit-centers/${encodeURIComponent(pc)}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profit-centers"] });
      toast.success("Profit center deactivated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = deptFilter === "ALL"
    ? pcs
    : pcs.filter((p) => p.dept_code === deptFilter);

  const totalCapex = filtered.reduce((s, p) => s + p.actual_capex, 0);
  const totalOpex  = filtered.reduce((s, p) => s + p.actual_opex,  0);

  return (
    <AppShell>
      <PageHeader
        title="Profit Center Management"
        subtitle="Map profit centers · Set CAPEX / OPEX classification · Track actual spend"
        showExport={false}
        actions={
          <button
            onClick={() => { setEditing(null); setSheetOpen(true); }}
            className="h-8 px-3 rounded-md bg-primary text-white text-[12px] font-medium flex items-center gap-1.5 hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Add Profit Center
          </button>
        }
      />

      {/* Summary tiles */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { label: "Active Profit Centers", value: String(pcs.length), color: "text-foreground" },
          { label: "Total CAPEX Spend", value: `₹${totalCapex.toFixed(1)} Cr`, color: "text-primary" },
          { label: "Total OPEX Spend",  value: `₹${totalOpex.toFixed(1)} Cr`,  color: "text-teal-600" },
          { label: "Total Spend",       value: `₹${(totalCapex + totalOpex).toFixed(1)} Cr`, color: "text-foreground" },
        ].map((t) => (
          <div key={t.label} className="bg-surface rounded-lg border border-border px-4 py-3">
            <div className="text-[11px] text-muted-foreground">{t.label}</div>
            <div className={`text-[22px] font-bold font-tabular mt-0.5 ${t.color}`}>{t.value}</div>
          </div>
        ))}
      </div>

      <SectionCard
        title="Profit Centers"
        subtitle={`${pcs.length} active — filter by department to drill down`}
        actions={
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="border border-border rounded-md px-2 py-1 text-[11px] bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="ALL">All Departments</option>
            {DEPT_OPTIONS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        }
      >
        {isLoading ? (
          <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
            No profit centers. Click <strong className="mx-1">Add Profit Center</strong> to create one.
          </div>
        ) : (
          <div className="overflow-auto -mx-1">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-border">
                  {["PC Code", "Name", "Dept", "Plant", "Material Group", "Flag", "Budget CAPEX (Cr)", "Budget OPEX (Cr)", "Actual CAPEX (Cr)", "Actual OPEX (Cr)", "Actions"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap text-[11px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((pc) => {
                  const capexOver = pc.actual_capex > pc.capex_budget && pc.capex_budget > 0;
                  const opexOver  = pc.actual_opex  > pc.opex_budget  && pc.opex_budget  > 0;
                  return (
                    <tr key={pc.profit_center}
                      className="border-b border-border/40 hover:bg-secondary/30 transition-colors">
                      <td className="px-3 py-2.5 font-mono text-[11px] font-medium text-primary whitespace-nowrap">
                        {pc.profit_center}
                      </td>
                      <td className="px-3 py-2.5 font-medium whitespace-nowrap max-w-[160px] truncate">{pc.pc_name}</td>
                      <td className="px-3 py-2.5">
                        <StatusPill tone="info">{pc.dept_name || pc.dept_code}</StatusPill>
                      </td>
                      <td className="px-3 py-2.5 font-tabular text-muted-foreground">{pc.plant}</td>
                      <td className="px-3 py-2.5 font-tabular text-muted-foreground">{pc.material_group}</td>
                      <td className="px-3 py-2.5">
                        <FlagToggle pc={pc.profit_center} current={pc.default_capex_opex} />
                      </td>
                      <td className="px-3 py-2.5 font-tabular text-right">
                        {pc.capex_budget > 0 ? pc.capex_budget.toFixed(1) : "—"}
                      </td>
                      <td className="px-3 py-2.5 font-tabular text-right">
                        {pc.opex_budget > 0 ? pc.opex_budget.toFixed(1) : "—"}
                      </td>
                      <td className={cn("px-3 py-2.5 font-tabular text-right font-semibold", capexOver ? "text-danger" : "text-primary")}>
                        {pc.actual_capex > 0 ? pc.actual_capex.toFixed(2) : "—"}
                        {capexOver && <span className="text-[9px] ml-1">▲OVR</span>}
                      </td>
                      <td className={cn("px-3 py-2.5 font-tabular text-right font-semibold", opexOver ? "text-danger" : "text-teal-600")}>
                        {pc.actual_opex > 0 ? pc.actual_opex.toFixed(2) : "—"}
                        {opexOver && <span className="text-[9px] ml-1">▲OVR</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => { setEditing(pc); setSheetOpen(true); }}
                            className="h-6 w-6 rounded border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-accent/50 transition-colors"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => deleteMut.mutate(pc.profit_center)}
                            disabled={deleteMut.isPending}
                            className="h-6 w-6 rounded border border-border flex items-center justify-center text-muted-foreground hover:text-danger hover:border-danger/40 transition-colors"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <PCSheet
        open={sheetOpen}
        onClose={() => { setSheetOpen(false); setEditing(null); }}
        editing={editing}
      />
    </AppShell>
  );
}
