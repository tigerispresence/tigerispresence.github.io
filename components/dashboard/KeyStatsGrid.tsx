"use client";

import { useStockData } from "./StockDataContext";

export default function KeyStatsGrid() {
  const { data, formatCurrency } = useStockData();

  return (
    <>
      {/* Key Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-2xl p-4 flex flex-col items-center justify-center relative group">
              <div className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-1">TTM PER</div>
              <div className="text-white font-bold text-2xl">
                  {data.trailingPE ? data.trailingPE.toFixed(2) : <span className="text-gray-600 text-lg">N/A</span>}
              </div>
          </div>
          <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-2xl p-4 flex flex-col items-center justify-center relative group">
              <div className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-1">Forward PER</div>
              <div className="text-white font-bold text-2xl">
                  {data.forwardPE ? data.forwardPE.toFixed(2) : <span className="text-gray-600 text-lg">N/A</span>}
              </div>
          </div>
          <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-2xl p-4 flex flex-col items-center justify-center relative group">
              <div className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-1">Dividend Yield</div>
              <div className="text-white font-bold text-2xl">
                  {data.dividendYield ? `${data.dividendYield.toFixed(2)}%` : <span className="text-gray-600 text-lg">N/A</span>}
              </div>
          </div>
          {/* Max Pain Card */}
          <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-2xl p-4 flex flex-col items-center justify-center relative group">
              <div className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-1">Max Pain</div>
              <div className="text-white font-bold text-2xl">
                  {data.maxPain ? formatCurrency(data.maxPain.price) : <span className="text-gray-600 text-lg">N/A</span>}
              </div>
              {data.maxPain && (
                  <div className="text-xs text-blue-400 border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 mt-1 rounded opacity-80 whitespace-nowrap">
                      Exp: {new Date(data.maxPain.expirationDate).toISOString().split('T')[0]}
                  </div>
              )}
          </div>
      </div>
    </>
  );
}
