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
  icon?: ReactNode;
}

const valueSizes = {
  sm: "text-lg",
  md: "text-xl",
  lg: "text-2xl",
  xl: "text-3xl",
};

const toneClasses: Record<string, string> = {
  success: "bg-success/8 text-success",
  warning: "bg-warning/10 text-[#A56500]",
  danger: "bg-danger/8 text-danger",
  info: "bg-accent/8 text-accent",
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
  icon,
}: KpiCardProps) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4 flex flex-col h-full hover:shadow-[0_1px_4px_oklch(0_0_0/0.04)] transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {icon && <div className="text-muted-foreground">{icon}</div>}
          <div className="text-[11px] font-medium text-muted-foreground tracking-wide">
            {label}
          </div>
        </div>
        {rightSlot}
      </div>

      <div className="mt-2.5 flex items-baseline gap-2">
        <span className={cn("font-semibold font-tabular text-foreground", valueSizes[size])}>
          {value}
        </span>
        {delta && (
          <span className={cn("inline-flex items-center gap-0.5 text-[11px] font-medium",
            delta.positive ? "text-success" : "text-danger",
          )}>
            {delta.positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {delta.text}
          </span>
        )}
      </div>

      {sublabel && (
        <div className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{sublabel}</div>
      )}

      {threshold && (
        <span className={cn("mt-2 inline-flex items-center self-start px-1.5 py-0.5 rounded text-[10px] font-medium", toneClasses[threshold.tone])}>
          {threshold.label}
        </span>
      )}

      {sparkline && <div className="mt-3 -mx-1 h-8">{sparkline}</div>}
    </div>
  );
}
