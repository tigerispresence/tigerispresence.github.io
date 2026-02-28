/* eslint-disable @typescript-eslint/no-explicit-any */
import { yahooFinance } from '@/lib/yahoo';
import { NextResponse } from "next/server";
import { generateJsonWithFallback } from '@/lib/gemini';
import { KOREAN_STOCK_MAP } from '@/lib/korean_stocks';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';

const CACHE_DIR = process.env.NODE_ENV === 'production'
    ? path.join(os.tmpdir(), 'stock_data')
    : path.resolve(process.cwd(), '.cache/stock_data');
const CACHE_DURATION = 60 * 60 * 1000; // 1 Hour Cache for Stock Data

export const maxDuration = 60; // Set Vercel max execution time to 60 seconds

export async function POST(req: Request) {
    try {
        const { query, range = '1y', from } = await req.json();

        if (!query) {
            return NextResponse.json({ error: "Query is required" }, { status: 400 });
        }

        // 1. Check Cache
        // Create a unique filename hash based on query and range
        const cacheKey = crypto.createHash('md5').update(`${query}-${range}-${from || ''}`).digest('hex');
        const cacheFilePath = path.join(CACHE_DIR, `${cacheKey}.json`);

        // let cachedData = null; // Unused 
        try {
            if (fs.existsSync(cacheFilePath)) {
                // ... cache logic ...
                const raw = fs.readFileSync(cacheFilePath, 'utf8');
                const cached = JSON.parse(raw);
                if (Date.now() - cached.timestamp < CACHE_DURATION) {
                    console.log(`Using cached data for "${query}" (${range})`);
                    return NextResponse.json(cached.data);
                }
            }
        } catch (e) {
            console.warn("Failed to read cache:", e);
        }

        // ... (skipping to date logic) ...

        // 4. Fetch Historical Data based on Range (Still using Yahoo)
        const endDate = new Date();
        const startDate = new Date();

        if (from) {
            startDate.setTime(new Date(from).getTime());
        } else {
            switch (range) {
                case '2y': startDate.setFullYear(endDate.getFullYear() - 2); break;
                case '3y': startDate.setFullYear(endDate.getFullYear() - 3); break;
                case '5y': startDate.setFullYear(endDate.getFullYear() - 5); break;
                case '10y': startDate.setFullYear(endDate.getFullYear() - 10); break;
                case '1y': default: startDate.setFullYear(endDate.getFullYear() - 1); break;
            }
        }


        // 2. Resolve Symbol
        let symbol = "";
        let stockName = "";



        // 0. Static Map Check (Fastest Fallback)
        if (/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(query)) {
            const normalizedQuery = query.trim().replace(/\s+/g, '');
            // Check for exact keys or partial keys (if short enough)
            const matchKey = Object.keys(KOREAN_STOCK_MAP).find(key =>
                key === normalizedQuery || (normalizedQuery.length >= 2 && key.includes(normalizedQuery))
            );
            if (matchKey) {
                const candidate = KOREAN_STOCK_MAP[matchKey];
                symbol = candidate.symbol;
                stockName = candidate.name;
                console.log(`Static map found symbol: ${symbol} (${stockName})`);
            }
        }

        // A. Try direct search with Yahoo Finance (Primary)
        // Only run if we didn't find a symbol in static map
        if (!symbol) {
            try {
                console.log(`Searching for symbol: ${query} via Yahoo...`);

                // 1. Determine Search Context (Korean vs Global)
                const hasKorean = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(query);
                const searchOptions = hasKorean
                    ? { quotesCount: 1, newsCount: 0, region: 'KR', lang: 'ko-KR' }
                    : { quotesCount: 1, newsCount: 0 };

                // Yahoo Finance API can choke on raw Korean characters, so we encode them.
                const searchQuery = hasKorean ? encodeURIComponent(query) : query;

                const searchResult = await yahooFinance.search(searchQuery, searchOptions);
                if (searchResult.quotes.length > 0) {
                    const firstQuote = searchResult.quotes[0];
                    symbol = firstQuote.symbol;
                    stockName = firstQuote.shortname || firstQuote.longname || firstQuote.symbol;
                    console.log(`Yahoo found symbol: ${symbol}`);
                }
            } catch (e) {
                console.warn("Yahoo search failed, trying fallback...", e);
            }

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

        const aiAnalysisPromise = (async () => {
            try {
                console.log("Fetching AI Bull/Bear Thesis via Gemini...");
                return await generateJsonWithFallback(
                    `Analyze the stock "${symbol}" (${stockName}) and provide a concise Bull Case and Bear Case investment thesis.
                     
                     Return a JSON object with:
                     - bullCase: string (A concise paragraph summarizing positive catalysts, max 300 chars)
                     - bearCase: string (A concise paragraph summarizing risks/negatives, max 300 chars)
                     
                     Ensure the tone is objective and professional.`,
                    { tools: [{ googleSearch: {} }] as any }
                );
            } catch (e: any) {
                console.error("AI Thesis Generation Failed", e);
                return {
                    bullCase: "Error generating insights: " + (e.message || "Unknown error"),
                    bearCase: "Please check Vercel deployment logs and environment variables."
                };
            }
        })();

        const maxPainPromise = (async () => {
            try {
                console.log("Fetching options data for Max Pain...");
                const result = await yahooFinance.options(symbol);
                if (result.options && result.options.length > 0) {
                    const opts = result.options[0];
                    const allStrikes = Array.from(new Set([
                        ...opts.calls.map((c: any) => c.strike),
                        ...opts.puts.map((p: any) => p.strike)
                    ])).sort((a, b) => a - b);

                    let minPain = Infinity;
                    let maxPainStrike = 0;

                    for (const S of allStrikes) {
                        let currentPain = 0;
                        for (const c of opts.calls) {
                            if (S > c.strike) {
                                currentPain += (S - c.strike) * (c.openInterest || 0);
                            }
                        }
                        for (const p of opts.puts) {
                            if (S < p.strike) {
                                currentPain += (p.strike - S) * (p.openInterest || 0);
                            }
                        }

                        if (currentPain < minPain) {
                            minPain = currentPain;
                            maxPainStrike = S;
                        }
                    }
                    return {
                        price: maxPainStrike,
                        expirationDate: opts.expirationDate.toISOString()
                    };
                }
                return null;
            } catch (e) {
                console.warn("Max Pain fetch failed:", e);
                return null;
            }
        })();

        const [history, dividends, geminiMetrics, quoteSummaryResult, seasonalityHistory, aiAnalysis, maxPain] = await Promise.all([
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
            metricsPromise,
            yahooFinance.quoteSummary(symbol, { modules: ['financialData', 'upgradeDowngradeHistory', 'earningsHistory', 'incomeStatementHistoryQuarterly'] }).catch((e: any) => {
                console.warn("Yahoo FinancialData/History failed:", e);
                return null;
            }),
            yahooFinance.historical(symbol, {
                period1: new Date(new Date().setFullYear(new Date().getFullYear() - 10)), // 10 years for seasonality
                period2: new Date(),
                interval: '1mo'
            }).catch((e: any) => {
                console.warn("Yahoo Seasonality History failed:", e);
                return [] as any[];
            }),
            aiAnalysisPromise,
            maxPainPromise
        ]);

        // Extract Analyst Data
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const financialData = quoteSummaryResult?.financialData;
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        // const earnings = quoteSummaryResult?.earnings; // Unused
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const upgradeHistory = quoteSummaryResult?.upgradeDowngradeHistory?.history;
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const earningsHistory = quoteSummaryResult?.earningsHistory?.history;
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const incomeStatementHistory = quoteSummaryResult?.incomeStatementHistoryQuarterly?.incomeStatementHistory;

        // Process Individual Analyst Targets from History
        const uniqueFirms = new Set();
        const analystHistory = [];

        if (Array.isArray(upgradeHistory)) {
            // Sort by date new to old (should be default, but ensure it)
            const sortedHistory = [...upgradeHistory].sort((a, b) =>
                new Date(b.epochGradeDate).getTime() - new Date(a.epochGradeDate).getTime()
            );

            for (const item of sortedHistory) {
                if (item.currentPriceTarget && item.firm && !uniqueFirms.has(item.firm)) {
                    uniqueFirms.add(item.firm);
                    analystHistory.push({
                        firm: item.firm,
                        target: item.currentPriceTarget,
                        date: item.epochGradeDate,
                        action: item.action
                    });
                }
            }
            console.log(`[StockAPI] Found ${analystHistory.length} unique analyst targets for ${symbol} from ${upgradeHistory.length} history items.`);
        } else {
            console.log(`[StockAPI] No upgrade history found for ${symbol}`);
        }

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

        // 5. AI Thesis already generated from Promise.all

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
            priceTargets: financialData ? {
                low: financialData.targetLowPrice,
                high: financialData.targetHighPrice,
                mean: financialData.targetMeanPrice,
                median: financialData.targetMedianPrice,
                numberOfAnalysts: financialData.numberOfAnalystOpinions,
            } : null,
            analystHistory: analystHistory, // Add processed individual targets
            history: history.map((day: any) => ({
                date: day.date.toISOString(),
                close: day.close
            })),
            dividends: dividends.map((div: any) => ({
                date: div.date.toISOString(),
                amount: div.dividends
            })),
            seasonality: seasonalityHistory.map((item: any) => ({
                date: item.date.toISOString(),
                close: item.close
            })),
            financials: (earningsHistory && incomeStatementHistory) ? {
                financialsChart: {
                    quarterly: (() => {
                        // Create a map of revenue by date (approximate matching by quarter)
                        const revenueMap = new Map();
                        incomeStatementHistory.forEach((item: any) => {
                            const date = new Date(item.endDate);
                            const quarterLabel = date.getFullYear() + ' Q' + Math.floor((date.getMonth() + 3) / 3);
                            revenueMap.set(quarterLabel, item.totalRevenue);
                        });

                        return earningsHistory.map((item: any) => {
                            // Use 'quarter' field if available, otherwise fallback to epochGradeDate
                            const dateStr = item.quarter || item.epochGradeDate;
                            const date = new Date(dateStr);
                            const quarterLabel = date.getFullYear() + ' Q' + Math.floor((date.getMonth() + 3) / 3);
                            const revenueVal = revenueMap.get(quarterLabel) || 0;

                            return {
                                date: quarterLabel,
                                revenue: { raw: revenueVal, fmt: (revenueVal / 1e9).toFixed(2) + "B", longFmt: revenueVal.toLocaleString() },
                                earnings: { raw: item.epsActual, fmt: item.epsActual?.toFixed(2), longFmt: item.epsActual?.toFixed(2) }
                            };
                        }).sort((a: any, b: any) => {
                            // Ensure strict chronological order (Oldest -> Newest)
                            const dateA = a.date.split(' Q');
                            const dateB = b.date.split(' Q');
                            return (parseInt(dateA[0]) - parseInt(dateB[0])) || (parseInt(dateA[1]) - parseInt(dateB[1]));
                        });
                    })(),
                    yearly: []
                },
                financialCurrency: quote.currency
            } : null,
            aiAnalysis: aiAnalysis,
            maxPain: maxPain
        };

        // 5. Save to Cache
        try {
            // Only cache if we actually got history data AND valid price
            // This prevents caching "empty" fetches (e.g. caused by IP bans or errors)
            if (responseData.history.length > 0 && responseData.currentPrice && responseData.currentPrice > 0) {
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
