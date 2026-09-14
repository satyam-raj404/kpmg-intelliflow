import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
  accent?: "default" | "danger" | "warning" | "info";
  bodyClassName?: string;
  delay?: number;
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
  delay = 0,
}: SectionCardProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: delay * 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={cn("bg-surface border border-border rounded-lg flex flex-col overflow-hidden", accentBars[accent], className)}
    >
      <header className="px-4 py-3 border-b border-border flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground font-heading">{title}</h3>
          {subtitle && <p className="text-[12px] text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {actions}
      </header>
      <div className={cn("p-4 flex-1 min-h-0", bodyClassName)}>{children}</div>
    </motion.section>
  );
}
