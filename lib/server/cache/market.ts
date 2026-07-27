import { cacheLife, cacheTag } from "next/cache";
import { CACHE_PROFILES } from "./profiles";
import { getMarketData, type MarketData } from "@/lib/server/market/indices";

export async function cachedMarketData(): Promise<MarketData> {
  "use cache";
  cacheLife(CACHE_PROFILES.quote);
  cacheTag("market:indices", "market:feargreed");
  return getMarketData();
}
