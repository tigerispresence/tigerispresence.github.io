import { NextResponse } from 'next/server';
import { yahooFinance } from '@/lib/yahoo';
import fs from 'fs';
import path from 'path';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { generateJsonWithFallback } from '@/lib/gemini';

export const maxDuration = 60; // Set Vercel max execution time to 60 seconds

const CACHE_DIR = path.join(process.cwd(), '.cache', 'insights');
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const symbol = (searchParams.get('symbol') || '').toUpperCase();

    if (!symbol) {
        return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    const cacheFilePath = path.join(CACHE_DIR, `${symbol}_social.json`);

    try {
        console.log(`[Insights API] Fetching insights for: ${symbol} via Yahoo Finance`);

        // 1. Check Cache for Social Posts (Gemini)
        let cachedSocialPosts = null;
        if (fs.existsSync(cacheFilePath)) {
            try {
                const cachedData = JSON.parse(fs.readFileSync(cacheFilePath, 'utf-8'));
                if (Date.now() - cachedData.timestamp < CACHE_TTL) {
                    console.log(`[Insights API] Using CACHED social posts for: ${symbol}`);
                    cachedSocialPosts = cachedData.data;
                }
            } catch (e) {
                console.warn("[Insights API] Cache Read Failed:", e);
            }
        }

        // Parallel Fetch: News + Analyst Sentiment + Summary Profile (for context)
        const [newsResult, quoteSummary] = await Promise.all([
            yahooFinance.search(symbol, { newsCount: 5 }),
            yahooFinance.quoteSummary(symbol, { modules: ['recommendationTrend', 'financialData', 'summaryProfile'] }),
        ]);

        // Process News and Summary for Gemini context
        const newsHeaders = newsResult.news.slice(0, 3).map((n: any) => n.title).join("; ");
        const businessSummary = quoteSummary?.summaryProfile?.longBusinessSummary?.substring(0, 300);

        // Fetch Social Posts (Gemini) - using context to reduce search
        const socialPosts = await (async () => {
            if (cachedSocialPosts) return cachedSocialPosts;

            try {
                const prompt = `
                     Identify 5 recent and trending social media discussions (Reddit, X, StockTwits) for "${symbol}".
                     Stock Context: ${businessSummary || "N/A"}
                     Recent News: ${newsHeaders || "N/A"}
                     
                     Focus on sentiment and specific community reactions.
                     Return a JSON object with a "posts" array:
                     {
                         "posts": [
                             { "title": "Post Summary", "url": "Link", "source": "Reddit/X/StockTwits" }
                         ]
                     }
                 `;
                
                // Only provide search if we have minimal context
                const geminiOptions: any = {};
                if (!newsHeaders && !businessSummary) {
                    geminiOptions.tools = [{ googleSearch: {} }];
                }

                const result = await generateJsonWithFallback(prompt, geminiOptions);

                if (result?.posts && Array.isArray(result.posts)) {
                    // Save to Cache
                    try {
                        if (!fs.existsSync(CACHE_DIR)) {
                            fs.mkdirSync(CACHE_DIR, { recursive: true });
                        }
                        fs.writeFileSync(cacheFilePath, JSON.stringify({
                            timestamp: Date.now(),
                            data: result.posts
                        }, null, 2));
                    } catch (cacheError) {
                        console.error("[Insights API] Cache Write Failed:", cacheError);
                    }
                    return result.posts;
                }
                return null;
            } catch (e) {
                console.warn("Gemini Social Search Failed (Quota/Error):", e);
                return null;
            }
        })();

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
        const relatedTickers = new Set<string>();
        newsResult.news.forEach((n: any) => {
            if (n.relatedTickers) {
                n.relatedTickers.forEach((t: string) => {
                    if (t !== symbol) relatedTickers.add(t);
                });
            }
        });
        const trendingTopics = Array.from(relatedTickers).slice(0, 5);

        // 4. Fallback for Social Posts if Gemini Failed
        let finalPosts = socialPosts;
        if (!finalPosts || finalPosts.length === 0) {
            console.log("Using generic backup links for social posts.");
            finalPosts = [
                { title: `Search $${symbol} on Reddit`, url: `https://www.reddit.com/search/?q=$${symbol}`, source: "Reddit" },
                { title: `Search $${symbol} on X`, url: `https://twitter.com/search?q=$${symbol}`, source: "X" },
                { title: `Search $${symbol} on Stocktwits`, url: `https://stocktwits.com/symbol/${symbol}`, source: "Stocktwits" },
                { title: `Search $${symbol} on Google`, url: `https://www.google.com/search?q=${symbol}+stock+discussion`, source: "Google" }
            ];
        }

        return NextResponse.json({
            news,
            social: {
                sentiment: sentiment,
                summary: sentimentSummary,
                trendingTopics: trendingTopics,
                posts: finalPosts
            }
        });

    } catch (error: any) {
        console.error("[Insights API] Error:", error);

        return NextResponse.json({
            news: [],
            social: {
                sentiment: "Neutral",
                summary: "Failed to fetch data from Yahoo Finance.",
                trendingTopics: [],
                posts: []
            },
            error: error.message
        });
    }
}
