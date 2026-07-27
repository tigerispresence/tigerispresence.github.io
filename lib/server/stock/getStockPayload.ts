import type { StockData } from "@/lib/types/stock";
import { getFearGreedHistory } from "@/lib/server/cnn/fearGreed";
import {
  getCashFlowTimeSeries,
  getDailyHistory,
  getDividendHistory,
  getMonthlyHistory,
  getOptions,
  getQuote,
  getQuoteSummary,
} from "@/lib/server/yahoo/fetchers";
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
 * zero when Yahoo failed. Both are now computed in code, so the slowest step
 * here is the slowest Yahoo call.
 */
export async function getStockPayload(
  resolved: ResolvedSymbol,
  range: string,
  from?: string,
): Promise<StockData> {
  const { period1, period2 } = rangeToDates(range, from);

  const [
    quote,
    history,
    dividends,
    seasonality,
    cashFlowSeries,
    quoteSummary,
    options,
    fearGreedHistory,
  ] = await Promise.all([
    getQuote(resolved.symbol),
    getDailyHistory(resolved.symbol, period1, period2),
    getDividendHistory(resolved.symbol, period1, period2),
    getMonthlyHistory(resolved.symbol),
    getCashFlowTimeSeries(resolved.symbol),
    getQuoteSummary(resolved.symbol),
    getOptions(resolved.symbol),
    getFearGreedHistory(),
  ]);

  return buildStockPayload({
    resolved,
    quote,
    quoteSummary,
    history,
    dividends,
    seasonality,
    cashFlowSeries,
    options,
    fearGreedHistory,
    riskScores: mapRiskScores(quoteSummary, quote),
  });
}
