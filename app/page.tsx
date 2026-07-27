"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import SearchArea from "@/components/SearchArea";
import StockDashboard from "@/components/dashboard/StockDashboard";
import MarketStatus from "@/components/MarketStatus";
import StockHeatmap from "@/components/StockHeatmap";
import TimeRangeControl from "@/components/TimeRangeControl";
import { useMarketData } from "@/hooks/useMarketData";
import { useStockQuery } from "@/hooks/useStockQuery";
import { normalizeSymbol } from "@/lib/utils/symbols";

/** Loads the ?q= symbol the TradingView heatmap redirects with. */
function SearchEffect({ onSearch }: { onSearch: (query: string) => void }) {
  const searchParams = useSearchParams();
  const queryParam = searchParams?.get("q");

  useEffect(() => {
    if (!queryParam) return;
    onSearch(normalizeSymbol(queryParam));
    window.history.replaceState({}, "", "/");
  }, [queryParam, onSearch]);

  return null;
}

export default function Home() {
  const { marketData, loading: marketLoading, refresh: refreshMarket } =
    useMarketData();
  const {
    stockData,
    candidates,
    loading,
    error,
    timeRange,
    search,
    load,
    changeRange,
  } = useStockQuery(refreshMarket);

  const handleSearch = (query: string) => search(normalizeSymbol(query));

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

        <MarketStatus data={marketData} loading={marketLoading} />

        <StockHeatmap />

        <Suspense fallback={null}>
          <SearchEffect onSearch={handleSearch} />
        </Suspense>

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

        {candidates.length > 0 && !stockData && !loading && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-8 w-full max-w-2xl"
          >
            <h2 className="text-xl text-gray-300 mb-4 text-center">
              Did you mean?
            </h2>
            <div className="grid grid-cols-1 gap-3">
              {candidates.map((c) => (
                <button
                  key={c.symbol}
                  onClick={() => load(c.symbol)}
                  className="flex items-center justify-between p-4 bg-gray-900/50 hover:bg-gray-800 border border-gray-800 rounded-xl transition-all group text-left"
                >
                  <div>
                    <div className="text-white font-bold flex items-center gap-2">
                      {c.symbol}
                      <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">
                        {c.exchange}
                      </span>
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

        {stockData && (
          <TimeRangeControl timeRange={timeRange} onChange={changeRange} />
        )}

        <StockDashboard data={stockData} />

        {!stockData && candidates.length === 0 && !loading && !error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 text-center text-gray-500 max-w-4xl"
          >
            <div className="p-6 rounded-2xl bg-gray-900/30 border border-gray-800/50">
              <h3 className="text-white font-semibold mb-2">Live Market Data</h3>
              <p className="text-sm">
                Real-time prices, analyst targets and options data from Yahoo
                Finance.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-gray-900/30 border border-gray-800/50">
              <h3 className="text-white font-semibold mb-2">Deep History</h3>
              <p className="text-sm">
                Up to ten years of daily prices, dividends and seasonality.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-gray-900/30 border border-gray-800/50">
              <h3 className="text-white font-semibold mb-2">Strategy Backtests</h3>
              <p className="text-sm">
                Volatility, dollar-cost-averaging and Fear &amp; Greed
                simulations.
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </main>
  );
}
