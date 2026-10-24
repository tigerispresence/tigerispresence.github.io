import type { StockData } from "@/lib/types/stock";
import type { SectorData } from "@/lib/types/sectors";
import type { SectorMacroData } from "@/lib/types/macro";

/**
 * Client-side API helpers.
 *
 * Centralised so the three call sites that used to build the stock request by
 * hand cannot drift apart, and so the GET-based URLs live in one place.
 */

export interface FetchStockOptions {
  range?: string;
  /** Explicit start date for the custom-range slider. */
  from?: string;
}

export async function fetchStock(
  symbol: string,
  { range = "1y", from }: FetchStockOptions = {},
): Promise<StockData> {
  const params = new URLSearchParams({ range });
  if (from) params.set("from", from);

  const res = await fetch(
    `/api/stock/${encodeURIComponent(symbol)}?${params}`,
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Failed to fetch stock data");
  }
  return res.json();
}

export async function fetchSectors(): Promise<SectorData> {
  const res = await fetch("/api/sectors");
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Failed to fetch sector data");
  }
  return res.json();
}

export async function fetchSectorMacro(): Promise<SectorMacroData> {
  const res = await fetch("/api/sectors/macro");
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Failed to fetch macro data");
  }
  return res.json();
}

export async function fetchMarket() {
  const res = await fetch("/api/market");
  if (!res.ok) throw new Error("Failed to fetch market data");
  return res.json();
}

/**
 * Ticker search.
 *
 * `deep` opts into the AI fallback and must stay off the typeahead path — it
 * previously ran on a 400ms debounce, firing a model call on roughly every
 * third keystroke.
 */
export async function fetchSearch(query: string, { deep = false } = {}) {
  const params = new URLSearchParams({ q: query });
  if (deep) params.set("deep", "1");
  const res = await fetch(`/api/search?${params}`);
  if (!res.ok) return { results: [] };
  return res.json();
}

export async function fetchInsights(symbol: string) {
  const res = await fetch(`/api/insights/${encodeURIComponent(symbol)}`);
  if (!res.ok) throw new Error("Failed to fetch insights");
  return res.json();
}

/** Separate from insights: this is the AI half, fetched only on demand. */
export async function fetchSocialPosts(symbol: string) {
  const res = await fetch(`/api/insights/${encodeURIComponent(symbol)}/social`);
  if (!res.ok) throw new Error("Failed to fetch social posts");
  return res.json();
}

export async function fetchThesis(symbol: string, name: string) {
  const res = await fetch(
    `/api/ai-thesis/${encodeURIComponent(symbol)}?name=${encodeURIComponent(name)}`,
  );
  if (!res.ok) throw new Error("Failed to fetch thesis");
  return res.json();
}

export type AskContext = { kind: "stock"; symbol: string } | { kind: "sectors" };

export interface AskTurn {
  role: "user" | "assistant";
  content: string;
}

/** Streamed events from /api/ask; mirrors AskEvent on the server. */
export type AskStreamEvent =
  | { type: "status"; text: string }
  | { type: "text"; text: string }
  | { type: "sources"; sources: { title: string; url: string }[] }
  | { type: "error"; message: string }
  | { type: "done" };

export class AskError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
  }
}

/** Ask Claude about what is on screen, calling `onEvent` as the answer streams in. */
export async function askClaude(
  request: { question: string; context: AskContext; history: AskTurn[] },
  onEvent: (event: AskStreamEvent) => void,
  { signal, accessCode }: { signal?: AbortSignal; accessCode?: string } = {},
): Promise<void> {
  const res = await fetch("/api/ask", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessCode ? { "x-ask-code": accessCode } : {}),
    },
    body: JSON.stringify(request),
    signal,
  });
  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => ({}));
    throw new AskError(body.error || "Failed to ask Claude", body.code);
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) if (line.trim()) onEvent(JSON.parse(line) as AskStreamEvent);
  }
  if (buffer.trim()) onEvent(JSON.parse(buffer) as AskStreamEvent);
}
