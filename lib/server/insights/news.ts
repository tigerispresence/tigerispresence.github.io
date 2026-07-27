import { yahooFinance } from "@/lib/server/yahoo/client";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface NewsItem {
  title: string;
  summary: string;
  source: string;
  date: string;
  url: string;
}

export interface NewsAndSentiment {
  news: NewsItem[];
  social: {
    sentiment: "Positive" | "Neutral" | "Negative";
    summary: string;
    trendingTopics: string[];
  };
}

/** Context the social-post generator needs; cheap enough to fetch on its own. */
export interface NewsContext {
  newsHeadlines?: string;
  businessSummary?: string;
}

async function fetchRaw(symbol: string) {
  const [newsResult, quoteSummary] = await Promise.all([
    // validateResult:false for the same reason as the other Yahoo calls —
    // schema drift otherwise makes search throw instead of returning data.
    (yahooFinance as any)
      .search(symbol, { newsCount: 5 }, { validateResult: false })
      .catch(() => null),
    (yahooFinance as any)
      .quoteSummary(
        symbol,
        { modules: ["recommendationTrend", "financialData", "summaryProfile"] },
        { validateResult: false },
      )
      .catch(() => null),
  ]);
  return { newsItems: newsResult?.news ?? [], quoteSummary };
}

export async function getNewsContext(symbol: string): Promise<NewsContext> {
  const { newsItems, quoteSummary } = await fetchRaw(symbol);
  return {
    newsHeadlines: newsItems
      .slice(0, 3)
      .map((n: any) => n.title)
      .join("; "),
    businessSummary: quoteSummary?.summaryProfile?.longBusinessSummary?.substring(
      0,
      300,
    ),
  };
}

/** Yahoo news plus a sentiment line derived from analyst consensus. No AI. */
export async function getNewsAndSentiment(
  symbol: string,
): Promise<NewsAndSentiment> {
  const { newsItems, quoteSummary } = await fetchRaw(symbol);

  const news: NewsItem[] = newsItems.map((item: any) => ({
    title: item.title,
    // Yahoo's news feed carries no abstract, so the publisher stands in.
    summary: item.publisher,
    source: item.publisher,
    date: new Date(item.providerPublishTime).toISOString().split("T")[0],
    url: item.link,
  }));

  const financialData = quoteSummary?.financialData;
  const recommendationKey =
    financialData?.recommendationKey?.toLowerCase() || "neutral";

  let sentiment: NewsAndSentiment["social"]["sentiment"] = "Neutral";
  if (recommendationKey.includes("buy") || recommendationKey.includes("perform")) {
    sentiment = "Positive";
  } else if (
    recommendationKey.includes("sell") ||
    recommendationKey.includes("under")
  ) {
    sentiment = "Negative";
  }

  const analystCount = financialData?.numberOfAnalystOpinions || 0;
  const targetPrice = financialData?.targetMeanPrice;
  const currentPrice = financialData?.currentPrice;

  let summary = `Analyst Consensus: ${recommendationKey.toUpperCase()}.`;
  if (targetPrice && currentPrice) {
    const upside = ((targetPrice - currentPrice) / currentPrice) * 100;
    summary += ` Target Mean Price: ${financialData.financialCurrency} ${targetPrice.toLocaleString()} (${upside > 0 ? "+" : ""}${upside.toFixed(1)}% upside).`;
  }
  summary +=
    analystCount > 0
      ? ` Based on ${analystCount} analyst opinions.`
      : " (Limited analyst data available)";

  const relatedTickers = new Set<string>();
  for (const item of newsItems) {
    for (const ticker of item.relatedTickers ?? []) {
      if (ticker !== symbol) relatedTickers.add(ticker);
    }
  }

  return {
    news,
    social: {
      sentiment,
      summary,
      trendingTopics: [...relatedTickers].slice(0, 5),
    },
  };
}
