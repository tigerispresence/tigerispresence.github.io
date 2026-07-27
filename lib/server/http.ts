/**
 * Cache-Control headers, one per route family.
 *
 * `max-age` governs the browser, `s-maxage` the CDN, and
 * `stale-while-revalidate` lets the edge serve a slightly stale response while
 * it refreshes in the background — so a cold upstream never blocks a user.
 */
export const CACHE_HEADERS = {
  /** Prices move; the CDN holds for 5 minutes. */
  stock: "public, max-age=0, s-maxage=300, stale-while-revalidate=3600",
  market: "public, max-age=0, s-maxage=300, stale-while-revalidate=900",
  /** A ticker lookup is effectively permanent; let the browser hold it too. */
  search: "public, max-age=60, s-maxage=86400, stale-while-revalidate=604800",
  news: "public, max-age=0, s-maxage=900, stale-while-revalidate=3600",
  /** AI output is expensive and low-volatility. */
  ai: "public, max-age=0, s-maxage=86400, stale-while-revalidate=86400",
} as const;

/**
 * Errors must never be cached.
 *
 * Without this an upstream blip returns a 500 that the CDN then serves for the
 * full s-maxage window, turning a transient failure into a multi-minute outage.
 */
export const NO_STORE = "no-store";
