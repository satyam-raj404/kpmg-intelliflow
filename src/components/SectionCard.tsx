import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
  accent?: "default" | "danger" | "warning" | "info";
  bodyClassName?: string;
}

const accentBars = {
  default: "",
  danger: "border-l-2 border-l-danger",
  warning: "border-l-2 border-l-warning",
  info: "border-l-2 border-l-accent",
};

export function SectionCard({
  title,
  subtitle,
  children,
  actions,
  className,
  accent = "default",
  bodyClassName,
}: SectionCardProps) {
  return (
    <section className={cn("bg-surface border border-border rounded-lg flex flex-col", accentBars[accent], className)}>
      <header className="px-4 py-3 border-b border-border flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold text-foreground">{title}</h3>
          {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {actions}
      </header>
      <div className={cn("p-4 flex-1 min-h-0", bodyClassName)}>{children}</div>
    </section>
  );
}
