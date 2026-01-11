import { NextResponse } from 'next/server';
import { generateJsonWithFallback } from '@/lib/gemini';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
        return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    try {
        console.log(`[Insights API] Fetching insights for: ${symbol}`);

        // Prompt designed to get high-impact news and social sentiment
        const prompt = `
            Research the latest financial news and social media sentiment for "${symbol}".
            
            1. **News**: Find 5 recent, high-impact news articles that are determining the stock's price direction. 
               - **CRITICAL: Only include articles published within the last 30 days.**
               - **Ignore articles older than 1 month.**
               - Focus on "Financial Impact" and "Popularity".
               - Provide a short summary of WHY it matters.
            
            2. **Social (SNS)**: Search for trending discussions on X (Twitter), StockTwits, and Reddit.
               - Summarize the **overall sentiment** (Bullish/Bearish/Neutral).
               - Identify key **trending topics** or hashtags people are discussing.
            
            RETURN ONLY JSON in the following format (Language: Korean):
            {
                "news": [
                    {
                        "title": "Headline",
                        "summary": "Short summary of financial impact (1-2 sentences)",
                        "source": "Source Name",
                        "date": "YYYY-MM-DD",
                        "url": "Link to article (if available, else null)"
                    }
                ],
                "social": {
                    "sentiment": "Positive/Negative/Neutral",
                    "summary": "Summary of what retail investors are saying (e.g. 'Excited about earnings', 'Worried about regulation').",
                    "trendingTopics": ["Topic 1", "Topic 2"]
                }
            }
        `;

        const insights = await generateJsonWithFallback(prompt, {
            // We NEED external tools for fresh news
            tools: [{ googleSearch: {} }] as any
        });

        if (!insights) {
            throw new Error("Failed to generate insights");
        }

        return NextResponse.json(insights);

    } catch (error) {
        console.error("[Insights API] Error:", error);
        return NextResponse.json({
            news: [],
            social: { sentiment: "Neutral", summary: "데이터를 불러올 수 없습니다.", trendingTopics: [] }
        }, { status: 500 });
    }
}
