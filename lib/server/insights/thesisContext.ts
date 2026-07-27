import { yahooFinance } from "@/lib/server/yahoo/client";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ThesisContextFields {
  price?: number;
  changePercent?: number;
  sector?: string;
  industry?: string;
  businessSummary?: string;
}

/**
 * Cheap context for the thesis prompt.
 *
 * Worth fetching first: with a business summary in hand the generator can skip
 * its web-search round-trip entirely.
 */
export async function getThesisContext(
  symbol: string,
): Promise<ThesisContextFields> {
  const quoteSummary = await (yahooFinance as any)
    .quoteSummary(
      symbol,
      { modules: ["price", "summaryProfile"] },
      { validateResult: false },
    )
    .catch(() => null);

  const profile = quoteSummary?.summaryProfile;
  const price = quoteSummary?.price;

  return {
    price: price?.regularMarketPrice,
    changePercent: price?.regularMarketChangePercent,
    sector: profile?.sector,
    industry: profile?.industry,
    businessSummary: profile?.longBusinessSummary?.substring(0, 500),
  };
}
