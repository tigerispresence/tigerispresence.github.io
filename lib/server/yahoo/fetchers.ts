import { yahooFinance } from "./client";
import type {
  QuoteSummaryBundle,
  YahooFundamentalsRow,
  YahooHistoryRow,
  YahooOptionsResult,
  YahooQuote,
  YahooSearchQuote,
} from "./types";

/**
 * Thin wrappers around yahoo-finance2.
 *
 * Each fetcher owns exactly one upstream call, returns a narrowed type, and
 * swallows its own failure by returning an empty/null value. That is
 * deliberate: the stock payload is assembled from ~8 independent calls, and a
 * missing options chain should cost one panel, not the whole response.
 *
 * These are the seams Phase 4 wraps with "use cache", which is why the caching
 * decision lives outside this file.
 */

/** yahoo-finance2's types don't narrow by module list; cast once, here. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const yf = yahooFinance as any;

const QUOTE_SUMMARY_MODULES = [
  "financialData",
  "upgradeDowngradeHistory",
  "earningsHistory",
  "incomeStatementHistoryQuarterly",
  "recommendationTrend",
  "defaultKeyStatistics",
  "summaryDetail",
  "insiderTransactions",
  "majorHoldersBreakdown",
  "cashflowStatementHistory",
  "earningsTrend",
  "incomeStatementHistory",
  // Required by the Piotroski F-Score, which needs two years of balance sheet
  // data to compute the leverage, liquidity and share-issuance signals.
  "balanceSheetHistory",
] as const;

export async function getQuote(symbol: string): Promise<YahooQuote | null> {
  try {
    return (await yf.quote(symbol)) as YahooQuote;
  } catch (e) {
    console.warn(`[yahoo] quote failed for ${symbol}:`, e);
    return null;
  }
}

export async function getQuoteSummary(
  symbol: string,
): Promise<QuoteSummaryBundle | null> {
  try {
    return (await yf.quoteSummary(symbol, {
      modules: [...QUOTE_SUMMARY_MODULES],
    })) as QuoteSummaryBundle;
  } catch (e) {
    console.warn(`[yahoo] quoteSummary failed for ${symbol}:`, e);
    return null;
  }
}

export async function getDailyHistory(
  symbol: string,
  period1: Date,
  period2: Date,
): Promise<YahooHistoryRow[]> {
  try {
    return (await yf.historical(
      symbol,
      { period1, period2, interval: "1d" },
      { validateResult: false },
    )) as YahooHistoryRow[];
  } catch (e) {
    console.warn(`[yahoo] daily history failed for ${symbol}:`, e);
    return [];
  }
}

export async function getDividendHistory(
  symbol: string,
  period1: Date,
  period2: Date,
): Promise<YahooHistoryRow[]> {
  try {
    return (await yf.historical(
      symbol,
      { period1, period2, interval: "1d", events: "dividends" },
      { validateResult: false },
    )) as YahooHistoryRow[];
  } catch (e) {
    console.warn(`[yahoo] dividend history failed for ${symbol}:`, e);
    return [];
  }
}

/** Ten years of monthly closes, for the seasonality heatmap. */
export async function getMonthlyHistory(
  symbol: string,
  years = 10,
): Promise<YahooHistoryRow[]> {
  try {
    const period1 = new Date();
    period1.setFullYear(period1.getFullYear() - years);
    return (await yf.historical(
      symbol,
      { period1, period2: new Date(), interval: "1mo" },
      { validateResult: false },
    )) as YahooHistoryRow[];
  } catch (e) {
    console.warn(`[yahoo] monthly history failed for ${symbol}:`, e);
    return [];
  }
}

export async function getOptions(
  symbol: string,
): Promise<YahooOptionsResult | null> {
  try {
    return (await yf.options(symbol)) as YahooOptionsResult;
  } catch (e) {
    console.warn(`[yahoo] options failed for ${symbol}:`, e);
    return null;
  }
}

/** Annual cash-flow time series, used for the buyback yield. */
export async function getCashFlowTimeSeries(
  symbol: string,
  years = 3,
): Promise<YahooFundamentalsRow[]> {
  try {
    const period1 = new Date();
    period1.setFullYear(period1.getFullYear() - years);
    return (await yf.fundamentalsTimeSeries(
      symbol,
      { period1, type: "annual", module: "cash-flow" },
      { validateResult: false },
    )) as YahooFundamentalsRow[];
  } catch (e) {
    console.warn(`[yahoo] cash-flow series failed for ${symbol}:`, e);
    return [];
  }
}

export interface SearchOptions {
  quotesCount?: number;
  newsCount?: number;
  region?: string;
  lang?: string;
}

export async function searchSymbols(
  query: string,
  options: SearchOptions = {},
): Promise<YahooSearchQuote[]> {
  try {
    const result = await yf.search(query, { newsCount: 0, ...options });
    return (result?.quotes ?? []) as YahooSearchQuote[];
  } catch (e) {
    console.warn(`[yahoo] search failed for "${query}":`, e);
    return [];
  }
}
