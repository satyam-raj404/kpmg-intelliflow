import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function ProgressBar({
  value,
  max = 100,
  tone = "auto",
  showLabel = false,
  className,
}: {
  value: number;
  max?: number;
  tone?: "auto" | "success" | "warning" | "danger" | "info";
  showLabel?: boolean;
  className?: string;
}) {
  const pct = Math.min(100, (value / max) * 100);
  let resolved = tone;
  if (tone === "auto") {
    if (pct > 100) resolved = "danger";
    else if (pct >= 90) resolved = "warning";
    else resolved = "success";
  }
  const colorMap = {
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
    info: "bg-accent",
  } as const;

  return (
    <div className={cn("w-full", className)}>
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(pct, 100)}%` }}
          transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.2 }}
          className={cn("h-full rounded-full", colorMap[resolved as keyof typeof colorMap])}
        />
      </div>
      {showLabel && (
        <div className="text-[10px] text-muted-foreground mt-1 font-tabular">
          {pct.toFixed(1)}%
        </div>
      )}
    </div>
  );
}
