/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import SearchArea from "@/components/SearchArea";
import StockDashboard, { StockData } from "@/components/StockDashboard";
import MarketStatus, { MarketData } from "@/components/MarketStatus";
import StockHeatmap from "@/components/StockHeatmap";
import { motion, AnimatePresence } from "framer-motion";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [stockData, setStockData] = useState<StockData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<any[]>([]); // State for matching suggestions

  const [timeRange, setTimeRange] = useState("1y");
  const [sliderValue, setSliderValue] = useState(12);

  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [marketLoading, setMarketLoading] = useState(true);

  const searchParams = useSearchParams();
  const queryParam = searchParams?.get('q');

  // Handle URL query parameters (e.g. from Heatmap widget redirection)
  useEffect(() => {
    if (queryParam) {
      // Remove query param from URL to clean it up, but search first
      handleSearch(queryParam);
      // Optional: clear URL history? Maybe later.
      window.history.replaceState({}, '', '/');
    }
  }, [queryParam]);

  const fetchMarketData = useCallback(async () => {
    setMarketLoading(true);
    try {
      const res = await fetch("/api/market");
      const json = await res.json();
      // Check for new schema (indices)
      if (json.indices) {
        setMarketData(json);
      }
    } catch (error) {
      console.error("Failed to fetch market data", error);
    } finally {
      setMarketLoading(false);
    }
  }, []);

  // Initial load and Auto-Refresh
  useEffect(() => {
    fetchMarketData();
    const intervalId = setInterval(() => {
      console.log("Auto-refreshing data...");
      fetchMarketData();
    }, 10 * 60 * 1000); // 10 minutes
    return () => clearInterval(intervalId);
  }, [fetchMarketData]);

  // Core Stock Fetch Logic
  const fetchStockDetail = useCallback(async (symbol: string, isAutoRefresh = false) => {
    if (!isAutoRefresh) {
      setLoading(true);
      setError(null);
      setCandidates([]); // Clear candidates on selection
      setStockData(null);
    }

    try {
      // Refresh market data on manual search only
      if (!isAutoRefresh) fetchMarketData();

      const response = await fetch("/api/stock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: symbol, range: timeRange }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch stock data");
      }

      const data = await response.json();
      setStockData(data);

      // Save to history (only for manual searches)
      if (!isAutoRefresh) {
        const history = JSON.parse(localStorage.getItem("searchHistory") || "[]");
        if (!history.includes(symbol)) {
          const newHistory = [symbol, ...history].slice(0, 5);
          localStorage.setItem("searchHistory", JSON.stringify(newHistory));
        }
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      if (!isAutoRefresh) setLoading(false);
    }
  }, [timeRange, fetchMarketData]);

  // Separate effect for stock data auto-refresh
  useEffect(() => {
    const stockRefreshInterval = setInterval(() => {
      const currentStock = stockData;
      if (currentStock?.symbol) {
        console.log("Auto-refreshing stock data for:", currentStock.symbol);
        fetchStockDetail(currentStock.symbol, true);
      }
    }, 10 * 60 * 1000); // 10 minutes

    return () => clearInterval(stockRefreshInterval);
  }, [stockData, timeRange, fetchStockDetail]);

  // Handle Search Submission (matches UI request to show suggestions)
  const handleSearch = async (query: string) => {
    setLoading(true);
    setError(null);
    setStockData(null);
    setCandidates([]);

    // 1. First check for candidates
    try {
      const searchRes = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const searchData = await searchRes.json();
      const results = searchData.results || [];

      // Logic A: Exact Symbol Match -> Load Immediately
      const exactMatch = results.find((r: any) => r.symbol.toUpperCase() === query.toUpperCase());
      if (exactMatch) {
        await fetchStockDetail(exactMatch.symbol);
        return;
      }

      // Logic B: Single result -> Load Immediately
      if (results.length === 1) {
        await fetchStockDetail(results[0].symbol);
        return;
      }

      // Logic C: Multiple Matches -> Show User Selection
      if (results.length > 1) {
        setCandidates(results);
        setLoading(false); // Stop loading to allow selection
        return;
      }

      // Logic D: No Search candidates? Try direct stock fetch as fallback
      await fetchStockDetail(query);

    } catch (e) {
      console.warn("Search API failed, falling back to direct fetch", e);
      await fetchStockDetail(query);
    }
  };

  const handleRangeChange = async (newRange: string) => {
    setTimeRange(newRange);
    if (stockData) {
      // Just trigger fetch with new range
      setLoading(true);
      try {
        const response = await fetch("/api/stock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: stockData.symbol, range: newRange }),
        });
        const data = await response.json();
        setStockData(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
  };


  return (
    <main className="min-h-screen bg-black text-white selection:bg-blue-500/30">
      <div className="fixed inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />

      <div className="relative z-10 container mx-auto px-4 py-6 md:py-12 flex flex-col items-center min-h-screen">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12 space-y-4"
        >
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-400">
            Stock Analysis
          </h1>
          <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto">
            WorkingNow - Youngkyu Lee
          </p>
        </motion.div>

        {/* Market Status Section */}
        <MarketStatus data={marketData} loading={marketLoading} />

        {/* Stock Heatmap */}
        <StockHeatmap />

        <div className="w-full max-w-2xl relative z-20">
          <SearchArea onSearch={handleSearch} isLoading={loading} />
        </div>

        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 w-full max-w-2xl text-center"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* CANDIDATE SELECTION UI */}
        {candidates.length > 0 && !stockData && !loading && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-8 w-full max-w-2xl"
          >
            <h2 className="text-xl text-gray-300 mb-4 text-center">Did you mean?</h2>
            <div className="grid grid-cols-1 gap-3">
              {candidates.map((c) => (
                <button
                  key={c.symbol}
                  onClick={() => fetchStockDetail(c.symbol)}
                  className="flex items-center justify-between p-4 bg-gray-900/50 hover:bg-gray-800 border border-gray-800 rounded-xl transition-all group text-left"
                >
                  <div>
                    <div className="text-white font-bold flex items-center gap-2">
                      {c.symbol}
                      <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">{c.exchange}</span>
                    </div>
                    <div className="text-sm text-gray-400 group-hover:text-blue-400 transition-colors">
                      {c.name}
                    </div>
                  </div>
                  <div className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity font-semibold text-sm">
                    Select &rarr;
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Sticky Time Range Selector & Slider */}
        {stockData && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="sticky top-2 md:top-4 z-50 mt-4 w-full max-w-2xl mx-auto"
          >
            <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-3 md:p-4 shadow-2xl flex flex-col gap-3 md:gap-4">
              {/* Preset Buttons */}
              <div className="flex flex-wrap justify-between items-center gap-2">
                <div className="flex gap-1 bg-gray-800/50 p-1 rounded-xl border border-gray-700/50 overflow-x-auto scrollbar-hide">
                  {['1y', '2y', '3y', '5y', '10y'].map((range) => (
                    <button
                      key={range}
                      onClick={() => handleRangeChange(range)}
                      className={`px-2.5 py-1.5 md:px-3 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all whitespace-nowrap ${timeRange === range
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                      {range.toUpperCase()}
                    </button>
                  ))}
                </div>
                <div className="hidden sm:block text-xs text-gray-500 font-medium px-2">
                  {timeRange === 'custom' ? 'Custom Range' : 'Presets'}
                </div>
              </div>

              {/* Slider Section */}
              <div className="flex items-center gap-3 px-1">
                <span className="text-[10px] md:text-xs font-medium text-gray-400 w-8 md:w-12">Custom</span>
                <input
                  type="range"
                  min="1"
                  max="120"
                  step="1"
                  value={sliderValue}
                  onChange={(e) => setSliderValue(parseInt(e.target.value))}
                  onMouseUp={(e) => {
                    const months = parseInt((e.target as HTMLInputElement).value);
                    const date = new Date();
                    date.setMonth(date.getMonth() - months);
                    const fromDate = date.toISOString().split('T')[0];

                    // Manually trigger fetch logic
                    setTimeRange('custom');
                    if (stockData) {
                      setLoading(true);
                      fetch("/api/stock", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ query: stockData.symbol, from: fromDate, range: 'custom' }),
                      })
                        .then(res => res.json())
                        .then(data => setStockData(data))
                        .catch(err => console.error(err))
                        .finally(() => setLoading(false));
                    }
                  }}
                  className="flex-1 h-1.5 md:h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400"
                />
                <span className="text-[10px] md:text-xs font-medium text-blue-400 w-12 md:w-16 text-right whitespace-nowrap">
                  {sliderValue} mo
                </span>
              </div>
            </div>
          </motion.div>
        )}

        <StockDashboard data={stockData} />

        {/* Landing Page Placeholders */}
        {!stockData && candidates.length === 0 && !loading && !error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 text-center text-gray-500 max-w-4xl"
          >
            <div className="p-6 rounded-2xl bg-gray-900/30 border border-gray-800/50">
              <h3 className="text-white font-semibold mb-2">Real-time Data</h3>
              <p className="text-sm">Live market prices and changes powered by Google Search Grounding.</p>
            </div>
            <div className="p-6 rounded-2xl bg-gray-900/30 border border-gray-800/50">
              <h3 className="text-white font-semibold mb-2">Deep History</h3>
              <p className="text-sm">Comprehensive 1-year daily price history and trend analysis.</p>
            </div>
            <div className="p-6 rounded-2xl bg-gray-900/30 border border-gray-800/50">
              <h3 className="text-white font-semibold mb-2">Volatility Metrics</h3>
              <p className="text-sm">Advanced standard deviation and daily change calculations.</p>
            </div>
          </motion.div>
        )}
      </div>
    </main>
  );
}
