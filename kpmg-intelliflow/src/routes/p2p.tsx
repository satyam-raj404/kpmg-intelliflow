import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell, LineChart, Line, Legend,
} from "recharts";
import {
  FilePlus, CheckSquare, ShoppingCart, ClipboardCheck,
  Package, FileText, Banknote, AlertTriangle, ChevronRight,
  Filter, X,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { AppShell }   from "@/components/AppShell";
import { PageHeader }  from "@/components/PageHeader";
import { SectionCard } from "@/components/SectionCard";
import { StatusPill }  from "@/components/StatusPill";
import { apiFetch }    from "@/api/client";
import { brand }       from "@/lib/brand";
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
        subtitle="Stage health · conversion rates · avg cycle times between stages"
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
              {/* Stage Node */}
              <button
                onClick={() => onSelectStage(selected ? null : stage.id)}
                className={`relative flex flex-col items-center w-[120px] rounded-xl border-2 p-3 transition-all
                  ${rag.bg} ${rag.border}
                  ${selected ? "ring-2 ring-primary ring-offset-2 shadow-md" : "hover:shadow-sm hover:-translate-y-0.5"}
                  `}
              >
                {/* Stage number */}
                <div className="absolute -top-2 -left-2 h-5 w-5 rounded-full bg-surface border border-border
                  text-[10px] font-bold text-muted-foreground flex items-center justify-center">
                  {idx + 1}
                </div>

                {/* Icon */}
                <div className={`h-8 w-8 rounded-full flex items-center justify-center mb-1.5
                  ${stage.rag === "green" ? "bg-success/20" :
                    stage.rag === "amber" ? "bg-warning/20" :
                    stage.rag === "red"   ? "bg-danger/20"  : "bg-secondary"}`}>
                  <Icon className={`h-4 w-4 ${rag.text}`} />
                </div>

                {/* Label */}
                <div className="text-[10px] font-semibold text-foreground text-center leading-tight mb-1.5">
                  {stage.label}
                </div>

                {/* Count */}
                <div className="text-[20px] font-bold font-tabular text-foreground leading-none">
                  {stage.count.toLocaleString()}
                </div>
                <div className="text-[9px] text-muted-foreground mt-0.5">cases</div>

                {/* Conversion badge */}
                <div className={`mt-1.5 text-[9px] font-medium px-1.5 py-0.5 rounded-full
                  ${stage.conversion >= 90 ? "bg-success/15 text-success" :
                    stage.conversion >= 70 ? "bg-warning/15 text-warning" :
                    "bg-danger/15 text-danger"}`}>
                  {stage.conversion.toFixed(0)}%
                </div>

                {/* RAG dot */}
                <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 h-2 w-2 rounded-full"
                  style={{ background: rag.dot }} />
              </button>

              {/* Connector arrow (not after last stage) */}
              {idx < stages.length - 1 && stages[idx].avg_days_to_next !== null && (
                <div className="flex flex-col items-center justify-center h-[140px] mx-0.5">
                  <div className="flex-1" />
                  <div className="flex flex-col items-center gap-0.5">
                    {/* Avg days label */}
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
                    {/* Arrow */}
                    <ChevronRight className={`h-4 w-4 mt-0.5
                      ${stage.rag === "green" ? "text-success" :
                        stage.rag === "amber" ? "text-warning" :
                        stage.rag === "red"   ? "text-danger"  : "text-muted-foreground"}`} />
                  </div>
                  <div className="flex-1" />
                </div>
              )}
              {/* No connector data between non-linked stages */}
              {idx < stages.length - 1 && stages[idx].avg_days_to_next === null && (
                <div className="flex items-center justify-center h-[140px] mx-0.5">
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
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
        <span className="text-[10px] text-muted-foreground ml-2">· Numbers = avg days to next stage</span>
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
