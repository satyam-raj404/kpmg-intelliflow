import { type ReactNode } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/context/AppContext";
import { format } from "date-fns";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  showExport?: boolean;
}

export function PageHeader({ title, subtitle, actions, showExport = true }: PageHeaderProps) {
  const { period } = useApp();
  return (
    <div className="flex items-end justify-between mb-6 pb-4 border-b border-border">
      <div>
        <h1 className="text-[28px] font-serif font-semibold text-foreground tracking-tight">
          {title}
        </h1>
        {subtitle && <p className="text-[13px] text-muted-foreground mt-1">{subtitle}</p>}
        <p className="text-[11px] text-muted-foreground mt-2">
          Period: <span className="font-semibold text-foreground">{period}</span> · Last updated:{" "}
          <span className="font-semibold text-foreground">{format(new Date(), "dd-MMM-yyyy HH:mm")}</span>
        </p>
      </div>
      <div className="flex items-center gap-2">
        {actions}
        {showExport && (
          <>
            <button
              onClick={() => toast.success("Export ready — download started")}
              className="h-9 px-3 rounded-md border border-border bg-surface text-[12px] font-semibold flex items-center gap-1.5 hover:border-accent"
            >
              <Download className="h-3.5 w-3.5" />
              PDF
            </button>
            <button
              onClick={() => toast.success("Export ready — download started")}
              className="h-9 px-3 rounded-md border border-border bg-surface text-[12px] font-semibold flex items-center gap-1.5 hover:border-accent"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Excel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
