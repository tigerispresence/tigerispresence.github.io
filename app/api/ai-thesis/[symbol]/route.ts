import { NextResponse } from "next/server";
import { CACHE_HEADERS, NO_STORE } from "@/lib/server/http";
import { cachedThesis } from "@/lib/server/cache/ai";
import { getThesisContext } from "@/lib/server/insights/thesisContext";

export const maxDuration = 60;

/**
 * Bull/bear thesis. User-initiated behind a toggle, cached for 24 hours.
 *
 * Failures return 200 with `unavailable: true` rather than an error status:
 * this panel is optional, and a missing thesis should not read to the client
 * as a broken page.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw ?? "").toUpperCase().trim();
  const name = new URL(req.url).searchParams.get("name") || symbol;

  if (!symbol) {
    return NextResponse.json(
      { error: "Symbol is required" },
      { status: 400, headers: { "Cache-Control": NO_STORE } },
    );
  }

  try {
    const context = await getThesisContext(symbol);
    const thesis = await cachedThesis({ symbol, name, ...context });

    if (!thesis) {
      return NextResponse.json(
        { bullCase: "", bearCase: "", unavailable: true },
        { headers: { "Cache-Control": NO_STORE } },
      );
    }

    return NextResponse.json(thesis, {
      headers: { "Cache-Control": CACHE_HEADERS.ai },
    });
  } catch (error) {
    console.error("[api/ai-thesis]", error);
    return NextResponse.json(
      { bullCase: "", bearCase: "", unavailable: true },
      { headers: { "Cache-Control": NO_STORE } },
    );
  }
}
