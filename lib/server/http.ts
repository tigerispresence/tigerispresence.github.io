/**
 * Cache headers, one set per route family.
 *
 * The CDN and the browser get separate headers. `CDN-Cache-Control`, which
 * Vercel's edge honours and browsers ignore, carries `s-maxage` and
 * `stale-while-revalidate`, so a cold upstream never
 * blocks a user. The browser's `Cache-Control` must not carry
 * `stale-while-revalidate`: Chrome honours it too, and was answering repeat
 * requests from its own copy up to an hour old before fetching a fresh one,
 * so a revisited stock briefly showed outdated figures.
 */
const BROWSER_REVALIDATE = "public, max-age=0, must-revalidate";

const cacheHeaders = (cdn: string, browser = BROWSER_REVALIDATE) => ({
  "Cache-Control": browser,
  "CDN-Cache-Control": `public, ${cdn}`,
});

export const CACHE_HEADERS = {
  /** Prices move; the CDN holds for 5 minutes. */
  stock: cacheHeaders("s-maxage=300, stale-while-revalidate=3600"),
  /** The status bar shows FX and BTC, which trade around the clock. */
  market: cacheHeaders("s-maxage=60, stale-while-revalidate=120"),
  /** Matches the server's `quote` profile; a long SWR would serve hour-old returns. */
  sectors: cacheHeaders("s-maxage=300, stale-while-revalidate=600"),
  /** CPI is monthly and FRED yields daily; an hour is plenty fresh. */
  macro: cacheHeaders("s-maxage=3600, stale-while-revalidate=3600"),
  /** A ticker lookup is effectively permanent; let the browser hold it for a minute too. */
  search: cacheHeaders("s-maxage=86400, stale-while-revalidate=604800", "public, max-age=60"),
  news: cacheHeaders("s-maxage=900, stale-while-revalidate=3600"),
  /** AI output is expensive and low-volatility. */
  ai: cacheHeaders("s-maxage=86400, stale-while-revalidate=86400"),
} as const;

/**
 * Errors must never be cached.
 *
 * Without this an upstream blip returns a 500 that the CDN then serves for the
 * full s-maxage window, turning a transient failure into a multi-minute outage.
 */
export const NO_STORE = "no-store";
