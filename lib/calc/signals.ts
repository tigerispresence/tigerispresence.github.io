import type { SeriesPoint } from "./series";

/**
 * Regime-filtered moving-average crossover signals.
 *
 * There is one trigger — the 10-session average crossing *below* the
 * 20-session average — and the 60/120 relationship decides how to read it:
 *
 *   SMA 60 below SMA 120  ->  buy   (long-term regime is weak, so a
 *                                    short-term dip is treated as depressed)
 *   SMA 60 above SMA 120  ->  sell  (long-term regime is strong, so a
 *                                    short-term breakdown is treated as
 *                                    momentum rolling over)
 *
 * The same event therefore means opposite things depending on the backdrop:
 * contrarian in a weak regime, trend-following in a strong one.
 *
 * These are mechanical technical-analysis markers, not investment advice.
 * Crossovers lag by construction — averages only cross after the move has
 * happened — and they whipsaw in sideways markets.
 *
 * Markers fire on the *crossing session* only. "SMA 10 is below SMA 20" stays
 * true for long stretches; drawing a triangle on each of those sessions would
 * put hundreds on the chart and bury the moment the relationship changed.
 */

export type SignalKind = "buy" | "sell";
/** Which side of the long-term average the medium-term one sits on. */
export type Regime = "below" | "above";

/** The short-term cross that fires a signal. */
export const TRIGGER = { fast: "sma10", slow: "sma20" } as const;
/** The long-term pair whose relationship classifies the signal. */
export const REGIME = { fast: "sma60", slow: "sma120" } as const;

export interface CrossoverSignal {
  date: string;
  /** Close on the session the cross completed. */
  price: number;
  kind: SignalKind;
  regime: Regime;
  /** Trigger averages at the cross, for the tooltip. */
  fast: number;
  slow: number;
  /** Regime averages at the cross. */
  regimeFast: number;
  regimeSlow: number;
}

export const SIGNAL_LABELS: Record<SignalKind, string> = {
  buy: "Buy — SMA 10 below 20, while 60 below 120",
  sell: "Sell — SMA 10 below 20, while 60 above 120",
};

/**
 * Find sessions where SMA 10 crossed below SMA 20, classified by regime.
 *
 * A cross is recorded only when both trigger averages exist on the current
 * *and* previous session, so the day an average first becomes available is
 * never mistaken for a crossing.
 *
 * A signal is skipped entirely when the regime cannot be determined — either
 * average missing, or the two exactly equal. That matters on short ranges: the
 * 120-session average needs roughly six months of history, so crosses before
 * that point are genuinely unclassifiable and emitting a guess would be worse
 * than emitting nothing.
 */
export function detectCrossovers(
  series: readonly SeriesPoint[],
): CrossoverSignal[] {
  const signals: CrossoverSignal[] = [];
  if (!series || series.length < 2) return signals;

  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1];
    const curr = series[i];

    const prevFast = prev[TRIGGER.fast];
    const prevSlow = prev[TRIGGER.slow];
    const fast = curr[TRIGGER.fast];
    const slow = curr[TRIGGER.slow];

    if (prevFast === null || prevSlow === null || fast === null || slow === null) {
      continue;
    }

    // Only the downward cross fires; 10 rising back above 20 is silent.
    const crossedDown = prevFast >= prevSlow && fast < slow;
    if (!crossedDown) continue;

    const regimeFast = curr[REGIME.fast];
    const regimeSlow = curr[REGIME.slow];
    if (regimeFast === null || regimeSlow === null) continue;
    if (regimeFast === regimeSlow) continue;

    const regime: Regime = regimeFast < regimeSlow ? "below" : "above";

    signals.push({
      date: curr.date,
      price: curr.close,
      kind: regime === "below" ? "buy" : "sell",
      regime,
      fast,
      slow,
      regimeFast,
      regimeSlow,
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
): (T & { buySignal: number | null; sellSignal: number | null })[] {
  const buys = new Map<string, number>();
  const sells = new Map<string, number>();
  for (const s of signals) {
    (s.kind === "buy" ? buys : sells).set(s.date, s.price);
  }

  return points.map((point) => ({
    ...point,
    buySignal: buys.get(point.date) ?? null,
    sellSignal: sells.get(point.date) ?? null,
  }));
}
