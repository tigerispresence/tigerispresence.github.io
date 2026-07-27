"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchMarket } from "@/lib/api/client";
import type { MarketData } from "@/lib/server/market/indices";

const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

/** Market status bar data, refreshed every ten minutes. */
export function useMarketData() {
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
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
    const timer = setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  return { marketData, loading, refresh };
}
