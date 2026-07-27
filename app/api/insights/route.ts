import { NextResponse } from "next/server";
import { yahooFinance } from "@/lib/server/yahoo/client";
import { backupSocialLinks, getSocialPosts } from "@/lib/server/ai/social";
import { FileCache } from "@/lib/server/cache/fileCache";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const maxDuration = 60;

const cache = new FileCache("insights", 24 * 60 * 60 * 1000);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get("symbol") || "").toUpperCase();

  if (!symbol) {
    return NextResponse.json({ error: "Symbol is required" }, { status: 400 });
  }

  try {
    const [newsResult, quoteSummary] = await Promise.all([
      (yahooFinance as any).search(symbol, { newsCount: 5 }),
      (yahooFinance as any).quoteSummary(symbol, {
        modules: ["recommendationTrend", "financialData", "summaryProfile"],
      }),
    ]);

    const newsItems = newsResult?.news ?? [];
    const newsHeadlines = newsItems
      .slice(0, 3)
      .map((n: any) => n.title)
      .join("; ");
    const businessSummary =
      quoteSummary?.summaryProfile?.longBusinessSummary?.substring(0, 300);

    const cachedPosts = cache.read<ReturnType<typeof backupSocialLinks>>(
      `${symbol}_social`,
    );

    let posts = cachedPosts;
    if (!posts) {
      const result = await getSocialPosts({
        symbol,
        newsHeadlines,
        businessSummary,
      });
      if (result.ok && result.data.posts.length > 0) {
        posts = result.data.posts;
        cache.write(`${symbol}_social`, posts);
      }
    }

    const news = newsItems.map((item: any) => ({
      title: item.title,
      summary: item.publisher,
      source: item.publisher,
      date: new Date(item.providerPublishTime).toISOString().split("T")[0],
      url: item.link,
    }));

    const financialData = quoteSummary?.financialData;
    const recommendationKey =
      financialData?.recommendationKey?.toLowerCase() || "neutral";

    let sentiment = "Neutral";
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

    let sentimentSummary = `Analyst Consensus: ${recommendationKey.toUpperCase()}.`;
    if (targetPrice && currentPrice) {
      const upside = ((targetPrice - currentPrice) / currentPrice) * 100;
      sentimentSummary += ` Target Mean Price: ${financialData.financialCurrency} ${targetPrice.toLocaleString()} (${upside > 0 ? "+" : ""}${upside.toFixed(1)}% upside).`;
    }
    sentimentSummary +=
      analystCount > 0
        ? ` Based on ${analystCount} analyst opinions.`
        : " (Limited analyst data available)";

    const relatedTickers = new Set<string>();
    for (const item of newsItems) {
      for (const ticker of item.relatedTickers ?? []) {
        if (ticker !== symbol) relatedTickers.add(ticker);
      }
    }

    return NextResponse.json({
      news,
      social: {
        sentiment,
        summary: sentimentSummary,
        trendingTopics: [...relatedTickers].slice(0, 5),
        // Generic search links whenever the AI call is unavailable or empty.
        posts: posts && posts.length > 0 ? posts : backupSocialLinks(symbol),
      },
    });
  } catch (error) {
    console.error("[api/insights]", error);
    return NextResponse.json({
      news: [],
      social: {
        sentiment: "Neutral",
        summary: "Insights are temporarily unavailable.",
        trendingTopics: [],
        posts: backupSocialLinks(symbol),
      },
    });
  }
}
