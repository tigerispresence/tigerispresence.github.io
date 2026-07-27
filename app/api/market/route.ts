import { NextResponse } from "next/server";
import { CACHE_HEADERS, NO_STORE } from "@/lib/server/http";
import { cachedMarketData } from "@/lib/server/cache/market";

export const maxDuration = 30;

/**
 * Market status bar.
 *
 * The previous version set `dynamic = 'force-dynamic'` and an s-maxage header
 * at the same time, and backed them with a /tmp file cache that on Vercel is
 * per-instance and wiped on cold start — so its hit rate in production was
 * close to zero. Caching now happens at the fetcher.
 */
export async function GET() {
  try {
    const data = await cachedMarketData();
    return NextResponse.json(data, {
      headers: { "Cache-Control": CACHE_HEADERS.market },
    });
  } catch (error) {
    console.error("[api/market]", error);
    return NextResponse.json(
      { error: "Failed to fetch market data" },
      { status: 500, headers: { "Cache-Control": NO_STORE } },
    );
  }
}
