import { describe, expect, it } from "vitest";
import type { PricePoint } from "@/lib/types/stock";
import { computeSeries, dailyReturns } from "./series";

function flatSeries(n: number, close = 100): PricePoint[] {
  return Array.from({ length: n }, (_, i) => ({
    date: new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10),
    close,
  }));
}

describe("computeSeries", () => {
  it("returns an empty array for empty history", () => {
    expect(computeSeries([])).toEqual([]);
  });

  it("sorts history ascending by date", () => {
    const out = computeSeries([
      { date: "2024-03-01", close: 30 },
      { date: "2024-01-01", close: 10 },
      { date: "2024-02-01", close: 20 },
    ]);
    expect(out.map((p) => p.close)).toEqual([10, 20, 30]);
  });

  it("reports the first point's change as zero", () => {
    const out = computeSeries([
      { date: "2024-01-01", close: 100 },
      { date: "2024-01-02", close: 110 },
    ]);
    expect(out[0].changePercent).toBe(0);
    expect(out[1].changePercent).toBeCloseTo(10, 10);
  });

  it("leaves SMA and bands null until a full period is available", () => {
    const out = computeSeries(flatSeries(25), 20);
    for (let i = 0; i < 19; i++) {
      expect(out[i].sma20, `index ${i}`).toBeNull();
      expect(out[i].upperBand, `index ${i}`).toBeNull();
      expect(out[i].lowerBand, `index ${i}`).toBeNull();
    }
    expect(out[19].sma20).not.toBeNull();
  });

  it("computes SMA and Bollinger bands on a flat series", () => {
    const out = computeSeries(flatSeries(25, 100), 20);
    // Zero variance: bands collapse onto the mean.
    expect(out[24].sma20).toBeCloseTo(100, 10);
    expect(out[24].upperBand).toBeCloseTo(100, 10);
    expect(out[24].lowerBand).toBeCloseTo(100, 10);
  });

  it("computes SMA against a hand-checked ramp", () => {
    // closes 1..20; SMA of 1..20 = 10.5
    const history: PricePoint[] = Array.from({ length: 20 }, (_, i) => ({
      date: new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10),
      close: i + 1,
    }));
    const out = computeSeries(history, 20);
    expect(out[19].sma20).toBeCloseTo(10.5, 10);
  });

  it("does not report volatility until a full window of real returns exists", () => {
    // Regression test: changes[0] is a placeholder zero because the first point
    // has no prior close. The old implementation pulled it into the window at
    // index 19, biasing that day's volatility toward zero. A full window of
    // real returns is only available from index 20 onward.
    const history: PricePoint[] = Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10),
      // Alternating +/- moves so real volatility is clearly non-zero.
      close: 100 * (i % 2 === 0 ? 1 : 1.05) + i,
    }));
    const out = computeSeries(history, 20);

    expect(out[19].rollingSD).toBe(0);
    expect(out[20].rollingSD).toBeGreaterThan(0);
  });

  it("survives a zero close without producing Infinity or NaN", () => {
    const out = computeSeries([
      { date: "2024-01-01", close: 0 },
      { date: "2024-01-02", close: 50 },
    ]);
    expect(Number.isFinite(out[1].changePercent)).toBe(true);
  });
});

describe("dailyReturns", () => {
  it("returns one fewer value than the input length", () => {
    const out = dailyReturns(flatSeries(5));
    expect(out).toHaveLength(4);
  });

  it("excludes the leading placeholder", () => {
    const out = dailyReturns([
      { date: "2024-01-01", close: 100 },
      { date: "2024-01-02", close: 110 },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toBeCloseTo(10, 10);
  });

  it("returns an empty array when there is nothing to compare", () => {
    expect(dailyReturns([])).toEqual([]);
    expect(dailyReturns([{ date: "2024-01-01", close: 1 }])).toEqual([]);
  });
});
