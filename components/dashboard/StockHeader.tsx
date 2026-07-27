"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useStockData } from "./StockDataContext";

export default function StockHeader() {
  const { data, formatCurrency } = useStockData();
  const isPositive = data.change >= 0;

  return (
    <>
      {/* Header Section */}
      <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-3xl p-8 shadow-2xl">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                  <h1 className="text-4xl font-bold text-white tracking-tight">{data.symbol}</h1>
                  <p className="text-gray-400 text-lg">{data.name}</p>
              </div>
              <div className="text-right">
                  <div className="text-5xl font-bold text-white tracking-tighter">
                      {formatCurrency(data.currentPrice)}
                  </div>
                  <div className={`flex items-center justify-end gap-2 text-xl font-medium mt-2 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                      {isPositive ? <ArrowUp className="w-6 h-6" /> : <ArrowDown className="w-6 h-6" />}
                      {Math.abs(data.change).toFixed(2)} ({Math.abs(data.changePercent).toFixed(2)}%)
                  </div>
              </div>
          </div>
      </div>
    </>
  );
}
