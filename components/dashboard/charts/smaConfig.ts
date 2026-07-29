import type { SeriesPoint } from "@/lib/calc/series";

/**
 * Moving averages drawn on the price chart.
 *
 * Keys are tied to SeriesPoint so a rename is a compile error rather than a
 * silently blank line — the failure mode that hid the DCA chart's missing
 * series. Shorter averages are drawn thinner so the long-term trend stays
 * readable with five lines on one chart.
 */
export interface SmaLine {
  key: Extract<keyof SeriesPoint, `sma${string}`>;
  label: string;
  color: string;
  width: number;
}

export const SMA_LINES: SmaLine[] = [
  { key: "sma5", label: "SMA 5", color: "#f472b6", width: 1 },
  { key: "sma10", label: "SMA 10", color: "#a78bfa", width: 1 },
  { key: "sma20", label: "SMA 20", color: "#fbbf24", width: 1.5 },
  { key: "sma60", label: "SMA 60", color: "#34d399", width: 1.5 },
  { key: "sma120", label: "SMA 120", color: "#f87171", width: 2 },
];
