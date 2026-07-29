import { describe, expect, it } from "vitest";
import type { PricePoint } from "@/lib/types/stock";
import { computeSeries, type SeriesPoint } from "./series";
import { detectCrossovers, withCrossoverMarkers } from "./signals";

function series(prices: number[]): PricePoint[] {
  return prices.map((close, i) => ({
    date: new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10),
    close,
  }));
}

/**
 * A long trend followed by wobbles, so SMA10 repeatedly crosses SMA20 while
 * the 60/120 regime stays fixed by the preceding trend.
 */
function trendThenWobble(
  trendLength: number,
  slope: number,
  wobbles: number,
): number[] {
  const out: number[] = [];
  let price = 300;
  for (let i = 0; i < trendLength; i++) {
    price += slope;
    out.push(price);
  }
  // Alternating up/down runs long enough to swing the 10-session average
  // across the 20-session one without disturbing the 60/120 backdrop.
  for (let w = 0; w < wobbles; w++) {
    for (let i = 0; i < 8; i++) out.push(price + (w % 2 === 0 ? -6 : 6) * (i + 1) * 0.4);
    for (let i = 0; i < 8; i++) out.push(price + (w % 2 === 0 ? 6 : -6) * (i + 1) * 0.4);
  }
  return out;
}

/** Regime at a given date, straight from the computed averages. */
function regimeAt(points: SeriesPoint[], date: string): "below" | "above" | null {
  const p = points.find((x) => x.date === date)!;
  if (p.sma60 === null || p.sma120 === null) return null;
  return p.sma60 < p.sma120 ? "below" : "above";
}

describe("detectCrossovers", () => {
  it("returns nothing without enough history", () => {
    expect(detectCrossovers([])).toEqual([]);
    expect(detectCrossovers(computeSeries(series([1, 2, 3])))).toEqual([]);
  });

  it("emits no signal on a flat series", () => {
    expect(detectCrossovers(computeSeries(series(new Array(300).fill(100))))).toEqual([]);
  });

  it("fires only when SMA 10 crosses below SMA 20", () => {
    const points = computeSeries(series(trendThenWobble(200, -1, 6)));
    const signals = detectCrossovers(points);
    expect(signals.length).toBeGreaterThan(0);

    for (const s of signals) {
      // The trigger condition must hold on the session it fired...
      expect(s.fast).toBeLessThan(s.slow);
      // ...and must not have held on the session before.
      const i = points.findIndex((p) => p.date === s.date);
      expect(points[i - 1].sma10!).toBeGreaterThanOrEqual(points[i - 1].sma20!);
    }
  });

  it("calls it a buy while SMA 60 is below SMA 120", () => {
    // A sustained decline puts the medium average under the long one.
    const points = computeSeries(series(trendThenWobble(200, -1, 6)));
    const signals = detectCrossovers(points);

    expect(signals.some((s) => s.kind === "buy")).toBe(true);
    for (const s of signals.filter((s) => s.kind === "buy")) {
      expect(s.regime).toBe("below");
      expect(s.regimeFast).toBeLessThan(s.regimeSlow);
    }
  });

  it("calls it a sell while SMA 60 is above SMA 120", () => {
    // A sustained advance puts the medium average over the long one.
    const points = computeSeries(series(trendThenWobble(200, 1, 6)));
    const signals = detectCrossovers(points);

    expect(signals.some((s) => s.kind === "sell")).toBe(true);
    for (const s of signals.filter((s) => s.kind === "sell")) {
      expect(s.regime).toBe("above");
      expect(s.regimeFast).toBeGreaterThan(s.regimeSlow);
    }
  });

  it("classifies every signal by the regime on its own session", () => {
    // The identical trigger must flip meaning with the backdrop; this is the
    // whole point of the rule.
    for (const slope of [-1, 1]) {
      const points = computeSeries(series(trendThenWobble(200, slope, 6)));
      for (const s of detectCrossovers(points)) {
        const expected = regimeAt(points, s.date);
        expect(s.regime, `slope ${slope} on ${s.date}`).toBe(expected);
        expect(s.kind).toBe(expected === "below" ? "buy" : "sell");
      }
    }
  });

  it("skips crosses where the regime cannot be determined", () => {
    // SMA 120 needs 120 sessions, so nothing before that can be classified.
    const points = computeSeries(series(trendThenWobble(200, -1, 6)));
    for (const s of detectCrossovers(points)) {
      const p = points.find((x) => x.date === s.date)!;
      expect(p.sma60).not.toBeNull();
      expect(p.sma120).not.toBeNull();
    }
  });

  it("ignores SMA 10 crossing back above SMA 20", () => {
    const points = computeSeries(series(trendThenWobble(200, 1, 6)));
    const signals = detectCrossovers(points);
    const upwardCrosses = points.filter((p, i) => {
      if (i === 0) return false;
      const prev = points[i - 1];
      if ([prev.sma10, prev.sma20, p.sma10, p.sma20].some((v) => v === null)) return false;
      return prev.sma10! <= prev.sma20! && p.sma10! > p.sma20!;
    });
    // Upward crosses exist in this data but none of them produced a signal.
    expect(upwardCrosses.length).toBeGreaterThan(0);
    for (const cross of upwardCrosses) {
      expect(signals.some((s) => s.date === cross.date)).toBe(false);
    }
  });

  it("marks the crossing session only, not every session below", () => {
    const points = computeSeries(series(trendThenWobble(200, -1, 6)));
    const signals = detectCrossovers(points);
    const belowSessions = points.filter(
      (p) => p.sma10 !== null && p.sma20 !== null && p.sma10 < p.sma20,
    ).length;
    expect(belowSessions).toBeGreaterThan(signals.length);
  });

  it("returns signals in date order", () => {
    const dates = detectCrossovers(
      computeSeries(series(trendThenWobble(200, -1, 6))),
    ).map((s) => s.date);
    expect([...dates].sort()).toEqual(dates);
  });
});

describe("withCrossoverMarkers", () => {
  const signal = (date: string, price: number, kind: "buy" | "sell") => ({
    date,
    price,
    kind,
    regime: (kind === "buy" ? "below" : "above") as "below" | "above",
    fast: 1,
    slow: 2,
    regimeFast: 1,
    regimeSlow: 2,
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

  it("leaves both fields null on ordinary sessions", () => {
    const out = withCrossoverMarkers([{ date: "2024-01-01", close: 10 }], []);
    expect(out[0].buySignal).toBeNull();
    expect(out[0].sellSignal).toBeNull();
  });
});
