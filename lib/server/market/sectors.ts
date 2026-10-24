import { getDailyHistory } from "@/lib/server/yahoo/fetchers";
import { toPricePoints } from "@/lib/server/yahoo/normalize";
import { allReturns, BENCHMARK, SECTORS, sectorStats } from "@/lib/calc/sectors";
import type { SectorData } from "@/lib/types/sectors";

/** Enough sessions for a 200-day average, a 1Y return, and last year's close. */
const LOOKBACK_DAYS = 400;

/**
 * The sector tab: a year of daily closes for SPY and the eleven sector ETFs,
 * reduced to returns, trend and rotation on the server so the client receives
 * a few kilobytes instead of twelve price histories.
 *
 * A sector whose history fails is dropped rather than zero-filled — a missing
 * row is honest; a 0% row would rank it mid-table.
 */
export async function getSectorData(now = new Date()): Promise<SectorData> {
  const from = new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000);
  const symbols = [BENCHMARK, ...SECTORS.map((s) => s.symbol)];
  const histories = await Promise.all(
    symbols.map(async (symbol) => toPricePoints(await getDailyHistory(symbol, from, now))),
  );
  const [benchmark, ...sectorHistories] = histories;

  if (benchmark.length === 0) {
    return { benchmark: { symbol: BENCHMARK, price: 0, returns: allReturns([]) }, sectors: [], asOf: null };
  }

  return {
    benchmark: {
      symbol: BENCHMARK,
      price: benchmark[benchmark.length - 1].close,
      returns: allReturns(benchmark),
    },
    sectors: SECTORS.flatMap((sector, i) =>
      sectorHistories[i].length > 0 ? [sectorStats(sector, sectorHistories[i], benchmark)] : [],
    ),
    asOf: benchmark[benchmark.length - 1].date,
  };
}

/** True when the payload looks like a real fetch rather than an upstream failure. */
export function isUsableSectorData(data: SectorData): boolean {
  return data.sectors.length > 0;
}
