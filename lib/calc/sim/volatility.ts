import type { SeriesPoint } from "../series";
import { Portfolio, buildDividendMap, dayKey, finalize } from "./shared";
import type { SimContext, SimPoint, SimulationResult } from "./types";

/** Sigma bucket a day's return falls into, relative to the mean. */
export type SigmaZone = "-2" | "-1" | "0" | "1" | "2";

export const ALL_SIGMA_ZONES: SigmaZone[] = ["-2", "-1", "0", "1", "2"];

/** Classify a return into a sigma zone. Exported so the UI can label points. */
export function sigmaZone(
  changePercent: number,
  mean: number,
  sd: number,
): SigmaZone {
  const diff = changePercent - mean;
  if (diff <= -2 * sd) return "-2";
  if (diff <= -1 * sd) return "-1";
  if (diff >= 2 * sd) return "2";
  if (diff >= 1 * sd) return "1";
  return "0";
}

/**
 * Buy one share on any day whose return lands in one of the selected sigma
 * zones — the "buy the dip" strategy, parameterised by how deep a dip counts.
 */
export function simulateVolatility(
  series: readonly SeriesPoint[],
  stats: { mean: number; sd: number },
  ctx: SimContext,
  selectedZones: readonly string[],
): SimulationResult | null {
  if (!series || series.length === 0) return null;
  if (!stats.sd) return null;

  const dividendMap = buildDividendMap(ctx.dividends);
  const portfolio = new Portfolio();
  const history: SimPoint[] = [];

  for (const day of series) {
    const key = dayKey(day.date);

    const dividend = dividendMap.get(key);
    if (dividend !== undefined) portfolio.applyDividend(dividend, day.close);

    const zone = sigmaZone(day.changePercent, stats.mean, stats.sd);
    if (selectedZones.includes(zone)) portfolio.buy(day.close, day.date);

    history.push(portfolio.snapshot(day.date, day.close));
  }

  return finalize(
    portfolio,
    history,
    ctx.currentPrice,
    series[series.length - 1].close,
  );
}
