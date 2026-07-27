import type { FearGreedPoint } from "@/lib/types/stock";
import type { SeriesPoint } from "../series";
import { Portfolio, buildDividendMap, dayKey, finalize } from "./shared";
import type { SimContext, SimPoint, SimulationResult } from "./types";

/** CNN publishes ratings with underscores and mixed case; normalize for comparison. */
export function normalizeRating(rating: string): string {
  return rating.toLowerCase().replace(/_/g, " ").trim();
}

/**
 * Buy one share on any day whose CNN Fear & Greed rating is in the selected
 * set — typically "extreme fear" and "fear".
 *
 * Price history usually spans years while the Fear & Greed feed covers roughly
 * one, so the simulation only runs over the overlap. Weekends and holidays
 * present in the price series but missing from the feed carry the previous
 * rating forward.
 */
export function simulateFearGreed(
  series: readonly SeriesPoint[],
  fearGreedHistory: readonly FearGreedPoint[] | null | undefined,
  ctx: SimContext,
  selectedRatings: readonly string[],
): SimulationResult | null {
  if (!series || series.length === 0) return null;
  if (!fearGreedHistory || fearGreedHistory.length === 0) return null;

  const dividendMap = buildDividendMap(ctx.dividends);
  const fgMap = new Map<string, FearGreedPoint>();
  for (const fg of fearGreedHistory) fgMap.set(dayKey(fg.date), fg);

  const portfolio = new Portfolio();
  const history: SimPoint[] = [];
  let previous: FearGreedPoint | null = null;
  let lastClose = 0;

  for (const day of series) {
    const key = dayKey(day.date);

    const today: FearGreedPoint | null = fgMap.get(key) ?? previous;
    // Skip the leading stretch of price history that predates the feed.
    if (!today) continue;
    previous = today;

    const dividend = dividendMap.get(key);
    if (dividend !== undefined) portfolio.applyDividend(dividend, day.close);

    if (selectedRatings.includes(normalizeRating(today.rating))) {
      portfolio.buy(day.close, day.date);
    }

    history.push(portfolio.snapshot(day.date, day.close));
    lastClose = day.close;
  }

  if (history.length === 0) return null;

  return finalize(portfolio, history, ctx.currentPrice, lastClose);
}
