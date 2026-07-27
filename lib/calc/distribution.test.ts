import { describe, expect, it } from "vitest";
import type { PricePoint } from "@/lib/types/stock";
import { computeDistribution } from "./distribution";

/** Build a price series whose successive daily returns match `returnsPct`. */
function seriesFromReturns(returnsPct: number[], start = 100): PricePoint[] {
  const points: PricePoint[] = [{ date: "2024-01-01", close: start }];
  let close = start;
  returnsPct.forEach((r, i) => {
    close = close * (1 + r / 100);
    points.push({
      date: new Date(Date.UTC(2024, 0, 2 + i)).toISOString().slice(0, 10),
      close,
    });
  });
  return points;
}

describe("computeDistribution", () => {
  it("returns an empty result for insufficient history", () => {
    expect(computeDistribution([]).totalDays).toBe(0);
    expect(computeDistribution([{ date: "2024-01-01", close: 10 }]).totalDays).toBe(0);
  });

  it("computes mean and standard deviation of daily returns", () => {
    // Exactly +10% then -10% from 100 -> 110 -> 99
    const history: PricePoint[] = [
      { date: "2024-01-01", close: 100 },
      { date: "2024-01-02", close: 110 },
      { date: "2024-01-03", close: 99 },
    ];
    const result = computeDistribution(history);
    expect(result.totalDays).toBe(2);
    expect(result.mean).toBeCloseTo(0, 10); // (+10 + -10) / 2
    expect(result.sd).toBeCloseTo(10, 10);
  });

  it("counts every observation exactly once", () => {
    // The core invariant. The previous implementation could silently discard
    // returns whose bin key the creation loop never emitted.
    const returns = [0.5, -0.3, 0.05, -0.05, 1.2, -1.1, 0.02, -0.02, 2.5, -2.4];
    const result = computeDistribution(seriesFromReturns(returns));
    const counted = result.data.reduce((sum, b) => sum + b.count, 0);
    expect(counted).toBe(result.totalDays);
    expect(counted).toBe(returns.length);
  });

  it("does not drop returns when float drift would produce a '-0.0' bin key", () => {
    // Regression test for the histogram bug. The old code built bin keys by
    // repeatedly adding 0.1 to a float and formatting with toFixed(1). Starting
    // from a sufficiently negative lower bound, the accumulator reached about
    // -1.4e-14 where it should have reached 0, formatting as "-0.0" — so the
    // "0.0" bin never existed and every return in [0, 0.1) was dropped.
    //
    // The -9.4% day is what widens the range enough to trigger it.
    const returns = [
      0.5, -0.3, 0.05, -0.05, 1.2, -1.1, 0.02, -0.02, 2.5, -2.4,
      0.08, -0.09, 0.7, -0.6, 3.1, -3.0, 0.15, -0.15, -9.4, 8.8,
    ];
    const result = computeDistribution(seriesFromReturns(returns));

    const counted = result.data.reduce((sum, b) => sum + b.count, 0);
    expect(counted).toBe(returns.length);

    // The specific bucket that used to vanish: small positive returns.
    const zeroBin = result.data.find((b) => Math.abs(b.bin) < 1e-9);
    expect(zeroBin).toBeDefined();
    expect(zeroBin!.count).toBeGreaterThan(0);
  });

  it("keeps bin values free of float representation noise", () => {
    const result = computeDistribution(seriesFromReturns([0.35, -0.25, 0.15]));
    for (const b of result.data) {
      // 0.30000000000000004 would render as a garbage axis label.
      expect(String(b.bin).length).toBeLessThanOrEqual(6);
    }
  });

  it("spans the sigma reference lines even when no return reaches them", () => {
    const result = computeDistribution(seriesFromReturns([0.1, -0.1, 0.1, -0.1]));
    const min = Math.min(...result.data.map((b) => b.bin));
    const max = Math.max(...result.data.map((b) => b.bin));
    expect(min).toBeLessThanOrEqual(result.mean - 2 * result.sd);
    expect(max).toBeGreaterThanOrEqual(result.mean + 2 * result.sd);
  });

  it("counts observations inside 1 and 2 sigma", () => {
    const returns = [1, -1, 1, -1, 5];
    const result = computeDistribution(seriesFromReturns(returns));
    expect(result.count1Sigma).toBeLessThanOrEqual(result.totalDays);
    expect(result.count2Sigma).toBeGreaterThanOrEqual(result.count1Sigma);
  });

  it("returns bins in ascending order", () => {
    const result = computeDistribution(seriesFromReturns([2, -3, 1, -1, 4]));
    const bins = result.data.map((b) => b.bin);
    expect([...bins].sort((a, b) => a - b)).toEqual(bins);
  });
});
