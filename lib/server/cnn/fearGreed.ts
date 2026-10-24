import type { FearGreedPoint } from "@/lib/types/stock";

/**
 * CNN's Fear & Greed index.
 *
 * This endpoint is undocumented and rejects requests that don't look like they
 * came from cnn.com, hence the browser-ish headers. It was previously
 * copy-pasted verbatim into both the stock and market routes.
 */
const GRAPH_DATA_URL =
  "https://production.dataviz.cnn.io/index/fearandgreed/graphdata";

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  Referer: "https://www.cnn.com/",
  Origin: "https://www.cnn.com",
};

export interface FearGreedCurrent {
  current: number;
  rating?: string;
  date?: string;
}

interface GraphDataResponse {
  fear_and_greed?: { score?: number; rating?: string; timestamp?: string | number };
  fear_and_greed_historical?: {
    data?: Array<{ x: number; y: number; rating: string }>;
  };
}

/**
 * The feed's first day. The endpoint takes a start date (`/graphdata/YYYY-MM-DD`)
 * and returns daily readings from then on; without one it returns about a
 * year. Earlier start dates are rejected with a 500.
 */
export const FEAR_GREED_EARLIEST = "2020-07-15";

async function fetchGraphData(start?: string): Promise<GraphDataResponse | null> {
  try {
    const url = start ? `${GRAPH_DATA_URL}/${start}` : GRAPH_DATA_URL;
    const response = await fetch(url, { headers: BROWSER_HEADERS });
    if (!response.ok) throw new Error(`CNN API status ${response.status}`);
    return (await response.json()) as GraphDataResponse;
  } catch (error) {
    console.error("[cnn] fear & greed fetch failed:", error);
    return null;
  }
}

/**
 * Daily Fear & Greed readings since `start`, falling back to the default
 * one-year feed if CNN rejects the dated request.
 */
export async function getFearGreedHistory(start?: string): Promise<FearGreedPoint[] | null> {
  let data = await fetchGraphData(start);
  if (start && !Array.isArray(data?.fear_and_greed_historical?.data)) data = await fetchGraphData();
  const historical = data?.fear_and_greed_historical?.data;
  if (!Array.isArray(historical)) return null;

  return historical.map((h) => ({
    date: new Date(h.x).toISOString(),
    score: h.y,
    rating: h.rating,
  }));
}

/** The latest reading, for the market status bar. */
export async function getFearGreedCurrent(): Promise<FearGreedCurrent | null> {
  const data = await fetchGraphData();
  const current = data?.fear_and_greed;
  if (!current || typeof current.score !== "number") return null;

  return {
    current: current.score,
    rating: current.rating,
    date: current.timestamp ? new Date(current.timestamp).toISOString() : undefined,
  };
}
