import { describe, expect, it } from "vitest";
import type { PricePoint } from "@/lib/types/stock";
import { computeSeries } from "../series";
import { computeDistribution } from "../distribution";
import { simulateDca } from "./dca";
import { simulateVolatility, sigmaZone } from "./volatility";
import { simulateFearGreed, normalizeRating } from "./fearGreed";

/** Deterministic daily series spanning `days` calendar days from 2024-01-01. */
function makeHistory(days: number, priceAt: (i: number) => number): PricePoint[] {
  return Array.from({ length: days }, (_, i) => ({
    date: new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10),
    close: priceAt(i),
  }));
}

const flat100 = makeHistory(90, () => 100);

describe("simulateDca", () => {
  it("returns null for empty input", () => {
    expect(simulateDca([], { currentPrice: 100 })).toBeNull();
  });

  it("buys once per calendar month", () => {
    // 90 days from Jan 1 spans Jan, Feb, Mar -> 3 monthly buys.
    const series = computeSeries(flat100);
    const result = simulateDca(series, { currentPrice: 100 })!;
    expect(result.totalBuys).toBe(3);
    expect(result.totalInvested).toBeCloseTo(300, 10);
  });

  it("reports avgPrice as totalInvested / totalBuys", () => {
    const series = computeSeries(makeHistory(90, (i) => 100 + i));
    const result = simulateDca(series, { currentPrice: 200 })!;
    expect(result.avgPrice).toBeCloseTo(
      result.totalInvested / result.totalBuys,
      10,
    );
  });

  it("reports zero dividends when none are supplied", () => {
    const series = computeSeries(flat100);
    const result = simulateDca(series, { currentPrice: 100 })!;
    expect(result.totalDividends).toBe(0);
  });

  it("reinvests dividends into additional shares", () => {
    const series = computeSeries(flat100);
    const withDiv = simulateDca(series, {
      currentPrice: 100,
      dividends: [{ date: "2024-02-15", amount: 5 }],
    })!;
    const without = simulateDca(series, { currentPrice: 100 })!;

    expect(withDiv.totalDividends).toBeGreaterThan(0);
    // Same cash invested, more shares -> higher terminal value.
    expect(withDiv.totalInvested).toBeCloseTo(without.totalInvested, 10);
    expect(withDiv.currentValue).toBeGreaterThan(without.currentValue);
  });

  it("shows a flat price with no dividends as a zero return", () => {
    const series = computeSeries(flat100);
    const result = simulateDca(series, { currentPrice: 100 })!;
    expect(result.totalReturn).toBeCloseTo(0, 10);
  });

  it("populates the reinvested series the chart plots", () => {
    // Regression test: unifying the three simulations onto one SimPoint
    // renamed DCA's `value` field to `valueReinvest`, but the chart kept
    // asking for `value`. It resolved to undefined, so the portfolio-value
    // area rendered empty while the invested line still drew.
    const series = computeSeries(flat100);
    const result = simulateDca(series, { currentPrice: 100 })!;

    expect(result.history.length).toBeGreaterThan(0);
    for (const point of result.history) {
      expect(point).toHaveProperty("valueReinvest");
      expect(point).toHaveProperty("valueNoReinvest");
      expect(Number.isFinite(point.valueReinvest)).toBe(true);
    }
    // Once the first monthly buy lands the series must be non-zero, otherwise
    // the chart is a flat line at the axis.
    expect(result.history[result.history.length - 1].valueReinvest).toBeGreaterThan(0);
  });

  it("falls back to the last close when the live quote is missing", () => {
    // Regression test: a failed upstream quote used to surface as
    // currentPrice = 0, valuing the portfolio at zero and reporting -100%.
    const series = computeSeries(flat100);
    const result = simulateDca(series, { currentPrice: 0 })!;
    expect(result.currentValue).toBeGreaterThan(0);
    expect(result.totalReturn).toBeCloseTo(0, 10);
    expect(result.totalReturn).not.toBeCloseTo(-100, 1);
  });
});

describe("sigmaZone", () => {
  it("classifies returns relative to the mean", () => {
    expect(sigmaZone(0, 0, 1)).toBe("0");
    expect(sigmaZone(-1.5, 0, 1)).toBe("-1");
    expect(sigmaZone(-2.5, 0, 1)).toBe("-2");
    expect(sigmaZone(1.5, 0, 1)).toBe("1");
    expect(sigmaZone(2.5, 0, 1)).toBe("2");
  });

  it("treats the boundary as belonging to the outer zone", () => {
    expect(sigmaZone(-2, 0, 1)).toBe("-2");
    expect(sigmaZone(2, 0, 1)).toBe("2");
  });
});

describe("simulateVolatility", () => {
  it("returns null when volatility is zero", () => {
    const series = computeSeries(flat100);
    const stats = computeDistribution(flat100);
    expect(simulateVolatility(series, stats, { currentPrice: 100 }, ["-1"])).toBeNull();
  });

  it("buys only on days inside the selected zones", () => {
    const history = makeHistory(60, (i) => (i % 10 === 0 ? 90 : 100));
    const series = computeSeries(history);
    const stats = computeDistribution(history);

    const none = simulateVolatility(series, stats, { currentPrice: 100 }, [])!;
    expect(none.totalBuys).toBe(0);

    const some = simulateVolatility(
      series,
      stats,
      { currentPrice: 100 },
      ["-2", "-1"],
    )!;
    expect(some.totalBuys).toBeGreaterThan(0);
  });

  it("records a buy date for every buy", () => {
    const history = makeHistory(60, (i) => (i % 10 === 0 ? 90 : 100));
    const series = computeSeries(history);
    const stats = computeDistribution(history);
    const result = simulateVolatility(
      series,
      stats,
      { currentPrice: 100 },
      ["-2", "-1"],
    )!;
    expect(result.buyDates.size).toBe(result.totalBuys);
  });
});

describe("normalizeRating", () => {
  it("lowercases and replaces underscores", () => {
    expect(normalizeRating("EXTREME_FEAR")).toBe("extreme fear");
    expect(normalizeRating("Greed")).toBe("greed");
  });
});

describe("simulateFearGreed", () => {
  const fgHistory = Array.from({ length: 60 }, (_, i) => ({
    date: new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10),
    score: i % 10 === 0 ? 10 : 60,
    rating: i % 10 === 0 ? "extreme fear" : "greed",
  }));

  it("returns null without a Fear & Greed feed", () => {
    const series = computeSeries(flat100);
    expect(simulateFearGreed(series, null, { currentPrice: 100 }, ["fear"])).toBeNull();
    expect(simulateFearGreed(series, [], { currentPrice: 100 }, ["fear"])).toBeNull();
  });

  it("buys only on days matching the selected ratings", () => {
    const series = computeSeries(makeHistory(60, () => 100));
    const result = simulateFearGreed(
      series,
      fgHistory,
      { currentPrice: 100 },
      ["extreme fear"],
    )!;
    expect(result.totalBuys).toBe(6); // every 10th day of 60
  });

  it("only simulates over the overlap with the feed", () => {
    // Price history runs well before the Fear & Greed feed starts.
    const series = computeSeries(makeHistory(200, () => 100));
    const lateFeed = fgHistory.map((f, i) => ({
      ...f,
      date: new Date(Date.UTC(2024, 3, 1 + i)).toISOString().slice(0, 10),
    }));
    const result = simulateFearGreed(
      series,
      lateFeed,
      { currentPrice: 100 },
      ["extreme fear"],
    )!;
    // Nothing before the feed's first date should appear in the equity curve.
    expect(result.history[0].date >= "2024-04-01").toBe(true);
  });

  it("carries the previous rating across gaps in the feed", () => {
    const series = computeSeries(makeHistory(10, () => 100));
    const sparse = [
      { date: "2024-01-01", score: 10, rating: "extreme fear" },
      // no entries for 01-02..01-10 (weekend/holiday style gap)
    ];
    const result = simulateFearGreed(
      series,
      sparse,
      { currentPrice: 100 },
      ["extreme fear"],
    )!;
    // The rating persists, so every day is a buy day.
    expect(result.totalBuys).toBe(10);
  });
});
