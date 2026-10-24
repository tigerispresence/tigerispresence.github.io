import type { PricePoint } from "@/lib/types/stock";
import {
  SECTOR_PERIODS,
  type RotationPoint,
  type RotationQuadrant,
  type SectorPeriod,
  type SectorStats,
} from "@/lib/types/sectors";

/** The eleven GICS sectors, via their SPDR ETFs. */
export const SECTORS = [
  { symbol: "XLK", name: "Technology" },
  { symbol: "XLC", name: "Communication Services" },
  { symbol: "XLY", name: "Consumer Discretionary" },
  { symbol: "XLF", name: "Financials" },
  { symbol: "XLI", name: "Industrials" },
  { symbol: "XLV", name: "Health Care" },
  { symbol: "XLP", name: "Consumer Staples" },
  { symbol: "XLE", name: "Energy" },
  { symbol: "XLB", name: "Materials" },
  { symbol: "XLU", name: "Utilities" },
  { symbol: "XLRE", name: "Real Estate" },
] as const;

export const BENCHMARK = "SPY";

/** Trading sessions per lookback; YTD is anchored to the calendar instead. */
const PERIOD_SESSIONS: Record<Exclude<SectorPeriod, "YTD">, number> = {
  "1D": 1,
  "1W": 5,
  "1M": 21,
  "3M": 63,
  "6M": 126,
  "1Y": 252,
};

/** Rotation settings, in weeks. */
const RS_TREND_WEEKS = 10;
const MOMENTUM_WEEKS = 4;
const TAIL_WEEKS = 8;
const SESSIONS_PER_WEEK = 5;

export function periodReturn(points: PricePoint[], period: SectorPeriod): number | null {
  const last = points.at(-1);
  if (!last) return null;

  let base: PricePoint | undefined;
  if (period === "YTD") {
    // The last close of the previous calendar year.
    const year = new Date(last.date).getUTCFullYear();
    base = points.findLast((p) => new Date(p.date).getUTCFullYear() < year);
  } else {
    base = points[points.length - 1 - PERIOD_SESSIONS[period]];
  }
  return base && base.close > 0 ? last.close / base.close - 1 : null;
}

export function allReturns(points: PricePoint[]): Record<SectorPeriod, number | null> {
  return Object.fromEntries(
    SECTOR_PERIODS.map((p) => [p, periodReturn(points, p)]),
  ) as Record<SectorPeriod, number | null>;
}

function aboveSma(points: PricePoint[], length: number): boolean | null {
  if (points.length < length) return null;
  const window = points.slice(-length);
  const mean = window.reduce((sum, p) => sum + p.close, 0) / length;
  return points[points.length - 1].close > mean;
}

const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;

/**
 * A simplified relative-rotation path against the benchmark.
 *
 * RS is the sector's close over the benchmark's, sampled weekly.
 *   RS-Ratio    = 100 × RS / its 10-week mean       (is relative strength trending up?)
 *   RS-Momentum = 100 × RS-Ratio / its 4-week mean  (is that trend accelerating?)
 * Both centre on 100, so the quadrant is read straight off the signs. This is
 * an approximation of the JdK RRG, whose exact normalisation is proprietary.
 */
export function rotationPath(sector: PricePoint[], benchmark: PricePoint[]): RotationPoint[] {
  const benchByDay = new Map(benchmark.map((p) => [p.date.slice(0, 10), p.close]));
  const rs = sector.flatMap((p) => {
    const b = benchByDay.get(p.date.slice(0, 10));
    return b ? [{ date: p.date, value: p.close / b }] : [];
  });

  // Every fifth session counting back from the latest, so the last sample is today.
  const weekly = rs.filter((_, i) => (rs.length - 1 - i) % SESSIONS_PER_WEEK === 0);

  const ratios: { date: string; ratio: number }[] = [];
  for (let i = RS_TREND_WEEKS - 1; i < weekly.length; i++) {
    const trend = mean(weekly.slice(i - RS_TREND_WEEKS + 1, i + 1).map((w) => w.value));
    ratios.push({ date: weekly[i].date, ratio: (100 * weekly[i].value) / trend });
  }

  const path: RotationPoint[] = [];
  for (let i = MOMENTUM_WEEKS - 1; i < ratios.length; i++) {
    const trend = mean(ratios.slice(i - MOMENTUM_WEEKS + 1, i + 1).map((r) => r.ratio));
    path.push({ date: ratios[i].date, ratio: ratios[i].ratio, momentum: (100 * ratios[i].ratio) / trend });
  }
  return path.slice(-TAIL_WEEKS);
}

export function quadrantOf(point: RotationPoint | undefined): RotationQuadrant | null {
  if (!point) return null;
  if (point.ratio >= 100) return point.momentum >= 100 ? "leading" : "weakening";
  return point.momentum >= 100 ? "improving" : "lagging";
}

export function sectorStats(
  sector: { symbol: string; name: string },
  points: PricePoint[],
  benchmark: PricePoint[],
): SectorStats {
  const returns = allReturns(points);
  const benchReturns = allReturns(benchmark);
  const relative = Object.fromEntries(
    SECTOR_PERIODS.map((p) => {
      const r = returns[p];
      const b = benchReturns[p];
      return [p, r === null || b === null ? null : r - b];
    }),
  ) as Record<SectorPeriod, number | null>;
  const rotation = rotationPath(points, benchmark);

  return {
    symbol: sector.symbol,
    name: sector.name,
    price: points.at(-1)?.close ?? 0,
    returns,
    relative,
    aboveSma50: aboveSma(points, 50),
    aboveSma200: aboveSma(points, 200),
    rotation,
    quadrant: quadrantOf(rotation.at(-1)),
  };
}
