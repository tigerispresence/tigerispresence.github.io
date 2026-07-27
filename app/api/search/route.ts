import { NextResponse } from "next/server";
import { KOREAN_STOCK_MAP } from "@/lib/korean_stocks";
import { searchCandidatesWithAi } from "@/lib/server/ai/symbol";
import { searchSymbols } from "@/lib/server/yahoo/fetchers";
import { hasKorean } from "@/lib/server/stock/resolveSymbol";

export const maxDuration = 30;

interface SearchResult {
  symbol: string;
  name: string;
  exchange?: string;
  type?: string;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");
  // The AI fallback is opt-in. It used to run whenever Yahoo returned fewer
  // than three results, which on a 400ms typeahead debounce meant a model call
  // roughly every third keystroke.
  const deep = searchParams.get("deep") === "1";

  if (!query) return NextResponse.json({ results: [] });

  try {
    const korean = hasKorean(query);
    const results: SearchResult[] = [];
    const seen = new Set<string>();

    const add = (result: SearchResult) => {
      if (!result.symbol || seen.has(result.symbol)) return;
      seen.add(result.symbol);
      results.push(result);
    };

    // Tier 1: static Korean alias table.
    if (korean) {
      const normalized = query.trim().replace(/\s+/g, "");
      for (const key of Object.keys(KOREAN_STOCK_MAP)) {
        if (key === normalized || (normalized.length >= 2 && key.includes(normalized))) {
          add({ ...KOREAN_STOCK_MAP[key], type: "EQUITY" });
        }
      }
    }

    // Tier 2: Yahoo's search index.
    const quotes = await searchSymbols(korean ? encodeURIComponent(query) : query, {
      quotesCount: 12,
      ...(korean ? { region: "KR", lang: "ko-KR" } : {}),
    });
    for (const q of quotes) {
      add({
        symbol: q.symbol,
        name: q.shortname || q.longname || q.symbol,
        exchange: q.exchange,
        type: q.quoteType,
      });
    }

    // Tier 3: the model, only on an explicit deep search.
    if (deep && results.length < 3) {
      const ai = await searchCandidatesWithAi(query);
      if (ai.ok) {
        for (const candidate of ai.data.candidates) {
          add({ ...candidate, type: "EQUITY" });
        }
      }
    }

    return NextResponse.json({ results: results.slice(0, 12) });
  } catch (error) {
    console.error("[api/search]", error);
    return NextResponse.json({ results: [] }, { status: 500 });
  }
}
