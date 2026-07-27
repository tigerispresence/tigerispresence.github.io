import { KOREAN_STOCK_MAP } from "@/lib/korean_stocks";
import { resolveSymbolWithAi } from "@/lib/server/ai/symbol";
import { normalizeSymbol } from "@/lib/utils/symbols";
import { searchSymbols } from "@/lib/server/yahoo/fetchers";

export interface ResolvedSymbol {
  symbol: string;
  name: string;
  /** Which tier produced the answer; useful for logs and for cache policy. */
  source: "static" | "yahoo" | "ai";
}

const HANGUL = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/;

export function hasKorean(text: string): boolean {
  return HANGUL.test(text);
}

/** Tier 1: a hand-maintained alias table for common Korean company names. */
export function resolveFromStaticMap(query: string): ResolvedSymbol | null {
  if (!hasKorean(query)) return null;

  const normalized = query.trim().replace(/\s+/g, "");
  const matchKey = Object.keys(KOREAN_STOCK_MAP).find(
    (key) =>
      key === normalized || (normalized.length >= 2 && key.includes(normalized)),
  );
  if (!matchKey) return null;

  const candidate = KOREAN_STOCK_MAP[matchKey];
  return { symbol: candidate.symbol, name: candidate.name, source: "static" };
}

/** Tier 2: Yahoo's own search index. */
export async function resolveFromYahoo(
  query: string,
): Promise<ResolvedSymbol | null> {
  const korean = hasKorean(query);
  // Yahoo's endpoint chokes on raw Hangul, so encode it.
  const searchQuery = korean ? encodeURIComponent(query) : query;
  const quotes = await searchSymbols(searchQuery, {
    quotesCount: 1,
    ...(korean ? { region: "KR", lang: "ko-KR" } : {}),
  });

  const first = quotes[0];
  if (!first?.symbol) return null;

  return {
    symbol: first.symbol,
    name: first.shortname || first.longname || first.symbol,
    source: "yahoo",
  };
}

/** Tier 3: ask the model. Rare — only when the first two tiers both miss. */
export async function resolveFromAi(
  query: string,
): Promise<ResolvedSymbol | null> {
  const result = await resolveSymbolWithAi(query);
  if (!result.ok || !result.data.symbol) return null;
  return {
    symbol: result.data.symbol,
    name: result.data.name || result.data.symbol,
    source: "ai",
  };
}

/**
 * Resolve free-form user input to a Yahoo ticker, cheapest tier first.
 */
export async function resolveSymbol(
  query: string,
): Promise<ResolvedSymbol | null> {
  const trimmed = query?.trim();
  if (!trimmed) return null;

  const fromStatic = resolveFromStaticMap(trimmed);
  if (fromStatic) return fromStatic;

  const fromYahoo = await resolveFromYahoo(trimmed);
  if (fromYahoo) return fromYahoo;

  return resolveFromAi(normalizeSymbol(trimmed) || trimmed);
}
