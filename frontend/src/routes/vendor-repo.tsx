import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Grid3x3, List, ShieldCheck, Plus, Loader2 } from "lucide-react";
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
import { vendors as mockVendors } from "@/data/mock";
import { formatINR } from "@/lib/format";
import { roleInitials } from "@/context/AppContext";
import { fetchVendors, addVendor, type AddVendorPayload, type VendorApiRow } from "@/api/queries";

export const Route = createFileRoute("/vendor-repo")({
  head: () => ({ meta: [{ title: "Vendor Repository — KPMG IntelliSource" }] }),
  component: VendorRepo,
});

const EMPTY_FORM: AddVendorPayload = {
  vendor_code: "",
  vendor_name: "",
  vendor_address: "",
  country: "",
  contact_phone: "",
  contact_email: "",
  spoc_name: "",
  tax_number_pan: "",
  added_by: "",
  msme_flag: "",
  payment_terms: "",
  service_description: "",
};

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-medium text-foreground">
        {label}
        {required && <span className="text-danger ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full h-8 px-2.5 rounded border border-border bg-surface text-[12px] focus:border-accent focus:outline-none";
const selectCls =
  "w-full h-8 px-2.5 rounded border border-border bg-surface text-[12px] focus:border-accent focus:outline-none";

function AddVendorSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<AddVendorPayload>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(key: keyof AddVendorPayload, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.vendor_code.trim() || !form.vendor_name.trim()) {
      setError("Vendor Code and Vendor Name are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await addVendor(form);
      qc.invalidateQueries({ queryKey: ["vendors"] });
      setForm(EMPTY_FORM);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add vendor.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-[480px] sm:max-w-[480px] overflow-y-auto">
        <SheetHeader className="mb-5">
          <SheetTitle>Add Vendor</SheetTitle>
          <SheetDescription>Register a new vendor in the repository.</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Row 1 */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Vendor Code" required>
              <input
                className={inputCls}
                placeholder="e.g. VND-001"
                value={form.vendor_code}
                onChange={(e) => set("vendor_code", e.target.value)}
              />
            </Field>
            <Field label="Vendor Name" required>
              <input
                className={inputCls}
                placeholder="Company legal name"
                value={form.vendor_name}
                onChange={(e) => set("vendor_name", e.target.value)}
              />
            </Field>
          </div>

          {/* Row 2 */}
          <Field label="Vendor Address">
            <textarea
              className="w-full px-2.5 py-1.5 rounded border border-border bg-surface text-[12px] focus:border-accent focus:outline-none resize-none h-16"
              placeholder="Full registered address"
              value={form.vendor_address}
              onChange={(e) => set("vendor_address", e.target.value)}
            />
          </Field>

          {/* Row 3 */}
          <Field label="Country of Business">
            <input
              className={inputCls}
              placeholder="e.g. India"
              value={form.country}
              onChange={(e) => set("country", e.target.value)}
            />
          </Field>

          {/* Row 4 — Contact Details */}
          <div className="border border-border rounded-md p-3 space-y-3">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Contact Details (SPOC)
            </p>
            <Field label="SPOC Name">
              <input
                className={inputCls}
                placeholder="Full name"
                value={form.spoc_name}
                onChange={(e) => set("spoc_name", e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone">
                <input
                  className={inputCls}
                  placeholder="+91 98765 43210"
                  value={form.contact_phone}
                  onChange={(e) => set("contact_phone", e.target.value)}
                />
              </Field>
              <Field label="Email">
                <input
                  className={inputCls}
                  type="email"
                  placeholder="spoc@vendor.com"
                  value={form.contact_email}
                  onChange={(e) => set("contact_email", e.target.value)}
                />
              </Field>
            </div>
          </div>

          {/* Row 5 */}
          <Field label="PAN No.">
            <input
              className={inputCls}
              placeholder="AAAAA0000A"
              value={form.tax_number_pan}
              onChange={(e) => set("tax_number_pan", e.target.value.toUpperCase())}
            />
          </Field>

          {/* Row 6 */}
          <Field label="Added By">
            <input
              className={inputCls}
              placeholder="Your name / employee ID"
              value={form.added_by}
              onChange={(e) => set("added_by", e.target.value)}
            />
          </Field>

          {/* Row 7 */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="MSME Vendor Flag">
              <select
                className={selectCls}
                value={form.msme_flag}
                onChange={(e) => set("msme_flag", e.target.value)}
              >
                <option value="">Select</option>
                <option value="Yes">Yes — MSME</option>
                <option value="No">No</option>
              </select>
            </Field>
            <Field label="Payment Terms">
              <input
                className={inputCls}
                placeholder="e.g. Net 30, Net 60"
                value={form.payment_terms}
                onChange={(e) => set("payment_terms", e.target.value)}
              />
            </Field>
          </div>

          {/* Row 8 */}
          <Field label="Service / Material Provided">
            <textarea
              className="w-full px-2.5 py-1.5 rounded border border-border bg-surface text-[12px] focus:border-accent focus:outline-none resize-none h-16"
              placeholder="Describe the primary service or material this vendor provides"
              value={form.service_description}
              onChange={(e) => set("service_description", e.target.value)}
            />
          </Field>

          {error && (
            <p className="text-[11px] text-danger bg-danger/10 border border-danger/20 rounded px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 h-9 rounded bg-primary text-primary-foreground text-[12px] font-medium hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {submitting ? "Adding…" : "Add Vendor"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded border border-border text-[12px] hover:bg-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function vendorInitials(name: string) {
  return roleInitials(name);
}

function VendorRepo() {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [addOpen, setAddOpen] = useState(false);

  const cats = ["All", "IT Services", "Consulting", "Cloud Infrastructure", "Security", "Data Analytics", "SaaS"];

  const { data: apiVendors, isLoading, isError } = useQuery({
    queryKey: ["vendors"],
    queryFn: fetchVendors,
    staleTime: 30_000,
  });

  // Merge: API vendors take priority; fall back to mock when API unavailable
  const allVendors = apiVendors
    ? apiVendors.map((v: VendorApiRow) => ({
        id: String(v.id),
        name: v.vendor_name || v.vendor,
        code: v.vendor,
        region: (v.country || "APAC") as "APAC" | "EMEA" | "Americas",
        category: "IT Services" as const,
        spendYTD: 0,
        rating: 0,
        compliance: "Compliant" as const,
        riskTier: "Low" as const,
        abacCertified: false,
        _isApi: true as const,
        _raw: v,
      }))
    : mockVendors;

  const filtered = allVendors.filter(
    (v) => (cat === "All" || v.category === cat) && v.name.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <AppShell>
      <PageHeader title="Vendor Repository" subtitle="Searchable, AI-assisted vendor catalog" />

      <AddVendorSheet open={addOpen} onClose={() => setAddOpen(false)} />

      <SectionCard
        title={`${filtered.length} Vendor${filtered.length !== 1 ? "s" : ""}`}
        subtitle="Browse, filter and drill into any vendor"
        actions={
          <div className="flex gap-2 items-center">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search vendors..."
                className="h-8 pl-8 pr-3 rounded border border-border text-[12px] bg-surface w-56 focus:border-accent focus:outline-none"
              />
            </div>
            <button
              onClick={() => setAddOpen(true)}
              className="h-8 px-3 rounded border border-primary bg-primary text-primary-foreground text-[12px] font-medium flex items-center gap-1.5 hover:bg-primary/90"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Vendor
            </button>
            <button
              onClick={() => setView("grid")}
              className={`h-8 w-8 rounded border flex items-center justify-center ${view === "grid" ? "bg-primary text-white border-primary" : "border-border"}`}
            >
              <Grid3x3 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setView("list")}
              className={`h-8 w-8 rounded border flex items-center justify-center ${view === "list" ? "bg-primary text-white border-primary" : "border-border"}`}
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        }
      >
        <div className="flex gap-1 mb-4 flex-wrap">
          {cats.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`text-[11px] px-2.5 py-1 rounded border ${cat === c ? "bg-primary text-primary-foreground border-primary" : "bg-surface border-border hover:border-accent"}`}
            >
              {c}
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading vendors…
          </div>
        )}

        {isError && (
          <p className="text-[11px] text-warning mb-3">
            Could not reach API — showing demo data.
          </p>
        )}

        {view === "grid" ? (
          <div className="grid grid-cols-4 gap-3">
            {filtered.map((v) => (
              <div
                key={v.id}
                className="border border-border rounded-md p-4 hover:border-accent hover:shadow-sm cursor-pointer"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="h-10 w-10 rounded-full bg-primary text-white text-[12px] font-bold flex items-center justify-center">
                    {vendorInitials(v.name)}
                  </div>
                  {v.abacCertified && <ShieldCheck className="h-4 w-4 text-success" />}
                </div>
                <div className="font-semibold text-[13px] truncate">{v.name}</div>
                <div className="text-[10px] text-muted-foreground font-mono mb-2">
                  {v.code} · {v.region}
                </div>
                <StatusPill tone="info" className="mb-2">
                  {v.category}
                </StatusPill>
                {"_raw" in v && v._raw.service_description && (
                  <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                    {v._raw.service_description}
                  </p>
                )}
                {!("_raw" in v) && (
                  <div className="text-[11px] mt-2 flex justify-between">
                    <span className="text-muted-foreground">Spend YTD</span>
                    <span className="font-tabular font-semibold">{formatINR(v.spendYTD)}</span>
                  </div>
                )}
                {!("_raw" in v) && (
                  <div className="text-[11px] flex justify-between">
                    <span className="text-muted-foreground">Rating</span>
                    <span className="font-semibold">★ {v.rating.toFixed(1)}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((v) => (
              <div
                key={v.id}
                className="py-2.5 flex items-center gap-3 hover:bg-secondary/50 px-2 -mx-2 rounded"
              >
                <div className="h-8 w-8 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">
                  {vendorInitials(v.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[13px]">{v.name}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {v.code} · {v.category} · {v.region}
                  </div>
                  {"_raw" in v && v._raw.service_description && (
                    <div className="text-[10px] text-muted-foreground truncate">
                      {v._raw.service_description}
                    </div>
                  )}
                </div>
                <StatusPill
                  tone={
                    v.compliance === "Compliant"
                      ? "success"
                      : v.compliance === "Under Review"
                        ? "warning"
                        : "danger"
                  }
                >
                  {v.compliance}
                </StatusPill>
                {!("_raw" in v) && (
                  <span className="text-[12px] font-tabular font-semibold w-24 text-right">
                    {formatINR(v.spendYTD)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </AppShell>
  );
}
