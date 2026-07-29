import { describe, expect, it } from "vitest";
import type { PricePoint } from "@/lib/types/stock";
import { computeSeries } from "./series";
import { detectCrossovers, withCrossoverMarkers } from "./signals";

function series(prices: number[]): PricePoint[] {
  return prices.map((close, i) => ({
    date: new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10),
    close,
  }));
}

/** Falls for `down` sessions, then rises for `up` — forces one of each cross. */
function vShape(down: number, up: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < down; i++) out.push(200 - i);
  const floor = out[out.length - 1];
  for (let i = 1; i <= up; i++) out.push(floor + i * 2);
  return out;
}

describe("detectCrossovers", () => {
  it("returns nothing without enough history", () => {
    expect(detectCrossovers([])).toEqual([]);
    expect(detectCrossovers(computeSeries(series([1, 2, 3])))).toEqual([]);
  });

  it("never fires before both averages exist", () => {
    // A 60-session average needs 60 closes; the session it first appears must
    // not be mistaken for a crossing.
    const points = computeSeries(series(vShape(80, 120)));
    for (const signal of detectCrossovers(points)) {
      const index = points.findIndex((p) => p.date === signal.date);
      expect(points[index - 1].sma20).not.toBeNull();
      expect(points[index - 1].sma60).not.toBeNull();
    }
  });

  it("finds a bullish cross when a downtrend reverses", () => {
    const points = computeSeries(series(vShape(90, 140)));
    const signals = detectCrossovers(points);
    expect(signals.some((s) => s.kind === "bullish")).toBe(true);
  });

  it("finds a bearish cross when an uptrend reverses", () => {
    const rising = Array.from({ length: 100 }, (_, i) => 100 + i * 2);
    const falling = Array.from({ length: 100 }, (_, i) => 300 - i * 2);
    const points = computeSeries(series([...rising, ...falling]));
    const signals = detectCrossovers(points);
    expect(signals.some((s) => s.kind === "bearish")).toBe(true);
  });

  it("records the direction consistently with the averages at the cross", () => {
    const points = computeSeries(series(vShape(90, 140)));
    for (const s of detectCrossovers(points)) {
      if (s.kind === "bullish") expect(s.fast).toBeGreaterThan(s.slow);
      else expect(s.fast).toBeLessThanOrEqual(s.slow);
    }
  });

  it("alternates direction — no two consecutive signals of the same kind", () => {
    // A crossover is a state change, so repeats would mean double counting.
    const points = computeSeries(
      series([...vShape(90, 120), ...vShape(90, 120).map((p) => p + 50)]),
    );
    const signals = detectCrossovers(points);
    for (let i = 1; i < signals.length; i++) {
      expect(signals[i].kind).not.toBe(signals[i - 1].kind);
    }
  });

  it("emits no signal on a flat series", () => {
    const points = computeSeries(series(new Array(200).fill(100)));
    expect(detectCrossovers(points)).toEqual([]);
  });
});

describe("withCrossoverMarkers", () => {
  it("attaches a price only on signal dates", () => {
    const points = [
      { date: "2024-01-01", close: 10 },
      { date: "2024-01-02", close: 11 },
    ];
    const out = withCrossoverMarkers(points, [
      { date: "2024-01-02", price: 11, kind: "bullish", fast: 1, slow: 0 },
    ]);
    expect(out[0].bullishSignal).toBeNull();
    expect(out[1].bullishSignal).toBe(11);
    expect(out[1].bearishSignal).toBeNull();
  });

  it("keeps bullish and bearish in separate fields", () => {
    const points = [{ date: "2024-01-01", close: 10 }];
    const out = withCrossoverMarkers(points, [
      { date: "2024-01-01", price: 10, kind: "bearish", fast: 0, slow: 1 },
    ]);
    expect(out[0].bearishSignal).toBe(10);
    expect(out[0].bullishSignal).toBeNull();
  });
});
