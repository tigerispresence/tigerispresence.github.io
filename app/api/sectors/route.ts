import { NextResponse } from "next/server";
import { CACHE_HEADERS, NO_STORE } from "@/lib/server/http";
import { cachedSectorData } from "@/lib/server/cache/sectors";

export const maxDuration = 30;

/** Sector returns, trend and rotation for the Sectors tab. */
export async function GET() {
  try {
    const data = await cachedSectorData();
    return NextResponse.json(data, {
      headers: CACHE_HEADERS.sectors,
    });
  } catch (error) {
    console.error("[api/sectors]", error);
    return NextResponse.json(
      { error: "Sector data is unavailable right now" },
      { status: 503, headers: { "Cache-Control": NO_STORE } },
    );
  }
}
