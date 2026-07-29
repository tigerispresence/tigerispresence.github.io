import type { PricePoint } from "@/lib/types/stock";

/** Simple moving average windows drawn on the price chart. */
export const SMA_PERIODS = [5, 10, 20, 60, 120] as const;
export type SmaPeriod = (typeof SMA_PERIODS)[number];

/** The period Bollinger bands are built from. */
export const BAND_PERIOD = 20;

export interface SeriesPoint extends PricePoint {
  /** Percent change vs the previous close. 0 for the first point (no prior close). */
  changePercent: number;
  /** Standard deviation of the trailing 20 daily returns, in percent. */
  rollingSD: number;
  sma5: number | null;
  sma10: number | null;
  sma20: number | null;
  sma60: number | null;
  sma120: number | null;
  upperBand: number | null;
  lowerBand: number | null;
}

export const DEFAULT_PERIOD = BAND_PERIOD;

/**
 * Rolling simple moving average.
 *
 * Null until `period` closes are available, so a partial window is never drawn
 * as though it were a full one.
 */
function movingAverages(
  closes: readonly number[],
  period: number,
): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null);
  let sum = 0;
  for (let i = 0; i < closes.length; i++) {
    sum += closes[i];
    if (i >= period) sum -= closes[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/**
 * Compute daily returns, simple moving averages, Bollinger bands (±2σ of
 * price over 20 sessions) and rolling return volatility.
 *
 * Sorted ascending by date internally, so callers need not pre-sort.
 *
 * Note on the volatility window: `changes[0]` is a placeholder zero, because
 * the first point has no prior close to compare against. A full window of
 * *real* returns is required before any volatility is reported, otherwise the
 * first value is biased toward zero.
 */
export function computeSeries(
  history: readonly PricePoint[],
  bandPeriod: number = BAND_PERIOD,
): SeriesPoint[] {
  if (!history || history.length === 0) return [];

  const sorted = [...history].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  const closes = sorted.map((p) => p.close);

  const changes = sorted.map((day, i) => {
    if (i === 0) return 0;
    const prev = sorted[i - 1].close;
    if (!prev) return 0;
    return ((day.close - prev) / prev) * 100;
  });

  const smas = Object.fromEntries(
    SMA_PERIODS.map((p) => [p, movingAverages(closes, p)]),
  ) as Record<SmaPeriod, (number | null)[]>;

  // Bands share the 20-period mean, so reuse it rather than recomputing.
  const bandMean =
    bandPeriod === BAND_PERIOD ? smas[BAND_PERIOD] : movingAverages(closes, bandPeriod);

  return sorted.map((day, index) => {
    let upperBand: number | null = null;
    let lowerBand: number | null = null;

    const mean = bandMean[index];
    if (mean !== null) {
      let sumSqDiff = 0;
      for (let k = 0; k < bandPeriod; k++) {
        sumSqDiff += (closes[index - k] - mean) ** 2;
      }
      const sd = Math.sqrt(sumSqDiff / bandPeriod);
      upperBand = mean + 2 * sd;
      lowerBand = mean - 2 * sd;
    }

    // Real returns live at changes[1..]. A full window ending at `index`
    // therefore needs index - bandPeriod + 1 >= 1.
    let rollingSD = 0;
    if (index >= bandPeriod) {
      let sumChange = 0;
      for (let k = 0; k < bandPeriod; k++) sumChange += changes[index - k];
      const meanChange = sumChange / bandPeriod;

      let sumSqDiffChange = 0;
      for (let k = 0; k < bandPeriod; k++) {
        sumSqDiffChange += (changes[index - k] - meanChange) ** 2;
      }
      rollingSD = Math.sqrt(sumSqDiffChange / bandPeriod);
    }

    return {
      ...day,
      changePercent: changes[index],
      rollingSD,
      sma5: smas[5][index],
      sma10: smas[10][index],
      sma20: smas[20][index],
      sma60: smas[60][index],
      sma120: smas[120][index],
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
