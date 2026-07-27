/**
 * Cache lifetimes, named by how fast each kind of data actually moves.
 *
 * Single source of truth: next.config.ts registers these as named profiles,
 * and the cached functions pass the objects directly. Passing the object
 * rather than the profile name keeps them type-checked — Next's `cacheLife`
 * overloads only know its own built-in names, so a custom name would need a
 * cast at every call site.
 *
 *   stale      — how long a client may reuse without revalidating
 *   revalidate — how long before the server refreshes in the background
 *   expire     — hard ceiling before a fresh fetch is forced
 */
export const CACHE_PROFILES = {
  /** Live prices. */
  quote: { stale: 60, revalidate: 300, expire: 900 },
  /** Daily closes: yesterday's bars never change. */
  history: { stale: 300, revalidate: 3600, expire: 86_400 },
  /** Statements change quarterly. */
  fundamentals: { stale: 3600, revalidate: 21_600, expire: 172_800 },
  /** Ten years of monthly closes. */
  seasonality: { stale: 3600, revalidate: 86_400, expire: 604_800 },
  /** The ticker for a given company name is effectively permanent. */
  symbol: { stale: 86_400, revalidate: 604_800, expire: 2_592_000 },
  /** AI output is expensive and low-volatility. */
  ai: { stale: 3600, revalidate: 86_400, expire: 604_800 },
} as const;

export type CacheProfileName = keyof typeof CACHE_PROFILES;
