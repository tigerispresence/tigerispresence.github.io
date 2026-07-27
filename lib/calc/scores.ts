/**
 * Financial health scores.
 *
 * Both are closed-form formulas over figures Yahoo already returns in the
 * quoteSummary payload. They were previously produced by asking a language
 * model to recall them, which is slower, costs money, cannot be verified, and
 * fed an unciteable number into a risk badge that reads as authoritative.
 *
 * Every input is optional because Yahoo omits statements for many symbols;
 * each function returns null rather than a partial score when it cannot be
 * computed honestly.
 */

export interface AltmanInputs {
  totalAssets?: number;
  totalLiabilities?: number;
  totalCurrentAssets?: number;
  totalCurrentLiabilities?: number;
  retainedEarnings?: number;
  ebit?: number;
  totalRevenue?: number;
  marketCap?: number;
}

const isNum = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

/**
 * Altman Z-Score for public manufacturers:
 *
 *   Z = 1.2·(WC/TA) + 1.4·(RE/TA) + 3.3·(EBIT/TA) + 0.6·(MVE/TL) + 1.0·(S/TA)
 *
 * Conventional reading: > 2.99 safe, 1.81–2.99 grey, < 1.81 distress.
 */
export function altmanZScore(i: AltmanInputs): number | null {
  const {
    totalAssets,
    totalLiabilities,
    totalCurrentAssets,
    totalCurrentLiabilities,
    retainedEarnings,
    ebit,
    totalRevenue,
    marketCap,
  } = i;

  // Total assets is the denominator of four of the five terms.
  if (!isNum(totalAssets) || totalAssets <= 0) return null;
  if (!isNum(totalLiabilities) || totalLiabilities <= 0) return null;
  if (
    !isNum(totalCurrentAssets) ||
    !isNum(totalCurrentLiabilities) ||
    !isNum(retainedEarnings) ||
    !isNum(ebit) ||
    !isNum(totalRevenue) ||
    !isNum(marketCap)
  ) {
    return null;
  }

  const workingCapital = totalCurrentAssets - totalCurrentLiabilities;

  const z =
    1.2 * (workingCapital / totalAssets) +
    1.4 * (retainedEarnings / totalAssets) +
    3.3 * (ebit / totalAssets) +
    0.6 * (marketCap / totalLiabilities) +
    1.0 * (totalRevenue / totalAssets);

  return Number.isFinite(z) ? z : null;
}

export interface FinancialYear {
  totalAssets?: number;
  totalCurrentAssets?: number;
  totalCurrentLiabilities?: number;
  longTermDebt?: number;
  netIncome?: number;
  operatingCashFlow?: number;
  totalRevenue?: number;
  grossProfit?: number;
  sharesOutstanding?: number;
}

export interface PiotroskiBreakdown {
  score: number;
  signals: Record<string, boolean>;
}

/**
 * Piotroski F-Score: nine binary tests across profitability, leverage and
 * efficiency, comparing the latest fiscal year against the prior one.
 *
 * Returns null when either year is too sparse to judge, rather than reporting
 * a low score that merely reflects missing data — a false "distress" signal is
 * worse than no signal.
 */
export function piotroskiFScore(
  current: FinancialYear,
  previous: FinancialYear,
): PiotroskiBreakdown | null {
  const curAssets = current.totalAssets;
  const prevAssets = previous.totalAssets;
  if (!isNum(curAssets) || curAssets <= 0) return null;
  if (!isNum(prevAssets) || prevAssets <= 0) return null;

  const ratio = (n?: number, d?: number) =>
    isNum(n) && isNum(d) && d !== 0 ? n / d : undefined;

  const roaCur = ratio(current.netIncome, curAssets);
  const roaPrev = ratio(previous.netIncome, prevAssets);

  const currentRatioCur = ratio(
    current.totalCurrentAssets,
    current.totalCurrentLiabilities,
  );
  const currentRatioPrev = ratio(
    previous.totalCurrentAssets,
    previous.totalCurrentLiabilities,
  );

  const leverageCur = ratio(current.longTermDebt, curAssets);
  const leveragePrev = ratio(previous.longTermDebt, prevAssets);

  const grossMarginCur = ratio(current.grossProfit, current.totalRevenue);
  const grossMarginPrev = ratio(previous.grossProfit, previous.totalRevenue);

  const turnoverCur = ratio(current.totalRevenue, curAssets);
  const turnoverPrev = ratio(previous.totalRevenue, prevAssets);

  const signals: Record<string, boolean | undefined> = {
    // Profitability
    positiveNetIncome: isNum(current.netIncome) ? current.netIncome > 0 : undefined,
    positiveOperatingCashFlow: isNum(current.operatingCashFlow)
      ? current.operatingCashFlow > 0
      : undefined,
    improvingRoa:
      roaCur !== undefined && roaPrev !== undefined ? roaCur > roaPrev : undefined,
    // Accruals: cash earnings should exceed accounting earnings.
    cashFlowExceedsNetIncome:
      isNum(current.operatingCashFlow) && isNum(current.netIncome)
        ? current.operatingCashFlow > current.netIncome
        : undefined,
    // Leverage, liquidity and share issuance
    decreasingLeverage:
      leverageCur !== undefined && leveragePrev !== undefined
        ? leverageCur < leveragePrev
        : undefined,
    improvingCurrentRatio:
      currentRatioCur !== undefined && currentRatioPrev !== undefined
        ? currentRatioCur > currentRatioPrev
        : undefined,
    noNewShares:
      isNum(current.sharesOutstanding) && isNum(previous.sharesOutstanding)
        ? current.sharesOutstanding <= previous.sharesOutstanding
        : undefined,
    // Operating efficiency
    improvingGrossMargin:
      grossMarginCur !== undefined && grossMarginPrev !== undefined
        ? grossMarginCur > grossMarginPrev
        : undefined,
    improvingAssetTurnover:
      turnoverCur !== undefined && turnoverPrev !== undefined
        ? turnoverCur > turnoverPrev
        : undefined,
  };

  const known = Object.values(signals).filter((v) => v !== undefined);
  // Fewer than two thirds of the signals available means the score would say
  // more about Yahoo's coverage than about the company.
  if (known.length < 6) return null;

  const resolved: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(signals)) {
    if (value !== undefined) resolved[key] = value;
  }

  return {
    score: known.filter(Boolean).length,
    signals: resolved,
  };
}
