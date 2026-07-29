import type { SeriesPoint } from "./series";

/**
 * Moving-average crossover signals.
 *
 * These are mechanical technical-analysis markers, not investment advice: a
 * signal fires purely because one moving average crossed another on that
 * session. Crossovers lag by construction — the averages only cross after the
 * move has happened — and they whipsaw in sideways markets. Treat them as a
 * description of trend change, not a prediction.
 *
 * The pair is 20 over 60 sessions: roughly one month against one quarter. It
 * is the medium-term analogue of the classic 50/200 "golden cross", chosen
 * here because 20 and 60 are already drawn on the chart, and because a 120-day
 * average needs half a year of history before it produces anything at all.
 */

export type SignalKind = "bullish" | "bearish";

export interface CrossoverSignal {
  date: string;
  /** Close on the session the cross completed. */
  price: number;
  kind: SignalKind;
  /** Short/long averages at the cross, for the tooltip. */
  fast: number;
  slow: number;
}

export const FAST_PERIOD = 20;
export const SLOW_PERIOD = 60;

/**
 * Find sessions where the 20-session average crossed the 60-session average.
 *
 * A cross is recorded only when both averages exist on the current *and*
 * previous session, so the first day either becomes available is never
 * mistaken for a crossing.
 */
export function detectCrossovers(
  series: readonly SeriesPoint[],
): CrossoverSignal[] {
  const signals: CrossoverSignal[] = [];
  if (!series || series.length < 2) return signals;

  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1];
    const curr = series[i];

    const prevFast = prev.sma20;
    const prevSlow = prev.sma60;
    const fast = curr.sma20;
    const slow = curr.sma60;

    if (prevFast === null || prevSlow === null || fast === null || slow === null) {
      continue;
    }

    const wasAbove = prevFast > prevSlow;
    const isAbove = fast > slow;
    if (wasAbove === isAbove) continue;

    signals.push({
      date: curr.date,
      price: curr.close,
      kind: isAbove ? "bullish" : "bearish",
      fast,
      slow,
    });
  }

  return signals;
}

/**
 * Attach signal prices to the chart series.
 *
 * Recharts scatters read from the same row objects as the lines, so each
 * signal becomes a nullable field on the matching point rather than a separate
 * dataset — that keeps the marker aligned to the shared x-axis.
 */
export function withCrossoverMarkers<T extends { date: string; close: number }>(
  points: readonly T[],
  signals: readonly CrossoverSignal[],
): (T & { bullishSignal: number | null; bearishSignal: number | null })[] {
  const byDate = new Map(signals.map((s) => [s.date, s]));
  return points.map((point) => {
    const signal = byDate.get(point.date);
    return {
      ...point,
      bullishSignal: signal?.kind === "bullish" ? signal.price : null,
      bearishSignal: signal?.kind === "bearish" ? signal.price : null,
    };
  });
}
