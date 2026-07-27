import type { StockData } from "@/lib/types/stock";

/**
 * Client-side API helpers.
 *
 * Centralised so the three call sites that used to build the stock request by
 * hand cannot drift apart, and so the GET-based URLs live in one place.
 */

export interface FetchStockOptions {
  range?: string;
  /** Explicit start date for the custom-range slider. */
  from?: string;
}

export async function fetchStock(
  symbol: string,
  { range = "1y", from }: FetchStockOptions = {},
): Promise<StockData> {
  const params = new URLSearchParams({ range });
  if (from) params.set("from", from);

  const res = await fetch(
    `/api/stock/${encodeURIComponent(symbol)}?${params}`,
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Failed to fetch stock data");
  }
  return res.json();
}

export async function fetchMarket() {
  const res = await fetch("/api/market");
  if (!res.ok) throw new Error("Failed to fetch market data");
  return res.json();
}

/**
 * Ticker search.
 *
 * `deep` opts into the AI fallback and must stay off the typeahead path — it
 * previously ran on a 400ms debounce, firing a model call on roughly every
 * third keystroke.
 */
export async function fetchSearch(query: string, { deep = false } = {}) {
  const params = new URLSearchParams({ q: query });
  if (deep) params.set("deep", "1");
  const res = await fetch(`/api/search?${params}`);
  if (!res.ok) return { results: [] };
  return res.json();
}

export async function fetchInsights(symbol: string) {
  const res = await fetch(`/api/insights/${encodeURIComponent(symbol)}`);
  if (!res.ok) throw new Error("Failed to fetch insights");
  return res.json();
}

/** Separate from insights: this is the AI half, fetched only on demand. */
export async function fetchSocialPosts(symbol: string) {
  const res = await fetch(`/api/insights/${encodeURIComponent(symbol)}/social`);
  if (!res.ok) throw new Error("Failed to fetch social posts");
  return res.json();
}

export async function fetchThesis(symbol: string, name: string) {
  const res = await fetch(
    `/api/ai-thesis/${encodeURIComponent(symbol)}?name=${encodeURIComponent(name)}`,
  );
  if (!res.ok) throw new Error("Failed to fetch thesis");
  return res.json();
}
