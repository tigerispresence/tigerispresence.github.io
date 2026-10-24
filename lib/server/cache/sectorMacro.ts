import { cacheLife, cacheTag } from "next/cache";
import { CACHE_PROFILES } from "./profiles";
import { getSectorMacroData, isUsableSectorMacroData } from "@/lib/server/market/sectorMacro";
import type { SectorMacroData } from "@/lib/types/macro";

/** Throws on an upstream failure so it is not cached; see cachedSectorData. */
export async function cachedSectorMacroData(): Promise<SectorMacroData> {
  "use cache";
  cacheLife(CACHE_PROFILES.history);
  cacheTag("market:sectors:macro");
  const data = await getSectorMacroData();
  if (!isUsableSectorMacroData(data)) throw new Error("Macro data unavailable upstream");
  return data;
}
