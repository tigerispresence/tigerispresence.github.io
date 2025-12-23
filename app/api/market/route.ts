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
            const maxRetries = 3;
            let attempt = 0;

            while (attempt < maxRetries) {
                try {
                    // Enable Google Search Grounding
                    const model = genAI.getGenerativeModel({
                        model: "gemini-2.0-flash-exp",
                        tools: [{ googleSearch: {} } as any]
                    });

                    const today = new Date().toISOString().split('T')[0];
                    const prompt = `
                        Task: Extract the LATEST available market data (Value, Date) for these indicators.
                        
                        Indicators to Search:
                        1. "CNN Fear and Greed Index" (Current score 0-100).
                        2. "S&P 500 Gamma Exposure (GEX)" (Billions USD, often from SqueezeMetrics).
                        3. "Dark Index (DIX)" (%, often from SqueezeMetrics).
    
                        CRITICAL INSTRUCTION:
                        - If data for Today (${today}) is missing, YOU MUST Search backwards up to 7 days.
                        - ALWAYS return the most recent valid number you can find. DO NOT return null if a value exists in the last week.
                        - For Fear & Greed, specifically look for "Fear & Greed Index score today" or "latest".
    
                        Output JSON Format:
                        {
                            "gex": { "current": number | null, "date": "YYYY-MM-DD", "change": number, "history": [] },
                            "dix": { "current": number | null, "date": "YYYY-MM-DD", "change": number, "history": [] },
                            "fearGreed": { "current": number | null, "date": "YYYY-MM-DD", "change": number, "history": [] }
                        }
                        
                        Return ONLY raw JSON. No markdown.
                    `;

                    const result = await model.generateContent(prompt);
                    const text = result.response.text().replace(/```json|```/g, "").trim();
                    return JSON.parse(text);

                } catch (e: any) {
                    console.error(`Gemini fetch attempt ${attempt + 1} failed:`, e.message);
                    attempt++;
                    if (attempt === maxRetries) return null;
                    // Wait 2 seconds before retrying
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
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
