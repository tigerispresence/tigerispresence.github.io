"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { StockData } from "@/lib/types/stock";
import { fetchSearch, fetchStock } from "@/lib/api/client";

const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

export interface Candidate {
  symbol: string;
  name: string;
  exchange?: string;
  type?: string;
}

/**
 * Search-to-load flow and the loaded stock.
 *
 * Consolidates what were three separate fetch call sites in the page
 * component, each building the request slightly differently.
 */
export function useStockQuery(onLoaded?: () => void) {
  const [stockData, setStockData] = useState<StockData | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState("1y");

  // Read inside the refresh timer without making it a dependency, which would
  // tear down and recreate the interval on every load.
  const currentSymbol = useRef<string | null>(null);
  const currentRange = useRef<string>("1y");

  const load = useCallback(
    async (
      symbol: string,
      opts: { range?: string; from?: string; silent?: boolean } = {},
    ) => {
      const range = opts.range ?? currentRange.current;
      if (!opts.silent) {
        setLoading(true);
        setError(null);
        setCandidates([]);
      }
      try {
        const data = await fetchStock(symbol, { range, from: opts.from });
        setStockData(data);
        currentSymbol.current = data.symbol;
        currentRange.current = range;
        if (!opts.silent) onLoaded?.();
      } catch (err) {
        if (!opts.silent) {
          setError(err instanceof Error ? err.message : "Failed to load stock");
        }
      } finally {
        if (!opts.silent) setLoading(false);
      }
    },
    [onLoaded],
  );

  /** Resolve free-form input, loading directly when the match is unambiguous. */
  const search = useCallback(
    async (query: string) => {
      setLoading(true);
      setError(null);
      setStockData(null);
      setCandidates([]);

      try {
        // Explicit submit, so the AI fallback is allowed here. The typeahead
        // deliberately does not use it.
        const { results = [] } = await fetchSearch(query, { deep: true });

        const exact = results.find(
          (r: Candidate) => r.symbol?.toUpperCase() === query.toUpperCase(),
        );
        if (exact) return load(exact.symbol);
        if (results.length === 1) return load(results[0].symbol);
        if (results.length > 1) {
          setCandidates(results);
          setLoading(false);
          return;
        }
        // No search hits: the query may still be a valid ticker.
        return load(query);
      } catch {
        return load(query);
      }
    },
    [load],
  );

  const changeRange = useCallback(
    (range: string, from?: string) => {
      setTimeRange(range);
      if (currentSymbol.current) {
        return load(currentSymbol.current, { range, from });
      }
    },
    [load],
  );

  // Silent background refresh so the chart does not flash a spinner.
  useEffect(() => {
    const timer = setInterval(() => {
      if (currentSymbol.current) {
        load(currentSymbol.current, { silent: true });
      }
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [load]);

  return {
    stockData,
    candidates,
    loading,
    error,
    timeRange,
    search,
    load,
    changeRange,
    clearCandidates: () => setCandidates([]),
  };
}
