import { NextResponse } from "next/server";
import { CACHE_HEADERS, NO_STORE } from "@/lib/server/http";
import { toApiError } from "@/lib/server/errors";
import { isStockRange } from "@/lib/server/stock/dateRange";
import { getStockPayload } from "@/lib/server/stock/getStockPayload";
import { resolveSymbol } from "@/lib/server/stock/resolveSymbol";

export const maxDuration = 60;

/**
 * GET rather than POST so the response is CDN-cacheable. A POST response never
 * is, which made the previous route's s-maxage header dead weight.
 *
 * No filesystem cache here any more: the per-fetcher "use cache" layer handles
 * it, and writing to disk on Vercel was either impossible (the deployment
 * filesystem is read-only) or pointless (/tmp is per-instance and wiped on
 * cold start).
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  try {
    const { symbol: raw } = await params;
    const query = decodeURIComponent(raw ?? "").trim();

    if (!query) {
      return NextResponse.json(
        { error: "Symbol is required" },
        { status: 400, headers: { "Cache-Control": NO_STORE } },
      );
    }

    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") ?? "1y";
    const from = searchParams.get("from") ?? undefined;

    if (!isStockRange(range)) {
      return NextResponse.json(
        { error: `Unsupported range "${range}"` },
        { status: 400, headers: { "Cache-Control": NO_STORE } },
      );
    }

    const resolved = await resolveSymbol(query);
    if (!resolved) {
      return NextResponse.json(
        { error: "Stock not found" },
        { status: 404, headers: { "Cache-Control": NO_STORE } },
      );
    }

    const payload = await getStockPayload(resolved, range, from);

    return NextResponse.json(payload, {
      headers: { "Cache-Control": CACHE_HEADERS.stock },
    });
  } catch (error) {
    console.error("[api/stock]", error);
    const { status, body } = toApiError(error);
    return NextResponse.json(body, {
      status,
      headers: { "Cache-Control": NO_STORE },
    });
  }
}
