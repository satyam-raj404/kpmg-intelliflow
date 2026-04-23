import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "purple";

const tones: Record<Tone, string> = {
  success: "bg-success/12 text-success border-success/30",
  warning: "bg-warning/15 text-[#8A5A00] border-warning/30",
  danger: "bg-danger/12 text-danger border-danger/30",
  info: "bg-accent/12 text-accent border-accent/30",
  neutral: "bg-muted text-muted-foreground border-border",
  purple: "bg-[#470A68]/10 text-[#470A68] border-[#470A68]/30",
};

export function StatusPill({
  tone,
  children,
  dot = false,
  className,
}: {
  tone: Tone;
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold border",
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
    </span>
  );
}
