import {
  MACRO_REGIMES,
  type MacroReading,
  type MacroRegime,
  type RegimeStats,
  type Trend,
} from "@/lib/types/macro";

/** A monthly series keyed by "YYYY-MM". Gaps are simply absent keys. */
export type MonthSeries = Map<string, number>;

export interface DatedValue {
  date: string;
  value: number;
}

export const monthKey = (iso: string) => iso.slice(0, 7);

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/** Year-over-year change; a month without a value twelve months earlier is skipped. */
export function yoy(series: MonthSeries): MonthSeries {
  const out: MonthSeries = new Map();
  for (const [month, value] of series) {
    const base = series.get(shiftMonth(month, -12));
    if (base) out.set(month, value / base - 1);
  }
  return out;
}

/** Last observation of each month from a daily series (sorted oldest first). */
export function monthEnd(daily: DatedValue[]): MonthSeries {
  const out: MonthSeries = new Map();
  for (const point of daily) out.set(monthKey(point.date), point.value);
  return out;
}

/** Month-over-month return; needs the previous month to be present. */
export function monthlyReturns(prices: MonthSeries): MonthSeries {
  const out: MonthSeries = new Map();
  for (const [month, price] of prices) {
    const prev = prices.get(shiftMonth(month, -1));
    if (prev) out.set(month, price / prev - 1);
  }
  return out;
}

const trend = (now: number, before: number): Trend => (now > before ? "rising" : "falling");

/**
 * The regime an investor could have known at the start of `month`.
 *
 * CPI for a month is published around the middle of the next, so on the
 * first of `month` the latest print is for month − 2; the inflation trend
 * compares it with month − 5. The yield trend uses month-end closes, so the
 * latest is month − 1 against month − 4. Using same-month data instead would
 * let the table "predict" with numbers nobody had yet.
 */
export function regimeAt(month: string, cpiYoY: MonthSeries, yields: MonthSeries): MacroRegime | null {
  const cpiNow = cpiYoY.get(shiftMonth(month, -2));
  const cpiBefore = cpiYoY.get(shiftMonth(month, -5));
  const yNow = yields.get(shiftMonth(month, -1));
  const yBefore = yields.get(shiftMonth(month, -4));
  if (cpiNow === undefined || cpiBefore === undefined || yNow === undefined || yBefore === undefined) {
    return null;
  }
  return `${trend(cpiNow, cpiBefore)}-${trend(yNow, yBefore)}`;
}

/** Latest value of a monthly series beside the value three months earlier. */
export function latestMonthly(series: MonthSeries): MacroReading | null {
  const months = [...series.keys()].sort();
  const last = months.at(-1);
  if (!last) return null;
  return {
    value: series.get(last)!,
    previous: series.get(shiftMonth(last, -3)) ?? null,
    date: last,
  };
}

/** Latest value of a daily series beside the last value at least three months older. */
export function latestDaily(daily: DatedValue[]): MacroReading | null {
  const last = daily.at(-1);
  if (!last) return null;
  const cutoff = new Date(last.date);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 3);
  const before = daily.findLast((p) => new Date(p.date) <= cutoff);
  return { value: last.value, previous: before?.value ?? null, date: last.date };
}

/** The current regime, from the latest CPI print and the latest daily yield. */
export function currentRegime(cpi: MacroReading | null, ten: MacroReading | null) {
  if (cpi?.previous == null || ten?.previous == null) return null;
  const inflation = trend(cpi.value, cpi.previous);
  const rates = trend(ten.value, ten.previous);
  return { key: `${inflation}-${rates}` as MacroRegime, inflation, rates };
}

/** Average excess return over the benchmark per regime, using only months that have all three. */
export function regimeStats(
  returns: MonthSeries,
  benchmark: MonthSeries,
  regimes: Map<string, MacroRegime>,
): Record<MacroRegime, RegimeStats | null> {
  const buckets = new Map<MacroRegime, number[]>(MACRO_REGIMES.map((r) => [r, []]));
  for (const [month, ret] of returns) {
    const bench = benchmark.get(month);
    const regime = regimes.get(month);
    if (bench === undefined || regime === undefined) continue;
    buckets.get(regime)!.push(ret - bench);
  }
  return Object.fromEntries(
    MACRO_REGIMES.map((r) => {
      const excess = buckets.get(r)!;
      const n = excess.length;
      if (n === 0) return [r, null];
      const mean = excess.reduce((a, b) => a + b, 0) / n;
      const sd = n > 1 ? Math.sqrt(excess.reduce((a, e) => a + (e - mean) ** 2, 0) / (n - 1)) : 0;
      return [
        r,
        {
          avgExcess: mean,
          hitRate: excess.filter((e) => e > 0).length / n,
          months: n,
          tStat: sd > 0 ? mean / (sd / Math.sqrt(n)) : null,
        },
      ];
    }),
  ) as Record<MacroRegime, RegimeStats | null>;
}

/** Ordinary least squares slope of y on x, with the correlation. */
export function regression(x: number[], y: number[]): { beta: number; r: number } | null {
  const n = Math.min(x.length, y.length);
  if (n < 12) return null;
  const mx = x.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const my = y.slice(0, n).reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  if (sxx === 0 || syy === 0) return null;
  return { beta: sxy / sxx, r: sxy / Math.sqrt(sxx * syy) };
}

/**
 * How a sector's excess return moves with the 10-year yield, over the last
 * `months` months: the slope is excess return per +1pp change in the yield.
 */
export function rateSensitivity(
  returns: MonthSeries,
  benchmark: MonthSeries,
  yields: MonthSeries,
  months = 120,
): { beta: number | null; r: number | null; months: number } {
  const x: number[] = [];
  const y: number[] = [];
  const recent = [...returns.keys()].sort().slice(-months);
  for (const month of recent) {
    const bench = benchmark.get(month);
    const yNow = yields.get(month);
    const yPrev = yields.get(shiftMonth(month, -1));
    if (bench === undefined || yNow === undefined || yPrev === undefined) continue;
    x.push(yNow - yPrev);
    y.push(returns.get(month)! - bench);
  }
  const fit = regression(x, y);
  return { beta: fit?.beta ?? null, r: fit?.r ?? null, months: x.length };
}
