import { NextResponse } from 'next/server';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { yahooFinance } from '@/lib/server/yahoo/client';
import { generateJsonWithFallback } from '@/lib/gemini';

import { KOREAN_STOCK_MAP } from '@/lib/korean_stocks';

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

        // 1. Determine Search Context (Korean vs Global)
        const hasKorean = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(query);
        const searchOptions = hasKorean
            ? { quotesCount: 12, newsCount: 0, region: 'KR', lang: 'ko-KR' }
            : { quotesCount: 12, newsCount: 0 };

        let results: any[] = [];

        // 0. Static Map Check (Fastest Fallback for Common Korean Stocks)
        if (hasKorean) {
            const normalizedQuery = query.trim().replace(/\s+/g, ''); // Remove spaces
            // Check for exact keys or partial keys (if short enough)
            Object.keys(KOREAN_STOCK_MAP).forEach(key => {
                if (key === normalizedQuery || (normalizedQuery.length >= 2 && key.includes(normalizedQuery))) {
                    const candidate = KOREAN_STOCK_MAP[key];
                    if (!results.find(r => r.symbol === candidate.symbol)) {
                        results.push({ ...candidate, type: 'EQUITY' });
                    }
                }
            });
            console.log(`[Search API] Static map found ${results.length} matches`);
        }

        // 2. Try Yahoo Finance Search First
        try {
            // Yahoo Finance API can choke on raw Korean characters, so we encode them.
            const searchQuery = hasKorean ? encodeURIComponent(query) : query;
            const yahooResults = await yahooFinance.search(searchQuery, searchOptions);
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

        // 3. Logic for Korean Queries (Han-geul) if Yahoo results are weak/empty
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
                    // Removed googleSearch tool to prevent Vercel Timeouts (Latency optimization)
                    // Gemini has internal knowledge of major tickers.
                });

                if (Array.isArray(geminiResults) && geminiResults.length > 0) {
                    console.log(`[Search API] Gemini fallback returned ${geminiResults.length} items`);
                    // Deduplicate against existing Yahoo results
                    const existingSymbols = new Set(results.map(r => r.symbol));
                    geminiResults.forEach((r: any) => {
                        // Ensure symbol fits standard format
                        if (r.symbol && !existingSymbols.has(r.symbol)) {
                            results.push(r);
                            existingSymbols.add(r.symbol);
                        }
                    });
                } else {
                    console.log("[Search API] Gemini fallback returned no valid items");
                }
            } catch (geminiError) {
                console.error("[Search API] Gemini fallback failed:", geminiError);
            }
        }

        return NextResponse.json({ results: results.slice(0, 12) });

    } catch (error) {
        console.error("[Search API] Error:", error);
        return NextResponse.json({ results: [] }, { status: 500 });
    }
}
