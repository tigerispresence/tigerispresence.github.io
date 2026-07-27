"use client";

import {
  Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Activity } from "lucide-react";
import { motion } from "framer-motion";
import { useStockData } from "../StockDataContext";

export default function VolatilityChart() {
  const { analytics } = useStockData();

  return (
    <>
      {/* Volatility Chart */}
      <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-3xl p-6 shadow-xl"
      >
          <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-purple-500/10 rounded-xl">
                  <Activity className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-xl font-semibold text-white">Volatility Analysis</h3>
          </div>
          <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={analytics.priceChart}>
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
                          tickFormatter={(val) => `${val}%`}
                      />
                      <Tooltip
                          contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '12px' }}
                          itemStyle={{ color: '#e5e7eb' }}
                          labelStyle={{ color: '#9ca3af' }}
                      />
                      <Legend />
                      <Bar
                          dataKey="changePercent"
                          name="Daily Change %"
                          fill="#8b5cf6"
                          opacity={0.6}
                          radius={[4, 4, 0, 0]}
                      />
                      <Line
                          type="monotone"
                          dataKey="rollingSD"
                          name="20-Day Volatility (SD)"
                          stroke="#f472b6"
                          strokeWidth={2}
                          dot={false}
                      />
                  </ComposedChart>
              </ResponsiveContainer>
          </div>
      </motion.div>

    </>
  );
}
