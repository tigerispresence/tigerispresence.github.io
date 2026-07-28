import { yahooFinance } from "./client";
import { MIN_MEANINGFUL_OPEN_INTEREST } from "@/lib/calc/maxPain";
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

/**
 * Skip yahoo-finance2's response schema validation.
 *
 * Yahoo changes its payloads faster than the library's schemas track them, and
 * a drifted field currently makes `search` throw outright rather than return
 * partial data. That failure was silent: every symbol lookup fell through to
 * the AI fallback, so the app appeared to work while paying for a model call
 * on a request Yahoo could answer. The historical() calls already used this
 * escape hatch; it is now applied consistently.
 */
const VALIDATION_OFF = { validateResult: false } as const;

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
    return (await yf.quote(symbol, {}, VALIDATION_OFF)) as YahooQuote;
  } catch (e) {
    console.warn(`[yahoo] quote failed for ${symbol}:`, e);
    return null;
  }
}

export async function getQuoteSummary(
  symbol: string,
): Promise<QuoteSummaryBundle | null> {
  try {
    return (await yf.quoteSummary(
      symbol,
      { modules: [...QUOTE_SUMMARY_MODULES] },
      VALIDATION_OFF,
    )) as QuoteSummaryBundle;
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

/** Prefer a chain that clears the meaningful-liquidity bar. */
const MIN_CHAIN_OPEN_INTEREST = MIN_MEANINGFUL_OPEN_INTEREST;

function chainOpenInterest(result: YahooOptionsResult | null): number {
  const chain = result?.options?.[0];
  if (!chain) return 0;
  const sum = (legs: { openInterest?: number }[]) =>
    legs.reduce((total, leg) => total + (leg.openInterest ?? 0), 0);
  return sum(chain.calls) + sum(chain.puts);
}

/**
 * Front-month options chain.
 *
 * Yahoo returns the *nearest* expiry by default, which for a freshly listed
 * weekly is often a full chain with zero open interest — useless for max pain,
 * and previously the cause of a max-pain price far below where the stock
 * traded. When that happens, fall back to the first expiry at least three
 * weeks out, which is typically a monthly and carries real open interest.
 */
export async function getOptions(
  symbol: string,
): Promise<YahooOptionsResult | null> {
  try {
    const nearest = (await yf.options(
      symbol,
      {},
      VALIDATION_OFF,
    )) as YahooOptionsResult;

    if (chainOpenInterest(nearest) >= MIN_CHAIN_OPEN_INTEREST) return nearest;

    const threeWeeksOut = Date.now() + 21 * 24 * 60 * 60 * 1000;
    const monthly = nearest.expirationDates?.find(
      (d) => new Date(d).getTime() > threeWeeksOut,
    );
    if (!monthly) return nearest;

    const later = (await yf.options(
      symbol,
      { date: new Date(monthly) },
      VALIDATION_OFF,
    )) as YahooOptionsResult;

    return chainOpenInterest(later) > 0 ? later : nearest;
  } catch (e) {
    console.warn(`[yahoo] options failed for ${symbol}:`, e);
    return null;
  }
}

/**
 * Annual fundamentals time series.
 *
 * This is the only working source for balance-sheet and cash-flow figures:
 * quoteSummary's balanceSheetHistory and cashflowStatementHistory modules have
 * returned essentially empty rows (just maxAge and endDate) since late 2024,
 * which the library itself warns about.
 */
async function getFundamentalsTimeSeries(
  symbol: string,
  module: "balance-sheet" | "cash-flow" | "financials",
  years: number,
): Promise<YahooFundamentalsRow[]> {
  try {
    const period1 = new Date();
    period1.setFullYear(period1.getFullYear() - years);
    return (await yf.fundamentalsTimeSeries(
      symbol,
      { period1, type: "annual", module },
      VALIDATION_OFF,
    )) as YahooFundamentalsRow[];
  } catch (e) {
    console.warn(`[yahoo] ${module} series failed for ${symbol}:`, e);
    return [];
  }
}

/** Used for the buyback yield and the Piotroski cash-flow signals. */
export function getCashFlowTimeSeries(symbol: string, years = 4) {
  return getFundamentalsTimeSeries(symbol, "cash-flow", years);
}

/** Used for the Altman Z-Score and the Piotroski leverage/liquidity signals. */
export function getBalanceSheetTimeSeries(symbol: string, years = 4) {
  return getFundamentalsTimeSeries(symbol, "balance-sheet", years);
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
    const result = await yf.search(
      query,
      { newsCount: 0, ...options },
      VALIDATION_OFF,
    );
    return (result?.quotes ?? []) as YahooSearchQuote[];
  } catch (e) {
    console.warn(`[yahoo] search failed for "${query}":`, e);
    return [];
  }
}
