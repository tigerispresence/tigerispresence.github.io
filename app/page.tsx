"use client";

import { useState, useEffect } from "react";
import SearchArea from "@/components/SearchArea";
import StockDashboard from "@/components/StockDashboard";
import MarketStatus, { MarketData } from "@/components/MarketStatus";
import { motion, AnimatePresence } from "framer-motion"; // Consolidated framer-motion import

export default function Home() {
  const [loading, setLoading] = useState(false); // Changed from isLoading to loading
  const [stockData, setStockData] = useState(null);
  const [error, setError] = useState(null); // Changed initial state from "" to null

  const [timeRange, setTimeRange] = useState("1y"); // New state for time range

  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [marketLoading, setMarketLoading] = useState(true);

  const fetchMarketData = async () => {
    setMarketLoading(true);
    try {
      const res = await fetch("/api/market");
      const json = await res.json();
      if (json.vix) {
        setMarketData(json);
      }
    } catch (error) {
      console.error("Failed to fetch market data", error);
    } finally {
      setMarketLoading(false);
    }
  };

  // Initial load and Auto-Refresh
  useEffect(() => {
    fetchMarketData();

    const intervalId = setInterval(() => {
      console.log("Auto-refreshing data...");
      fetchMarketData();

      // Refresh stock data if a stock is selected
      // We need to access the current stockData state, but since we can't easily get the *current* state 
      // inside a closure without refs or dependency arrays that might cause loops, 
      // we'll rely on a separate mechanism or just re-fetch if we have the symbol stored.
      // A better approach for the stock data refresh is to use a ref or check the localStorage history/last searched.
      // For now, let's just refresh market data. To refresh stock data properly, we'd need to refactor handleSearch slightly 
      // or store the current query in a state variable that we can access.
    }, 10 * 60 * 1000); // 10 minutes

    return () => clearInterval(intervalId);
  }, []);

  // Separate effect for stock data auto-refresh to avoid stale closures
  useEffect(() => {
    const stockRefreshInterval = setInterval(() => {
      if (stockData?.symbol) {
        console.log("Auto-refreshing stock data for:", stockData.symbol);
        // Re-use the search logic but silent (no loading spinner if possible, or minimal)
        // For simplicity, we'll just call the API directly similar to handleSearch
        fetch("/api/stock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: stockData.symbol, range: timeRange }),
        })
          .then(res => res.json())
          .then(data => {
            if (data.symbol) setStockData(data);
          })
          .catch(err => console.error("Stock auto-refresh failed", err));
      }
    }, 10 * 60 * 1000); // 10 minutes

    return () => clearInterval(stockRefreshInterval);
  }, [stockData?.symbol, timeRange]); // Depend on symbol so we refresh the correct stock


  const handleSearch = async (query: string) => {
    setLoading(true);
    setError(null);
    setStockData(null);

    // Refresh market data on search
    fetchMarketData();

    try {
      const response = await fetch("/api/stock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, range: timeRange }), // Added timeRange to body
      });

      // Updated error handling
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch stock data");
      }

      const data = await response.json();
      setStockData(data);

      // Save to history
      const history = JSON.parse(localStorage.getItem("searchHistory") || "[]");
      if (!history.includes(query)) {
        const newHistory = [query, ...history].slice(0, 5);
        localStorage.setItem("searchHistory", JSON.stringify(newHistory));
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // New function to handle time range changes
  const handleRangeChange = async (newRange: string) => {
    setTimeRange(newRange);
    if (stockData) {
      // Use the current symbol or name to re-fetch
      // Ideally we should store the last query, but using symbol works
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
        console.error("Failed to update range", err);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <main className="min-h-screen bg-black text-white selection:bg-blue-500/30"> {/* Changed background color */}
      <div className="fixed inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" /> {/* Changed to fixed */}

      <div className="relative z-10 container mx-auto px-4 py-12 flex flex-col items-center min-h-screen"> {/* Added z-10 and changed padding */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12 space-y-4"
        >
          {/* Removed "Powered by Gemini 2.0 Flash" div */}
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-400">
            Stock Analysis {/* Changed title */}
          </h1>
          <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto">
            Real-time market insights powered by AI. Search for any company to get started. {/* Changed description */}
          </p>
        </motion.div>

        {/* Market Status Section */}
        <MarketStatus data={marketData} loading={marketLoading} />

        <div className="w-full max-w-2xl relative z-20"> {/* Added wrapper div for SearchArea */}
          <SearchArea onSearch={handleSearch} isLoading={loading} /> {/* Changed loading to isLoading */}
        </div>

        <AnimatePresence mode="wait"> {/* Added AnimatePresence */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* New time range selector */}
        {stockData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-8 flex gap-2 bg-gray-900/50 p-1 rounded-xl border border-gray-800 backdrop-blur-sm"
          >
            {['1y', '2y', '3y', '5y', '10y'].map((range) => (
              <button
                key={range}
                onClick={() => handleRangeChange(range)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${timeRange === range
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
              >
                {range.toUpperCase()}
              </button>
            ))}
          </motion.div>
        )}

        <StockDashboard data={stockData} />

        {!stockData && !loading && !error && ( // Changed isLoading to loading
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
