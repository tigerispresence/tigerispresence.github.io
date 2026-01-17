/* eslint-disable @typescript-eslint/no-explicit-any */
import { yahooFinance } from '@/lib/yahoo';
import { NextResponse } from "next/server";
import { generateJsonWithFallback } from '@/lib/gemini';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';

const CACHE_DIR = process.env.NODE_ENV === 'production'
    ? path.join(os.tmpdir(), 'stock_data')
    : path.resolve(process.cwd(), '.cache/stock_data');
const CACHE_DURATION = 60 * 60 * 1000; // 1 Hour Cache for Stock Data

export async function POST(req: Request) {
    try {
        const { query, range = '1y' } = await req.json();

        if (!query) {
            return NextResponse.json({ error: "Query is required" }, { status: 400 });
        }

        // 1. Check Cache
        // Create a unique filename hash based on query and range
        const cacheKey = crypto.createHash('md5').update(`${query}-${range}`).digest('hex');
        const cacheFilePath = path.join(CACHE_DIR, `${cacheKey}.json`);

        // let cachedData = null; // Unused 
        try {
            if (fs.existsSync(cacheFilePath)) {
                const raw = fs.readFileSync(cacheFilePath, 'utf8');
                const parsed = JSON.parse(raw);
                if (Date.now() - parsed.timestamp < CACHE_DURATION) {
                    console.log(`Using cached stock data for "${query}"`);
                    return NextResponse.json(parsed.data);
                }
            }
        } catch (e) {
            console.warn("Cache read error:", e);
        }

        // 2. Resolve Symbol
        let symbol = "";
        let stockName = "";

        // A. Try direct search with Yahoo Finance (Primary)
        try {
            console.log(`Searching for symbol: ${query} via Yahoo...`);
            const searchResult = await yahooFinance.search(query);
            if (searchResult.quotes.length > 0) {
                const firstQuote = searchResult.quotes[0];
                symbol = firstQuote.symbol;
                symbol = firstQuote.symbol;
                stockName = firstQuote.shortname || firstQuote.longname || firstQuote.symbol;
                console.log(`Yahoo found symbol: ${symbol}`);
            }
        } catch (e) {
            console.warn("Yahoo search failed, trying fallback...", e);
        }

        // B. Fallback: Resolve Symbol using Gemini Search (If Yahoo failed)
        if (!symbol) {
            try {
                console.log(`Searching for symbol: ${query} via Gemini (Fallback)...`);
                const searchResult = await generateJsonWithFallback(
                    `Find the exact stock ticker symbol for "${query}". 
                     If it is a Korean company, use the format "000000.KS" or "000000.KQ". 
                     If it is a US company, use the standard ticker (e.g. AAPL).
                     Return a JSON object: { "symbol": "string", "name": "string" }`,
                    { tools: [{ googleSearch: {} }] as any }
                );

                if (searchResult?.symbol) {
                    symbol = searchResult.symbol;
                    stockName = searchResult.name;
                    console.log(`Gemini found symbol: ${symbol} (${stockName})`);
                }
            } catch (e) {
                console.error("Gemini Symbol Search failed:", e);
            }
        }

        if (!symbol) {
            return NextResponse.json({ error: "Stock not found" }, { status: 404 });
        }

        // 3. Fetch Quote Summary (Primary: Yahoo, Fallback: Gemini)
        let quote: any = null;

        try {
            console.log(`Fetching quote for ${symbol} via Yahoo...`);
            quote = await yahooFinance.quote(symbol);
        } catch (e) {
            console.warn("Yahoo Quote failed, trying Gemini fallback...", e);
        }

        if (!quote) {
            // Initialize empty quote structure for fallback
            quote = {
                symbol: symbol,
                shortName: stockName,
                regularMarketPrice: 0,
                currency: "USD",
                regularMarketChange: 0,
                regularMarketChangePercent: 0,
                trailingPE: null,
                forwardPE: null,
                dividendYield: null
            };

            try {
                console.log(`Fetching quote for ${symbol} via Gemini (Fallback)...`);
                const quoteResult = await generateJsonWithFallback(
                    `Search for the current stock price and financial details for "${symbol}" (${stockName}).
                     Return a JSON object with:
                     - regularMarketPrice: number (current price)
                     - currency: string (e.g. USD, KRW)
                     - regularMarketChange: number (absolute change)
                     - regularMarketChangePercent: number (percentage change, e.g. -1.2 for -1.2%)
                     - trailingPE: number or null
                     - forwardPE: number or null
                     - dividendYield: number or null (e.g. 1.5 for 1.5%)
                     
                     Ensure the data is real-time or from the latest close.`,
                    { tools: [{ googleSearch: {} }] as any }
                );

                if (quoteResult) {
                    quote = { ...quote, ...quoteResult };
                }
            } catch (e) {
                console.error("Gemini Quote Fetch failed:", e);
            }
        }

        // 4. Fetch Historical Data based on Range (Still using Yahoo)
        const endDate = new Date();
        const startDate = new Date();
        switch (range) {
            case '2y': startDate.setFullYear(endDate.getFullYear() - 2); break;
            case '3y': startDate.setFullYear(endDate.getFullYear() - 3); break;
            case '5y': startDate.setFullYear(endDate.getFullYear() - 5); break;
            case '10y': startDate.setFullYear(endDate.getFullYear() - 10); break;
            case '1y': default: startDate.setFullYear(endDate.getFullYear() - 1); break;
        }

        const metricsPromise = (async () => {
            // Optimization: If Yahoo already provided key metrics, skip Gemini to save time (avoid 8s+ delay)
            if (quote && (quote.trailingPE || quote.forwardPE)) {
                console.log("Yahoo provided sufficient metrics, skipping Gemini...");
                return null;
            }

            try {
                console.log("Fetching additional metrics via Gemini...");
                const prompt = `
                    Analyze the stock "${symbol}" and provide the following financial metrics based on the most recent data available to you:
                    1. Trailing P/E Ratio (TTM)
                    2. Forward P/E Ratio
                    3. Annual Dividend Yield (%)

                    Return ONLY a JSON object with keys: "trailingPE", "forwardPE", "dividendYield".
                    Values should be numbers (or null if not applicable/found).
                    Example: { "trailingPE": 25.4, "forwardPE": 22.1, "dividendYield": 0.85 }
                `;
                // Use search tool to avoid "I don't have real data" refusals
                return await generateJsonWithFallback(prompt, {
                    tools: [{ googleSearch: {} }] as any
                });
            } catch (e) {
                console.error("Gemini metrics fetch failed:", e);
                return null;
            }
        })();

        const [history, dividends, geminiMetrics] = await Promise.all([
            yahooFinance.historical(symbol, {
                period1: startDate,
                period2: endDate,
                interval: '1d'
            }).catch((e: any) => {
                console.warn("Yahoo History failed:", e);
                return [] as any[];
            }),
            yahooFinance.historical(symbol, {
                period1: startDate,
                period2: endDate,
                interval: '1d',
                events: 'dividends'
            }).catch((e: any) => {
                console.warn("Yahoo Dividends failed:", e);
                return [] as any[];
            }),
            metricsPromise
        ]);

        // 4. Calculate Derived Metrics
        let calculatedYield = quote.dividendYield;
        if (!calculatedYield && dividends.length > 0) {
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            const lastYearDividends = dividends
                .filter((d: any) => new Date(d.date) >= oneYearAgo)
                .reduce((sum: number, d: any) => sum + d.dividends, 0);

            if (lastYearDividends > 0 && quote.regularMarketPrice) {
                calculatedYield = (lastYearDividends / quote.regularMarketPrice) * 100;
            }
        }

        const responseData = {
            symbol: quote.symbol,
            name: quote.shortName || quote.longName,
            currentPrice: quote.regularMarketPrice,
            currency: quote.currency,
            change: quote.regularMarketChange,
            changePercent: quote.regularMarketChangePercent,
            trailingPE: quote.trailingPE,
            forwardPE: quote.forwardPE,
            dividendYield: calculatedYield,
            geminiMetrics,
            history: history.map((day: any) => ({
                date: day.date.toISOString(),
                close: day.close
            })),
            dividends: dividends.map((div: any) => ({
                date: div.date.toISOString(),
                amount: div.dividends
            }))
        };

        // 5. Save to Cache
        try {
            // Only cache if we actually got history data
            // This prevents caching "empty" fetches (e.g. caused by IP bans or errors)
            if (responseData.history.length > 0) {
                if (!fs.existsSync(CACHE_DIR)) {
                    fs.mkdirSync(CACHE_DIR, { recursive: true });
                }
                fs.writeFileSync(cacheFilePath, JSON.stringify({
                    timestamp: Date.now(),
                    data: responseData
                }, null, 2));
                console.log(`Cached stock data for "${query}"`);
            } else {
                console.warn(`Skipping cache for "${query}" due to empty history.`);
            }
        } catch (e) {
            console.error("Failed to write to cache:", e);
        }

        return NextResponse.json(responseData);

    } catch (error: any) {
        console.error("Stock API Error:", error);

        // Handle Rate Limits specially in error response
        if (error.message?.includes("429") || error.toString().includes("Too Many Requests")) {
            return NextResponse.json({
                error: "Rate Limit Exceeded. Please try again in 1 minute.",
                details: "External API Provider (Yahoo/Google) is busy."
            }, { status: 429 });
        }

        return NextResponse.json({
            error: error.message || "Internal Server Error",
            details: error.toString()
        }, { status: 500 });
    }
}
