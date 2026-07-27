"use client";

import {
  Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { useStockData } from "../StockDataContext";

export default function DcaSimulationChart() {
  const { data, analytics, formatCurrency } = useStockData();

  return (
    <>
      {/* Monthly DCA Simulation Chart */}
      {analytics.dcaSim && (
          <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-3xl p-6 shadow-xl lg:col-span-2"
          >
              <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-blue-500/10 rounded-xl">
                      <TrendingUp className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                      <h3 className="text-xl font-semibold text-white">Monthly DCA Simulation</h3>
                      <p className="text-gray-400 text-sm">Strategy: Buy 1 Share on Month Start + <span className="text-green-400">Reinvest Dividends</span></p>
                  </div>
              </div>

              {/* DCA Stats */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-gray-800/50 rounded-2xl p-3 border border-gray-700/50">
                      <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">Total Buys</div>
                      <div className="text-white font-bold text-lg">{analytics.dcaSim.totalBuys}</div>
                  </div>
                  <div className="bg-gray-800/50 rounded-2xl p-3 border border-gray-700/50">
                      <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">Total Invested</div>
                      <div className="text-white font-bold text-lg">${analytics.dcaSim.totalInvested.toLocaleString()}</div>
                  </div>
                  <div className="bg-gray-800/50 rounded-2xl p-3 border border-gray-700/50">
                      <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">Avg Buy Price</div>
                      <div className="text-white font-bold text-lg">${analytics.dcaSim.avgPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                  </div>

                  <div className="bg-gray-800/50 rounded-2xl p-3 border border-gray-700/50">
                      <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">Total Dividends</div>
                      <div className="text-green-400 font-bold text-lg">+${analytics.dcaSim.totalDividends.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                  </div>
                  <div className="bg-gray-800/50 rounded-2xl p-3 border border-gray-700/50">
                      <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">Current Value</div>
                      <div className="text-white font-bold text-lg">${analytics.dcaSim.currentValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                  </div>
                  <div className="bg-gray-800/50 rounded-2xl p-3 border border-gray-700/50">
                      <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">Total Return</div>
                      <div className={`font-bold text-lg ${analytics.dcaSim.totalReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {analytics.dcaSim.totalReturn >= 0 ? '+' : ''}{analytics.dcaSim.totalReturn.toFixed(2)}%
                      </div>
                  </div>
              </div>

              <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={analytics.dcaChart}>
                          <defs>
                              <linearGradient id="colorDcaValue" x1="0" y1="0" x2="0" y2="1">
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
                              tickFormatter={(val) => data.currency === 'USD' ? `$${val}` : val.toLocaleString()}
                          />
                          <Tooltip
                              contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '12px' }}
                              itemStyle={{ color: '#e5e7eb' }}
                              labelStyle={{ color: '#9ca3af' }}
                              formatter={(value: number) => [formatCurrency(value), ""]}
                          />
                          <Legend />
                          <Area
                              type="monotone"
                              dataKey="value"
                              name="Portfolio Value"
                              stroke="#3b82f6"
                              fill="url(#colorDcaValue)"
                              strokeWidth={2}
                          />
                          <Area
                              type="monotone"
                              dataKey="invested"
                              name="Total Invested"
                              stroke="#9ca3af" // Gray line for invested amount
                              fill="none"
                              strokeWidth={2}
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
