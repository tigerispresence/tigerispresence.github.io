import { yahooFinance } from "@/lib/server/yahoo/client";
import { getFearGreedCurrent } from "@/lib/server/cnn/fearGreed";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface IndexReading {
  current: number;
  changePercent: number;
  date: string | null;
}

export interface MarketData {
  indices: Record<
    "vix" | "sp500" | "nasdaq" | "usdkrw" | "btc" | "tnx" | "tyx",
    IndexReading
  >;
  fearGreed: IndexReading;
}

const SYMBOLS = {
  vix: "^VIX",
  sp500: "^GSPC",
  nasdaq: "^IXIC",
  usdkrw: "KRW=X",
  btc: "BTC-USD",
  tnx: "^TNX",
  tyx: "^TYX",
} as const;

const EMPTY: IndexReading = { current: 0, changePercent: 0, date: null };

/**
 * The market status bar: seven indices in one batched quote, plus CNN's Fear
 * & Greed reading.
 *
 * Returns zeros rather than throwing when Yahoo is unavailable — the caller
 * caches only responses that look real, so a failed fetch is not persisted.
 */
export async function getMarketData(): Promise<MarketData> {
  const [quotes, fearGreed] = await Promise.all([
    (yahooFinance as any)
      .quote(Object.values(SYMBOLS))
      .catch((e: unknown) => {
        console.error("[market] batch quote failed:", e);
        return null;
      }),
    getFearGreedCurrent(),
  ]);

  const read = (symbol: string): IndexReading => {
    const item = Array.isArray(quotes)
      ? quotes.find((q: any) => q.symbol === symbol)
      : undefined;
    if (!item) return EMPTY;
    return {
      current: item.regularMarketPrice || 0,
      changePercent: item.regularMarketChangePercent || 0,
      date: new Date().toISOString(),
    };
  };

  return {
    indices: {
      vix: read(SYMBOLS.vix),
      sp500: read(SYMBOLS.sp500),
      nasdaq: read(SYMBOLS.nasdaq),
      usdkrw: read(SYMBOLS.usdkrw),
      btc: read(SYMBOLS.btc),
      tnx: read(SYMBOLS.tnx),
      tyx: read(SYMBOLS.tyx),
    },
    fearGreed: fearGreed
      ? { current: fearGreed.current, changePercent: 0, date: fearGreed.date ?? null }
      // 50 is the neutral midpoint; the UI renders it without a misleading signal.
      : { current: 50, changePercent: 0, date: null },
  };
}

/** True when the payload looks like a real fetch rather than an upstream failure. */
export function isUsableMarketData(data: MarketData): boolean {
  return data.indices.sp500.current > 0 || data.indices.vix.current > 0;
}
