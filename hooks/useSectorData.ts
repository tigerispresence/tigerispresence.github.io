"use client";

import { useEffect, useState } from "react";
import { fetchSectors } from "@/lib/api/client";
import type { SectorData } from "@/lib/types/sectors";

// Matches the server's `quote` cache profile.
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

/** Sector tab data, refreshed every five minutes while the tab is visible. */
export function useSectorData() {
  const [data, setData] = useState<SectorData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const json = await fetchSectors();
        if (cancelled) return;
        setData(json);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to fetch sector data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return { data, error, loading };
}
