import type { StockData } from "@/lib/types/stock";
import { generateJsonWithFallback } from "@/lib/gemini";
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
import type { ResolvedSymbol } from "./resolveSymbol";

/**
 * AI-derived metrics.
 *
 * Note this call currently sits on the critical path of every stock lookup and
 * is the dominant source of latency. The scores it returns (Altman Z,
 * Piotroski F) are closed-form formulas over data already present in the
 * quoteSummary response; the AI phase replaces this with deterministic code.
 */
async function fetchAiMetrics(resolved: ResolvedSymbol, hasPeRatios: boolean) {
  try {
    const prompt = `
      Analyze the stock "${resolved.symbol}" (${resolved.name}) and provide:
      ${hasPeRatios ? "" : "1. Trailing P/E Ratio (TTM)\n2. Forward P/E Ratio\n3. Annual Dividend Yield (%)"}
      4. Altman Z-Score (bankruptcy risk)
      5. Piotroski F-Score (0-9 financial strength)
      6. 1-sentence risk summary

      Return ONLY a JSON object with keys: ${hasPeRatios ? "" : '"trailingPE", "forwardPE", "dividendYield", '}"altmanZScore", "piotroskiFScore", "riskSummary".
    `;
    return await generateJsonWithFallback(prompt);
  } catch (e) {
    console.error("[stock] AI metrics fetch failed:", e);
    return null;
  }
}

/**
 * Fetch everything the stock payload needs and assemble it.
 *
 * The quote is fetched first because the AI prompt depends on whether Yahoo
 * already supplied P/E ratios; everything else fans out in parallel.
 */
export async function getStockPayload(
  resolved: ResolvedSymbol,
  range: string,
  from?: string,
): Promise<StockData> {
  const { period1, period2 } = rangeToDates(range, from);

  const quote = await getQuote(resolved.symbol);
  const hasPeRatios = Boolean(quote?.trailingPE || quote?.forwardPE);

  const [
    history,
    dividends,
    seasonality,
    cashFlowSeries,
    quoteSummary,
    options,
    fearGreedHistory,
    aiMetrics,
  ] = await Promise.all([
    getDailyHistory(resolved.symbol, period1, period2),
    getDividendHistory(resolved.symbol, period1, period2),
    getMonthlyHistory(resolved.symbol),
    getCashFlowTimeSeries(resolved.symbol),
    getQuoteSummary(resolved.symbol),
    getOptions(resolved.symbol),
    getFearGreedHistory(),
    fetchAiMetrics(resolved, hasPeRatios),
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
    aiMetrics,
  });
}
