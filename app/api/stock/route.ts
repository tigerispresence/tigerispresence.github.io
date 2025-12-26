import yahooFinance from 'yahoo-finance2';
const yf = new yahooFinance();
import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || "");

export async function POST(req: Request) {
    try {
        const { query, range = '1y' } = await req.json();

        if (!query) {
            return NextResponse.json({ error: "Query is required" }, { status: 400 });
        }

        let symbol = "";

        // 1. Try direct search with Yahoo Finance
        try {
            const searchResult = await yf.search(query);
            if (searchResult.quotes.length > 0) {
                symbol = searchResult.quotes[0].symbol as string;
            }
        } catch (e) {
            console.log("Yahoo search failed, trying Gemini...");
        }

        // 2. If Yahoo search failed or returned no results, use Gemini to find the ticker
        if (!symbol) {
            const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

            if (!apiKey) {
                console.error("Critical: NEXT_PUBLIC_GEMINI_API_KEY is not set in environment variables. Korean/Fallback search will fail.");
                return NextResponse.json({ error: "Configuration Error: Gemini API Key missing on server." }, { status: 500 });
            }

            try {
                // "Web Searching" Fallback using Naver Stock Autocomplete API
                // This replaces the unreliable Gemini AI fallback.
                // Endpoint: ac.stock.naver.com (Returns JSON, supports UTF-8)
                const naverUrl = `https://ac.stock.naver.com/ac?q=${encodeURIComponent(query)}&target=stock,index,test&q_enc=utf-8&st=11&r_format=json&t_koreng=1`;

                const res = await fetch(naverUrl);
                const json = await res.json();

                if (json && json.items && json.items.length > 0) {
                    const topMatch = json.items[0]; // Best match is usually first
                    const code = topMatch.code;
                    const typeCode = topMatch.typeCode; // "KOSPI" or "KOSDAQ"

                    if (code) {
                        // Append correct suffix for Yahoo Finance
                        if (typeCode === 'KOSPI') {
                            symbol = code + ".KS";
                        } else if (typeCode === 'KOSDAQ') {
                            symbol = code + ".KQ";
                        } else {
                            // Default fallback if type is unknown
                            symbol = code + ".KS";
                        }
                    }
                }
            } catch (webSearchError) {
                console.error("Naver web search failed:", webSearchError);
            }
        }

        if (!symbol) {
            return NextResponse.json({ error: "Stock not found" }, { status: 404 });
        }

        // 3. Fetch Quote Summary (Current Price, etc.)
        const quote = await yf.quote(symbol);

        // 4. Fetch Historical Data based on Range
        const endDate = new Date();
        const startDate = new Date();

        switch (range) {
            case '2y':
                startDate.setFullYear(endDate.getFullYear() - 2);
                break;
            case '3y':
                startDate.setFullYear(endDate.getFullYear() - 3);
                break;
            case '5y':
                startDate.setFullYear(endDate.getFullYear() - 5);
                break;
            case '10y':
                startDate.setFullYear(endDate.getFullYear() - 10);
                break;
            case '1y':
            default:
                startDate.setFullYear(endDate.getFullYear() - 1);
                break;
        }

        // 5. Fetch Data in Parallel (History, Dividends, Gemini Metrics)
        const [history, dividends, geminiMetrics] = await Promise.all([
            yf.historical(symbol, {
                period1: startDate,
                period2: endDate,
                interval: '1d'
            }),
            yf.historical(symbol, {
                period1: startDate,
                period2: endDate,
                interval: '1d',
                events: 'dividends'
            }),
            (async () => {
                try {
                    // Use 1.5-flash to ensure fallback works when Yahoo fails
                    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
                    const prompt = `
                        Analyze the stock "${symbol}" and provide the following financial metrics based on the most recent data available to you:
                        1. Trailing P/E Ratio (TTM)
                        2. Forward P/E Ratio
                        3. Annual Dividend Yield (%)

                        Return ONLY a JSON object with keys: "trailingPE", "forwardPE", "dividendYield".
                        Values should be numbers (or null if not applicable/found).
                        Example: { "trailingPE": 25.4, "forwardPE": 22.1, "dividendYield": 0.85 }
                        Do not include markdown formatting.
                    `;
                    const result = await model.generateContent(prompt);
                    const text = result.response.text().replace(/```json|```/g, "").trim();
                    return JSON.parse(text);
                } catch (e) {
                    console.error("Gemini metrics fetch failed:", e);
                    return null;
                }
            })()
        ]);

        // Calculate Dividend Yield from history if missing in quote
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

        return NextResponse.json({
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
        });

    } catch (error: any) {
        console.error("API Error:", error);
        return NextResponse.json({
            error: error.message || "Internal Server Error",
            details: error.toString()
        }, { status: 500 });
    }
}
