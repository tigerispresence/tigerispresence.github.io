import type { SeriesPoint } from "../series";
import { Portfolio, buildDividendMap, dayKey, finalize } from "./shared";
import type { SimContext, SimPoint, SimulationResult } from "./types";

/**
 * Dollar-cost averaging: buy one share on the first trading day of each month,
 * reinvesting dividends.
 */
export function simulateDca(
  series: readonly SeriesPoint[],
  ctx: SimContext,
): SimulationResult | null {
  if (!series || series.length === 0) return null;

  const dividendMap = buildDividendMap(ctx.dividends);
  const portfolio = new Portfolio();
  const history: SimPoint[] = [];
  let lastMonth = -1;

  for (const day of series) {
    const date = new Date(day.date);
    const key = dayKey(date);

    const dividend = dividendMap.get(key);
    if (dividend !== undefined) portfolio.applyDividend(dividend, day.close);

    const month = date.getMonth();
    if (month !== lastMonth) {
      portfolio.buy(day.close, day.date);
      lastMonth = month;
    }

    history.push(portfolio.snapshot(day.date, day.close));
  }

  return finalize(
    portfolio,
    history,
    ctx.currentPrice,
    series[series.length - 1].close,
  );
}
