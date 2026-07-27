import { describe, expect, it } from "vitest";
import { isStockRange, rangeToDates } from "./dateRange";

const yearsBetween = (a: Date, b: Date) =>
  (b.getTime() - a.getTime()) / (365.25 * 24 * 60 * 60 * 1000);

describe("isStockRange", () => {
  it("accepts supported ranges", () => {
    expect(isStockRange("1y")).toBe(true);
    expect(isStockRange("10y")).toBe(true);
    expect(isStockRange("custom")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isStockRange("7y")).toBe(false);
    expect(isStockRange("")).toBe(false);
    expect(isStockRange(undefined)).toBe(false);
    expect(isStockRange(5)).toBe(false);
  });
});

describe("rangeToDates", () => {
  it("defaults to one year", () => {
    const { period1, period2 } = rangeToDates(undefined);
    expect(yearsBetween(period1, period2)).toBeCloseTo(1, 1);
  });

  it("maps each range to its span", () => {
    for (const [range, years] of [
      ["1y", 1],
      ["2y", 2],
      ["3y", 3],
      ["5y", 5],
      ["10y", 10],
    ] as const) {
      const { period1, period2 } = rangeToDates(range);
      expect(yearsBetween(period1, period2), range).toBeCloseTo(years, 1);
    }
  });

  it("falls back to one year for an unknown range", () => {
    const { period1, period2 } = rangeToDates("bogus");
    expect(yearsBetween(period1, period2)).toBeCloseTo(1, 1);
  });

  it("honours an explicit from date", () => {
    const { period1 } = rangeToDates("custom", "2020-06-15");
    expect(period1.toISOString().slice(0, 10)).toBe("2020-06-15");
  });

  it("ignores an unparseable from date", () => {
    const { period1, period2 } = rangeToDates("1y", "not-a-date");
    expect(yearsBetween(period1, period2)).toBeCloseTo(1, 1);
  });

  it("ends before today so the in-progress session is excluded", () => {
    // yahoo-finance2 v3 rejects rows whose close is still null.
    const { period2 } = rangeToDates("1y");
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    expect(period2.getTime()).toBeLessThan(todayStart.getTime());
  });
});
