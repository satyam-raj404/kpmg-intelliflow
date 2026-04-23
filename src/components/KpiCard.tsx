import { type ReactNode } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: ReactNode;
  delta?: { text: string; positive: boolean } | null;
  sublabel?: ReactNode;
  threshold?: { label: string; tone: "success" | "warning" | "danger" | "info" };
  size?: "sm" | "md" | "lg" | "xl";
  sparkline?: ReactNode;
  rightSlot?: ReactNode;
}

const valueSizes = {
  sm: "text-xl",
  md: "text-2xl",
  lg: "text-3xl",
  xl: "text-[42px] leading-none",
};

const toneClasses: Record<string, string> = {
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-[#A56500]",
  danger: "bg-danger/10 text-danger",
  info: "bg-accent/10 text-accent",
};

export function KpiCard({
  label,
  value,
  delta,
  sublabel,
  threshold,
  size = "lg",
  sparkline,
  rightSlot,
}: KpiCardProps) {
  return (
    <div className="bg-surface border border-border rounded-md p-4 flex flex-col h-full">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        {rightSlot}
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className={cn("font-bold font-tabular text-foreground", valueSizes[size])}>
          {value}
        </span>
        {delta && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-[11px] font-semibold",
              delta.positive ? "text-success" : "text-danger",
            )}
          >
            {delta.positive ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {delta.text}
          </span>
        )}
      </div>

      {sublabel && (
        <div className="text-[12px] text-muted-foreground mt-1.5 leading-tight">{sublabel}</div>
      )}

      {threshold && (
        <span
          className={cn(
            "mt-2 inline-flex items-center self-start px-2 py-0.5 rounded text-[10px] font-semibold",
            toneClasses[threshold.tone],
          )}
        >
          {threshold.label}
        </span>
      )}

      {sparkline && <div className="mt-3 -mx-1 h-10">{sparkline}</div>}
    </div>
  );
}
