import { NextResponse } from 'next/server';
import yahooFinance from 'yahoo-finance2';
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from 'fs';
import path from 'path';

const yf = new yahooFinance();
const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || "");
const CACHE_FILE = path.resolve(process.cwd(), '.cache/market_data.json');
const CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 Hours

export async function GET() {
    try {
        // 1. Fetch VIX History (Yahoo Finance)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);

        const vixHistoryPromise = yf.historical('^VIX', {
            period1: startDate,
            period2: endDate,
            interval: '1d'
        });

        // 2. Fetch Market Sentiment (Persistent Cache -> Gemini Search -> Fallback)
        const geminiPromise = (async () => {
            // A. Try reading from cache first
            let cachedData = null;
            try {
                if (fs.existsSync(CACHE_FILE)) {
                    const raw = fs.readFileSync(CACHE_FILE, 'utf8');
                    cachedData = JSON.parse(raw);
                }
            } catch (e) {
                console.warn("Failed to read cache:", e);
            }

            // B. Check if cache is valid (Freshness check)
            const now = Date.now();
            if (cachedData && (now - cachedData.timestamp < CACHE_DURATION)) {
                console.log("Using cached market data (Fresh)");
                return cachedData.data;
            }

            // C. Try fetching new data (if cache stale or missing)
            try {
                console.log("Cache missing/stale. Fetching new market data...");
                // Use 2.0-flash-exp to enable Google Search (needed for real data)
                const model = genAI.getGenerativeModel({
                    model: "gemini-2.0-flash-exp",
                    tools: [{ googleSearch: {} }] as any
                });

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

                const result = await model.generateContent(prompt);
                const text = result.response.text().replace(/```json|```/g, "").trim();
                const newData = JSON.parse(text);

                // Validation: Ensure we actually got a number for Fear & Greed
                if (newData.fearGreed && typeof newData.fearGreed.current === 'number') {
                    // Save to cache
                    fs.writeFileSync(CACHE_FILE, JSON.stringify({
                        timestamp: now,
                        data: newData
                    }, null, 2));
                    console.log("Market data refreshed and cached.");
                    return newData;
                } else {
                    throw new Error("Invalid format/missing data from API");
                }

            } catch (apiError: any) {
                console.error("Gemini Search failed (Rate Limit/Error):", apiError.message);

                // D. Fallback: Return stale cache if available
                if (cachedData) {
                    console.warn("Returning STALE cache due to API failure.");
                    return cachedData.data;
                }

                // E. Last Resort: Internal Estimate (without search)
                console.warn("No cache. Fallback to estimation.");
                return null; // The frontend or next step will handle nulls (or we can estimate here)
            }
        })();

        const [vixHistory, geminiMetrics] = await Promise.all([
            vixHistoryPromise,
            geminiPromise
        ]);

        const vixData = vixHistory as any[];

        // Default structure for metrics
        const defaultMetrics = {
            gex: { current: null, date: null, change: 0, history: [] },
            dix: { current: null, date: null, change: 0, history: [] },
            fearGreed: { current: 50, date: null, change: 0, history: [] } // Default 50 neutral
        };

        const finalMetrics = geminiMetrics || defaultMetrics;

        // If we really fell back to null but have VIX, maybe we can estimate Fear/Greed roughly? 
        // For now, let's stick to the default neutral to avoid confusion if search fails completely.

        return NextResponse.json({
            vix: {
                current: vixData[vixData.length - 1]?.close || 0,
                date: vixData[vixData.length - 1]?.date ? new Date(vixData[vixData.length - 1].date).toISOString().split('T')[0] : null,
                history: vixData.map((day: any) => ({
                    date: day.date.toISOString(),
                    close: day.close
                }))
            },
            metrics: {
                gex: finalMetrics.gex || defaultMetrics.gex,
                dix: finalMetrics.dix || defaultMetrics.dix,
                fearGreed: finalMetrics.fearGreed || defaultMetrics.fearGreed
            }
        });

    } catch (error) {
        console.error("Market API Error:", error);
        return NextResponse.json({ error: "Failed to fetch market data" }, { status: 500 });
    }
}
