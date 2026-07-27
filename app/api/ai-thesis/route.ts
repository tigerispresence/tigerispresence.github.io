import { NextResponse } from "next/server";
import { yahooFinance } from "@/lib/server/yahoo/client";
import { getThesis } from "@/lib/server/ai/thesis";
import { FileCache } from "@/lib/server/cache/fileCache";

export const maxDuration = 60;

const cache = new FileCache("ai_thesis", 24 * 60 * 60 * 1000);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get("symbol") || "").toUpperCase();
  const name = searchParams.get("name") || symbol;

  if (!symbol) {
    return NextResponse.json({ error: "Symbol is required" }, { status: 400 });
  }

  try {
    const cached = cache.read(symbol);
    if (cached) return NextResponse.json(cached);

    // Cheap context first: with a business summary in hand the thesis call can
    // skip its web-search round-trip entirely.
    const quoteSummary = await yahooFinance
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .quoteSummary(symbol, { modules: ["price", "summaryProfile"] } as any)
      .catch(() => null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const summaryModule = (quoteSummary as any)?.summaryProfile;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const priceModule = (quoteSummary as any)?.price;

    const result = await getThesis({
      symbol,
      name,
      price: priceModule?.regularMarketPrice,
      changePercent: priceModule?.regularMarketChangePercent,
      sector: summaryModule?.sector,
      industry: summaryModule?.industry,
      businessSummary: summaryModule?.longBusinessSummary?.substring(0, 500),
    });

    if (!result.ok) {
      // 200 with an explanatory body: the panel is optional, and a failed
      // thesis should not read to the client as a broken page.
      return NextResponse.json(
        {
          bullCase: "",
          bearCase: "",
          unavailable: true,
          reason: result.reason,
        },
        { status: 200 },
      );
    }

    cache.write(symbol, result.data);
    return NextResponse.json(result.data);
  } catch (e) {
    console.error("[api/ai-thesis]", e);
    return NextResponse.json(
      { bullCase: "", bearCase: "", unavailable: true, reason: "unavailable" },
      { status: 200 },
    );
  }
}
