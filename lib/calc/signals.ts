import type { SeriesPoint } from "./series";

/**
 * Regime-filtered moving-average crossover signals.
 *
 * Each rule pairs a *trigger* — one average crossing below another — with a
 * *regime* condition that must hold on the same session for the signal to
 * count. Both are configured per rule, so the two signals can watch entirely
 * different parts of the curve:
 *
 *   buy   SMA 5 crosses below SMA 10,  while SMA 20 is below SMA 60
 *   sell  SMA 10 crosses below SMA 20, while SMA 60 is above SMA 120
 *
 * The buy is contrarian — a short-term dip inside an already-weak medium-term
 * regime reads as depressed. The sell is trend-following — a medium-term
 * breakdown inside a strong long-term regime reads as momentum rolling over.
 *
 * These are mechanical technical-analysis markers, not investment advice.
 * Crossovers lag by construction — averages only cross after the move has
 * happened — and they whipsaw in sideways markets.
 *
 * Markers fire on the *crossing session* only. A trigger condition stays true
 * for long stretches; drawing a triangle on each of those sessions would put
 * hundreds on the chart and bury the moment the relationship changed.
 */

export type SignalKind = "buy" | "sell";
/** Which side of the slower average the faster one must sit on. */
export type Regime = "below" | "above";

/** Only SMA fields are comparable; tying to SeriesPoint makes renames break the build. */
type SmaKey = Extract<keyof SeriesPoint, `sma${string}`>;

export interface SignalRule {
  kind: SignalKind;
  /** Fires when `fast` crosses down through `slow`. */
  trigger: { fast: SmaKey; slow: SmaKey };
  /** Must hold on the crossing session for the signal to count. */
  regime: { fast: SmaKey; slow: SmaKey; side: Regime };
}

export const SIGNAL_RULES: SignalRule[] = [
  {
    kind: "buy",
    trigger: { fast: "sma5", slow: "sma10" },
    regime: { fast: "sma20", slow: "sma60", side: "below" },
  },
  {
    kind: "sell",
    trigger: { fast: "sma10", slow: "sma20" },
    regime: { fast: "sma60", slow: "sma120", side: "above" },
  },
];

/** "sma20" -> "20", so all copy follows the rules above. */
const period = (key: SmaKey) => key.replace("sma", "");

export function ruleLabel(rule: SignalRule): string {
  const verb = rule.kind === "buy" ? "Buy" : "Sell";
  return (
    `${verb} — SMA ${period(rule.trigger.fast)} below ${period(rule.trigger.slow)}, ` +
    `while ${period(rule.regime.fast)} ${rule.regime.side} ${period(rule.regime.slow)}`
  );
}

export const SIGNAL_LABELS: Record<SignalKind, string> = Object.fromEntries(
  SIGNAL_RULES.map((rule) => [rule.kind, ruleLabel(rule)]),
) as Record<SignalKind, string>;

/** One-line explanation for the chart header. */
export const SIGNAL_DESCRIPTION =
  "Each triangle marks a moving-average cross that also met its regime condition. " +
  "Mechanical indicator, not investment advice.";

export interface CrossoverSignal {
  kind: SignalKind;
  date: string;
  /** Close on the session the cross completed. */
  price: number;
  /** Trigger averages at the cross, for the tooltip. */
  fast: number;
  slow: number;
  /** Regime averages at the cross. */
  regimeFast: number;
  regimeSlow: number;
  label: string;
}

/**
 * Find the sessions where each rule's trigger crossed down and its regime held.
 *
 * A cross is recorded only when both trigger averages exist on the current
 * *and* previous session, so the day an average first becomes available is
 * never mistaken for a crossing.
 *
 * A signal is skipped when the regime cannot be evaluated because an average
 * is missing. That bites hardest on the sell rule, whose 120-session average
 * needs roughly six months of history, so short ranges legitimately show fewer
 * sells than the trigger alone would suggest.
 *
 * The two rules watch different pairs, so both can fire on the same session.
 * That is left as-is rather than collapsed to one marker: it is a real state
 * of the data, and hiding one would misrepresent it.
 */
export function detectCrossovers(
  series: readonly SeriesPoint[],
  rules: readonly SignalRule[] = SIGNAL_RULES,
): CrossoverSignal[] {
  const signals: CrossoverSignal[] = [];
  if (!series || series.length < 2) return signals;

  for (const rule of rules) {
    const label = ruleLabel(rule);

    for (let i = 1; i < series.length; i++) {
      const prev = series[i - 1];
      const curr = series[i];

      const prevFast = prev[rule.trigger.fast];
      const prevSlow = prev[rule.trigger.slow];
      const fast = curr[rule.trigger.fast];
      const slow = curr[rule.trigger.slow];

      if (prevFast === null || prevSlow === null || fast === null || slow === null) {
        continue;
      }

      // Only the downward cross fires; the fast average rising back is silent.
      const crossedDown = prevFast >= prevSlow && fast < slow;
      if (!crossedDown) continue;

      const regimeFast = curr[rule.regime.fast];
      const regimeSlow = curr[rule.regime.slow];
      if (regimeFast === null || regimeSlow === null) continue;

      const holds =
        rule.regime.side === "below"
          ? regimeFast < regimeSlow
          : regimeFast > regimeSlow;
      if (!holds) continue;

      signals.push({
        kind: rule.kind,
        date: curr.date,
        price: curr.close,
        fast,
        slow,
        regimeFast,
        regimeSlow,
        label,
      });
    }
  }

  return signals.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
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
