"use client";

import {
  Area, AreaChart, CartesianGrid, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { SIM_KEY } from "@/lib/calc/sim/types";
import { useStockData } from "../StockDataContext";

export default function VolatilitySimulationChart() {
  const { analytics, selectedZones, toggleZone } = useStockData();

  return (
    <>
      {/* Volatility Trading Simulation Chart */}
      {analytics.volatilitySim && (
          <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-3xl p-6 shadow-xl lg:col-span-2"
          >
              <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-yellow-500/10 rounded-xl">
                      <TrendingUp className="w-6 h-6 text-yellow-400" />
                  </div>
                  <div>
                      <h3 className="text-xl font-semibold text-white">Volatility Trading Simulation</h3>
                      <p className="text-gray-400 text-sm">Strategy: Buy 1 Share when daily change is in selected zones + <span className="text-green-400">Reinvest Dividends</span></p>
                  </div>
              </div>

              {/* Strategy Controls */}
              <div className="mb-6">
                  <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-2">Buy Zones (Sigma)</div>
                  <div className="flex flex-wrap gap-2">
                      {[
                          { id: "-2", label: "≤ -2σ", color: "bg-red-500" },
                          { id: "-1", label: "-1σ", color: "bg-pink-500" },
                          { id: "0", label: "0σ (Normal)", color: "bg-gray-500" },
                          { id: "1", label: "+1σ", color: "bg-blue-500" },
                          { id: "2", label: "≥ +2σ", color: "bg-indigo-500" },
                      ].map(zone => {
                          const isSelected = selectedZones.includes(zone.id);
                          return (
                              <button
                                  key={zone.id}
                                  onClick={() => toggleZone(zone.id)}
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
                      <div className="text-white font-bold text-lg">{analytics.volatilitySim.totalBuys}</div>
                  </div>
                  <div className="bg-gray-800/50 rounded-2xl p-3 border border-gray-700/50">
                      <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">Total Invested</div>
                      <div className="text-white font-bold text-lg">${analytics.volatilitySim.totalInvested.toLocaleString()}</div>
                  </div>
                  <div className="bg-gray-800/50 rounded-2xl p-3 border border-gray-700/50">
                      <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">Avg Buy Price</div>
                      <div className="text-white font-bold text-lg">${analytics.volatilitySim.avgPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                  </div>

                  <div className="bg-gray-800/50 rounded-2xl p-3 border border-gray-700/50">
                      <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">Total Dividends</div>
                      <div className="text-green-400 font-bold text-lg">+${analytics.volatilitySim.totalDividends.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                  </div>
                  <div className="bg-gray-800/50 rounded-2xl p-3 border border-gray-700/50">
                      <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">Val (Reinvest)</div>
                      <div className="text-white font-bold text-lg">${analytics.volatilitySim.currentValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                  </div>
                  <div className="bg-gray-800/50 rounded-2xl p-3 border border-gray-700/50">
                      <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">Total Return</div>
                      <div className={`font-bold text-lg ${analytics.volatilitySim.totalReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {analytics.volatilitySim.totalReturn >= 0 ? '+' : ''}{analytics.volatilitySim.totalReturn.toFixed(2)}%
                      </div>
                  </div>
              </div>

              <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={analytics.volatilityChart}>
                          <defs>
                              <linearGradient id="colorValueReinvest" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                              </linearGradient>
                              <linearGradient id="colorValueNoReinvest" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
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
                          {/* Areas for Fill (Gradient) - Green behind Blue */}
                          <Area
                              type="monotone"
                              dataKey={SIM_KEY.valueReinvest}
                              name="With Reinvestment"
                              stroke="none"
                              fill="url(#colorValueReinvest)"
                              activeDot={false}
                          />
                          <Area
                              type="monotone"
                              dataKey={SIM_KEY.valueNoReinvest}
                              name="Without Reinvestment"
                              stroke="none"
                              fill="url(#colorValueNoReinvest)"
                              activeDot={false}
                          />

                          {/* Lines for Stroke - Green on top of Blue */}
                          <Line
                              type="monotone"
                              dataKey={SIM_KEY.valueNoReinvest}
                              stroke="#3b82f6"
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
