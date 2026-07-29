import { describe, expect, it } from "vitest";
import type { PricePoint } from "@/lib/types/stock";
import { computeSeries } from "./series";
import {
  CROSSOVER_RULES,
  detectCrossovers,
  withCrossoverMarkers,
} from "./signals";

function series(prices: number[]): PricePoint[] {
  return prices.map((close, i) => ({
    date: new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10),
    close,
  }));
}

/** Rises for `up` sessions then falls for `down` — forces averages to cross both ways. */
function invertedV(up: number, down: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < up; i++) out.push(100 + i * 2);
  const peak = out[out.length - 1];
  for (let i = 1; i <= down; i++) out.push(peak - i * 2);
  return out;
}

describe("CROSSOVER_RULES", () => {
  it("configures exactly the two requested rules", () => {
    expect(CROSSOVER_RULES.map((r) => r.id)).toEqual(["sell-10-20", "buy-60-120"]);
  });

  it("maps 10-below-20 to sell and 60-below-120 to buy", () => {
    const sell = CROSSOVER_RULES.find((r) => r.id === "sell-10-20")!;
    expect(sell).toMatchObject({ fast: "sma10", slow: "sma20", direction: "below", kind: "sell" });

    // Deliberately contrarian: the medium average dropping below the long one
    // is read as depressed rather than as the conventional bearish signal.
    const buy = CROSSOVER_RULES.find((r) => r.id === "buy-60-120")!;
    expect(buy).toMatchObject({ fast: "sma60", slow: "sma120", direction: "below", kind: "buy" });
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

  it("fires a sell when SMA10 crosses below SMA20", () => {
    const points = computeSeries(series(invertedV(60, 60)));
    const sells = detectCrossovers(points).filter((s) => s.ruleId === "sell-10-20");
    expect(sells.length).toBeGreaterThan(0);
    for (const s of sells) {
      expect(s.kind).toBe("sell");
      // The defining condition must hold on the session it fired.
      expect(s.fast).toBeLessThan(s.slow);
    }
  });

  it("fires a buy when SMA60 crosses below SMA120", () => {
    // Needs >120 sessions of rise before the fall so both averages exist.
    const points = computeSeries(series(invertedV(150, 150)));
    const buys = detectCrossovers(points).filter((s) => s.ruleId === "buy-60-120");
    expect(buys.length).toBeGreaterThan(0);
    for (const s of buys) {
      expect(s.kind).toBe("buy");
      expect(s.fast).toBeLessThan(s.slow);
    }
  });

  it("ignores the opposite cross for each rule", () => {
    // Both rules fire only on a downward cross, so an upward one is silent.
    const points = computeSeries(series(invertedV(150, 150)));
    for (const s of detectCrossovers(points)) {
      expect(s.fast).toBeLessThan(s.slow);
    }
  });

  it("never fires before both averages exist", () => {
    const points = computeSeries(series(invertedV(150, 150)));
    const rules = new Map(CROSSOVER_RULES.map((r) => [r.id, r]));
    for (const s of detectCrossovers(points)) {
      const rule = rules.get(s.ruleId)!;
      const i = points.findIndex((p) => p.date === s.date);
      expect(points[i - 1][rule.fast], `${s.ruleId} prev fast`).not.toBeNull();
      expect(points[i - 1][rule.slow], `${s.ruleId} prev slow`).not.toBeNull();
    }
  });

  it("marks the crossing session only, not every session the condition holds", () => {
    // SMA10 stays below SMA20 for the whole decline; one marker, not dozens.
    const points = computeSeries(series(invertedV(60, 60)));
    const sells = detectCrossovers(points).filter((s) => s.ruleId === "sell-10-20");
    const belowSessions = points.filter(
      (p) => p.sma10 !== null && p.sma20 !== null && p.sma10 < p.sma20,
    ).length;
    expect(belowSessions).toBeGreaterThan(sells.length);
  });

  it("returns signals in date order across both rules", () => {
    const points = computeSeries(series(invertedV(150, 150)));
    const dates = detectCrossovers(points).map((s) => s.date);
    expect([...dates].sort()).toEqual(dates);
  });
});

describe("withCrossoverMarkers", () => {
  it("routes buy and sell prices into separate fields", () => {
    const points = [
      { date: "2024-01-01", close: 10 },
      { date: "2024-01-02", close: 11 },
    ];
    const out = withCrossoverMarkers(points, [
      { ruleId: "buy-60-120", date: "2024-01-01", price: 10, kind: "buy", label: "", fast: 0, slow: 1 },
      { ruleId: "sell-10-20", date: "2024-01-02", price: 11, kind: "sell", label: "", fast: 0, slow: 1 },
    ]);

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
