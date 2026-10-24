"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchMarket } from "@/lib/api/client";
import type { MarketData } from "@/lib/server/market/indices";

// Matches the server's `live` cache profile; polling faster would only re-read the cache.
const REFRESH_INTERVAL_MS = 60 * 1000;

/** Market status bar data, refreshed every minute and when the tab regains focus. */
export function useMarketData() {
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const json = await fetchMarket();
      // Guard against an older cached payload without the indices field.
      if (json?.indices) setMarketData(json);
    } catch (error) {
      console.error("Failed to fetch market data", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, REFRESH_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  return { marketData, loading, refresh };
}
