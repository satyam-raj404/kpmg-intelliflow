// Indian number formatting & display helpers
import { format } from "date-fns";

/**
 * Format a value in INR using Indian conventions:
 *   >= 1 Cr     -> "₹X.XX Cr"
 *   >= 1 Lakh   -> "₹X.XX L"
 *   >= 1 K      -> "₹X.X K"
 *   else        -> "₹X"
 */
export function formatINR(value: number, opts?: { compact?: boolean }): string {
  const compact = opts?.compact ?? true;
  if (!compact) {
    return "₹" + value.toLocaleString("en-IN", { maximumFractionDigits: 0 });
  }
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(2)} Cr`;
  if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(2)} L`;
  if (abs >= 1_000) return `${sign}₹${(abs / 1_000).toFixed(1)} K`;
  return `${sign}₹${abs.toFixed(0)}`;
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatDateShort(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "dd-MMM-yyyy");
}

export function formatDateRange(start: Date, end: Date): string {
  return `${format(start, "dd-MMM")} – ${format(end, "dd-MMM-yyyy")}`;
}

export function formatCompact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function formatDelta(current: number, previous: number): {
  text: string;
  positive: boolean;
  pct: number;
} {
  if (previous === 0) return { text: "—", positive: true, pct: 0 };
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const arrow = pct >= 0 ? "↑" : "↓";
  return {
    text: `${arrow} ${Math.abs(pct).toFixed(1)}%`,
    positive: pct >= 0,
    pct,
  };
}

export function formatNumber(n: number): string {
  return n.toLocaleString("en-IN");
}
