import { NextResponse } from "next/server";
import { CACHE_HEADERS, NO_STORE } from "@/lib/server/http";
import { backupSocialLinks } from "@/lib/server/ai/social";
import { cachedSocialPosts } from "@/lib/server/cache/ai";
import { cachedNewsContext } from "@/lib/server/cache/insights";

export const maxDuration = 60;

/**
 * Trending social discussions. Separated from the news route because this is
 * the expensive half — a web-search-backed model call — and should only run
 * when the user actually opens the panel.
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
    const context = await cachedNewsContext(symbol);
    const posts = await cachedSocialPosts({ symbol, ...context });

    return NextResponse.json(
      // Generic search links whenever the model call is unavailable or empty.
      { posts: posts ?? backupSocialLinks(symbol), generated: posts !== null },
      { headers: { "Cache-Control": CACHE_HEADERS.ai } },
    );
  } catch (error) {
    console.error("[api/insights/social]", error);
    return NextResponse.json(
      { posts: backupSocialLinks(symbol), generated: false },
      { headers: { "Cache-Control": NO_STORE } },
    );
  }
}
