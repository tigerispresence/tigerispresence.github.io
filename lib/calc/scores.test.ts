import { describe, expect, it } from "vitest";
import { altmanZScore, piotroskiFScore, type FinancialYear } from "./scores";

describe("altmanZScore", () => {
  it("matches a hand-computed worked example", () => {
    // Chosen so every term is exact:
    //   WC/TA  = (500-200)/1000 = 0.3   -> 1.2 * 0.3 = 0.36
    //   RE/TA  = 200/1000       = 0.2   -> 1.4 * 0.2 = 0.28
    //   EBIT/TA= 100/1000       = 0.1   -> 3.3 * 0.1 = 0.33
    //   MVE/TL = 800/400        = 2.0   -> 0.6 * 2.0 = 1.20
    //   S/TA   = 900/1000       = 0.9   -> 1.0 * 0.9 = 0.90
    //   total  = 3.07
    const z = altmanZScore({
      totalAssets: 1000,
      totalLiabilities: 400,
      totalCurrentAssets: 500,
      totalCurrentLiabilities: 200,
      retainedEarnings: 200,
      ebit: 100,
      totalRevenue: 900,
      marketCap: 800,
    });
    expect(z).toBeCloseTo(3.07, 10);
  });

  it("places a healthy company in the safe zone", () => {
    const z = altmanZScore({
      totalAssets: 1000,
      totalLiabilities: 200,
      totalCurrentAssets: 600,
      totalCurrentLiabilities: 100,
      retainedEarnings: 400,
      ebit: 200,
      totalRevenue: 1200,
      marketCap: 3000,
    })!;
    expect(z).toBeGreaterThan(2.99);
  });

  it("places a distressed company in the distress zone", () => {
    const z = altmanZScore({
      totalAssets: 1000,
      totalLiabilities: 950,
      totalCurrentAssets: 100,
      totalCurrentLiabilities: 400,
      retainedEarnings: -300,
      ebit: -50,
      totalRevenue: 200,
      marketCap: 100,
    })!;
    expect(z).toBeLessThan(1.81);
  });

  it("handles negative working capital", () => {
    const z = altmanZScore({
      totalAssets: 1000,
      totalLiabilities: 400,
      totalCurrentAssets: 100,
      totalCurrentLiabilities: 300,
      retainedEarnings: 200,
      ebit: 100,
      totalRevenue: 900,
      marketCap: 800,
    })!;
    // Only the working-capital term changes: (100-300)/1000 = -0.2 -> -0.24
    expect(z).toBeCloseTo(3.07 - 0.36 - 0.24, 10);
  });

  it("returns null rather than guessing when inputs are missing", () => {
    expect(altmanZScore({})).toBeNull();
    expect(altmanZScore({ totalAssets: 1000 })).toBeNull();
    // Market cap is genuinely unavailable for many listings.
    expect(
      altmanZScore({
        totalAssets: 1000,
        totalLiabilities: 400,
        totalCurrentAssets: 500,
        totalCurrentLiabilities: 200,
        retainedEarnings: 200,
        ebit: 100,
        totalRevenue: 900,
      }),
    ).toBeNull();
  });

  it("returns null for a zero or negative asset base", () => {
    const base = {
      totalLiabilities: 400,
      totalCurrentAssets: 500,
      totalCurrentLiabilities: 200,
      retainedEarnings: 200,
      ebit: 100,
      totalRevenue: 900,
      marketCap: 800,
    };
    expect(altmanZScore({ ...base, totalAssets: 0 })).toBeNull();
    expect(altmanZScore({ ...base, totalAssets: -5 })).toBeNull();
  });
});

describe("piotroskiFScore", () => {
  /** A year that passes all nine tests when compared against `worse`. */
  const better: FinancialYear = {
    totalAssets: 1000,
    totalCurrentAssets: 600,
    totalCurrentLiabilities: 200,
    longTermDebt: 100,
    netIncome: 120,
    operatingCashFlow: 200,
    totalRevenue: 900,
    grossProfit: 450,
    sharesOutstanding: 100,
  };

  const worse: FinancialYear = {
    totalAssets: 1000,
    totalCurrentAssets: 400,
    totalCurrentLiabilities: 300,
    longTermDebt: 200,
    netIncome: 80,
    operatingCashFlow: 90,
    totalRevenue: 700,
    grossProfit: 280,
    sharesOutstanding: 100,
  };

  it("awards a perfect nine when every signal improves", () => {
    const result = piotroskiFScore(better, worse)!;
    expect(result.score).toBe(9);
    expect(Object.values(result.signals).every(Boolean)).toBe(true);
  });

  it("drops the trend signals when the year deteriorates", () => {
    const result = piotroskiFScore(worse, better)!;
    // The four level-based signals still hold in the worse year: it remains
    // profitable (80), cash generative (90), has cash flow above net income
    // (90 > 80), and issued no shares. All five year-over-year comparisons
    // fail, so the score is 4.
    expect(result.score).toBe(4);
    expect(result.signals.positiveNetIncome).toBe(true);
    expect(result.signals.positiveOperatingCashFlow).toBe(true);
    expect(result.signals.cashFlowExceedsNetIncome).toBe(true);
    expect(result.signals.noNewShares).toBe(true);

    expect(result.signals.improvingRoa).toBe(false);
    expect(result.signals.decreasingLeverage).toBe(false);
    expect(result.signals.improvingCurrentRatio).toBe(false);
    expect(result.signals.improvingGrossMargin).toBe(false);
    expect(result.signals.improvingAssetTurnover).toBe(false);
  });

  it("flags a loss-making year", () => {
    const result = piotroskiFScore(
      { ...better, netIncome: -50, operatingCashFlow: -10 },
      worse,
    )!;
    expect(result.signals.positiveNetIncome).toBe(false);
    expect(result.signals.positiveOperatingCashFlow).toBe(false);
  });

  it("detects share issuance", () => {
    const result = piotroskiFScore(
      { ...better, sharesOutstanding: 150 },
      worse,
    )!;
    expect(result.signals.noNewShares).toBe(false);
  });

  it("rewards cash flow exceeding net income", () => {
    const result = piotroskiFScore(better, worse)!;
    expect(result.signals.cashFlowExceedsNetIncome).toBe(true);

    const accrualHeavy = piotroskiFScore(
      { ...better, operatingCashFlow: 50 },
      worse,
    )!;
    expect(accrualHeavy.signals.cashFlowExceedsNetIncome).toBe(false);
  });

  it("returns null rather than a misleadingly low score when data is sparse", () => {
    // A company with only an asset figure would otherwise score 0/9 and be
    // rendered as financially distressed.
    expect(
      piotroskiFScore({ totalAssets: 1000 }, { totalAssets: 900 }),
    ).toBeNull();
  });

  it("returns null without a usable asset base in either year", () => {
    expect(piotroskiFScore(better, { ...worse, totalAssets: 0 })).toBeNull();
    expect(piotroskiFScore({ ...better, totalAssets: undefined }, worse)).toBeNull();
  });

  it("omits signals it cannot evaluate", () => {
    const result = piotroskiFScore(
      { ...better, sharesOutstanding: undefined },
      { ...worse, sharesOutstanding: undefined },
    )!;
    expect(result).not.toBeNull();
    expect(result.signals).not.toHaveProperty("noNewShares");
    expect(result.score).toBe(8);
  });
});
