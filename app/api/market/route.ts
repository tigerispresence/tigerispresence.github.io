import { NextResponse } from 'next/server';
import { yahooFinance } from '@/lib/yahoo';
import { generateJsonWithFallback } from '@/lib/gemini';
import fs from 'fs';
import path from 'path';

const CACHE_FILE = path.resolve(process.cwd(), '.cache/market_data.json');
const CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 Hours

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

        // 2. Check if cache is valid (Freshness check)
        const now = Date.now();
        if (cachedData && (now - cachedData.timestamp < CACHE_DURATION)) {
            console.log("Using cached market data (Fresh)");
            return NextResponse.json(cachedData.data);
        }

        console.log("Cache missing/stale. Fetching new market data...");

        // 3. Fetch New Data (VIX + Gemini)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);

        // 3. Fetch New Data (VIX - Yahoo Primary, Gemini Fallback)
        const vixPromise = (async () => {
            // A. Try Yahoo First (Primary)
            try {
                console.log("Fetching VIX via Yahoo...");
                const result = await yahooFinance.quote('^VIX');
                if (result && result.regularMarketPrice) {
                    return [{
                        date: new Date(),
                        close: result.regularMarketPrice
                    }];
                }
            } catch (e) {
                console.warn("Yahoo VIX failed, trying Gemini fallback...", e);
            }

            // B. Fallback: Gemini Search
            try {
                console.log("Fetching VIX via Gemini (Fallback)...");
                const result = await generateJsonWithFallback(
                    `Search for the current price/value of the CBOE Volatility Index (^VIX).
                     Return a JSON object: { "price": number, "date": "YYYY-MM-DD" }`,
                    { tools: [{ googleSearch: {} }] as any }
                );

                if (result && result.price) {
                    return [{
                        date: new Date(),
                        close: result.price
                    }];
                }
                return [];
            } catch (e) {
                console.error("Gemini VIX Fetch Error:", e);
                return [];
            }
        })();

        // Use 2.0-flash-exp to enable Google Search (needed for real data)
        const geminiPromise = (async () => {
            try {
                const today = new Date().toISOString().split('T')[0];
                const prompt = `
                    Search for the latest values of:
                    1. "CNN Fear and Greed Index" (current score 0-100).
                    2. "S&P 500 Gamma Exposure" (GEX) -> Source: SqueezeMetrics.
                    3. "Dark Index" (DIX) -> Source: SqueezeMetrics.

                    Return ONLY a JSON object:
                    {
                        "gex": { "current": value, "date": "${today}", "change": 0 },
                        "dix": { "current": value, "date": "${today}", "change": 0 },
                        "fearGreed": { "current": value, "date": "${today}", "change": 0 }
                    }
                    Fill null if not found. Do not use Markdown.
                    IMPORTANT: If real-time GEX/DIX is not available, estimate based on recent VIX or find the last known closing value (e.g. yesterday).
                `;

                const newData = await generateJsonWithFallback(prompt, {
                    tools: [{ googleSearch: {} }] as any
                });

                // Basic validation
                if (!newData.fearGreed) throw new Error("Missing fearGreed data");

                return newData;
            } catch (error: any) {
                console.error("Gemini Market Data Error:", error.message);
                return null;
            }
        })();

        const [vixHistory, geminiMetrics] = await Promise.all([
            vixPromise,
            geminiPromise
        ]);

        // 4. Construct Final Data
        const vixData = vixHistory as any[];

        // Prepare VIX response format
        const vixResponse = {
            current: vixData.length > 0 ? vixData[vixData.length - 1].close : 0,
            date: vixData.length > 0 ? new Date(vixData[vixData.length - 1].date).toISOString().split('T')[0] : null,
            history: vixData.map((day: any) => ({
                date: day.date.toISOString(),
                close: day.close
            }))
        };

        const defaultMetrics = {
            gex: { current: null, date: null, change: 0, history: [] },
            dix: { current: null, date: null, change: 0, history: [] },
            fearGreed: { current: 50, date: null, change: 0, history: [] }
        };

        const finalMetrics = geminiMetrics || (cachedData ? cachedData.data.metrics : defaultMetrics);

        const responseData = {
            vix: vixResponse,
            metrics: {
                gex: finalMetrics.gex || defaultMetrics.gex,
                dix: finalMetrics.dix || defaultMetrics.dix,
                fearGreed: finalMetrics.fearGreed || defaultMetrics.fearGreed
            }
        };

        // 5. Update Cache (Only if we got at least some data)
        // Note: If Gemini failed but we have VIX, we might still want to update cache? 
        // Or arguably, if Gemini failed, we shouldn't overwrite cache with "null" metrics.
        // Logic: If Gemini succeeded, write to cache.
        if (geminiMetrics) {
            try {
                if (!fs.existsSync(path.dirname(CACHE_FILE))) {
                    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
                }
                fs.writeFileSync(CACHE_FILE, JSON.stringify({
                    timestamp: now,
                    data: responseData
                }, null, 2));
                console.log("Market data refreshed and cached.");
            } catch (err) {
                console.error("Failed to write cache:", err);
            }
        } else if (cachedData) {
            // If fetch failed but we have stale cache, return stale cache preference?
            // Actually we already constructed responseData using stale cache if Gemini failed.
            console.warn("Using partial/stale data due to API failure.");
        }

        return NextResponse.json(responseData);

    } catch (error) {
        console.error("Market API Error:", error);
        return NextResponse.json({ error: "Failed to fetch market data" }, { status: 500 });
    }
}
