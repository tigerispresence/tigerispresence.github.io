import type { FearGreedPoint, StockData } from "@/lib/types/stock";
import { computeMaxPain } from "@/lib/calc/maxPain";
import type {
  QuoteSummaryBundle,
  YahooFundamentalsRow,
  YahooHistoryRow,
  YahooOptionsResult,
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
  history: YahooHistoryRow[];
  dividends: YahooHistoryRow[];
  seasonality: YahooHistoryRow[];
  cashFlowSeries: YahooFundamentalsRow[];
  options: YahooOptionsResult | null;
  fearGreedHistory: FearGreedPoint[] | null;
  /** Optional AI-derived extras; omitted entirely when unavailable. */
  aiMetrics?: {
    trailingPE?: number | null;
    forwardPE?: number | null;
    dividendYield?: number | null;
    altmanZScore?: number;
    piotroskiFScore?: number;
    riskSummary?: string;
  } | null;
}

const toClosePoints = (rows: YahooHistoryRow[]) =>
  rows
    .filter((row) => row.close !== null && row.close !== undefined)
    .map((row) => ({
      date: new Date(row.date).toISOString(),
      close: row.close as number,
    }));

/**
 * Trailing twelve month dividend yield, as a percent.
 *
 * Only used when Yahoo's quote omits `dividendYield`, which is common for
 * non-US listings. Guarded on a positive price: a failed quote used to leave
 * `regularMarketPrice` at 0 here and produce Infinity.
 */
function trailingYieldPercent(
  dividends: YahooHistoryRow[],
  price: number | undefined,
): number | undefined {
  if (!price || price <= 0 || dividends.length === 0) return undefined;

  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const lastYear = dividends
    .filter((d) => new Date(d.date) >= oneYearAgo)
    .reduce((sum, d) => sum + (d.dividends ?? 0), 0);

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
    options,
    fearGreedHistory,
    aiMetrics,
  } = input;

  const stats = quoteSummary?.defaultKeyStatistics;
  const summary = quoteSummary?.summaryDetail;
  const currency = quote?.currency ?? "USD";

  const dividendYield =
    quote?.dividendYield ?? trailingYieldPercent(dividends, quote?.regularMarketPrice);

  const chain = options?.options?.[0];
  const maxPainStrike = chain ? computeMaxPain(chain.calls, chain.puts) : null;

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

    geminiMetrics: aiMetrics
      ? {
          trailingPE: aiMetrics.trailingPE ?? null,
          forwardPE: aiMetrics.forwardPE ?? null,
          dividendYield: aiMetrics.dividendYield ?? null,
        }
      : undefined,
    geminiRiskMetrics: aiMetrics
      ? {
          altmanZScore: aiMetrics.altmanZScore,
          piotroskiFScore: aiMetrics.piotroskiFScore,
          riskSummary: aiMetrics.riskSummary,
        }
      : undefined,

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

    history: toClosePoints(history),
    dividends: dividends.map((d) => ({
      date: new Date(d.date).toISOString(),
      amount: d.dividends ?? 0,
    })),
    seasonality: toClosePoints(seasonality),

    financials:
      mapQuarterlyFinancials(
        quoteSummary?.earningsHistory?.history,
        quoteSummary?.incomeStatementHistoryQuarterly?.incomeStatementHistory,
        currency,
      ) ?? undefined,

    maxPain:
      maxPainStrike !== null && chain
        ? {
            price: maxPainStrike,
            expirationDate: new Date(chain.expirationDate).toISOString(),
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
