"use client";

import {
  Bar, BarChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Activity } from "lucide-react";
import { motion } from "framer-motion";
import { useStockData } from "../StockDataContext";

export default function DistributionChart() {
  const { analytics } = useStockData();

  return (
    <>
      {/* Distribution Chart */}
      <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-3xl p-6 shadow-xl"
      >
          <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-green-500/10 rounded-xl">
                  <Activity className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-white">Return Distribution</h3>
          </div>

          {/* Sigma Statistics Summary */}
          <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-800/50 rounded-2xl p-3 border border-gray-700/50 text-center">
                  <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">Mean</div>
                  <div className="text-white font-bold text-lg">{analytics.distribution.mean.toFixed(2)}%</div>
              </div>
              <div className="bg-gray-800/50 rounded-2xl p-3 border border-gray-700/50 text-center">
                  <div className="text-pink-400 text-xs font-medium uppercase tracking-wider mb-1">1 Sigma (1σ)</div>
                  <div className="text-white font-bold text-lg">±{analytics.distribution.sd.toFixed(2)}%</div>
                  <div className="text-gray-400 text-xs mt-1">{analytics.distribution.count1Sigma} days ({(analytics.distribution.count1Sigma / analytics.distribution.totalDays * 100).toFixed(1)}%)</div>
              </div>
              <div className="bg-gray-800/50 rounded-2xl p-3 border border-gray-700/50 text-center">
                  <div className="text-red-400 text-xs font-medium uppercase tracking-wider mb-1">2 Sigma (2σ)</div>
                  <div className="text-white font-bold text-lg">±{(analytics.distribution.sd * 2).toFixed(2)}%</div>
                  <div className="text-gray-400 text-xs mt-1">{analytics.distribution.count2Sigma} days ({(analytics.distribution.count2Sigma / analytics.distribution.totalDays * 100).toFixed(1)}%)</div>
              </div>
          </div>

          <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.distribution.data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                      <XAxis
                          dataKey="bin"
                          stroke="#6b7280"
                          tickFormatter={(val) => `${val}%`}
                          minTickGap={30}
                      />
                      <YAxis
                          stroke="#6b7280"
                      />
                      <Tooltip
                          contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '12px' }}
                          itemStyle={{ color: '#e5e7eb' }}
                          labelStyle={{ color: '#9ca3af' }}
                          formatter={(value) => [value, "Days"]}
                          labelFormatter={(label) => `Return: ${label}%`}
                      />
                      <Legend />
                      <Bar dataKey="count" name="Frequency" fill="#10b981" radius={[4, 4, 0, 0]} />

                      {/* Sigma Lines - Snapped to nearest bin for categorical axis */}
                      <ReferenceLine x={parseFloat((Math.round(analytics.distribution.mean / 0.1) * 0.1).toFixed(1))} stroke="#fff" strokeDasharray="3 3" label={{ value: "Mean", position: "top", fill: "#fff", fontSize: 10 }} />
                      <ReferenceLine x={parseFloat((Math.round((analytics.distribution.mean + analytics.distribution.sd) / 0.1) * 0.1).toFixed(1))} stroke="#f472b6" strokeDasharray="3 3" label={{ value: "+1σ", position: "top", fill: "#f472b6", fontSize: 10 }} />
                      <ReferenceLine x={parseFloat((Math.round((analytics.distribution.mean - analytics.distribution.sd) / 0.1) * 0.1).toFixed(1))} stroke="#f472b6" strokeDasharray="3 3" label={{ value: "-1σ", position: "top", fill: "#f472b6", fontSize: 10 }} />
                      <ReferenceLine x={parseFloat((Math.round((analytics.distribution.mean + (2 * analytics.distribution.sd)) / 0.1) * 0.1).toFixed(1))} stroke="#ef4444" strokeDasharray="3 3" label={{ value: "+2σ", position: "top", fill: "#ef4444", fontSize: 10 }} />
                      <ReferenceLine x={parseFloat((Math.round((analytics.distribution.mean - (2 * analytics.distribution.sd)) / 0.1) * 0.1).toFixed(1))} stroke="#ef4444" strokeDasharray="3 3" label={{ value: "-2σ", position: "top", fill: "#ef4444", fontSize: 10 }} />
                  </BarChart>
              </ResponsiveContainer>
          </div>
      </motion.div>

    </>
  );
}
