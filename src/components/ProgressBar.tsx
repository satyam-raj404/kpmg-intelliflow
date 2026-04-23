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
      <div className="h-2 w-full bg-muted rounded-sm overflow-hidden">
        <div
          className={cn("h-full rounded-sm", colorMap[resolved as keyof typeof colorMap])}
          style={{ width: `${Math.min(pct, 100)}%` }}
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
