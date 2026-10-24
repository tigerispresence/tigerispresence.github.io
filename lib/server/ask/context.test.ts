import { describe, expect, it } from "vitest";
import { stockContext } from "./context";
import type { StockData } from "@/lib/types/stock";

function stock(closes: number[]): StockData {
  const end = Date.UTC(2026, 9, 23);
  return {
    symbol: "TEST",
    name: "Test Corp",
    currentPrice: closes.at(-1)!,
    currency: "USD",
    change: 0,
    changePercent: 1.5,
    history: closes.map((close, i) => ({
      date: new Date(end - (closes.length - 1 - i) * 86_400_000).toISOString(),
      close,
    })),
    riskMetrics: { fiftyTwoWeekHigh: 300, fiftyTwoWeekLow: 100 },
  };
}

describe("stockContext", () => {
  it("summarizes returns and trend instead of sending raw history", () => {
    const ctx = stockContext(stock(Array.from({ length: 300 }, (_, i) => 100 + i)), null);
    expect(ctx.price).toBe(399);
    expect(ctx.dayChange).toBe("1.50%");
    expect(ctx.returns["1D"]).toBe(`${((399 / 398 - 1) * 100).toFixed(2)}%`);
    expect(ctx.trend.priceVsSma200).toMatch(/^\d+\.\d{2}%$/);
    expect(ctx.trend.offHigh).toBe(`${((399 / 300 - 1) * 100).toFixed(2)}%`);
    expect(JSON.stringify(ctx)).not.toContain('"history"');
    expect(ctx.macro).toBeNull();
  });

  it("leaves long-window figures empty when history is short", () => {
    const ctx = stockContext(stock([100, 101, 102]), null);
    expect(ctx.trend.sma200).toBeNull();
    expect(ctx.returns["1Y"]).toBeNull();
  });
});
