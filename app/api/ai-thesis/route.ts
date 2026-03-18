import { NextResponse } from 'next/server';
import { generateJsonWithFallback } from '@/lib/gemini';
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
            const cachedData = JSON.parse(fs.readFileSync(cacheFilePath, 'utf-8'));
            const isExpired = Date.now() - cachedData.timestamp > CACHE_TTL;
            if (!isExpired) {
                console.log(`[AI Thesis API] Returning CACHED thesis for: ${symbol}`);
                return NextResponse.json(cachedData.data);
            }
        }

        console.log(`[AI Thesis API] Fetching AI Bull/Bear Thesis for: ${symbol} (${name}) via Gemini...`);

        const aiAnalysis = await generateJsonWithFallback(
            `Analyze the stock "${symbol}" (${name}) and provide a concise Bull Case and Bear Case investment thesis.
             
             Return a JSON object with:
             - bullCase: string (A concise paragraph summarizing positive catalysts, max 300 chars)
             - bearCase: string (A concise paragraph summarizing risks/negatives, max 300 chars)
             
             Ensure the tone is objective and professional.`,
            { tools: [{ googleSearch: {} }] as any }
        );

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
    } catch (e: any) {
        console.error("[AI Thesis API] Generation Failed:", e);
        return NextResponse.json({
            bullCase: "Error generating insights: " + (e.message || "Unknown error"),
            bearCase: "Please check Vercel deployment logs and environment variables."
        }, { status: 500 });
    }
}
