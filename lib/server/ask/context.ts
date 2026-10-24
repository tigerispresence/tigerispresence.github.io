import { allReturns } from "@/lib/calc/sectors";
import { MACRO_REGIMES, type SectorMacroData } from "@/lib/types/macro";
import type { SectorData } from "@/lib/types/sectors";
import type { PricePoint, StockData } from "@/lib/types/stock";

/**
 * Compact, model-facing summaries of what the app shows.
 *
 * Built on the server from cached data rather than accepted from the client,
 * so a question cannot smuggle in fabricated "data", and so the prompt holds
 * a few kilobytes of figures instead of a year of raw price history.
 */

/** Four significant figures: enough for analysis, short enough for a prompt. */
const round = (n: number | null | undefined): number | null =>
  n == null || !Number.isFinite(n) ? null : Number(n.toPrecision(4));

const pct = (fraction: number | null | undefined): string | null =>
  fraction == null || !Number.isFinite(fraction) ? null : `${(fraction * 100).toFixed(2)}%`;

function sma(points: PricePoint[], length: number): number | null {
  if (points.length < length) return null;
  return points.slice(-length).reduce((sum, p) => sum + p.close, 0) / length;
}

function macroBackdrop(macro: SectorMacroData | null) {
  if (!macro) return null;
  const { snapshot: s, regime } = macro;
  return {
    regime: regime ? `inflation ${regime.inflation}, 10-year yield ${regime.rates} (3-month trends)` : null,
    cpiYoY: s.cpi && { value: pct(s.cpi.value), threeMonthsAgo: pct(s.cpi.previous), month: s.cpi.date },
    coreCpiYoY: s.coreCpi && { value: pct(s.coreCpi.value), threeMonthsAgo: pct(s.coreCpi.previous), month: s.coreCpi.date },
    tenYearYield: s.ten && { value: `${s.ten.value}%`, threeMonthsAgo: s.ten.previous != null ? `${s.ten.previous}%` : null, date: s.ten.date },
    twoYearYield: s.two && { value: `${s.two.value}%`, date: s.two.date },
    tenYearRealYield: s.real && { value: `${s.real.value}%`, date: s.real.date },
  };
}

export function stockContext(data: StockData, macro: SectorMacroData | null) {
  const history = data.history;
  const last = history.at(-1);
  const sma50 = sma(history, 50);
  const sma200 = sma(history, 200);
  const high = data.riskMetrics?.fiftyTwoWeekHigh;

  return {
    asOf: last?.date ?? null,
    symbol: data.symbol,
    name: data.name,
    currency: data.currency,
    price: round(data.currentPrice),
    dayChange: pct(data.changePercent / 100),
    returns: Object.fromEntries(Object.entries(allReturns(history)).map(([k, v]) => [k, pct(v)])),
    trend: {
      sma50: round(sma50),
      sma200: round(sma200),
      priceVsSma50: sma50 ? pct(data.currentPrice / sma50 - 1) : null,
      priceVsSma200: sma200 ? pct(data.currentPrice / sma200 - 1) : null,
      fiftyTwoWeekHigh: round(high),
      fiftyTwoWeekLow: round(data.riskMetrics?.fiftyTwoWeekLow),
      offHigh: high ? pct(data.currentPrice / high - 1) : null,
    },
    valuation: {
      marketCap: round(data.riskMetrics?.marketCap),
      beta: round(data.riskMetrics?.beta),
      trailingPE: round(data.trailingPE),
      forwardPE: round(data.forwardPE),
      dividendYieldPercent: round(data.dividendYield),
      shareholderYield: data.shareholderYield && {
        total: pct(data.shareholderYield.totalYield),
        buyback: pct(data.shareholderYield.buybackYield),
        payoutRatio: pct(data.shareholderYield.payoutRatio),
      },
    },
    analysts: {
      targets: data.priceTargets ?? null,
      recommendations: data.recommendationTrend ?? null,
      recentActions: (data.analystHistory ?? []).slice(0, 5),
    },
    earnings: data.earningsGrowth && {
      lastFourQuarters: data.earningsGrowth.history.slice(-4).map((q) => ({
        quarter: q.quarter,
        actual: round(q.actual),
        estimate: round(q.estimate),
        surprisePercent: round(q.surprisePercent),
      })),
      estimates: data.earningsGrowth.trend.map((t) => ({
        period: t.period,
        growth: pct(t.growth),
      })),
      latestMargins: data.earningsGrowth.margins.at(-1) ?? null,
    },
    quarterlyFinancials: data.financials?.financialsChart.quarterly.slice(-4).map((q) => ({
      date: q.date,
      revenue: q.revenue.fmt,
      earnings: q.earnings.fmt,
    })),
    risk: {
      altmanZ: round(data.riskScores?.altmanZScore),
      piotroskiF: data.riskScores?.piotroskiFScore ?? null,
      shortPercentOfFloat: pct(data.smartMoneyFlow?.shortInterest.shortPercentOfFloat),
      shortRatioDays: round(data.smartMoneyFlow?.shortInterest.shortRatio),
      institutionOwnership: pct(data.smartMoneyFlow?.ownership.institutionPercent),
      insiderOwnership: pct(data.smartMoneyFlow?.ownership.insiderPercent),
      recentInsiderTransactions: (data.smartMoneyFlow?.insiderTransactions ?? []).slice(0, 5).map((t) => ({
        date: t.date,
        who: `${t.insiderName} (${t.insiderTitle})`,
        what: t.text,
        value: round(t.value),
      })),
    },
    options: data.maxPain ?? null,
    fearAndGreed: data.fearGreedHistory?.at(-1) ?? null,
    macro: macroBackdrop(macro),
  };
}

export function sectorsContext(sectors: SectorData | null, macro: SectorMacroData | null) {
  const regime = macro?.regime?.key ?? null;
  const macroBySymbol = new Map(macro?.sectors.map((s) => [s.symbol, s]) ?? []);

  return {
    asOf: sectors?.asOf ?? null,
    benchmark: sectors && {
      symbol: sectors.benchmark.symbol,
      returns: Object.fromEntries(Object.entries(sectors.benchmark.returns).map(([k, v]) => [k, pct(v)])),
    },
    sectors: (sectors?.sectors ?? macro?.sectors ?? []).map((s) => {
      const momentum = sectors?.sectors.find((x) => x.symbol === s.symbol);
      const m = macroBySymbol.get(s.symbol);
      return {
        symbol: s.symbol,
        name: s.name,
        returns: momentum && Object.fromEntries(Object.entries(momentum.returns).map(([k, v]) => [k, pct(v)])),
        vsSpy1M: pct(momentum?.relative["1M"]),
        vsSpy3M: pct(momentum?.relative["3M"]),
        aboveSma50: momentum?.aboveSma50 ?? null,
        aboveSma200: momentum?.aboveSma200 ?? null,
        rotationQuadrant: momentum?.quadrant ?? null,
        excessReturnPerPlus1ppTenYear: m?.rateBeta != null ? pct(m.rateBeta) : null,
        rateCorrelation: round(m?.rateR),
        // Average monthly return vs SPY in each inflation/yield regime since 2000,
        // with the t-statistic: |t| < 2 is within normal noise.
        regimes: m && Object.fromEntries(
          MACRO_REGIMES.map((r) => {
            const st = m.regimes[r];
            return [r, st && { avgMonthlyExcess: pct(st.avgExcess), hitRate: pct(st.hitRate), months: st.months, t: round(st.tStat) }];
          }),
        ),
      };
    }),
    currentRegime: regime,
    regimeKey: "keys are inflation-yields, e.g. rising-falling = inflation rising, 10-year yield falling",
    macro: macroBackdrop(macro),
  };
}
