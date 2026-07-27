import type { PricePoint } from "@/lib/types/stock";

export interface SeriesPoint extends PricePoint {
  /** Percent change vs the previous close. 0 for the first point (no prior close). */
  changePercent: number;
  /** Standard deviation of the trailing `period` daily returns, in percent. 0 until enough real returns exist. */
  rollingSD: number;
  sma20: number | null;
  upperBand: number | null;
  lowerBand: number | null;
}

export const DEFAULT_PERIOD = 20;

/**
 * Compute daily returns, a simple moving average, Bollinger bands (±2σ of
 * price) and rolling return volatility.
 *
 * Sorted ascending by date internally, so callers need not pre-sort.
 *
 * Note on the volatility window: `changes[0]` is a placeholder zero, because
 * the first point has no prior close to compare against. The previous
 * implementation summed a full `period`-wide window starting at
 * `index === period - 1`, which pulled that placeholder in and reported a
 * volatility biased toward zero for the first real data point. We now require
 * a full window of *real* returns before reporting any.
 */
export function computeSeries(
  history: readonly PricePoint[],
  period: number = DEFAULT_PERIOD,
): SeriesPoint[] {
  if (!history || history.length === 0) return [];

  const sorted = [...history].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  const changes = sorted.map((day, i) => {
    if (i === 0) return 0;
    const prev = sorted[i - 1].close;
    if (!prev) return 0;
    return ((day.close - prev) / prev) * 100;
  });

  return sorted.map((day, index) => {
    let rollingSD = 0;
    let sma20: number | null = null;
    let upperBand: number | null = null;
    let lowerBand: number | null = null;

    if (index >= period - 1) {
      let sumPrice = 0;
      for (let k = 0; k < period; k++) sumPrice += sorted[index - k].close;
      const meanPrice = sumPrice / period;

      let sumSqDiff = 0;
      for (let k = 0; k < period; k++) {
        sumSqDiff += (sorted[index - k].close - meanPrice) ** 2;
      }
      const sdPrice = Math.sqrt(sumSqDiff / period);

      sma20 = meanPrice;
      upperBand = meanPrice + 2 * sdPrice;
      lowerBand = meanPrice - 2 * sdPrice;
    }

    // Real returns live at changes[1..]. A full window ending at `index`
    // therefore needs index - period + 1 >= 1.
    if (index >= period) {
      let sumChange = 0;
      for (let k = 0; k < period; k++) sumChange += changes[index - k];
      const meanChange = sumChange / period;

      let sumSqDiffChange = 0;
      for (let k = 0; k < period; k++) {
        sumSqDiffChange += (changes[index - k] - meanChange) ** 2;
      }
      rollingSD = Math.sqrt(sumSqDiffChange / period);
    }

    return {
      ...day,
      changePercent: changes[index],
      rollingSD,
      sma20,
      upperBand,
      lowerBand,
    };
  });
}

/** Daily returns excluding the leading placeholder, in percent. */
export function dailyReturns(history: readonly PricePoint[]): number[] {
  if (!history || history.length < 2) return [];
  const out: number[] = [];
  for (let i = 1; i < history.length; i++) {
    const prev = history[i - 1].close;
    if (!prev) continue;
    out.push(((history[i].close - prev) / prev) * 100);
  }
  return out;
}
