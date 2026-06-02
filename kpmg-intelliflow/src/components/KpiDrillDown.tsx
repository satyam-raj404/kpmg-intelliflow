import { type ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { StatusPill } from "@/components/StatusPill";

export interface DrillDownRecord {
  label: string;
  value: string | number;
  highlight?: boolean;
}

export interface KpiDrillDownData {
  kpiId: string;
  formula: string;
  sourceDatasets: string[];
  sourceFields: string[];
  target?: string;
  unit?: string;
  records?: DrillDownRecord[];
  note?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kpiName: string;
  data: KpiDrillDownData;
  currentValue?: ReactNode;
}

export function KpiDrillDown({ open, onOpenChange, kpiName, data, currentValue }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[420px] sm:max-w-[420px] overflow-y-auto">
        <SheetHeader className="pb-4 border-b border-border">
          <SheetTitle className="text-[15px] font-heading leading-tight pr-6">{kpiName}</SheetTitle>
          <SheetDescription className="text-[11px]">{data.kpiId}</SheetDescription>
        </SheetHeader>

        {/* Current value */}
        {currentValue && (
          <div className="mt-4 p-3 bg-secondary rounded-md">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Current Value</div>
            <div className="text-xl font-semibold font-tabular">{currentValue}</div>
          </div>
        )}

        {/* Formula */}
        <div className="mt-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">Formula</div>
          <pre className="text-[11px] bg-secondary/60 border border-border rounded-md p-3 whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto">
            {data.formula}
          </pre>
        </div>

        {/* Source Datasets */}
        <div className="mt-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">Source Dataset(s)</div>
          <div className="flex flex-wrap gap-1.5">
            {data.sourceDatasets.map((ds) => (
              <StatusPill key={ds} tone="info">{ds}</StatusPill>
            ))}
          </div>
        </div>

        {/* Source Fields */}
        <div className="mt-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">Key Fields</div>
          <ul className="space-y-1">
            {data.sourceFields.map((f) => (
              <li key={f} className="text-[11px] font-mono text-foreground/80 flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-accent shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Target / Threshold */}
        {data.target && (
          <div className="mt-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Target / Threshold</div>
            <div className="text-[12px] font-medium">{data.target}</div>
          </div>
        )}

        {/* Unit */}
        {data.unit && (
          <div className="mt-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Unit</div>
            <div className="text-[12px]">{data.unit}</div>
          </div>
        )}

        {/* Top Contributing Records */}
        {data.records && data.records.length > 0 && (
          <div className="mt-5">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Top Contributing Records</div>
            <div className="border border-border rounded-md overflow-hidden">
              <table className="w-full text-[11px]">
                <thead className="bg-secondary/50">
                  <tr>
                    <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Record</th>
                    <th className="px-3 py-1.5 text-right font-medium text-muted-foreground">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.records.map((r, i) => (
                    <tr key={i} className={r.highlight ? "bg-warning/5" : ""}>
                      <td className="px-3 py-1.5 truncate max-w-[220px]">{r.label}</td>
                      <td className={`px-3 py-1.5 text-right font-tabular font-medium ${r.highlight ? "text-warning" : ""}`}>{r.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Note */}
        {data.note && (
          <div className="mt-4 p-2.5 bg-accent/5 border border-accent/20 rounded-md">
            <div className="text-[10px] text-accent font-semibold mb-0.5">Note</div>
            <div className="text-[11px] text-muted-foreground leading-relaxed">{data.note}</div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
