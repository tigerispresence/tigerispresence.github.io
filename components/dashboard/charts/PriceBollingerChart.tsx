"use client";

import { useState } from "react";

import {
  Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { useStockData } from "../StockDataContext";
import { SMA_LINES } from "./smaConfig";
import { DownTriangle, UpTriangle } from "./signalShapes";

export default function PriceBollingerChart() {
  const { data, analytics } = useStockData();

  // Purely presentational, so it lives here rather than in the dashboard
  // shell: hiding a line changes nothing the analytics hook computes. Staying
  // mounted across symbol changes means the selection persists as you browse.
  const [hiddenSmas, setHiddenSmas] = useState<Set<string>>(new Set());

  const toggleSma = (key: string) =>
    setHiddenSmas((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const visibleSmas = SMA_LINES.filter((sma) => !hiddenSmas.has(sma.key));

  return (
    <>
      {/* Price Chart with Bollinger Bands */}
      <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-3xl p-6 shadow-xl lg:col-span-2"
      >
          <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-500/10 rounded-xl">
                  <TrendingUp className="w-6 h-6 text-blue-400" />
              </div>
              <div className="flex-1">
                  <h3 className="text-xl font-semibold text-white">Price &amp; Bollinger Bands</h3>
                  <p className="text-gray-500 text-xs mt-0.5">
                      Triangles mark SMA crossovers — a mechanical indicator, not investment advice.
                  </p>
              </div>
              {analytics.crossovers.length > 0 && (
                  <div className="text-right shrink-0">
                      <div className="text-gray-400 text-[10px] font-medium uppercase tracking-wider">Signals</div>
                      <div className="font-bold">
                          <span className="text-green-400">
                              {analytics.crossovers.filter((s) => s.kind === "buy").length}
                          </span>
                          <span className="text-gray-600 mx-1">/</span>
                          <span className="text-red-400">
                              {analytics.crossovers.filter((s) => s.kind === "sell").length}
                          </span>
                      </div>
                  </div>
              )}
          </div>
          {/* These chips are the SMA legend: fixed 5/10/20/60/120 order, and
              each carries its line's colour so the mapping is unambiguous. */}
          <div className="mb-4">
              <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-2">
                  Moving Averages
              </div>
              <div className="flex flex-wrap gap-2">
                  {SMA_LINES.map((sma) => {
                      const isVisible = !hiddenSmas.has(sma.key);
                      return (
                          <button
                              key={sma.key}
                              onClick={() => toggleSma(sma.key)}
                              aria-pressed={isVisible}
                              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 border ${
                                  isVisible
                                      ? "text-white border-transparent"
                                      : "bg-transparent text-gray-500 border-gray-700 hover:border-gray-500"
                              }`}
                              style={
                                  isVisible
                                      ? { backgroundColor: `${sma.color}26`, borderColor: sma.color }
                                      : undefined
                              }
                          >
                              <span
                                  className="w-3 h-0.5 rounded-full shrink-0"
                                  style={{ backgroundColor: isVisible ? sma.color : "#4b5563" }}
                              />
                              {sma.label}
                          </button>
                      );
                  })}
              </div>
          </div>
          <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={analytics.priceChart}>
                      <defs>
                          <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                          </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                      <XAxis
                          dataKey="date"
                          stroke="#6b7280"
                          tickFormatter={(str) => {
                              const date = new Date(str);
                              return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
                          }}
                          minTickGap={50}
                      />
                      <YAxis
                          stroke="#6b7280"
                          domain={['auto', 'auto']}
                          tickFormatter={(val) => data.currency === 'USD' ? `$${val}` : val.toLocaleString()}
                      />
                      <Tooltip
                          contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '12px' }}
                          itemStyle={{ color: '#e5e7eb' }}
                          labelStyle={{ color: '#9ca3af' }}
                      />
                      <Legend />
                      <Area
                          type="monotone"
                          dataKey="upperBand"
                          stroke="none"
                          fill="#3b82f6"
                          fillOpacity={0.1}
                          // The dashed Line below already names this band;
                          // without this the fill adds a raw "upperBand" entry.
                          legendType="none"
                      />
                      <Area
                          type="monotone"
                          dataKey="lowerBand"
                          stroke="none"
                          fill="#3b82f6"
                          fillOpacity={0.1}
                          legendType="none"
                      />
                      <Line
                          type="monotone"
                          dataKey="upperBand"
                          stroke="#60a5fa"
                          strokeWidth={1}
                          strokeDasharray="3 3"
                          dot={false}
                          name="Upper Band"
                      />
                      <Line
                          type="monotone"
                          dataKey="lowerBand"
                          stroke="#60a5fa"
                          strokeWidth={1}
                          strokeDasharray="3 3"
                          dot={false}
                          name="Lower Band"
                      />
                      {visibleSmas.map((sma) => (
                          <Line
                              key={sma.key}
                              type="monotone"
                              dataKey={sma.key}
                              stroke={sma.color}
                              strokeWidth={sma.width}
                              dot={false}
                              // A 120-session average has no value for its first
                              // half-year; joining across the gap would draw a
                              // straight line through prices it never averaged.
                              connectNulls={false}
                              name={sma.label}
                              // The chips above are the SMA legend; a second
                              // entry here would duplicate them and reorder
                              // unpredictably as lines are toggled.
                              legendType="none"
                          />
                      ))}
                      <Line
                          type="monotone"
                          dataKey="close"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          dot={false}
                          name="Price"
                      />
                      <Scatter
                          dataKey="buySignal"
                          name="Buy — SMA 60 crosses below 120"
                          fill="#22c55e"
                          shape={<UpTriangle />}
                          legendType="triangle"
                      />
                      <Scatter
                          dataKey="sellSignal"
                          name="Sell — SMA 10 crosses below 20"
                          fill="#ef4444"
                          shape={<DownTriangle />}
                          legendType="triangle"
                      />
                  </ComposedChart>
              </ResponsiveContainer>
          </div>
      </motion.div>

    </>
  );
}
