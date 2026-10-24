import { cacheLife, cacheTag } from "next/cache";
import { CACHE_PROFILES } from "./profiles";
import { getSectorData, isUsableSectorData } from "@/lib/server/market/sectors";
import type { SectorData } from "@/lib/types/sectors";

/**
 * Throws instead of returning an empty payload: a thrown call is not cached,
 * so a Yahoo blip costs one failed request rather than a cache lifetime of them.
 */
export async function cachedSectorData(): Promise<SectorData> {
  "use cache";
  cacheLife(CACHE_PROFILES.quote);
  cacheTag("market:sectors");
  const data = await getSectorData();
  if (!isUsableSectorData(data)) throw new Error("Sector data unavailable upstream");
  return data;
}
