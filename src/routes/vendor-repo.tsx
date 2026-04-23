import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Grid3x3, List, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SectionCard } from "@/components/SectionCard";
import { StatusPill } from "@/components/StatusPill";
import { vendors } from "@/data/mock";
import { formatINR } from "@/lib/format";
import { roleInitials } from "@/context/AppContext";

export const Route = createFileRoute("/vendor-repo")({
  head: () => ({ meta: [{ title: "Vendor Repository — KPMG IntelliSource" }] }),
  component: VendorRepo,
});

function VendorRepo() {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const cats = ["All", "IT Services", "Consulting", "Cloud Infrastructure", "Security", "Data Analytics", "SaaS"];
  const filtered = vendors.filter((v) => (cat === "All" || v.category === cat) && v.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <AppShell>
      <PageHeader title="Vendor Repository" subtitle="Searchable, AI-assisted vendor catalog" />

      <SectionCard
        title={`${filtered.length} Vendors`}
        subtitle="Browse, filter and drill into any vendor"
        actions={
          <div className="flex gap-2 items-center">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search vendors..." className="h-8 pl-8 pr-3 rounded border border-border text-[12px] bg-surface w-56 focus:border-accent focus:outline-none" />
            </div>
            <button onClick={() => setView("grid")} className={`h-8 w-8 rounded border flex items-center justify-center ${view === "grid" ? "bg-primary text-white border-primary" : "border-border"}`}><Grid3x3 className="h-3.5 w-3.5" /></button>
            <button onClick={() => setView("list")} className={`h-8 w-8 rounded border flex items-center justify-center ${view === "list" ? "bg-primary text-white border-primary" : "border-border"}`}><List className="h-3.5 w-3.5" /></button>
          </div>
        }
      >
        <div className="flex gap-1 mb-4 flex-wrap">
          {cats.map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`text-[11px] px-2.5 py-1 rounded border ${cat === c ? "bg-primary text-primary-foreground border-primary" : "bg-surface border-border hover:border-accent"}`}>{c}</button>
          ))}
        </div>

        {view === "grid" ? (
          <div className="grid grid-cols-4 gap-3">
            {filtered.map((v) => (
              <div key={v.id} className="border border-border rounded-md p-4 hover:border-accent hover:shadow-sm cursor-pointer">
                <div className="flex items-start justify-between mb-3">
                  <div className="h-10 w-10 rounded-full bg-primary text-white text-[12px] font-bold flex items-center justify-center">{roleInitials(v.name)}</div>
                  {v.abacCertified && <ShieldCheck className="h-4 w-4 text-success" />}
                </div>
                <div className="font-semibold text-[13px] truncate">{v.name}</div>
                <div className="text-[10px] text-muted-foreground font-mono mb-2">{v.code} · {v.region}</div>
                <StatusPill tone="info" className="mb-2">{v.category}</StatusPill>
                <div className="text-[11px] mt-2 flex justify-between">
                  <span className="text-muted-foreground">Spend YTD</span>
                  <span className="font-tabular font-semibold">{formatINR(v.spendYTD)}</span>
                </div>
                <div className="text-[11px] flex justify-between">
                  <span className="text-muted-foreground">Rating</span>
                  <span className="font-semibold">★ {v.rating.toFixed(1)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((v) => (
              <div key={v.id} className="py-2.5 flex items-center gap-3 hover:bg-secondary/50 px-2 -mx-2 rounded">
                <div className="h-8 w-8 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">{roleInitials(v.name)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[13px]">{v.name}</div>
                  <div className="text-[10px] text-muted-foreground">{v.code} · {v.category} · {v.region}</div>
                </div>
                <StatusPill tone={v.compliance === "Compliant" ? "success" : v.compliance === "Under Review" ? "warning" : "danger"}>{v.compliance}</StatusPill>
                <span className="text-[12px] font-tabular font-semibold w-24 text-right">{formatINR(v.spendYTD)}</span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </AppShell>
  );
}
