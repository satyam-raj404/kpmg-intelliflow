import { useState } from "react";
import * as HoverCard from "@radix-ui/react-hover-card";
import * as Collapsible from "@radix-ui/react-collapsible";
import { ChevronDown, ChevronUp, Info } from "lucide-react";
import { KPI_META } from "@/data/kpiMeta";

interface Props {
  kpiCode: string;
}

export function KpiInfoHover({ kpiCode }: Props) {
  const meta = KPI_META[kpiCode];
  if (!meta) return null;

  return (
    <HoverCard.Root openDelay={200} closeDelay={150}>
      <HoverCard.Trigger asChild>
        <button
          className="inline-flex items-center justify-center h-4 w-4 rounded-full text-muted-foreground/60 hover:text-muted-foreground transition-colors focus:outline-none"
          aria-label={`Info: ${meta.title}`}
          onClick={(e) => e.stopPropagation()}
        >
          <Info className="h-3 w-3" />
        </button>
      </HoverCard.Trigger>

      <HoverCard.Portal>
        <HoverCard.Content
          className="z-50 w-80 rounded-lg border border-border bg-popover p-4 shadow-lg text-popover-foreground"
          sideOffset={6}
          align="start"
          collisionPadding={12}
        >
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {kpiCode}
            </p>
            <p className="text-sm font-semibold leading-snug">{meta.title}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {meta.description}
            </p>
            <div className="rounded-md bg-muted/60 px-3 py-2 text-xs">
              <span className="font-medium text-foreground/80">Formula: </span>
              <span className="text-muted-foreground font-mono">{meta.formula}</span>
            </div>

            <SqlSection sql={meta.sql} />
          </div>
          <HoverCard.Arrow className="fill-border" />
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}

function SqlSection({ sql }: { sql: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible.Root open={open} onOpenChange={setOpen}>
      <Collapsible.Trigger asChild>
        <button className="flex items-center gap-1 text-[11px] text-primary hover:underline focus:outline-none mt-1">
          {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {open ? "Hide SQL" : "Read more (SQL)"}
        </button>
      </Collapsible.Trigger>
      <Collapsible.Content>
        <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-muted/80 p-2 text-[10px] font-mono text-foreground/80 whitespace-pre leading-relaxed">
          {sql.trim()}
        </pre>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
