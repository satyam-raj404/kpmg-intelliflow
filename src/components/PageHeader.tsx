import { type ReactNode } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/context/AppContext";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  showExport?: boolean;
}

export function PageHeader({ title, subtitle, actions, showExport = true }: PageHeaderProps) {
  const { period } = useApp();

  return (
    <div className="flex items-end justify-between mb-5 pb-4 border-b border-border">
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">{title}</h1>
        {subtitle && <p className="text-[12px] text-muted-foreground mt-0.5">{subtitle}</p>}
        <p className="text-[10px] text-muted-foreground mt-1.5">
          Period: <span className="font-medium text-foreground">{period}</span>
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        {actions}
        {showExport && (
          <>
            <button
              onClick={() => toast.success("Export ready")}
              className="h-7 px-2.5 rounded-md border border-border bg-background text-[11px] font-medium flex items-center gap-1 hover:border-accent/50 transition-colors"
            >
              <Download className="h-3 w-3" />
              PDF
            </button>
            <button
              onClick={() => toast.success("Export ready")}
              className="h-7 px-2.5 rounded-md border border-border bg-background text-[11px] font-medium flex items-center gap-1 hover:border-accent/50 transition-colors"
            >
              <FileSpreadsheet className="h-3 w-3" />
              Excel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
