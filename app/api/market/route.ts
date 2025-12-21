import { NextResponse } from 'next/server';
import yahooFinance from 'yahoo-finance2';
import { GoogleGenerativeAI } from "@google/generative-ai";

const yf = new yahooFinance();

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || "");

export async function GET() {
    try {
        // 1. Fetch VIX History (Yahoo Finance)
        // Get last 30 days of VIX data for the chart
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);

        const vixHistoryPromise = yf.historical('^VIX', {
            period1: startDate,
            period2: endDate,
            interval: '1d'
        });

        // 2. Fetch Market Sentiment Metrics (Gemini)
        // GEX, DIX, Fear & Greed are not available via standard free APIs, so we use Gemini Grounding
        const geminiPromise = (async () => {
            try {
                // Enable Google Search Grounding
                const model = genAI.getGenerativeModel({
                    model: "gemini-2.5-flash",
                    // Explicitly cast to any to avoid TS build error with googleSearch tool
                    tools: [{ googleSearch: {} } as any]
                });

                const today = new Date().toISOString().split('T')[0];
                const prompt = `
                    Find the latest market data for the following indicators. 
                    For GEX and DIX, specifically search for "SqueezeMetrics" data.
                    For Fear & Greed, search for "CNN Fear and Greed Index".
                    
                    CRITICAL: If data for today (${today}) is not available (e.g. weekend or pre-market), YOU MUST search back up to 5 days to find the most recent closing value.
                    Do not return null if a value exists within the last 5 days.

                    1. S&P 500 Gamma Exposure (GEX) in Billion USD.
                    2. Dark Index (DIX) %.
                    3. CNN Fear & Greed Index (0-100).

                    Return ONLY a valid JSON object with keys: "gex", "dix", "fearGreed".
                    Each key should contain an object with:
                    - "current": number (the most recent value found)
                    - "date": "YYYY-MM-DD" (the specific date of this 'current' value)
                    - "change": number (change from the previous value)
                    - "history": array of objects { "date": "YYYY-MM-DD", "value": number } (last 14 days history)

                    Example: 
                    { 
                        "gex": { "current": 5.2, "date": "2023-10-27", "change": 0.4, "history": [...] },
                        "dix": { "current": 45.3, "date": "2023-10-27", "change": -1.2, "history": [...] },
                        "fearGreed": { "current": 65, "date": "2023-10-27", "change": 5, "history": [...] }
                    }
                    Do not include markdown formatting or code blocks. Just the raw JSON string.
                `;
                const result = await model.generateContent(prompt);
                const text = result.response.text().replace(/```json|```/g, "").trim();
                return JSON.parse(text);
            } catch (e) {
                console.error("Gemini market metrics fetch failed:", e);
                return null;
            }
        })();

        const [vixHistory, geminiMetrics] = await Promise.all([
            vixHistoryPromise,
            geminiPromise
        ]);

        const vixData = vixHistory as any[];

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
                gex: geminiMetrics?.gex || { current: null, date: null, change: 0, history: [] },
                dix: geminiMetrics?.dix || { current: null, date: null, change: 0, history: [] },
                fearGreed: geminiMetrics?.fearGreed || { current: null, date: null, change: 0, history: [] }
            }
        });

    } catch (error) {
        console.error("Market API Error:", error);
        return NextResponse.json({ error: "Failed to fetch market data" }, { status: 500 });
    }
}
