import { cacheLife, cacheTag } from "next/cache";
import { CACHE_PROFILES } from "./profiles";
import type { Dividend, FearGreedPoint, PricePoint } from "@/lib/types/stock";
import { getFearGreedHistory } from "@/lib/server/cnn/fearGreed";
import {
  getBalanceSheetTimeSeries,
  getCashFlowTimeSeries,
  getDailyHistory,
  getDividendHistory,
  getMonthlyHistory,
  getOptions,
  getQuote,
  getQuoteSummary,
} from "@/lib/server/yahoo/fetchers";
import type {
  QuoteSummaryBundle,
  YahooFundamentalsRow,
  YahooOptionChain,
  YahooQuote,
} from "@/lib/server/yahoo/types";
import { toDividends, toPricePoints } from "@/lib/server/yahoo/normalize";

/**
 * The cached seam.
 *
 * This is the only file carrying "use cache", deliberately: cached functions
 * need Next's runtime and cannot execute under plain Vitest, so everything
 * here is a thin delegation to an uncached implementation that tests import
 * directly.
 *
 * Caching happens per fetcher rather than per response so that a 1y and a 5y
 * request for the same symbol share one quoteSummary entry, and so a single
 * slow upstream cannot invalidate the whole payload.
 *
 * Values are normalized to plain JSON here (Date -> ISO string) because cache
 * entries must be serializable, and normalizing after the cache boundary would
 * mean storing the un-normalized shape.
 */

export async function cachedQuote(symbol: string): Promise<YahooQuote | null> {
  "use cache";
  cacheLife(CACHE_PROFILES.quote);
  cacheTag(`stock:${symbol}`, `stock:${symbol}:quote`);
  return getQuote(symbol);
}

/**
 * Daily closes for the requested window.
 *
 * Note these are NOT downsampled. The chart only draws 500 points, but the
 * simulations buy on specific trading days — the DCA strategy on the first
 * session of each month, the volatility strategy on days breaching a sigma
 * band — and the return distribution is computed over every session. Thinning
 * the series here would silently change those results. Downsampling stays a
 * presentation concern, applied to the chart series only.
 */
export async function cachedHistory(
  symbol: string,
  fromIso: string,
  toIso: string,
): Promise<PricePoint[]> {
  "use cache";
  cacheLife(CACHE_PROFILES.history);
  cacheTag(`stock:${symbol}`, `stock:${symbol}:history`);
  return toPricePoints(
    await getDailyHistory(symbol, new Date(fromIso), new Date(toIso)),
  );
}

export async function cachedDividends(
  symbol: string,
  fromIso: string,
  toIso: string,
): Promise<Dividend[]> {
  "use cache";
  cacheLife(CACHE_PROFILES.history);
  cacheTag(`stock:${symbol}`);
  return toDividends(
    await getDividendHistory(symbol, new Date(fromIso), new Date(toIso)),
  );
}

export async function cachedSeasonality(symbol: string): Promise<PricePoint[]> {
  "use cache";
  cacheLife(CACHE_PROFILES.seasonality);
  cacheTag(`stock:${symbol}`);
  return toPricePoints(await getMonthlyHistory(symbol));
}

export async function cachedQuoteSummary(
  symbol: string,
): Promise<QuoteSummaryBundle | null> {
  "use cache";
  cacheLife(CACHE_PROFILES.fundamentals);
  cacheTag(`stock:${symbol}`, `stock:${symbol}:fundamentals`);
  return getQuoteSummary(symbol);
}

export async function cachedCashFlow(
  symbol: string,
): Promise<YahooFundamentalsRow[]> {
  "use cache";
  cacheLife(CACHE_PROFILES.fundamentals);
  cacheTag(`stock:${symbol}`);
  return getCashFlowTimeSeries(symbol);
}

export async function cachedBalanceSheet(
  symbol: string,
): Promise<YahooFundamentalsRow[]> {
  "use cache";
  cacheLife(CACHE_PROFILES.fundamentals);
  cacheTag(`stock:${symbol}`);
  return getBalanceSheetTimeSeries(symbol);
}

/** Front-month chain, slimmed to what max pain needs. */
export async function cachedOptionChain(
  symbol: string,
): Promise<YahooOptionChain | null> {
  "use cache";
  cacheLife(CACHE_PROFILES.history);
  cacheTag(`stock:${symbol}`);
  const result = await getOptions(symbol);
  const chain = result?.options?.[0];
  if (!chain) return null;
  return {
    expirationDate: new Date(chain.expirationDate),
    calls: chain.calls.map((c) => ({ strike: c.strike, openInterest: c.openInterest })),
    puts: chain.puts.map((p) => ({ strike: p.strike, openInterest: p.openInterest })),
  };
}

/** Shared across every symbol, so it carries its own market-wide tag. */
export async function cachedFearGreedHistory(): Promise<FearGreedPoint[] | null> {
  "use cache";
  cacheLife(CACHE_PROFILES.history);
  cacheTag("market:feargreed");
  return getFearGreedHistory();
}
