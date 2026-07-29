"use client";

import {
  Area, AreaChart, CartesianGrid, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { motion } from "framer-motion";
import { Activity } from "lucide-react";
import { SIM_KEY } from "@/lib/calc/sim/types";
import { useStockData } from "../StockDataContext";

export default function FearGreedSimulationChart() {
  const { analytics, selectedFgZones, toggleFgZone } = useStockData();

  return (
    <>
      {/* Fear & Greed Trading Simulation Chart */}
      {analytics.fearGreedSim && (
          <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-3xl p-6 shadow-xl lg:col-span-2"
          >
              <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-orange-500/10 rounded-xl">
                      <Activity className="w-6 h-6 text-orange-400" />
                  </div>
                  <div>
                      <h3 className="text-xl font-semibold text-white">Fear & Greed Trading Simulation</h3>
                      <p className="text-gray-400 text-sm">Strategy: Buy 1 Share when CNN Fear & Greed Index is in selected zones + <span className="text-green-400">Reinvest Dividends</span> <span className="text-orange-400 border border-orange-500/30 bg-orange-500/10 px-1 py-0.5 rounded ml-1 text-xs">Max 1 Year Data</span></p>
                  </div>
              </div>

              {/* Strategy Controls */}
              <div className="mb-6">
                  <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-2">Buy Zones (Index Rating)</div>
                  <div className="flex flex-wrap gap-2">
                      {[
                          { id: "extreme fear", label: "Extreme Fear (0-25)", color: "bg-red-500" },
                          { id: "fear", label: "Fear (26-45)", color: "bg-orange-500" },
                          { id: "neutral", label: "Neutral (46-54)", color: "bg-gray-500" },
                          { id: "greed", label: "Greed (55-74)", color: "bg-blue-500" },
                          { id: "extreme greed", label: "Extreme Greed (75-100)", color: "bg-indigo-500" },
                      ].map(zone => {
                          const isSelected = selectedFgZones.includes(zone.id);
                          return (
                              <button
                                  key={zone.id}
                                  onClick={() => toggleFgZone(zone.id)}
                                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 border ${isSelected
                                      ? `${zone.color} text-white border-transparent shadow-lg shadow-${zone.color}/20`
                                      : "bg-transparent text-gray-400 border-gray-700 hover:border-gray-500"
                                      }`}
                              >
                                  {zone.label}
                              </button>
                          );
                      })}
                  </div>
              </div>

              {/* Simulation Stats */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-gray-800/50 rounded-2xl p-3 border border-gray-700/50">
                      <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">Total Buys</div>
                      <div className="text-white font-bold text-lg">{analytics.fearGreedSim.totalBuys}</div>
                  </div>
                  <div className="bg-gray-800/50 rounded-2xl p-3 border border-gray-700/50">
                      <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">Total Invested</div>
                      <div className="text-white font-bold text-lg">${analytics.fearGreedSim.totalInvested.toLocaleString()}</div>
                  </div>
                  <div className="bg-gray-800/50 rounded-2xl p-3 border border-gray-700/50">
                      <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">Avg Buy Price</div>
                      <div className="text-white font-bold text-lg">${analytics.fearGreedSim.avgPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                  </div>

                  <div className="bg-gray-800/50 rounded-2xl p-3 border border-gray-700/50">
                      <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">Total Dividends</div>
                      <div className="text-green-400 font-bold text-lg">+${analytics.fearGreedSim.totalDividends.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                  </div>
                  <div className="bg-gray-800/50 rounded-2xl p-3 border border-gray-700/50">
                      <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">Val (Reinvest)</div>
                      <div className="text-white font-bold text-lg">${analytics.fearGreedSim.currentValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                  </div>
                  <div className="bg-gray-800/50 rounded-2xl p-3 border border-gray-700/50">
                      <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">Total Return</div>
                      <div className={`font-bold text-lg ${analytics.fearGreedSim.totalReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {analytics.fearGreedSim.totalReturn >= 0 ? '+' : ''}{analytics.fearGreedSim.totalReturn.toFixed(2)}%
                      </div>
                  </div>
              </div>

              <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={analytics.fearGreedChart}>
                          <defs>
                              <linearGradient id="colorFgValueReinvest" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                              </linearGradient>
                              <linearGradient id="colorFgValueNoReinvest" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                              </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                          <XAxis
                              dataKey={SIM_KEY.date}
                              stroke="#6b7280"
                              tickFormatter={(str) => {
                                  const date = new Date(str);
                                  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
                              }}
                              minTickGap={50}
                          />
                          <YAxis
                              stroke="#6b7280"
                              tickFormatter={(val) => `$${val}`}
                          />
                          <Tooltip
                              contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '12px' }}
                              itemStyle={{ color: '#e5e7eb' }}
                              labelStyle={{ color: '#9ca3af' }}
                              formatter={(value: number, name: string) => {
                                  if (name === "valueReinvest") return [`$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, "With Reinvestment"];
                                  if (name === "valueNoReinvest") return [`$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, "Without Reinvestment"];
                                  return [`$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, name];
                              }}
                          />
                          <Legend />
                          <Area
                              type="monotone"
                              dataKey={SIM_KEY.valueReinvest}
                              name="With Reinvestment"
                              stroke="none"
                              fill="url(#colorFgValueReinvest)"
                              activeDot={false}
                          />
                          <Area
                              type="monotone"
                              dataKey={SIM_KEY.valueNoReinvest}
                              name="Without Reinvestment"
                              stroke="none"
                              fill="url(#colorFgValueNoReinvest)"
                              activeDot={false}
                          />

                          <Line
                              type="monotone"
                              dataKey={SIM_KEY.valueNoReinvest}
                              stroke="#f97316"
                              strokeWidth={2}
                              dot={false}
                              legendType="none"
                              tooltipType="none"
                          />
                          <Line
                              type="monotone"
                              dataKey={SIM_KEY.valueReinvest}
                              stroke="#10b981"
                              strokeWidth={2}
                              dot={false}
                              legendType="none"
                              tooltipType="none"
                          />

                          <Line
                              type="step"
                              dataKey={SIM_KEY.invested}
                              name="Invested Capital"
                              stroke="#9ca3af"
                              strokeWidth={2}
                              dot={false}
                              strokeDasharray="5 5"
                          />
                      </AreaChart>
                  </ResponsiveContainer>
              </div>
          </motion.div>
      )}
    </>
  );
}
