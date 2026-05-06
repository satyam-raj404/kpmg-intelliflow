import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "purple";

const tones: Record<Tone, string> = {
  success: "bg-success/10 text-success border-success/20",
  warning: "bg-warning/12 text-[#8A5A00] border-warning/20",
  danger: "bg-danger/10 text-danger border-danger/20",
  info: "bg-accent/10 text-accent border-accent/20",
  neutral: "bg-muted text-muted-foreground border-border",
  purple: "bg-[#470A68]/8 text-[#470A68] border-[#470A68]/20",
};

export function StatusPill({
  tone,
  children,
  dot = false,
  className,
  animate = true,
}: {
  tone: Tone;
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
  animate?: boolean;
}) {
  const Comp = animate ? motion.span : "span";
  const animProps = animate
    ? { initial: { opacity: 0, scale: 0.9 }, animate: { opacity: 1, scale: 1 }, transition: { duration: 0.2 } }
    : {};

  return (
    <Comp
      {...animProps}
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border",
        tones[tone],
        className,
      )}
    >
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            tone === "success" && "bg-success",
            tone === "warning" && "bg-warning",
            tone === "danger" && "bg-danger",
            tone === "info" && "bg-accent",
            tone === "neutral" && "bg-muted-foreground",
            tone === "purple" && "bg-[#470A68]",
          )}
        />
      )}
      {children}
    </Comp>
  );
}
