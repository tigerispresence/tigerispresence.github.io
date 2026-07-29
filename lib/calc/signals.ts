import type { SeriesPoint } from "./series";

/**
 * Moving-average crossover signals.
 *
 * These are mechanical technical-analysis markers, not investment advice. A
 * signal fires purely because one moving average crossed another on that
 * session. Crossovers lag by construction — the averages only cross after the
 * move has happened — and they whipsaw in sideways markets. Treat them as a
 * description of trend change, not a prediction.
 *
 * Markers fire on the *crossing session*, not on every session the condition
 * holds. A condition like "SMA10 is below SMA20" is true for long stretches;
 * drawing a triangle on each of those sessions would put hundreds of markers
 * on the chart and bury the moment the relationship actually changed.
 */

export type SignalKind = "buy" | "sell";

/** Which SMA fields a rule compares. Tied to SeriesPoint so renames break the build. */
type SmaKey = Extract<keyof SeriesPoint, `sma${string}`>;

export interface CrossoverRule {
  id: string;
  fast: SmaKey;
  slow: SmaKey;
  /**
   * Which direction of cross fires the marker: "below" means the fast average
   * crossing down through the slow one.
   */
  direction: "below" | "above";
  kind: SignalKind;
  label: string;
}

/**
 * The configured rules.
 *
 * Note these take opposite stances by design. The 10/20 rule is
 * trend-following: short-term momentum rolling over is read as weakness. The
 * 60/120 rule is mean-reverting: the medium-term average falling below the
 * long-term one is read as the stock being depressed rather than as the
 * conventional bearish "death cross".
 */
export const CROSSOVER_RULES: CrossoverRule[] = [
  {
    id: "sell-10-20",
    fast: "sma10",
    slow: "sma20",
    direction: "below",
    kind: "sell",
    label: "SMA 10 crosses below 20",
  },
  {
    id: "buy-60-120",
    fast: "sma60",
    slow: "sma120",
    direction: "below",
    kind: "buy",
    label: "SMA 60 crosses below 120",
  },
];

export interface CrossoverSignal {
  ruleId: string;
  date: string;
  /** Close on the session the cross completed. */
  price: number;
  kind: SignalKind;
  label: string;
  /** The two averages at the cross, for the tooltip. */
  fast: number;
  slow: number;
}

/**
 * Find the sessions where each configured rule's cross completed.
 *
 * A cross is recorded only when both averages exist on the current *and*
 * previous session, so the day either average first becomes available is never
 * mistaken for a crossing — which matters most for the 120-session average,
 * whose first value arrives half a year in.
 */
export function detectCrossovers(
  series: readonly SeriesPoint[],
  rules: readonly CrossoverRule[] = CROSSOVER_RULES,
): CrossoverSignal[] {
  const signals: CrossoverSignal[] = [];
  if (!series || series.length < 2) return signals;

  for (const rule of rules) {
    for (let i = 1; i < series.length; i++) {
      const prev = series[i - 1];
      const curr = series[i];

      const prevFast = prev[rule.fast];
      const prevSlow = prev[rule.slow];
      const fast = curr[rule.fast];
      const slow = curr[rule.slow];

      if (prevFast === null || prevSlow === null || fast === null || slow === null) {
        continue;
      }

      const wasBelow = prevFast < prevSlow;
      const isBelow = fast < slow;
      if (wasBelow === isBelow) continue;

      // Only the requested direction fires; the opposite cross is ignored.
      if (rule.direction === "below" && !isBelow) continue;
      if (rule.direction === "above" && isBelow) continue;

      signals.push({
        ruleId: rule.id,
        date: curr.date,
        price: curr.close,
        kind: rule.kind,
        label: rule.label,
        fast,
        slow,
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
