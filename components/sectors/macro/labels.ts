import type { MacroRegime } from "@/lib/types/macro";

export const REGIME_LABELS: Record<MacroRegime, string> = {
  "rising-rising": "Inflation ↑ · Yields ↑",
  "rising-falling": "Inflation ↑ · Yields ↓",
  "falling-rising": "Inflation ↓ · Yields ↑",
  "falling-falling": "Inflation ↓ · Yields ↓",
};

/** A t-statistic past this is unlikely to be chance alone. */
export const T_SIGNIFICANT = 2;

/** Historical edges smaller than ±0.1%/month count as no edge, not a weak one. */
export const NEUTRAL_EXCESS = 0.001;

/** "Sep 2026" from "2026-09". */
export function formatMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
