"use client";

import { TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import AnalystRatings from "../AnalystRatings";
import { useStockData } from "./StockDataContext";

export default function AnalystTargets() {
  const { data, formatCurrency } = useStockData();

  return (
    <>
      {/* Analyst Price Targets (New Feature) */}
      {data.priceTargets && (
          <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-3xl p-6 shadow-xl"
          >
              <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-500/10 rounded-xl">
                          <TrendingUp className="w-6 h-6 text-indigo-400" />
                      </div>
                      <div>
                          <h3 className="text-xl font-semibold text-white">Analyst Price Targets</h3>
                          <p className="text-gray-400 text-sm">Based on {data.priceTargets.numberOfAnalysts} analyst opinions</p>
                      </div>
                  </div>
                  <div className="text-right">
                      <div className="text-gray-400 text-xs font-medium uppercase tracking-wider">Average Target</div>
                      <div className="text-2xl font-bold text-indigo-400">
                          {formatCurrency(data.priceTargets.mean)}
                      </div>
                      <div className={`text-sm ${((data.priceTargets.mean - data.currentPrice) / data.currentPrice) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {((data.priceTargets.mean - data.currentPrice) / data.currentPrice * 100).toFixed(1)}% Upside
                      </div>
                  </div>
              </div>

              <div className="relative pt-8 pb-4 px-4">
                  {/* Legend */}
                  <div className="flex justify-between mb-4 text-xs font-medium text-gray-500">
                      <span>Low: {formatCurrency(data.priceTargets.low)}</span>
                      <span>High: {formatCurrency(data.priceTargets.high)}</span>
                  </div>

                  {/* Range Bar Background */}
                  <div className="h-4 bg-gray-800 rounded-full w-full relative">
                      {/* Active Range (Gradient) */}
                      <div
                          className="absolute top-0 h-full bg-gradient-to-r from-gray-700 via-indigo-900/50 to-gray-700 rounded-full"
                          style={{
                              left: '0%',
                              width: '100%'
                          }}
                      ></div>

                      {/* Average (Mean) Marker */}
                      <div
                          className="absolute top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-400 rounded-full z-10"
                          style={{ left: `${Math.min(100, Math.max(0, ((data.priceTargets.mean - data.priceTargets.low) / (data.priceTargets.high - data.priceTargets.low)) * 100))}%` }}
                      ></div>
                      <div
                          className="absolute -bottom-8 -translate-x-1/2 text-xs text-indigo-400 font-bold text-center"
                          style={{ left: `${Math.min(100, Math.max(0, ((data.priceTargets.mean - data.priceTargets.low) / (data.priceTargets.high - data.priceTargets.low)) * 100))}%` }}
                      >
                          Avg
                      </div>

                      {/* Current Price Marker */}
                      <div
                          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-4 border-blue-500 rounded-full z-20 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                          style={{
                              left: `${Math.min(100, Math.max(0, ((data.currentPrice - data.priceTargets.low) / (data.priceTargets.high - data.priceTargets.low)) * 100))}%`
                          }}
                      ></div>
                      <div
                          className="absolute -top-10 -translate-x-1/2 text-xs text-white font-bold bg-blue-600 px-2 py-1 rounded-lg shadow-lg z-30 whitespace-nowrap"
                          style={{
                              left: `${Math.min(100, Math.max(0, ((data.currentPrice - data.priceTargets.low) / (data.priceTargets.high - data.priceTargets.low)) * 100))}%`
                          }}
                      >
                          Current: {formatCurrency(data.currentPrice)}
                      </div>
                      {/* Individual Analyst Targets */}
                      {data.analystHistory && data.analystHistory.map((item, idx) => {
                          const positionPercent = Math.min(100, Math.max(0, ((item.target - data.priceTargets!.low) / (data.priceTargets!.high - data.priceTargets!.low)) * 100));
                          return (
                              <div
                                  key={idx}
                                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-gray-400 rounded-full z-30 hover:bg-white hover:z-50 transition-all cursor-pointer group border border-gray-800"
                                  style={{
                                      left: `${positionPercent}%`,
                                      opacity: 0.8
                                  }}
                              >
                                  {/* Tooltip */}
                                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-gray-900 border border-gray-700 text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-lg">
                                      <div className="font-bold">{item.firm}</div>
                                      <div>{formatCurrency(item.target)}</div>
                                      <div className="text-gray-400 text-[10px]">{new Date(item.date).toLocaleDateString()}</div>
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              </div>

              {/* Analyst Ratings (Recommendation Trend) Sub-section */}
              <AnalystRatings trend={data.recommendationTrend} />
          </motion.div>
      )}
    </>
  );
}
