import { NextResponse } from "next/server";
import { CACHE_HEADERS, NO_STORE } from "@/lib/server/http";
import { cachedSectorMacroData } from "@/lib/server/cache/sectorMacro";

export const maxDuration = 30;

/** Sectors against CPI and Treasury yields, for the Sectors tab's macro section. */
export async function GET() {
  try {
    const data = await cachedSectorMacroData();
    return NextResponse.json(data, {
      headers: CACHE_HEADERS.macro,
    });
  } catch (error) {
    console.error("[api/sectors/macro]", error);
    return NextResponse.json(
      { error: "Macro data is unavailable right now" },
      { status: 503, headers: { "Cache-Control": NO_STORE } },
    );
  }
}
