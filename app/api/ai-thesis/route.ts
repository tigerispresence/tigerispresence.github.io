import { NextResponse } from 'next/server';
import { generateJsonWithFallback } from '@/lib/gemini';
import { yahooFinance } from '@/lib/yahoo';
import fs from 'fs';
import path from 'path';

export const maxDuration = 60; // Set Vercel max execution time to 60 seconds

const CACHE_DIR = path.join(process.cwd(), '.cache', 'ai_thesis');
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const symbol = (searchParams.get('symbol') || '').toUpperCase();
    const name = searchParams.get('name') || symbol;

    if (!symbol) {
        return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    const cacheFilePath = path.join(CACHE_DIR, `${symbol}.json`);

    try {
        // 1. Check Cache
        if (fs.existsSync(cacheFilePath)) {
            try {
                const cachedData = JSON.parse(fs.readFileSync(cacheFilePath, 'utf-8'));
                if (Date.now() - cachedData.timestamp < CACHE_TTL) {
                    console.log(`[AI Thesis API] Returning CACHED thesis for: ${symbol}`);
                    return NextResponse.json(cachedData.data);
                }
            } catch (e) {
                console.warn("[AI Thesis API] Cache Read Failed:", e);
            }
        }

        console.log(`[AI Thesis API] Fetching context for ${symbol} via Yahoo...`);
        
        // Fetch minimal context to avoid extra Gemini search costs
        const quoteSummary = await yahooFinance.quoteSummary(symbol, { 
            modules: ['price', 'summaryProfile', 'financialData'] 
        }).catch(() => null);

        const price = quoteSummary?.price?.regularMarketPrice;
        const change = quoteSummary?.price?.regularMarketChangePercent;
        const sector = quoteSummary?.summaryProfile?.sector;
        const industry = quoteSummary?.summaryProfile?.industry;
        const summary = quoteSummary?.summaryProfile?.longBusinessSummary?.substring(0, 500);

        console.log(`[AI Thesis API] Generating thesis for: ${symbol} using context...`);

        const prompt = `
             Analyze the stock "${symbol}" (${name}).
             Current Context:
             - Price: ${price ? price : 'N/A'}
             - 1D Change: ${change ? (change * 100).toFixed(2) + '%' : 'N/A'}
             - Sector: ${sector || 'N/A'}
             - Industry: ${industry || 'N/A'}
             - Business Summary: ${summary || 'N/A'}
             
             Provide a concise Bull Case and Bear Case investment thesis based on this data and your knowledge.
             If the context is insufficient, you may use external knowledge.
             
             Return a JSON object with:
             - bullCase: string (A concise paragraph summarizing positive catalysts, max 300 chars)
             - bearCase: string (A concise paragraph summarizing risks/negatives, max 300 chars)
             
             Tone: Objective and professional.
        `;

        // Optimization: We only use tools if we absolutely have NO context
        const options: { tools?: unknown[] } = {};
        if (!summary) {
            options.tools = [{ googleSearch: {} }];
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const aiAnalysis = await generateJsonWithFallback(prompt, options as any);

        // 2. Save to Cache
        try {
            if (!fs.existsSync(CACHE_DIR)) {
                fs.mkdirSync(CACHE_DIR, { recursive: true });
            }
            fs.writeFileSync(cacheFilePath, JSON.stringify({
                timestamp: Date.now(),
                data: aiAnalysis
            }, null, 2));
        } catch (cacheError) {
            console.error("[AI Thesis API] Cache Write Failed:", cacheError);
        }

        return NextResponse.json(aiAnalysis);
    } catch (e: unknown) {
        console.error("[AI Thesis API] Generation Failed:", e);
        const errorMessage = e instanceof Error ? e.message : "Unknown error";
        return NextResponse.json({
            bullCase: "Error generating insights: " + errorMessage,
            bearCase: "Rate limits or API issues encountered. Please try again later."
        }, { status: 500 });
    }
}
