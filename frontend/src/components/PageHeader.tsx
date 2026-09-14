import { type ReactNode } from "react";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useApp } from "@/context/AppContext";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  showExport?: boolean;
  onExportPdf?: () => void;
  isExporting?: boolean;
}

export function PageHeader({
  title,
  subtitle,
  actions,
  showExport = true,
  onExportPdf,
  isExporting = false,
}: PageHeaderProps) {
  const { period } = useApp();

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="flex items-end justify-between mb-5 pb-4 border-b border-border"
    >
      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight font-heading">{title}</h1>
        {subtitle && <p className="text-[13px] text-muted-foreground mt-0.5">{subtitle}</p>}
        <p className="text-[11px] text-muted-foreground mt-1.5">
          Period: <span className="font-medium text-foreground">{period}</span>
        </p>
      </div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.3 }}
        className="flex items-center gap-1.5"
      >
        {actions}
        {showExport && (
          <>
            <button
              onClick={onExportPdf ?? (() => toast.info("PDF export not configured"))}
              disabled={isExporting}
              className="h-7 px-2.5 rounded-md border border-border bg-background text-[12px] font-medium flex items-center gap-1 hover:border-accent/50 hover:bg-secondary/50 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isExporting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Download className="h-3 w-3" />
              )}
              {isExporting ? "Exporting…" : "PDF"}
            </button>
            <button
              onClick={() => toast.success("Export ready")}
              className="h-7 px-2.5 rounded-md border border-border bg-background text-[12px] font-medium flex items-center gap-1 hover:border-accent/50 hover:bg-secondary/50 transition-all duration-200"
            >
              <FileSpreadsheet className="h-3 w-3" />
              Excel
            </button>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
