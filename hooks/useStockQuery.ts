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
  /** Start date of a "custom" range; undefined for the presets. */
  const [rangeFrom, setRangeFrom] = useState<string | undefined>(undefined);

  // Read inside the refresh timer without making it a dependency, which would
  // tear down and recreate the interval on every load.
  const currentSymbol = useRef<string | null>(null);
  // The custom range's start date travels with it: "custom" alone resolves to
  // one year on the server, which silently replaced a 36-month slider choice
  // on the next background refresh or the next stock loaded.
  const currentRange = useRef<{ range: string; from?: string }>({ range: "1y" });
  // Bumped by every load and by reset, so a response that lands after the
  // user has moved on is dropped instead of reappearing on screen.
  const generation = useRef(0);

  const load = useCallback(
    async (
      symbol: string,
      opts: { range?: string; from?: string; silent?: boolean } = {},
    ) => {
      const { range, from } = opts.range
        ? { range: opts.range, from: opts.from }
        : currentRange.current;
      // A background refresh must not cancel a load the user started, so it
      // only checks the generation; it is dropped if anything changed meanwhile.
      const gen = opts.silent ? generation.current : ++generation.current;
      if (!opts.silent) {
        setLoading(true);
        setError(null);
        setCandidates([]);
      }
      try {
        const data = await fetchStock(symbol, { range, from });
        if (gen !== generation.current) return;
        // A refresh that started while the user was loading another stock
        // shares its generation; the symbol check catches that case.
        if (opts.silent && data.symbol !== currentSymbol.current) return;
        setStockData(data);
        currentSymbol.current = data.symbol;
        currentRange.current = { range, from };
        if (!opts.silent) onLoaded?.();
      } catch (err) {
        if (gen !== generation.current) return;
        if (!opts.silent) {
          setError(err instanceof Error ? err.message : "Failed to load stock");
        }
      } finally {
        if (!opts.silent && gen === generation.current) setLoading(false);
      }
    },
    [onLoaded],
  );

  /** Resolve free-form input, loading directly when the match is unambiguous. */
  const search = useCallback(
    async (query: string) => {
      const gen = ++generation.current;
      setLoading(true);
      setError(null);
      setStockData(null);
      setCandidates([]);

      try {
        // Explicit submit, so the AI fallback is allowed here. The typeahead
        // deliberately does not use it.
        const { results = [] } = await fetchSearch(query, { deep: true });
        if (gen !== generation.current) return;

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
        if (gen !== generation.current) return;
        return load(query);
      }
    },
    [load],
  );

  const changeRange = useCallback(
    (range: string, from?: string) => {
      setTimeRange(range);
      setRangeFrom(from);
      currentRange.current = { range, from };
      if (currentSymbol.current) {
        return load(currentSymbol.current, { range, from });
      }
    },
    [load],
  );

  /** Back to the landing state: no stock, no candidates, default range. */
  const reset = useCallback(() => {
    generation.current++;
    currentSymbol.current = null;
    currentRange.current = { range: "1y" };
    setStockData(null);
    setCandidates([]);
    setError(null);
    setLoading(false);
    setTimeRange("1y");
    setRangeFrom(undefined);
  }, []);

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
    rangeFrom,
    search,
    load,
    changeRange,
    reset,
    clearCandidates: () => setCandidates([]),
  };
}
