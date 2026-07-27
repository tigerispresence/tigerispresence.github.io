import { describe, expect, it } from "vitest";
import { buildStockPayload, type AssembleInput } from "./assemble";

/** Minimal viable input; individual tests override just what they exercise. */
function baseInput(overrides: Partial<AssembleInput> = {}): AssembleInput {
  return {
    resolved: { symbol: "AAPL", name: "Apple Inc." },
    quote: {
      symbol: "AAPL",
      shortName: "Apple Inc.",
      regularMarketPrice: 190,
      currency: "USD",
      regularMarketChange: 2,
      regularMarketChangePercent: 1.06,
    },
    quoteSummary: null,
    history: [
      { date: new Date("2024-01-02"), close: 185 },
      { date: new Date("2024-01-03"), close: 190 },
    ],
    dividends: [],
    seasonality: [],
    cashFlowSeries: [],
    options: null,
    fearGreedHistory: null,
    aiMetrics: null,
    ...overrides,
  };
}

describe("buildStockPayload", () => {
  it("maps the core quote fields", () => {
    const out = buildStockPayload(baseInput());
    expect(out.symbol).toBe("AAPL");
    expect(out.name).toBe("Apple Inc.");
    expect(out.currentPrice).toBe(190);
    expect(out.currency).toBe("USD");
  });

  it("falls back to the resolved symbol when the quote failed", () => {
    const out = buildStockPayload(baseInput({ quote: null }));
    expect(out.symbol).toBe("AAPL");
    expect(out.name).toBe("Apple Inc.");
    expect(out.currentPrice).toBe(0);
    expect(out.currency).toBe("USD");
  });

  it("drops history rows with a null close", () => {
    const out = buildStockPayload(
      baseInput({
        history: [
          { date: new Date("2024-01-02"), close: 185 },
          { date: new Date("2024-01-03"), close: null },
          { date: new Date("2024-01-04"), close: 195 },
        ],
      }),
    );
    expect(out.history).toHaveLength(2);
    expect(out.history.every((p) => typeof p.close === "number")).toBe(true);
  });

  it("emits ISO date strings so the payload is JSON-safe", () => {
    const out = buildStockPayload(baseInput());
    expect(out.history[0].date).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("computes a trailing dividend yield when the quote omits one", () => {
    const recent = new Date();
    recent.setMonth(recent.getMonth() - 1);
    const out = buildStockPayload(
      baseInput({
        quote: { symbol: "T", regularMarketPrice: 100, currency: "USD" },
        dividends: [{ date: recent, close: null, dividends: 2 }],
      }),
    );
    // 2 / 100 * 100 = 2%
    expect(out.dividendYield).toBeCloseTo(2, 6);
  });

  it("does not divide by a zero price when computing yield", () => {
    // Regression guard: a failed quote used to leave price at 0, producing
    // Infinity here and rendering as a nonsense yield.
    const recent = new Date();
    recent.setMonth(recent.getMonth() - 1);
    const out = buildStockPayload(
      baseInput({
        quote: { symbol: "X", regularMarketPrice: 0, currency: "USD" },
        dividends: [{ date: recent, close: null, dividends: 2 }],
      }),
    );
    expect(out.dividendYield).toBeUndefined();
  });

  it("omits AI blocks entirely when no AI data is present", () => {
    const out = buildStockPayload(baseInput({ aiMetrics: null }));
    expect(out.geminiMetrics).toBeUndefined();
    expect(out.geminiRiskMetrics).toBeUndefined();
  });

  it("computes max pain from the front-month chain", () => {
    const out = buildStockPayload(
      baseInput({
        options: {
          options: [
            {
              expirationDate: new Date("2024-02-16"),
              calls: [{ strike: 190, openInterest: 1000 }],
              puts: [{ strike: 190, openInterest: 1000 }],
            },
          ],
        },
      }),
    );
    expect(out.maxPain?.price).toBe(190);
    expect(out.maxPain?.expirationDate).toMatch(/^2024-02-16T/);
  });

  it("returns a null max pain when there is no options chain", () => {
    // Common for Korean listings and many ETFs.
    const out = buildStockPayload(baseInput({ options: null }));
    expect(out.maxPain).toBeNull();
  });

  it("keeps the latest target per analyst firm", () => {
    const out = buildStockPayload(
      baseInput({
        quoteSummary: {
          upgradeDowngradeHistory: {
            history: [
              { firm: "Acme", currentPriceTarget: 200, epochGradeDate: "2024-01-01", action: "up" },
              { firm: "Acme", currentPriceTarget: 250, epochGradeDate: "2024-06-01", action: "up" },
              { firm: "Beta", currentPriceTarget: 180, epochGradeDate: "2024-03-01", action: "hold" },
            ],
          },
        },
      }),
    );
    expect(out.analystHistory).toHaveLength(2);
    const acme = out.analystHistory!.find((a) => a.firm === "Acme");
    expect(acme?.target).toBe(250);
  });

  it("sorts analyst targets newest first", () => {
    const out = buildStockPayload(
      baseInput({
        quoteSummary: {
          upgradeDowngradeHistory: {
            history: [
              { firm: "Old", currentPriceTarget: 100, epochGradeDate: "2023-01-01", action: "x" },
              { firm: "New", currentPriceTarget: 300, epochGradeDate: "2024-09-01", action: "y" },
            ],
          },
        },
      }),
    );
    expect(out.analystHistory![0].firm).toBe("New");
  });

  it("takes the most recent recommendation trend row", () => {
    const out = buildStockPayload(
      baseInput({
        quoteSummary: {
          recommendationTrend: {
            trend: [
              { period: "0m", strongBuy: 10, buy: 5, hold: 2, sell: 1, strongSell: 0 },
              { period: "-1m", strongBuy: 1, buy: 1, hold: 1, sell: 1, strongSell: 1 },
            ],
          },
        },
      }),
    );
    expect(out.recommendationTrend?.strongBuy).toBe(10);
  });

  it("joins quarterly revenue to EPS by calendar quarter", () => {
    const out = buildStockPayload(
      baseInput({
        quoteSummary: {
          earningsHistory: {
            history: [{ quarter: "2024-03-31", epsActual: 1.5 }],
          },
          incomeStatementHistoryQuarterly: {
            incomeStatementHistory: [
              { endDate: "2024-03-31", totalRevenue: 90_000_000_000 },
            ],
          },
        },
      }),
    );
    const q = out.financials?.financialsChart.quarterly[0];
    expect(q?.date).toBe("2024 Q1");
    expect(q?.revenue.raw).toBe(90_000_000_000);
    expect(q?.earnings.raw).toBe(1.5);
  });

  it("survives a quoteSummary that is entirely absent", () => {
    // ETFs and many foreign listings return almost nothing here.
    const out = buildStockPayload(baseInput({ quoteSummary: null }));
    expect(out.analystHistory).toEqual([]);
    expect(out.recommendationTrend).toBeNull();
    expect(out.priceTargets).toBeNull();
    expect(out.financials).toBeUndefined();
    expect(out.smartMoneyFlow?.insiderTransactions).toEqual([]);
    expect(out.earningsGrowth?.history).toEqual([]);
  });

  it("caps insider transactions at ten", () => {
    const transactions = Array.from({ length: 25 }, (_, i) => ({
      shares: i,
      value: i * 10,
      startDate: "2024-01-01",
      insiderName: `Person ${i}`,
    }));
    const out = buildStockPayload(
      baseInput({ quoteSummary: { insiderTransactions: { transactions } } }),
    );
    expect(out.smartMoneyFlow?.insiderTransactions).toHaveLength(10);
  });

  it("computes buyback yield against market cap", () => {
    const out = buildStockPayload(
      baseInput({
        quoteSummary: {
          summaryDetail: { marketCap: 1_000_000 },
          defaultKeyStatistics: {},
        },
        cashFlowSeries: [
          { date: "2024-01-01", repurchaseOfCapitalStock: -100_000 },
        ],
      }),
    );
    expect(out.shareholderYield?.annualBuybacks).toBe(100_000);
    expect(out.shareholderYield?.buybackYield).toBeCloseTo(0.1, 6);
  });

  it("returns no shareholder yield without a market cap", () => {
    const out = buildStockPayload(baseInput({ quoteSummary: {} }));
    expect(out.shareholderYield).toBeUndefined();
  });

  it("guards margin ratios against a zero revenue divisor", () => {
    const out = buildStockPayload(
      baseInput({
        quoteSummary: {
          incomeStatementHistory: {
            incomeStatementHistory: [
              { endDate: "2024-01-01", totalRevenue: 0, grossProfit: 5, netIncome: 2, ebit: 3 },
            ],
          },
        },
      }),
    );
    const margin = out.earningsGrowth!.margins[0];
    expect(Number.isFinite(margin.grossMargin)).toBe(true);
    expect(margin.grossMargin).toBe(0);
  });
});
