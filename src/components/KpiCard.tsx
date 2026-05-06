import { type ReactNode, useState } from "react";
import { TrendingUp, TrendingDown, Search } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { KpiDrillDown, type KpiDrillDownData } from "./KpiDrillDown";

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
  index?: number;
  drillDown?: KpiDrillDownData;
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
  index = 0,
  drillDown,
}: KpiCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: index * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
        whileHover={{ y: -2, boxShadow: "0 8px 24px oklch(0 0 0 / 0.06)" }}
        className={cn(
          "bg-surface border border-border rounded-lg p-4 flex flex-col h-full transition-colors group",
          drillDown && "cursor-pointer",
        )}
        onClick={drillDown ? () => setOpen(true) : undefined}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {icon && <div className="text-muted-foreground">{icon}</div>}
            <div className="text-[11px] font-medium text-muted-foreground tracking-wide uppercase truncate">
              {label}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {rightSlot}
            {drillDown && (
              <Search className="h-3 w-3 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-colors" />
            )}
          </div>
        </div>

        <div className="mt-2.5 flex items-baseline gap-2">
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: index * 0.08 + 0.2 }}
            className={cn("font-semibold font-tabular text-foreground", valueSizes[size])}
          >
            {value}
          </motion.span>
          {delta && (
            <motion.span
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.08 + 0.3 }}
              className={cn("inline-flex items-center gap-0.5 text-[11px] font-medium",
                delta.positive ? "text-success" : "text-danger",
              )}
            >
              {delta.positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {delta.text}
            </motion.span>
          )}
        </div>

        {sublabel && (
          <div className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{sublabel}</div>
        )}

        {threshold && (
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.4 }}
            className={cn("mt-2 inline-flex items-center self-start px-1.5 py-0.5 rounded text-[10px] font-medium", toneClasses[threshold.tone])}
          >
            {threshold.label}
          </motion.span>
        )}

        {sparkline && <div className="mt-3 -mx-1 h-8">{sparkline}</div>}
      </motion.div>

      {drillDown && (
        <KpiDrillDown
          open={open}
          onOpenChange={setOpen}
          kpiName={label}
          data={drillDown}
          currentValue={value}
        />
      )}
    </>
  );
}
