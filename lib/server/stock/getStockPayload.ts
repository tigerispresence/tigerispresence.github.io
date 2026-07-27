import type { StockData } from "@/lib/types/stock";
import {
  cachedBalanceSheet,
  cachedCashFlow,
  cachedDividends,
  cachedFearGreedHistory,
  cachedHistory,
  cachedOptionChain,
  cachedQuote,
  cachedQuoteSummary,
  cachedSeasonality,
} from "@/lib/server/cache/stock";
import { buildStockPayload } from "./assemble";
import { rangeToDates } from "./dateRange";
import { mapRiskScores } from "./map/risk";
import type { ResolvedSymbol } from "./resolveSymbol";

/**
 * Fetch everything the stock payload needs and assemble it.
 *
 * There is deliberately no AI call on this path. It previously awaited a model
 * round-trip on every single lookup — for the Altman Z and Piotroski F scores,
 * which are closed-form formulas over figures already present in the
 * quoteSummary response, and for a quote fallback that fabricated a price of
 * zero when Yahoo failed. Both are now computed in code.
 */
export async function getStockPayload(
  resolved: ResolvedSymbol,
  range: string,
  from?: string,
): Promise<StockData> {
  const { period1, period2 } = rangeToDates(range, from);
  // Cache keys are derived from arguments, so pass stable ISO strings rather
  // than Date objects.
  const fromIso = period1.toISOString();
  const toIso = period2.toISOString();

  const [
    quote,
    history,
    dividends,
    seasonality,
    cashFlowSeries,
    quoteSummary,
    optionChain,
    fearGreedHistory,
    balanceSheets,
  ] = await Promise.all([
    cachedQuote(resolved.symbol),
    cachedHistory(resolved.symbol, fromIso, toIso),
    cachedDividends(resolved.symbol, fromIso, toIso),
    cachedSeasonality(resolved.symbol),
    cachedCashFlow(resolved.symbol),
    cachedQuoteSummary(resolved.symbol),
    cachedOptionChain(resolved.symbol),
    cachedFearGreedHistory(),
    cachedBalanceSheet(resolved.symbol),
  ]);

  return buildStockPayload({
    resolved,
    quote,
    quoteSummary,
    history,
    dividends,
    seasonality,
    cashFlowSeries,
    optionChain,
    fearGreedHistory,
    riskScores: mapRiskScores({
      quoteSummary,
      quote,
      balanceSheets,
      cashFlows: cashFlowSeries,
    }),
  });
}
