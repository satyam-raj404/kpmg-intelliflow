import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell, LineChart, Line, Legend,
} from "recharts";
import {
  FilePlus, CheckSquare, ShoppingCart, ClipboardCheck,
  Package, FileText, Banknote, AlertTriangle, ChevronRight,
  Filter, X, Search, ChevronDown, ChevronUp,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { AppShell }   from "@/components/AppShell";
import { PageHeader }  from "@/components/PageHeader";
import { SectionCard } from "@/components/SectionCard";
import { StatusPill }  from "@/components/StatusPill";
import { apiFetch }    from "@/api/client";
import { brand }       from "@/lib/brand";
import { formatINR, formatDateShort } from "@/lib/format";
import { useAnomalies } from "@/hooks/useP2P";

export const Route = createFileRoute("/p2p")({
  head: () => ({ meta: [{ title: "P2P Lifecycle — KPMG IntelliSource" }] }),
  component: P2PTracker,
});

// ── Types ──────────────────────────────────────────────────────────────────

interface Stage {
  id: string;
  label: string;
  icon: string;
  count: number;
  conversion: number;
  avg_days_to_next: number | null;
  next_label: string | null;
  rag: "green" | "amber" | "red" | "grey";
}

interface StageSummary {
  stages: Stage[];
  summary: {
    total_cases: number;
    avg_cycle_days: number | null;
    maverick_count: number;
    grn_returns: number;
    credit_memos: number;
    payment_count: number;
  };
  monthly_funnel: Array<{ month: string; po: number; grn: number; invoice: number }>;
}

interface FilterOptions {
  vendors: Array<{ value: string; label: string }>;
  plants: string[];
  purchasing_groups: string[];
  anomaly_codes: string[];
}

interface Filters {
  date_from: string;
  date_to:   string;
  vendor:    string;
  plant:     string;
  purchasing_group: string;
}

interface StageRecord {
  purchase_requisition: string | null;
  item_of_requisition: string | null;
  purchasing_document: string | null;
  item: string | null;
  vendor: string | null;
  vendor_name: string | null;
  material_description: string | null;
  material_group: string | null;
  company_code: string | null;
  po_document_date: string | null;
  po_net_value: number | null;
  grn_posting_date: string | null;
  grn_quantity: number | null;
  grn_amount: number | null;
  invoice_posting_date: string | null;
  invoice_amount: number | null;
  pr_to_po_days: number | null;
  po_to_grn_days: number | null;
  grn_to_invoice_days: number | null;
  invoice_to_payment_days: number | null;
  is_maverick: number;
}

interface FindChainItem {
  purchase_requisition: string | null;
  item_of_requisition: string | null;
  pr_release_date: string | null;
  purchasing_document: string | null;
  item: string | null;
  vendor: string | null;
  vendor_name: string | null;
  material_description: string | null;
  company_code: string | null;
  po_net_value: number | null;
  po_document_date: string | null;
  grn_posting_date: string | null;
  grn_quantity: number | null;
  grn_amount: number | null;
  invoice_posting_date: string | null;
  invoice_amount: number | null;
  pr_to_po_days: number | null;
  po_to_grn_days: number | null;
  grn_to_invoice_days: number | null;
  invoice_to_payment_days: number | null;
  is_maverick: number;
}

interface FindResult {
  found: boolean;
  doc_type: string;
  doc_number: string;
  chain: FindChainItem[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

const STAGE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "file-plus":       FilePlus,
  "check-square":    CheckSquare,
  "shopping-cart":   ShoppingCart,
  "clipboard-check": ClipboardCheck,
  "package":         Package,
  "file-text":       FileText,
  "banknote":        Banknote,
};

const RAG_STYLES = {
  green: { bg: "bg-success/10", border: "border-success/40", text: "text-success", dot: "#009A44" },
  amber: { bg: "bg-warning/10", border: "border-warning/40", text: "text-warning", dot: "#F5A623" },
  red:   { bg: "bg-danger/10",  border: "border-danger/40",  text: "text-danger",  dot: "#D0021B" },
  grey:  { bg: "bg-secondary",  border: "border-border",     text: "text-muted-foreground", dot: "#999" },
};

const ANOMALY_SEVERITY_COLOR: Record<string, string> = {
  HIGH:   brand.colors.danger,
  MEDIUM: brand.colors.warning,
  LOW:    brand.colors.accent,
};

// ── Main Page ──────────────────────────────────────────────────────────────

function P2PTracker() {
  const [filters, setFilters] = useState<Filters>({
    date_from: "", date_to: "", vendor: "", plant: "", purchasing_group: "",
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedStage, setSelectedStage] = useState<string | null>(null);

  const qp = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => { if (v) qp.set(k, v); });

  const { data: summary, isLoading: loadingStages } = useQuery<StageSummary>({
    queryKey: ["p2p-stage-summary", filters],
    queryFn:  () => apiFetch(`/p2p/stage-summary?${qp.toString()}`),
  });

  const { data: filterOpts } = useQuery<FilterOptions>({
    queryKey: ["p2p-filter-options"],
    queryFn:  () => apiFetch("/p2p/filter-options"),
  });

  const activeFilters = Object.values(filters).filter(Boolean).length;

  return (
    <AppShell>
      <PageHeader
        title="P2P Lifecycle Tracker"
        subtitle="End-to-end Procure-to-Pay flow — stage health, bottlenecks, and anomalies"
        actions={
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 h-8 px-3 rounded border text-[12px] font-medium transition-colors
              ${showFilters || activeFilters > 0
                ? "bg-primary text-white border-primary"
                : "border-border hover:border-primary/60"}`}
          >
            <Filter className="h-3.5 w-3.5" />
            Filters {activeFilters > 0 && `(${activeFilters})`}
          </button>
        }
      />

      {/* Find Bar */}
      <FindBar />

      {/* Filter Bar */}
      {showFilters && (
        <FilterBar
          filters={filters}
          options={filterOpts}
          onChange={setFilters}
          onClear={() => setFilters({ date_from:"", date_to:"", vendor:"", plant:"", purchasing_group:"" })}
        />
      )}

      {/* P2P Schematic */}
      <SectionCard
        title="P2P End-to-End Flow"
        subtitle="Click a stage to view records · stage health · conversion rates · avg cycle times"
        className="mt-4"
      >
        {loadingStages ? (
          <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
        ) : !summary?.stages.length ? (
          <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">Upload P2P data to view lifecycle</div>
        ) : (
          <P2PSchematic
            stages={summary.stages}
            selectedStage={selectedStage}
            onSelectStage={setSelectedStage}
          />
        )}
      </SectionCard>

      {/* Stage Records */}
      {selectedStage && <StageRecordsPanel stage={selectedStage} onClose={() => setSelectedStage(null)} />}

      {/* Summary Stats */}
      {summary && (
        <SummaryStats summary={summary.summary} />
      )}

      {/* Bottom Charts */}
      <div className="grid grid-cols-2 gap-4 mt-4">
        <MonthlyFunnel data={summary?.monthly_funnel ?? []} loading={loadingStages} />
        <AnomalyPanel />
      </div>

      <div className="mt-4">
        <VariantBreakdown />
      </div>
    </AppShell>
  );
}

// ── Find Bar ───────────────────────────────────────────────────────────────

const DOC_TYPES = ["PO", "PR", "GRN", "INVOICE"];

function FindBar() {
  const [docType, setDocType] = useState("PO");
  const [docNumber, setDocNumber] = useState("");
  const [searchKey, setSearchKey] = useState<{ type: string; number: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: result, isLoading, isFetching } = useQuery<FindResult>({
    queryKey: ["p2p-find", searchKey],
    queryFn:  () => apiFetch(`/p2p/find?doc_type=${searchKey!.type}&doc_number=${encodeURIComponent(searchKey!.number)}`),
    enabled:  !!searchKey,
    staleTime: 30_000,
  });

  function handleFind() {
    const num = docNumber.trim();
    if (!num) return;
    setSearchKey({ type: docType, number: num });
  }

  function handleClear() {
    setSearchKey(null);
    setDocNumber("");
    inputRef.current?.focus();
  }

  return (
    <div className="mt-4 space-y-3">
      {/* Search row */}
      <div className="flex items-center gap-2 bg-surface border border-border rounded-lg px-4 py-3">
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-[12px] font-medium text-muted-foreground shrink-0">Find:</span>

        <div className="flex items-center gap-1 border border-border rounded-md overflow-hidden shrink-0">
          {DOC_TYPES.map(t => (
            <button
              key={t}
              onClick={() => { setDocType(t); setSearchKey(null); }}
              className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${
                docType === t
                  ? "bg-primary text-white"
                  : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <input
          ref={inputRef}
          type="text"
          value={docNumber}
          onChange={e => setDocNumber(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleFind()}
          placeholder={`Enter ${docType} number…`}
          className="flex-1 h-7 px-2 text-[12px] rounded border border-border bg-background focus:outline-none focus:border-primary min-w-[160px]"
        />

        <button
          onClick={handleFind}
          disabled={!docNumber.trim() || isFetching}
          className="h-7 px-3 bg-primary text-white text-[12px] font-medium rounded hover:bg-primary/90 disabled:opacity-50 transition-colors shrink-0"
        >
          {isFetching ? "Finding…" : "Find"}
        </button>

        {searchKey && (
          <button onClick={handleClear} className="h-7 w-7 flex items-center justify-center rounded hover:bg-secondary transition-colors shrink-0">
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Results */}
      {searchKey && !isLoading && result && (
        result.found ? (
          <FindResults result={result} />
        ) : (
          <div className="bg-surface border border-border rounded-lg px-4 py-3 text-[12px] text-muted-foreground">
            No records found for {result.doc_type} <span className="font-mono font-medium text-foreground">{result.doc_number}</span>
          </div>
        )
      )}
    </div>
  );
}

// ── Find Results ───────────────────────────────────────────────────────────

function FindResults({ result }: { result: FindResult }) {
  const [expanded, setExpanded] = useState<number | null>(0);

  return (
    <SectionCard
      title={`P2P Chain · ${result.doc_type} ${result.doc_number}`}
      subtitle={`${result.chain.length} line item${result.chain.length !== 1 ? "s" : ""} found`}
      bodyClassName="p-0"
    >
      <div className="divide-y divide-border">
        {result.chain.map((item, idx) => {
          const isOpen = expanded === idx;
          const stages = [
            { label: "PR", value: item.purchase_requisition, sub: item.pr_release_date ? `Approved ${formatDateShort(item.pr_release_date)}` : "Pending approval", ok: !!item.purchase_requisition },
            { label: "PO", value: item.purchasing_document, sub: item.po_document_date ? formatDateShort(item.po_document_date) : null, ok: !!item.purchasing_document },
            { label: "GRN", value: item.grn_posting_date ? formatDateShort(item.grn_posting_date) : null, sub: item.grn_quantity ? `Qty: ${item.grn_quantity}` : null, ok: !!item.grn_posting_date },
            { label: "Invoice", value: item.invoice_posting_date ? formatDateShort(item.invoice_posting_date) : null, sub: item.invoice_amount ? formatINR(item.invoice_amount) : null, ok: !!item.invoice_posting_date },
            { label: "Payment", value: item.invoice_to_payment_days != null ? `${item.invoice_to_payment_days}d` : null, sub: "Days to pay", ok: item.invoice_to_payment_days != null },
          ];

          return (
            <div key={idx}>
              <button
                onClick={() => setExpanded(isOpen ? null : idx)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors text-left"
              >
                <span className="text-[11px] font-mono text-muted-foreground shrink-0">#{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-medium truncate">
                    {item.material_description || "—"}
                    {item.is_maverick ? <span className="ml-2 text-[9px] bg-danger/10 text-danger px-1 py-0.5 rounded">MAVERICK</span> : null}
                  </div>
                  <div className="text-[10px] text-muted-foreground">{item.vendor_name || item.vendor} · {item.company_code}</div>
                </div>

                {/* Stage pills */}
                <div className="flex items-center gap-1 shrink-0">
                  {stages.map((s, si) => (
                    <span key={si} className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                      s.ok ? "bg-success/10 text-success" : "bg-secondary text-muted-foreground"
                    }`}>{s.label}</span>
                  ))}
                </div>

                {isOpen ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
              </button>

              {isOpen && (
                <div className="px-4 pb-4 bg-secondary/20">
                  {/* Chain timeline */}
                  <div className="flex items-start gap-2 pt-3 overflow-x-auto pb-2">
                    {stages.map((s, si) => (
                      <div key={si} className="flex items-start">
                        <div className={`flex flex-col items-center min-w-[90px] p-2 rounded-lg border ${
                          s.ok ? "border-success/40 bg-success/5" : "border-border bg-background opacity-50"
                        }`}>
                          <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{s.label}</span>
                          <span className="text-[11px] font-medium mt-0.5 text-center leading-tight">{s.value || "—"}</span>
                          {s.sub && <span className="text-[9px] text-muted-foreground mt-0.5 text-center">{s.sub}</span>}
                        </div>
                        {si < stages.length - 1 && (
                          <div className="flex items-center pt-4 mx-0.5">
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Cycle times */}
                  <div className="flex flex-wrap gap-3 mt-3">
                    {[
                      { label: "PR→PO",       days: item.pr_to_po_days,           ok: (item.pr_to_po_days ?? 999) <= 5 },
                      { label: "PO→GRN",       days: item.po_to_grn_days,          ok: (item.po_to_grn_days ?? 999) <= 30 },
                      { label: "GRN→Invoice",  days: item.grn_to_invoice_days,     ok: (item.grn_to_invoice_days ?? 999) <= 7 },
                      { label: "Invoice→Pay",  days: item.invoice_to_payment_days, ok: (item.invoice_to_payment_days ?? 999) <= 30 },
                    ].map(c => (
                      c.days != null ? (
                        <div key={c.label} className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] ${
                          c.ok ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
                        }`}>
                          <span className="font-medium">{c.label}:</span>
                          <span className="font-tabular">{c.days}d</span>
                        </div>
                      ) : null
                    ))}
                    {item.po_net_value != null && (
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] bg-secondary text-muted-foreground">
                        <span className="font-medium">PO Value:</span>
                        <span className="font-tabular">{formatINR(item.po_net_value)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

// ── Stage Records Panel ────────────────────────────────────────────────────

const STAGE_LABELS: Record<string, string> = {
  PR_CREATED:    "PR Created",
  PR_APPROVED:   "PR Approved",
  PO_CREATED:    "PO Created",
  PO_APPROVED:   "PO Approved",
  GRN_POSTED:    "GRN Posted",
  INVOICE_POSTED:"Invoice Posted",
  PAYMENT_MADE:  "Payment Made",
};

function StageRecordsPanel({ stage, onClose }: { stage: string; onClose: () => void }) {
  const { data: records = [], isLoading } = useQuery<StageRecord[]>({
    queryKey: ["p2p-stage-records", stage],
    queryFn: () => apiFetch(`/p2p/stage-records?stage=${stage}&limit=50`),
    staleTime: 60_000,
  });

  return (
    <SectionCard
      title={`Stage Records — ${STAGE_LABELS[stage] ?? stage}`}
      subtitle={`${records.length} records · click a different stage to switch`}
      className="mt-4"
      actions={
        <button onClick={onClose} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-3 w-3" /> Close
        </button>
      }
      bodyClassName="p-0"
    >
      {isLoading ? (
        <div className="p-6 text-center text-sm text-muted-foreground">Loading records…</div>
      ) : records.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">No records found for this stage</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead className="bg-secondary/50 border-b border-border text-muted-foreground">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">PR #</th>
                <th className="px-3 py-2 font-medium">PO #</th>
                <th className="px-3 py-2 font-medium">Vendor</th>
                <th className="px-3 py-2 font-medium">Material</th>
                <th className="px-3 py-2 font-medium">Co.</th>
                <th className="px-3 py-2 font-medium text-right">PO Value</th>
                <th className="px-3 py-2 font-medium">PO Date</th>
                <th className="px-3 py-2 font-medium">GRN Date</th>
                <th className="px-3 py-2 font-medium">Inv Date</th>
                <th className="px-3 py-2 font-medium text-right">Cycle (d)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {records.map((r, i) => (
                <tr key={i} className={`hover:bg-secondary/30 transition-colors ${r.is_maverick ? "bg-warning/[0.02]" : ""}`}>
                  <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">{r.purchase_requisition ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-[10px] font-medium text-primary">{r.purchasing_document ?? "—"}</td>
                  <td className="px-3 py-2 max-w-[120px]">
                    <div className="truncate" title={r.vendor_name ?? r.vendor ?? ""}>{r.vendor_name ?? r.vendor ?? "—"}</div>
                  </td>
                  <td className="px-3 py-2 max-w-[140px]">
                    <div className="truncate text-muted-foreground" title={r.material_description ?? ""}>{r.material_description ?? "—"}</div>
                  </td>
                  <td className="px-3 py-2 text-[10px]">{r.company_code ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-tabular">{r.po_net_value != null ? formatINR(r.po_net_value) : "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.po_document_date ? formatDateShort(r.po_document_date) : "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.grn_posting_date ? formatDateShort(r.grn_posting_date) : "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.invoice_posting_date ? formatDateShort(r.invoice_posting_date) : "—"}</td>
                  <td className="px-3 py-2 text-right">
                    {[r.pr_to_po_days, r.po_to_grn_days, r.grn_to_invoice_days].filter(d => d != null).map((d, di) => (
                      <span key={di} className="ml-1 text-[9px] px-1 rounded bg-secondary">{d}d</span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

// ── Filter Bar ─────────────────────────────────────────────────────────────

function FilterBar({ filters, options, onChange, onClear }: {
  filters: Filters;
  options?: FilterOptions;
  onChange: (f: Filters) => void;
  onClear: () => void;
}) {
  const set = (k: keyof Filters, v: string) => onChange({ ...filters, [k]: v });

  return (
    <div className="flex flex-wrap items-center gap-3 bg-secondary/50 border border-border rounded-lg px-4 py-3 mt-3">
      <div className="flex items-center gap-1.5">
        <label className="text-[11px] text-muted-foreground font-medium">From</label>
        <input type="date" value={filters.date_from}
          onChange={e => set("date_from", e.target.value)}
          className="h-7 px-2 text-[11px] rounded border border-border bg-surface focus:outline-none focus:border-primary" />
      </div>
      <div className="flex items-center gap-1.5">
        <label className="text-[11px] text-muted-foreground font-medium">To</label>
        <input type="date" value={filters.date_to}
          onChange={e => set("date_to", e.target.value)}
          className="h-7 px-2 text-[11px] rounded border border-border bg-surface focus:outline-none focus:border-primary" />
      </div>
      <select value={filters.vendor} onChange={e => set("vendor", e.target.value)}
        className="h-7 px-2 text-[11px] rounded border border-border bg-surface focus:outline-none focus:border-primary min-w-[160px]">
        <option value="">All Vendors</option>
        {options?.vendors.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
      </select>
      <select value={filters.plant} onChange={e => set("plant", e.target.value)}
        className="h-7 px-2 text-[11px] rounded border border-border bg-surface focus:outline-none focus:border-primary">
        <option value="">All Plants</option>
        {options?.plants.map(p => <option key={p} value={p}>{p}</option>)}
      </select>
      <select value={filters.purchasing_group} onChange={e => set("purchasing_group", e.target.value)}
        className="h-7 px-2 text-[11px] rounded border border-border bg-surface focus:outline-none focus:border-primary">
        <option value="">All Groups</option>
        {options?.purchasing_groups.map(g => <option key={g} value={g}>{g}</option>)}
      </select>
      <button onClick={onClear}
        className="flex items-center gap-1 h-7 px-2 text-[11px] text-danger hover:bg-danger/10 rounded transition-colors">
        <X className="h-3 w-3" /> Clear
      </button>
    </div>
  );
}

// ── P2P Schematic ──────────────────────────────────────────────────────────

function P2PSchematic({ stages, selectedStage, onSelectStage }: {
  stages: Stage[];
  selectedStage: string | null;
  onSelectStage: (id: string | null) => void;
}) {
  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex items-start gap-0 min-w-max px-1 py-3">
        {stages.map((stage, idx) => {
          const Icon = STAGE_ICONS[stage.icon] ?? FileText;
          const rag  = RAG_STYLES[stage.rag];
          const selected = selectedStage === stage.id;

          return (
            <div key={stage.id} className="flex items-start">
              <button
                onClick={() => onSelectStage(selected ? null : stage.id)}
                className={`relative flex flex-col items-center w-[120px] rounded-xl border-2 p-3 transition-all
                  ${rag.bg} ${rag.border}
                  ${selected ? "ring-2 ring-primary ring-offset-2 shadow-md" : "hover:shadow-sm hover:-translate-y-0.5"}
                  `}
              >
                <div className="absolute -top-2 -left-2 h-5 w-5 rounded-full bg-surface border border-border
                  text-[10px] font-bold text-muted-foreground flex items-center justify-center">
                  {idx + 1}
                </div>
                <div className={`h-8 w-8 rounded-full flex items-center justify-center mb-1.5
                  ${stage.rag === "green" ? "bg-success/20" :
                    stage.rag === "amber" ? "bg-warning/20" :
                    stage.rag === "red"   ? "bg-danger/20"  : "bg-secondary"}`}>
                  <Icon className={`h-4 w-4 ${rag.text}`} />
                </div>
                <div className="text-[10px] font-semibold text-foreground text-center leading-tight mb-1.5">
                  {stage.label}
                </div>
                <div className="text-[20px] font-bold font-tabular text-foreground leading-none">
                  {stage.count.toLocaleString()}
                </div>
                <div className="text-[9px] text-muted-foreground mt-0.5">cases</div>
                <div className={`mt-1.5 text-[9px] font-medium px-1.5 py-0.5 rounded-full
                  ${stage.conversion >= 90 ? "bg-success/15 text-success" :
                    stage.conversion >= 70 ? "bg-warning/15 text-warning" :
                    "bg-danger/15 text-danger"}`}>
                  {stage.conversion.toFixed(0)}%
                </div>
                <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 h-2 w-2 rounded-full"
                  style={{ background: rag.dot }} />
                {selected && (
                  <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[8px] text-primary font-medium whitespace-nowrap">
                    ▲ viewing records
                  </div>
                )}
              </button>

              {idx < stages.length - 1 && stages[idx].avg_days_to_next !== null && (
                <div className="flex flex-col items-center justify-center h-[140px] mx-0.5">
                  <div className="flex-1" />
                  <div className="flex flex-col items-center gap-0.5">
                    {stage.avg_days_to_next != null && (
                      <div className={`text-[9px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap
                        ${stage.rag === "green" ? "bg-success/10 text-success" :
                          stage.rag === "amber" ? "bg-warning/10 text-warning" :
                          stage.rag === "red"   ? "bg-danger/10 text-danger"   : "bg-secondary text-muted-foreground"}`}>
                        {stage.avg_days_to_next.toFixed(1)}d
                      </div>
                    )}
                    {stage.next_label && (
                      <div className="text-[8px] text-muted-foreground whitespace-nowrap">{stage.next_label}</div>
                    )}
                    <ChevronRight className={`h-4 w-4 mt-0.5
                      ${stage.rag === "green" ? "text-success" :
                        stage.rag === "amber" ? "text-warning" :
                        stage.rag === "red"   ? "text-danger"  : "text-muted-foreground"}`} />
                  </div>
                  <div className="flex-1" />
                </div>
              )}
              {idx < stages.length - 1 && stages[idx].avg_days_to_next === null && (
                <div className="flex items-center justify-center h-[140px] mx-0.5">
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-4 mt-2 px-1">
        <span className="text-[10px] text-muted-foreground font-medium">Stage health:</span>
        {(["green","amber","red"] as const).map(rag => (
          <div key={rag} className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full" style={{ background: RAG_STYLES[rag].dot }} />
            <span className="text-[10px] capitalize text-muted-foreground">
              {rag === "green" ? "On target" : rag === "amber" ? "Slow" : "Bottleneck"}
            </span>
          </div>
        ))}
        <span className="text-[10px] text-muted-foreground ml-2">· Numbers = avg days to next stage · Click stage to view records</span>
      </div>
    </div>
  );
}

// ── Summary Stats ──────────────────────────────────────────────────────────

function SummaryStats({ summary }: { summary: StageSummary["summary"] }) {
  const stats = [
    { label: "Total Cases",     value: summary.total_cases.toLocaleString(),                         tone: "info" as const },
    { label: "Avg Cycle Time",  value: summary.avg_cycle_days ? `${summary.avg_cycle_days.toFixed(1)}d` : "—", tone: "info" as const },
    { label: "Maverick POs",    value: summary.maverick_count.toLocaleString(),     tone: summary.maverick_count > 0 ? "danger" as const : "success" as const },
    { label: "GRN Returns",     value: summary.grn_returns.toLocaleString(),        tone: summary.grn_returns > 0  ? "warning" as const : "success" as const },
    { label: "Credit Memos",    value: summary.credit_memos.toLocaleString(),       tone: summary.credit_memos > 0 ? "warning" as const : "success" as const },
    { label: "Payments Made",   value: summary.payment_count.toLocaleString(),                       tone: "info" as const },
  ];

  return (
    <div className="grid grid-cols-6 gap-3 mt-4">
      {stats.map((s) => (
        <div key={s.label} className="bg-surface border border-border rounded-lg p-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{s.label}</div>
          <div className="text-[22px] font-semibold font-tabular">{s.value}</div>
          {s.tone === "danger" && parseInt(s.value) > 0 && (
            <StatusPill tone="danger" className="mt-1">Review</StatusPill>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Monthly Funnel Chart ───────────────────────────────────────────────────

function MonthlyFunnel({ data, loading }: {
  data: Array<{ month: string; po: number; grn: number; invoice: number }>;
  loading: boolean;
}) {
  return (
    <SectionCard title="Monthly P2P Funnel" subtitle="PO → GRN → Invoice conversion per month">
      <div className="h-56">
        {loading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
        ) : data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No data</div>
        ) : (
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="po"      name="PO Created"  stroke={brand.colors.primary} strokeWidth={2} dot={{ r: 2 }} />
              <Line type="monotone" dataKey="grn"     name="GRN Posted"  stroke={brand.colors.teal}    strokeWidth={2} dot={{ r: 2 }} />
              <Line type="monotone" dataKey="invoice" name="Invoice"      stroke={brand.colors.accent}  strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </SectionCard>
  );
}

// ── Anomaly Panel ──────────────────────────────────────────────────────────

function AnomalyPanel() {
  const { data: anomalies, isLoading } = useAnomalies();

  return (
    <SectionCard title="Anomaly Detection" subtitle="Flagged cases by type and severity">
      <div className="h-56">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
        ) : !anomalies?.length ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No anomalies detected</div>
        ) : (
          <ResponsiveContainer>
            <BarChart
              data={anomalies.slice(0, 8).map(a => ({
                code: a.anomaly_code.replace(/_/g, " "),
                count: a.count,
                severity: a.severity,
              }))}
              layout="vertical"
              margin={{ top: 4, right: 40, left: 130, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
              <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="code" tickLine={false} axisLine={false} width={130} tick={{ fontSize: 9 }} />
              <Tooltip formatter={(v: number, _n, p) => [`${v} cases`, p.payload.severity]} />
              <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                {anomalies.slice(0, 8).map((a, i) => (
                  <Cell key={i} fill={ANOMALY_SEVERITY_COLOR[a.severity] ?? "#999"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </SectionCard>
  );
}

// ── Variant Breakdown ──────────────────────────────────────────────────────

function VariantBreakdown() {
  const { data, isLoading } = useQuery({
    queryKey: ["p2p", "lifecycle"],
    queryFn:  () => apiFetch<{ stage_counts: Record<string, number>; variants: Array<{ variant_class: string; count: number }> }>("/p2p/lifecycle"),
  });
  const variants = data?.variants ?? [];
  const total = variants.reduce((s, v) => s + v.count, 0) || 1;
  const barData = variants.slice(0, 8).map(v => ({
    variant: v.variant_class,
    count:   v.count,
    pct:     ((v.count / total) * 100).toFixed(1),
  }));

  const COLORS = [
    brand.colors.primary, brand.colors.success, brand.colors.accent,
    brand.colors.warning, brand.colors.danger, "#6366f1", "#14b8a6", "#f59e0b",
  ];

  return (
    <SectionCard title="Process Variant Distribution" subtitle="How POs flow through the P2P lifecycle">
      <div className="h-52">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
        ) : barData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Upload P2P data to view variants</div>
        ) : (
          <ResponsiveContainer>
            <BarChart data={barData} margin={{ top: 8, right: 16, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
              <XAxis dataKey="variant" tickLine={false} axisLine={false}
                tick={{ fontSize: 9 }} angle={-20} textAnchor="end" interval={0} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number, _n, p) => [`${v} cases (${p.payload.pct}%)`, "Count"]} />
              <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                {barData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </SectionCard>
  );
}
