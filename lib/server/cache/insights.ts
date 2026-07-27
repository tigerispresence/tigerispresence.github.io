import { cacheLife, cacheTag } from "next/cache";
import { CACHE_PROFILES } from "./profiles";
import {
  getNewsAndSentiment,
  getNewsContext,
  type NewsAndSentiment,
  type NewsContext,
} from "@/lib/server/insights/news";

export async function cachedNewsAndSentiment(
  symbol: string,
): Promise<NewsAndSentiment> {
  "use cache";
  cacheLife(CACHE_PROFILES.quote);
  cacheTag(`stock:${symbol}`, `news:${symbol}`);
  return getNewsAndSentiment(symbol);
}

export async function cachedNewsContext(symbol: string): Promise<NewsContext> {
  "use cache";
  cacheLife(CACHE_PROFILES.quote);
  cacheTag(`stock:${symbol}`, `news:${symbol}`);
  return getNewsContext(symbol);
}
