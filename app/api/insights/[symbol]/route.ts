import { NextResponse } from "next/server";
import { CACHE_HEADERS, NO_STORE } from "@/lib/server/http";
import { cachedNewsAndSentiment } from "@/lib/server/cache/insights";

export const maxDuration = 30;

/**
 * News and analyst sentiment. No AI, so this stays fast and cheap.
 *
 * The social panel used to live here, which meant simply viewing a stock fired
 * a model request. It now sits behind ./social and runs only when the user
 * opens that tab.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw ?? "").toUpperCase().trim();

  if (!symbol) {
    return NextResponse.json(
      { error: "Symbol is required" },
      { status: 400, headers: { "Cache-Control": NO_STORE } },
    );
  }

  try {
    const data = await cachedNewsAndSentiment(symbol);
    return NextResponse.json(data, {
      headers: { "Cache-Control": CACHE_HEADERS.news },
    });
  } catch (error) {
    console.error("[api/insights]", error);
    return NextResponse.json(
      {
        news: [],
        social: {
          sentiment: "Neutral",
          summary: "Insights are temporarily unavailable.",
          trendingTopics: [],
        },
      },
      { headers: { "Cache-Control": NO_STORE } },
    );
  }
}
