import type { PricePoint } from "@/lib/types/stock";
import { dailyReturns } from "./series";

export interface DistributionBin {
  bin: number;
  count: number;
}

export interface DistributionResult {
  data: DistributionBin[];
  mean: number;
  sd: number;
  count1Sigma: number;
  count2Sigma: number;
  totalDays: number;
}

export const DEFAULT_BIN_SIZE = 0.1;

const EMPTY: DistributionResult = {
  data: [],
  mean: 0,
  sd: 0,
  count1Sigma: 0,
  count2Sigma: 0,
  totalDays: 0,
};

/**
 * Histogram of daily returns, plus the mean/σ stats the chart annotates.
 *
 * Bins are keyed by *integer index* (`Math.round(value / binSize)`) rather than
 * by a formatted float string. The previous implementation created bin keys by
 * repeatedly adding `binSize` to a float and calling `.toFixed(1)`, but looked
 * them up via `(Math.floor(v / binSize) * binSize).toFixed(1)`. Accumulated
 * drift meant the loop could emit the key "-0.0" where it should have emitted
 * "0.0" (at index 0 the accumulator sat at about -1.4e-14), so the "0.0" bin
 * did not exist and every return in [0, 0.1) was silently discarded — the
 * single most common bucket for equities. Whether it triggered depended on the
 * range's lower bound, which is why it survived so long.
 *
 * Integer keys cannot drift, so the invariant `sum(counts) === totalDays` now
 * holds by construction.
 */
export function computeDistribution(
  history: readonly PricePoint[],
  binSize: number = DEFAULT_BIN_SIZE,
): DistributionResult {
  if (!history || history.length < 2) return EMPTY;

  const changes = dailyReturns(history);
  if (changes.length === 0) return EMPTY;

  const mean = changes.reduce((a, b) => a + b, 0) / changes.length;
  const variance =
    changes.reduce((a, b) => a + (b - mean) ** 2, 0) / changes.length;
  const sd = Math.sqrt(variance);

  const count1Sigma = changes.filter((c) => Math.abs(c - mean) <= sd).length;
  const count2Sigma = changes.filter((c) => Math.abs(c - mean) <= 2 * sd).length;

  // The chart draws reference lines at ±1σ and ±2σ, so the axis has to span
  // them even when no observed return reaches that far.
  const markers = [mean, mean + sd, mean - sd, mean + 2 * sd, mean - 2 * sd];
  const lowIndex = Math.floor(
    Math.min(Math.min(...changes), Math.min(...markers)) / binSize,
  );
  const highIndex = Math.ceil(
    Math.max(Math.max(...changes), Math.max(...markers)) / binSize,
  );

  const counts = new Map<number, number>();
  for (let i = lowIndex; i <= highIndex; i++) counts.set(i, 0);

  for (const change of changes) {
    const index = Math.floor(change / binSize);
    counts.set(index, (counts.get(index) ?? 0) + 1);
  }

  const data = [...counts.entries()]
    .map(([index, count]) => ({
      // Round back to a display value; 3 dp is well inside float precision
      // for the bin sizes we use and keeps keys like 0.30000000000000004 out
      // of the chart's axis labels.
      bin: Number((index * binSize).toFixed(3)),
      count,
    }))
    .sort((a, b) => a.bin - b.bin);

  return {
    data,
    mean,
    sd,
    count1Sigma,
    count2Sigma,
    totalDays: changes.length,
  };
}
