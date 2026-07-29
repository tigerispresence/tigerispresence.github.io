import type { SeriesPoint } from "./series";

/**
 * Regime-filtered moving-average crossover signals.
 *
 * There is one trigger — the fast average crossing *below* the next one up —
 * and a slower pair decides how to read it:
 *
 *   regime average below its slower partner  ->  buy   (regime is weak, so a
 *                                                       short-term dip reads
 *                                                       as depressed)
 *   regime average above its slower partner  ->  sell  (regime is strong, so a
 *                                                       short-term breakdown
 *                                                       reads as momentum
 *                                                       rolling over)
 *
 * Periods live in TRIGGER and REGIME below; labels and copy derive from them,
 * so retuning the rule is a one-line change.
 *
 * The same event therefore means opposite things depending on the backdrop:
 * contrarian in a weak regime, trend-following in a strong one.
 *
 * These are mechanical technical-analysis markers, not investment advice.
 * Crossovers lag by construction — averages only cross after the move has
 * happened — and they whipsaw in sideways markets.
 *
 * Markers fire on the *crossing session* only. The trigger condition stays
 * true for long stretches; drawing a triangle on each of those sessions would
 * put hundreds on the chart and bury the moment the relationship changed.
 */

export type SignalKind = "buy" | "sell";
/** Which side of the long-term average the medium-term one sits on. */
export type Regime = "below" | "above";

/** The short-term cross that fires a signal. */
export const TRIGGER = { fast: "sma5", slow: "sma10" } as const;
/** The longer pair whose relationship classifies the signal. */
export const REGIME = { fast: "sma20", slow: "sma60" } as const;

/** "sma20" -> "20", so labels and copy follow the constants above. */
const period = (key: string) => key.replace("sma", "");

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
  buy: `Buy — SMA ${period(TRIGGER.fast)} below ${period(TRIGGER.slow)}, while ${period(REGIME.fast)} below ${period(REGIME.slow)}`,
  sell: `Sell — SMA ${period(TRIGGER.fast)} below ${period(TRIGGER.slow)}, while ${period(REGIME.fast)} above ${period(REGIME.slow)}`,
};

/** One-line explanation for the chart header, derived from the same constants. */
export const SIGNAL_DESCRIPTION =
  `SMA ${period(TRIGGER.fast)} crossing below ${period(TRIGGER.slow)} fires a signal; ` +
  `whether ${period(REGIME.fast)} sits below or above ${period(REGIME.slow)} decides its direction. ` +
  `Mechanical indicator, not investment advice.`;

/**
 * Find sessions where the trigger average crossed below its partner,
 * classified by the regime pair.
 *
 * A cross is recorded only when both trigger averages exist on the current
 * *and* previous session, so the day an average first becomes available is
 * never mistaken for a crossing.
 *
 * A signal is skipped entirely when the regime cannot be determined — either
 * average missing, or the two exactly equal. The slower regime average needs
 * its full window before it produces anything, so crosses before that point
 * are genuinely unclassifiable and emitting a guess would be worse than
 * emitting nothing.
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

    // Only the downward cross fires; the fast average rising back above is silent.
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
