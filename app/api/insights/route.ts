import { NextResponse } from 'next/server';
import { yahooFinance } from '@/lib/yahoo';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
        return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    try {
        console.log(`[Insights API] Fetching insights for: ${symbol} via Yahoo Finance`);

        // Parallel Fetch: News + Analyst Sentiment
        const [newsResult, quoteSummary] = await Promise.all([
            yahooFinance.search(symbol, { newsCount: 5 }),
            yahooFinance.quoteSummary(symbol, { modules: ['recommendationTrend', 'financialData'] })
        ]);

        // 1. Process News
        const news = newsResult.news.map((item: any) => ({
            title: item.title,
            summary: item.publisher, // Yahoo news often lacks a clean summary, using publisher or type as fallback context
            source: item.publisher,
            date: new Date(item.providerPublishTime).toISOString().split('T')[0],
            url: item.link
        }));

        // 2. Process Analyst Sentiment
        // Yahoo "financialData" has recommendationKey (buy, hold, sell, etc.) and targetMeanPrice
        const financialData = quoteSummary.financialData;

        let sentiment = "Neutral";
        const recommendationKey = financialData?.recommendationKey?.toLowerCase() || "neutral";

        if (recommendationKey.includes("buy") || recommendationKey.includes("perform")) {
            sentiment = "Positive";
        } else if (recommendationKey.includes("sell") || recommendationKey.includes("under")) {
            sentiment = "Negative";
        }

        // Create a summary string based on Analyst Data
        const analystCount = financialData?.numberOfAnalystOpinions || 0;
        const targetPrice = financialData?.targetMeanPrice;
        const currentPrice = financialData?.currentPrice;

        let sentimentSummary = `Analyst Consensus: ${recommendationKey.toUpperCase()}.`;
        if (targetPrice && currentPrice) {
            const upside = ((targetPrice - currentPrice) / currentPrice) * 100;
            sentimentSummary += ` Target Mean Price: ${financialData.financialCurrency} ${targetPrice.toLocaleString()} (${upside > 0 ? '+' : ''}${upside.toFixed(1)}% upside).`;
        }
        if (analystCount > 0) {
            sentimentSummary += ` Based on ${analystCount} analyst opinions.`;
        } else {
            sentimentSummary += " (Limited analyst data available)";
        }

        // 3. Trending Topics - Using Sector/Industry from Summary Profile if available (Separate call, or just simplistic fallback)
        // Since we didn't request summaryProfile, we'll leave trending topics generic or empty for now.
        // Or we can just use the "relatedTickers" from the news items as trending topics.
        const relatedTickers = new Set<string>();
        newsResult.news.forEach((n: any) => {
            if (n.relatedTickers) {
                n.relatedTickers.forEach((t: string) => {
                    if (t !== symbol) relatedTickers.add(t);
                });
            }
        });
        const trendingTopics = Array.from(relatedTickers).slice(0, 5);

        return NextResponse.json({
            news,
            social: {
                sentiment: sentiment,
                summary: sentimentSummary,
                trendingTopics: trendingTopics
            }
        });

    } catch (error: any) {
        console.error("[Insights API] Error:", error);

        return NextResponse.json({
            news: [],
            social: {
                sentiment: "Neutral",
                summary: "Failed to fetch data from Yahoo Finance.",
                trendingTopics: []
            },
            error: error.message
        });
    }
}
