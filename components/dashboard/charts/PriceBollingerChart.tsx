"use client";

import {
  Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { useStockData } from "../StockDataContext";

export default function PriceBollingerChart() {
  const { data, analytics } = useStockData();

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
              <h3 className="text-xl font-semibold text-white">Price & Bollinger Bands</h3>
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
                      />
                      <Area
                          type="monotone"
                          dataKey="lowerBand"
                          stroke="none"
                          fill="#3b82f6"
                          fillOpacity={0.1}
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
                      <Line
                          type="monotone"
                          dataKey="sma20"
                          stroke="#fbbf24"
                          strokeWidth={1}
                          dot={false}
                          name="SMA 20"
                      />
                      <Line
                          type="monotone"
                          dataKey="close"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          dot={false}
                          name="Price"
                      />
                      <Scatter
                          dataKey="buyPrice"
                          name="Buy Signal"
                          fill="#10b981"
                          shape="circle"
                      />
                  </ComposedChart>
              </ResponsiveContainer>
          </div>
      </motion.div>

    </>
  );
}
