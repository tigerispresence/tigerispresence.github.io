import type { StockData } from "@/lib/types/stock";
import type {
  RecommendationTrendRow,
  UpgradeDowngradeRow,
} from "@/lib/server/yahoo/types";

/**
 * Collapse the upgrade/downgrade feed to the latest price target per firm,
 * newest first. Yahoo returns every historical action, so a firm that has
 * revised five times appears five times.
 */
export function mapAnalystHistory(
  history: UpgradeDowngradeRow[] | undefined,
): NonNullable<StockData["analystHistory"]> {
  if (!Array.isArray(history)) return [];

  const latestByFirm = new Map<string, { firm: string; target: number; date: string; action: string }>();

  for (const item of history) {
    if (!item.currentPriceTarget || !item.firm) continue;
    const date = item.epochGradeDate
      ? new Date(item.epochGradeDate).toISOString()
      : "";
    const existing = latestByFirm.get(item.firm);
    if (!existing || new Date(date).getTime() > new Date(existing.date).getTime()) {
      latestByFirm.set(item.firm, {
        firm: item.firm,
        target: item.currentPriceTarget,
        date,
        action: item.action ?? "",
      });
    }
  }

  return [...latestByFirm.values()].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}

/** The most recent recommendation breakdown; Yahoo puts it first. */
export function mapRecommendationTrend(
  trend: RecommendationTrendRow[] | undefined,
): StockData["recommendationTrend"] {
  if (!Array.isArray(trend) || trend.length === 0) return null;
  const latest = trend[0];
  return {
    strongBuy: latest.strongBuy,
    buy: latest.buy,
    hold: latest.hold,
    sell: latest.sell,
    strongSell: latest.strongSell,
  };
}
