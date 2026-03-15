/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { generateJsonWithFallback } from '@/lib/gemini';

export const maxDuration = 60; // Set Vercel max execution time to 60 seconds

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get('symbol');
    const name = searchParams.get('name') || symbol;

    if (!symbol) {
        return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    try {
        console.log(`[AI Thesis API] Fetching AI Bull/Bear Thesis for: ${symbol} (${name}) via Gemini...`);

        const aiAnalysis = await generateJsonWithFallback(
            `Analyze the stock "${symbol}" (${name}) and provide a concise Bull Case and Bear Case investment thesis.
             
             Return a JSON object with:
             - bullCase: string (A concise paragraph summarizing positive catalysts, max 300 chars)
             - bearCase: string (A concise paragraph summarizing risks/negatives, max 300 chars)
             
             Ensure the tone is objective and professional.`,
            { tools: [{ googleSearch: {} }] as any }
        );

        return NextResponse.json(aiAnalysis);
    } catch (e: any) {
        console.error("[AI Thesis API] Generation Failed:", e);
        return NextResponse.json({
            bullCase: "Error generating insights: " + (e.message || "Unknown error"),
            bearCase: "Please check Vercel deployment logs and environment variables."
        }, { status: 500 });
    }
}
