import { describe, expect, it } from "vitest";
import type { PricePoint } from "@/lib/types/stock";
import { computeSeries } from "./series";
import {
  detectCrossovers,
  ruleLabel,
  SIGNAL_RULES,
  withCrossoverMarkers,
  type SignalKind,
  type SignalRule,
} from "./signals";

function series(prices: number[]): PricePoint[] {
  return prices.map((close, i) => ({
    date: new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10),
    close,
  }));
}

/**
 * A long trend followed by wobbles, so the trigger pairs cross repeatedly
 * while the slower regime pairs stay fixed by the preceding trend.
 */
function trendThenWobble(trendLength: number, slope: number, wobbles: number): number[] {
  const out: number[] = [];
  let price = 300;
  for (let i = 0; i < trendLength; i++) {
    price += slope;
    out.push(price);
  }
  for (let w = 0; w < wobbles; w++) {
    for (let i = 0; i < 8; i++) out.push(price + (w % 2 === 0 ? -6 : 6) * (i + 1) * 0.4);
    for (let i = 0; i < 8; i++) out.push(price + (w % 2 === 0 ? 6 : -6) * (i + 1) * 0.4);
  }
  return out;
}

const ruleFor = (kind: SignalKind): SignalRule =>
  SIGNAL_RULES.find((r) => r.kind === kind)!;

const downtrend = () => computeSeries(series(trendThenWobble(200, -1, 6)));
const uptrend = () => computeSeries(series(trendThenWobble(200, 1, 6)));

describe("SIGNAL_RULES", () => {
  it("configures the requested trigger and regime for each side", () => {
    expect(ruleFor("buy")).toEqual({
      kind: "buy",
      trigger: { fast: "sma5", slow: "sma10" },
      regime: { fast: "sma20", slow: "sma60", side: "below" },
    });
    expect(ruleFor("sell")).toEqual({
      kind: "sell",
      trigger: { fast: "sma10", slow: "sma20" },
      regime: { fast: "sma60", slow: "sma120", side: "above" },
    });
  });

  it("builds labels from the configured periods", () => {
    // Derived so a retune cannot leave the UI describing the old rule.
    expect(ruleLabel(ruleFor("buy"))).toBe("Buy — SMA 5 below 10, while 20 below 60");
    expect(ruleLabel(ruleFor("sell"))).toBe("Sell — SMA 10 below 20, while 60 above 120");
  });
});

describe("detectCrossovers", () => {
  it("returns nothing without enough history", () => {
    expect(detectCrossovers([])).toEqual([]);
    expect(detectCrossovers(computeSeries(series([1, 2, 3])))).toEqual([]);
  });

  it("emits no signal on a flat series", () => {
    expect(detectCrossovers(computeSeries(series(new Array(300).fill(100))))).toEqual([]);
  });

  it("fires each signal only on a downward cross of its own trigger", () => {
    for (const points of [downtrend(), uptrend()]) {
      for (const s of detectCrossovers(points)) {
        const rule = ruleFor(s.kind);
        expect(s.fast).toBeLessThan(s.slow);

        const i = points.findIndex((p) => p.date === s.date);
        expect(points[i - 1][rule.trigger.fast]!).toBeGreaterThanOrEqual(
          points[i - 1][rule.trigger.slow]!,
        );
      }
    }
  });

  it("requires each rule's own regime condition to hold", () => {
    for (const points of [downtrend(), uptrend()]) {
      for (const s of detectCrossovers(points)) {
        const { side } = ruleFor(s.kind).regime;
        if (side === "below") expect(s.regimeFast).toBeLessThan(s.regimeSlow);
        else expect(s.regimeFast).toBeGreaterThan(s.regimeSlow);
      }
    }
  });

  it("produces buys in a weak medium-term regime", () => {
    // Sustained decline puts SMA 20 under SMA 60.
    expect(detectCrossovers(downtrend()).some((s) => s.kind === "buy")).toBe(true);
  });

  it("produces sells in a strong long-term regime", () => {
    // Sustained advance puts SMA 60 over SMA 120.
    expect(detectCrossovers(uptrend()).some((s) => s.kind === "sell")).toBe(true);
  });

  it("emits a signal exactly when the trigger fires and the regime holds", () => {
    // The regime filter is the whole point of the rule, so assert both
    // directions: every qualifying session produces a signal, and every
    // non-qualifying one does not. Derived from the data rather than assumed,
    // because a long trend followed by a plateau lets the shorter regime
    // average drift back across the longer one.
    for (const points of [downtrend(), uptrend()]) {
      const signals = detectCrossovers(points);

      for (const rule of SIGNAL_RULES) {
        const expected = new Set<string>();

        for (let i = 1; i < points.length; i++) {
          const prev = points[i - 1];
          const curr = points[i];
          const vals = [
            prev[rule.trigger.fast], prev[rule.trigger.slow],
            curr[rule.trigger.fast], curr[rule.trigger.slow],
            curr[rule.regime.fast], curr[rule.regime.slow],
          ];
          if (vals.some((v) => v === null)) continue;

          const crossed =
            prev[rule.trigger.fast]! >= prev[rule.trigger.slow]! &&
            curr[rule.trigger.fast]! < curr[rule.trigger.slow]!;
          const holds =
            rule.regime.side === "below"
              ? curr[rule.regime.fast]! < curr[rule.regime.slow]!
              : curr[rule.regime.fast]! > curr[rule.regime.slow]!;

          if (crossed && holds) expected.add(curr.date);
        }

        const actual = new Set(
          signals.filter((s) => s.kind === rule.kind).map((s) => s.date),
        );
        expect(actual, `${rule.kind} signal dates`).toEqual(expected);
      }
    }
  });

  it("never fires before every average it needs exists", () => {
    for (const points of [downtrend(), uptrend()]) {
      for (const s of detectCrossovers(points)) {
        const rule = ruleFor(s.kind);
        const p = points.find((x) => x.date === s.date)!;
        for (const key of [
          rule.trigger.fast, rule.trigger.slow,
          rule.regime.fast, rule.regime.slow,
        ] as const) {
          expect(p[key], `${s.kind} needs ${key}`).not.toBeNull();
        }
      }
    }
  });

  it("marks the crossing session only, not every session below", () => {
    const points = downtrend();
    const buys = detectCrossovers(points).filter((s) => s.kind === "buy");
    const rule = ruleFor("buy");
    const belowSessions = points.filter((p) => {
      const fast = p[rule.trigger.fast];
      const slow = p[rule.trigger.slow];
      return fast !== null && slow !== null && fast < slow;
    }).length;
    expect(belowSessions).toBeGreaterThan(buys.length);
  });

  it("returns signals in date order across both rules", () => {
    const dates = detectCrossovers(downtrend()).map((s) => s.date);
    expect([...dates].sort()).toEqual(dates);
  });
});

describe("withCrossoverMarkers", () => {
  const signal = (date: string, price: number, kind: SignalKind) => ({
    kind,
    date,
    price,
    fast: 1,
    slow: 2,
    regimeFast: 1,
    regimeSlow: 2,
    label: "",
  });

  it("routes buy and sell prices into separate fields", () => {
    const out = withCrossoverMarkers(
      [
        { date: "2024-01-01", close: 10 },
        { date: "2024-01-02", close: 11 },
      ],
      [signal("2024-01-01", 10, "buy"), signal("2024-01-02", 11, "sell")],
    );

    expect(out[0].buySignal).toBe(10);
    expect(out[0].sellSignal).toBeNull();
    expect(out[1].sellSignal).toBe(11);
    expect(out[1].buySignal).toBeNull();
  });

  it("keeps both markers when the two rules fire on the same session", () => {
    // The rules watch different pairs, so this is a real state of the data
    // rather than a conflict to resolve.
    const out = withCrossoverMarkers(
      [{ date: "2024-01-01", close: 10 }],
      [signal("2024-01-01", 10, "buy"), signal("2024-01-01", 10, "sell")],
    );
    expect(out[0].buySignal).toBe(10);
    expect(out[0].sellSignal).toBe(10);
  });

  it("leaves both fields null on ordinary sessions", () => {
    const out = withCrossoverMarkers([{ date: "2024-01-01", close: 10 }], []);
    expect(out[0].buySignal).toBeNull();
    expect(out[0].sellSignal).toBeNull();
  });
});
