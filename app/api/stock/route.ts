import { NextResponse } from "next/server";
import { FileCache } from "@/lib/server/cache/fileCache";
import { toApiError } from "@/lib/server/errors";
import { getStockPayload } from "@/lib/server/stock/getStockPayload";
import { resolveSymbol } from "@/lib/server/stock/resolveSymbol";
import { normalizeSymbol } from "@/lib/utils/symbols";

export const maxDuration = 60;

const cache = new FileCache("stock_data", 60 * 60 * 1000);

export async function POST(req: Request) {
  try {
    const { query, range = "1y", from } = await req.json();

    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    const cacheKey = `${normalizeSymbol(query)}-${range}-${from ?? ""}`;
    const cached = cache.read(cacheKey);
    if (cached) return NextResponse.json(cached);

    const resolved = await resolveSymbol(query);
    if (!resolved) {
      return NextResponse.json({ error: "Stock not found" }, { status: 404 });
    }

    const payload = await getStockPayload(resolved, range, from);

    // Never cache an empty or price-less result: those come from transient
    // upstream failures and would otherwise be served for the full TTL.
    if (payload.history.length > 0 && payload.currentPrice > 0) {
      cache.write(cacheKey, payload);
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.error("[api/stock]", error);
    const { status, body } = toApiError(error);
    return NextResponse.json(body, { status });
  }
}
