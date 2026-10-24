import type { RotationQuadrant } from "@/lib/types/sectors";

export const UP = "#22c55e";
export const DOWN = "#ef4444";

/** "+1.23%" from a fraction; an em dash when unavailable. */
export function formatPct(value: number | null, digits = 2): string {
  if (value === null) return "—";
  const pct = value * 100;
  return `${pct > 0 ? "+" : ""}${pct.toFixed(digits)}%`;
}

export const changeText = (value: number | null) =>
  value === null || value === 0 ? "text-gray-400" : value > 0 ? "text-green-400" : "text-red-400";

export const QUADRANT_LABELS: Record<RotationQuadrant, string> = {
  leading: "Leading",
  weakening: "Weakening",
  lagging: "Lagging",
  improving: "Improving",
};

/** One-line read of what each quadrant means for a sector. */
export const QUADRANT_HINTS: Record<RotationQuadrant, string> = {
  leading: "Outperforming SPY, and the lead is growing",
  weakening: "Still outperforming, but losing steam",
  lagging: "Underperforming, and falling further behind",
  improving: "Underperforming, but catching up",
};

/** Round-number ticks spanning [min, max], about `count` of them. */
export function niceTicks(min: number, max: number, count = 5): number[] {
  const raw = (max - min) / count || 1;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let t = Math.floor(min / step) * step; t <= max + step * 1e-9; t += step) {
    ticks.push(Number(t.toFixed(10)));
  }
  if (ticks.at(-1)! < max) ticks.push(Number((ticks.at(-1)! + step).toFixed(10)));
  return ticks;
}
