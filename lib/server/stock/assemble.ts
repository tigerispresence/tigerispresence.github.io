import type {
  Dividend,
  FearGreedPoint,
  PricePoint,
  StockData,
} from "@/lib/types/stock";
import { computeMaxPain } from "@/lib/calc/maxPain";
import type {
  QuoteSummaryBundle,
  YahooFundamentalsRow,
  YahooOptionChain,
  YahooQuote,
} from "@/lib/server/yahoo/types";
import { mapAnalystHistory, mapRecommendationTrend } from "./map/analysts";
import { mapQuarterlyFinancials } from "./map/financials";
import {
  mapEarningsGrowth,
  mapShareholderYield,
  mapSmartMoneyFlow,
} from "./map/portfolio";

/** Everything the assembler needs, already fetched. No I/O happens in here. */
export interface AssembleInput {
  resolved: { symbol: string; name: string };
  quote: YahooQuote | null;
  quoteSummary: QuoteSummaryBundle | null;
  /** Already normalized to ISO dates by the cache layer. */
  history: PricePoint[];
  dividends: Dividend[];
  seasonality: PricePoint[];
  cashFlowSeries: YahooFundamentalsRow[];
  optionChain: YahooOptionChain | null;
  fearGreedHistory: FearGreedPoint[] | null;
  /** Deterministically computed; omitted when the statements are too sparse. */
  riskScores?: {
    altmanZScore?: number;
    piotroskiFScore?: number;
    riskSummary?: string;
  };
}

/**
 * Trailing twelve month dividend yield, as a percent.
 *
 * Only used when Yahoo's quote omits `dividendYield`, which is common for
 * non-US listings. Guarded on a positive price: a failed quote used to leave
 * `regularMarketPrice` at 0 here and produce Infinity.
 */
function trailingYieldPercent(
  dividends: Dividend[],
  price: number | undefined,
): number | undefined {
  if (!price || price <= 0 || dividends.length === 0) return undefined;

  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const lastYear = dividends
    .filter((d) => new Date(d.date) >= oneYearAgo)
    .reduce((sum, d) => sum + d.amount, 0);

  if (lastYear <= 0) return undefined;
  return (lastYear / price) * 100;
}

/**
 * Build the `/api/stock` payload from already-fetched upstream data.
 *
 * Pure: same inputs always produce the same output, so it can be exercised
 * against committed fixtures without touching the network.
 */
export function buildStockPayload(input: AssembleInput): StockData {
  const {
    resolved,
    quote,
    quoteSummary,
    history,
    dividends,
    seasonality,
    cashFlowSeries,
    optionChain,
    fearGreedHistory,
    riskScores,
  } = input;

  const stats = quoteSummary?.defaultKeyStatistics;
  const summary = quoteSummary?.summaryDetail;
  const currency = quote?.currency ?? "USD";

  const dividendYield =
    quote?.dividendYield ?? trailingYieldPercent(dividends, quote?.regularMarketPrice);

  const maxPainStrike = optionChain
    ? computeMaxPain(optionChain.calls, optionChain.puts)
    : null;

  return {
    symbol: quote?.symbol ?? resolved.symbol,
    name: quote?.shortName ?? quote?.longName ?? resolved.name,
    currentPrice: quote?.regularMarketPrice ?? 0,
    currency,
    change: quote?.regularMarketChange ?? 0,
    changePercent: quote?.regularMarketChangePercent ?? 0,
    trailingPE: quote?.trailingPE,
    forwardPE: quote?.forwardPE,
    dividendYield,

    riskScores,

    priceTargets: quoteSummary?.financialData
      ? {
          low: quoteSummary.financialData.targetLowPrice ?? 0,
          high: quoteSummary.financialData.targetHighPrice ?? 0,
          mean: quoteSummary.financialData.targetMeanPrice ?? 0,
          median: quoteSummary.financialData.targetMedianPrice ?? 0,
          numberOfAnalysts:
            quoteSummary.financialData.numberOfAnalystOpinions ?? 0,
        }
      : null,
    analystHistory: mapAnalystHistory(quoteSummary?.upgradeDowngradeHistory?.history),
    recommendationTrend: mapRecommendationTrend(quoteSummary?.recommendationTrend?.trend),

    history,
    dividends,
    seasonality,

    financials:
      mapQuarterlyFinancials(
        quoteSummary?.earningsHistory?.history,
        quoteSummary?.incomeStatementHistoryQuarterly?.incomeStatementHistory,
        currency,
      ) ?? undefined,

    maxPain:
      maxPainStrike !== null && optionChain
        ? {
            price: maxPainStrike,
            expirationDate: new Date(optionChain.expirationDate).toISOString(),
          }
        : null,

    riskMetrics: {
      beta: stats?.beta,
      fiftyTwoWeekHigh: summary?.fiftyTwoWeekHigh ?? quote?.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: summary?.fiftyTwoWeekLow ?? quote?.fiftyTwoWeekLow,
      marketCap: summary?.marketCap ?? stats?.marketCap ?? quote?.marketCap,
    },

    shareholderYield:
      mapShareholderYield(
        quote ?? {},
        stats,
        summary,
        cashFlowSeries,
        quoteSummary?.cashflowStatementHistory?.cashflowStatements,
      ) ?? undefined,

    smartMoneyFlow: mapSmartMoneyFlow(
      quoteSummary?.insiderTransactions?.transactions,
      stats,
    ),

    fearGreedHistory: fearGreedHistory ?? null,

    earningsGrowth: mapEarningsGrowth(
      quoteSummary?.earningsHistory?.history,
      quoteSummary?.earningsTrend?.trend,
      quoteSummary?.incomeStatementHistory?.incomeStatementHistory,
    ),
  };
}
