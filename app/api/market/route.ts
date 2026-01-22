/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { yahooFinance } from '@/lib/yahoo';
import { generateJsonWithFallback } from '@/lib/gemini';
import fs from 'fs';
import path from 'path';
import os from 'os';

const CACHE_FILE = process.env.NODE_ENV === 'production'
    ? path.join(os.tmpdir(), 'market_data.json')
    : path.resolve(process.cwd(), '.cache/market_data.json');
const CACHE_DURATION = 60 * 60 * 1000; // 1 Hour (Reduced from 12 hours)

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // 1. Try reading from cache first
        let cachedData = null;
        try {
            if (fs.existsSync(CACHE_FILE)) {
                const raw = fs.readFileSync(CACHE_FILE, 'utf8');
                cachedData = JSON.parse(raw);
            }
        } catch (e) {
            console.warn("Failed to read cache:", e);
        }

        // 2. Check if cache is valid (Freshness check AND Schema check)
        const now = Date.now();
        // Check if the cache contains the new 'indices' field (Schema Migration)
        const hasNewSchema = cachedData?.data?.indices?.vix !== undefined;

        if (cachedData && (now - cachedData.timestamp < CACHE_DURATION) && hasNewSchema) {
            console.log("Using cached market data (Fresh)");
            return NextResponse.json(cachedData.data, {
                headers: {
                    // Reduce Edge Cache to 15 mins (900s), stale-while-revalidate for 5 mins
                    'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=300'
                }
            });
        }

        if (cachedData && !hasNewSchema) {
            console.log("Cache exists but has old schema (missing changePercent). Refreshing...");
        }

        console.log("Cache missing/stale. Fetching new market data...");

        // 3. Fetch New Data
        // A. Batch Fetch Yahoo Market Data (Fast & Reliable)
        const yahooPromise = (async () => {
            try {
                console.log("Fetching Market Indices via Yahoo...");
                const results = await yahooFinance.quote(['^VIX', '^GSPC', '^IXIC', 'KRW=X']);

                // Helper to extract data
                const extract = (symbol: string) => {
                    const item = results.find((r: any) => r.symbol === symbol);
                    if (!item) return { current: 0, changePercent: 0, date: null };
                    return {
                        current: item.regularMarketPrice || 0,
                        changePercent: item.regularMarketChangePercent || 0,
                        date: new Date().toISOString()
                    };
                };

                return {
                    vix: extract('^VIX'),
                    sp500: extract('^GSPC'),
                    nasdaq: extract('^IXIC'),
                    usdkrw: extract('KRW=X')
                };
            } catch (e) {
                console.error("Yahoo Batch Fetch Failed:", e);
                return null;
            }
        })();

        // B. Gemini for Fear & Greed Only (Niche Data)
        const geminiPromise = (async () => {
            try {
                const today = new Date().toISOString().split('T')[0];
                const prompt = `
                    Search for the latest "CNN Fear and Greed Index" (current score 0-100) and its daily change from yesterday.
                    
                    Return ONLY a JSON object:
                    {
                        "fearGreed": { "current": value, "date": "${today}", "changePercent": value }
                    }
                    Example: "fearGreed": { "current": 45, "date": "2024-01-01", "changePercent": -2.5 }
                `;

                const newData = await generateJsonWithFallback(prompt, {
                    tools: [{ googleSearch: {} }] as any
                });

                if (!newData?.fearGreed) throw new Error("Missing fearGreed data");
                return newData;
            } catch (error: any) {
                console.error("Gemini Market Data Error:", error.message);
                return null;
            }
        })();

        const [yahooData, geminiData] = await Promise.all([
            yahooPromise,
            geminiPromise
        ]);

        const defaultIndex = { current: 0, changePercent: 0, date: null };

        // 4. Construct Final Data
        // 4. Construct Final Data (With Stale-While-Error Fallback for Fear & Greed)
        let fearGreedData = geminiData?.fearGreed;

        if (!fearGreedData) {
            // If live fetch failed, try to reuse stale cache
            if (cachedData?.data?.fearGreed && cachedData.data.fearGreed.current !== 0) {
                console.log("Gemini failed. Using stale Fear & Greed data from cache.");
                fearGreedData = cachedData.data.fearGreed;
            } else {
                // Absolute fallback
                fearGreedData = { current: 50, changePercent: 0, date: null };
            }
        }

        const responseData = {
            indices: {
                vix: yahooData?.vix || defaultIndex,
                sp500: yahooData?.sp500 || defaultIndex,
                nasdaq: yahooData?.nasdaq || defaultIndex,
                usdkrw: yahooData?.usdkrw || defaultIndex
            },
            fearGreed: fearGreedData
        };

        // 5. Save to Cache
        try {
            // Only cache if we have at least one valid index data
            // This prevents caching "0" values when Yahoo API fails completely
            const hasValidData = responseData.indices.sp500.current > 0 || responseData.indices.vix.current > 0;

            if (hasValidData) {
                if (!fs.existsSync(path.dirname(CACHE_FILE))) {
                    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
                }
                fs.writeFileSync(CACHE_FILE, JSON.stringify({
                    timestamp: Date.now(),
                    data: responseData
                }, null, 2));
                console.log("Cached market data");
            } else {
                console.warn("Skipping cache write: Market data contains all zeros (likely API failure)");
            }
        } catch (e) {
            console.error("Failed to write to cache:", e);
        }

        return NextResponse.json(responseData, {
            headers: {
                // Reduce Edge Cache to 15 mins (900s), stale-while-revalidate for 5 mins
                'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=300'
            }
        });
    } catch (error) {
        console.error("Market API Error:", error);
        return NextResponse.json({ error: "Failed to fetch market data" }, { status: 500 });
    }
}
