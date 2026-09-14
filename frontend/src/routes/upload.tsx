import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useRef } from "react";
import { Upload, CheckCircle, XCircle, FileSpreadsheet } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SectionCard } from "@/components/SectionCard";
import { useUpload } from "@/hooks/useUpload";

export const Route = createFileRoute("/upload")({
  head: () => ({ meta: [{ title: "Data Upload — KPMG IntelliSource" }] }),
  component: UploadPage,
});

const DATASET_GUIDE = [
  { name: "01 — Purchase Requisition", key: "pr_dump", columns: ["purchase_requisition", "item_of_requisition", "requisitioner", "valuation_price", "order_quantity", "delivery_date"] },
  { name: "02 — Purchase Order",       key: "po_dump",  columns: ["purchasing_document", "item", "vendor", "vendor_name", "net_order_value", "net_order_price", "order_quantity", "capex_opex_flag"] },
  { name: "03 — PO Delivery Schedule", key: "po_delivery_dump", columns: ["purchasing_document", "item", "schedule_line", "expected_delivery_date", "scheduled_quantity"] },
  { name: "04 — Goods Receipt (GRN)",  key: "grn_dump", columns: ["purchasing_document", "item", "material_document", "po_history_category", "movement_type", "debit_credit_ind"] },
  { name: "05 — PO Invoice",           key: "po_invoice_dump", columns: ["purchasing_document", "item", "invoice_doc", "invoice_year", "po_history_category", "debit_credit_ind"] },
  { name: "06 — Invoice",              key: "invoice_dump", columns: ["invoice_doc", "invoice_year", "vendor", "document_type", "posting_date", "due_date", "amount_local_ccy"] },
  { name: "07 — Payment",              key: "payment_dump", columns: ["payment_doc", "payment_year", "vendor", "posting_date", "clearing_date", "cleared_invoice", "house_bank"] },
  { name: "08 — Vendor Master",        key: "vendor_master", columns: ["vendor", "vendor_name", "country", "city", "account_group", "central_purchasing_block"] },
  { name: "09 — Change Log",           key: "change_log", columns: ["object_class", "object_id", "change_number", "username", "change_date", "field_name", "change_indicator"] },
  { name: "10 — Company / Plant Master", key: "company_plant_master", columns: ["company_code", "company_name", "purchasing_org", "plant", "plant_name"] },
];

function UploadPage() {
  const { upload, isUploading, progress, batch, error, reset } = useUpload();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files?.length) return;
    reset();
    upload(files[0]);
  }, [upload, reset]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const isComplete = batch?.status === "COMPLETED";
  const isFailed = batch?.status === "FAILED";

  return (
    <AppShell>
      <PageHeader title="Data Upload" subtitle="Upload CSV or Excel files to update dashboards in real time" />

      <div className="grid grid-cols-3 gap-4">
        {/* Drop zone */}
        <div className="col-span-2 space-y-4">
          <SectionCard title="Upload File" subtitle="Supported: CSV, .xlsx, .xls · Max 50 MB">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              onClick={() => !isUploading && inputRef.current?.click()}
              className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 cursor-pointer transition-colors ${isUploading ? "opacity-60 cursor-not-allowed border-border" : "border-border hover:border-primary/60 hover:bg-secondary/30"}`}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium">Drag and drop a file here, or click to browse</p>
                <p className="text-xs text-muted-foreground mt-0.5">Dataset type is auto-detected from column headers</p>
              </div>
            </div>

            {/* Progress */}
            {(isUploading || isComplete || isFailed) && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-muted-foreground">{progress.message || (isComplete ? "Done" : isFailed ? "Failed" : "Uploading…")}</span>
                  <span className="font-tabular font-medium">{progress.pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${isFailed ? "bg-danger" : isComplete ? "bg-success" : "bg-primary"}`}
                    style={{ width: `${progress.pct}%` }}
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-danger/10 border border-danger/20 px-3 py-2">
                <XCircle className="h-4 w-4 text-danger shrink-0 mt-0.5" />
                <p className="text-[12px] text-danger">{error}</p>
              </div>
            )}
          </SectionCard>

          {/* Results */}
          {isComplete && batch && (
            <SectionCard
              title="Upload Results"
              subtitle={`Dataset: ${batch.dataset_type ?? "—"} · Completed: ${batch.completed_at ?? ""}`}
            >
              <div className="flex gap-6 mb-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-success" />
                  <div>
                    <div className="text-[18px] font-semibold font-tabular">{batch.rows_accepted ?? 0}</div>
                    <div className="text-[10px] text-muted-foreground">Rows accepted</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-danger" />
                  <div>
                    <div className="text-[18px] font-semibold font-tabular">{batch.rows_rejected ?? 0}</div>
                    <div className="text-[10px] text-muted-foreground">Rows rejected</div>
                  </div>
                </div>
              </div>

              {batch.rejection_sample && batch.rejection_sample.length > 0 && (
                <div>
                  <div className="text-[11px] font-medium text-muted-foreground mb-2">Rejection Sample (first 20)</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px]">
                      <thead className="bg-secondary/50">
                        <tr className="text-left">
                          <th className="px-3 py-1.5 font-medium">Row</th>
                          <th className="px-3 py-1.5 font-medium">Field</th>
                          <th className="px-3 py-1.5 font-medium">Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {batch.rejection_sample.map((r, i) => (
                          <tr key={i}>
                            <td className="px-3 py-1.5 font-tabular">{r.row}</td>
                            <td className="px-3 py-1.5 font-mono text-[10px]">{r.field}</td>
                            <td className="px-3 py-1.5 text-muted-foreground">{r.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="mt-3">
                <button onClick={reset} className="text-[12px] text-primary hover:underline">
                  Upload another file
                </button>
              </div>
            </SectionCard>
          )}
        </div>

        {/* Reference guide */}
        <div>
          <SectionCard title="Dataset Reference" subtitle="Mandatory columns per dataset">
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {DATASET_GUIDE.map((ds) => (
                <div key={ds.key} className="border border-border rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <FileSpreadsheet className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="text-[11px] font-medium">{ds.name}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {ds.columns.map((col) => (
                      <code key={col} className="text-[9px] bg-secondary px-1.5 py-0.5 rounded font-mono">
                        {col}
                      </code>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </AppShell>
  );
}
