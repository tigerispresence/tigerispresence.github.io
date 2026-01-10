import { NextResponse } from 'next/server';
import { yahooFinance } from '@/lib/yahoo';
import { generateJsonWithFallback } from '@/lib/gemini';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q');

    if (!query) {
        return NextResponse.json({ results: [] });
    }

    // Debugging for Vercel: Check if API Key is available
    console.log("[Search API] GEMINI_API_KEY configured:", !!process.env.NEXT_PUBLIC_GEMINI_API_KEY);

    try {
        console.log(`[Search API] Searching for: ${query}`);

        // 1. Try Yahoo Finance Search First
        let results: any[] = [];
        try {
            const yahooResults = await yahooFinance.search(query, { quotesCount: 5, newsCount: 0 });
            if (yahooResults.quotes && yahooResults.quotes.length > 0) {
                results = yahooResults.quotes
                    .filter((q: any) => q.isYahooFinance === true || q.symbol) // Basic filter
                    .map((q: any) => ({
                        symbol: q.symbol,
                        name: q.shortname || q.longname || q.symbol,
                        exchange: q.exchange,
                        type: q.quoteType
                    }));
            }
        } catch (e) {
            console.warn("[Search API] Yahoo search failed:", e);
        }

        // 2. Logic for Korean Queries (Han-geul) if Yahoo results are weak/empty
        // Check if query contains Korean characters
        const hasKorean = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(query);
        const isInsufficient = results.length === 0 || (hasKorean && results.length < 3);

        if (isInsufficient) {
            console.log(`[Search API] Insufficient results for "${query}", trying Gemini Fallback...`);
            try {
                // Use Gemini to interpret fuzzy Korean terms or find tickers
                const prompt = `
                    User is searching for a stock with query: "${query}".
                    Identify up to 5 likely stock candidates.
                    
                    CRITICAL:
                    - If the query is a Korean company, you MUST provide the correct ticker with ".KS" (KOSPI) or ".KQ" (KOSDAQ) suffix.
                    - Yahoo Finance requires these suffixes for Korean stocks.
                    - Example: "삼성전자" -> "005930.KS"
                    - Example: "에코프로" -> "086520.KQ"
                    
                    Return ONLY a valid JSON array of objects:
                    [ { "symbol": "TICKER", "name": "Company Name", "exchange": "ExchangeCode" }, ... ]
                `;

                const geminiResults = await generateJsonWithFallback(prompt, {
                    tools: [{ googleSearch: {} }] as any // Enable search for latest tickers
                });

                if (Array.isArray(geminiResults) && geminiResults.length > 0) {
                    // Deduplicate against existing Yahoo results
                    const existingSymbols = new Set(results.map(r => r.symbol));
                    geminiResults.forEach((r: any) => {
                        // Ensure symbol fits standard format
                        if (r.symbol && !existingSymbols.has(r.symbol)) {
                            results.push(r);
                            existingSymbols.add(r.symbol);
                        }
                    });
                }
            } catch (geminiError) {
                console.error("[Search API] Gemini fallback failed:", geminiError);
            }
        }

        return NextResponse.json({ results: results.slice(0, 5) });

    } catch (error) {
        console.error("[Search API] Error:", error);
        return NextResponse.json({ results: [] }, { status: 500 });
    }
}
