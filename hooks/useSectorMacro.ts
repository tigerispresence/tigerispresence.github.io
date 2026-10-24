"use client";

import { useEffect, useState } from "react";
import { fetchSectorMacro } from "@/lib/api/client";
import type { SectorMacroData } from "@/lib/types/macro";

/** Macro section data. Fetched once: CPI is monthly and the server holds it for an hour. */
export function useSectorMacro() {
  const [data, setData] = useState<SectorMacroData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSectorMacro()
      .then((json) => !cancelled && setData(json))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Failed to fetch macro data"));
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, error, loading: !data && !error };
}
