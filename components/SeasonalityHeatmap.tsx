"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Calendar } from "lucide-react";

interface SeasonalityHeatmapProps {
    data: {
        date: string;
        close: number;
    }[];
}

export default function SeasonalityHeatmap({ data }: SeasonalityHeatmapProps) {
    const processedData = useMemo(() => {
        if (!data || data.length < 12) return null;

        // Group by Year and Month
        const monthlyReturns: { year: number, month: number, return: number }[] = [];
        const monthlyStats: { [key: number]: number[] } = {};

        // Sort data by date just in case
        const sortedData = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        for (let i = 1; i < sortedData.length; i++) {
            const current = sortedData[i];
            const prev = sortedData[i - 1];
            const date = new Date(current.date);
            const r = ((current.close - prev.close) / prev.close) * 100;

            monthlyReturns.push({
                year: date.getFullYear(),
                month: date.getMonth(), // 0-11
                return: r
            });

            if (!monthlyStats[date.getMonth()]) monthlyStats[date.getMonth()] = [];
            monthlyStats[date.getMonth()].push(r);
        }

        // Calculate Average Stats per Month
        const avgMonthlyReturns = Object.entries(monthlyStats).map(([month, returns]) => ({
            month: parseInt(month),
            avgReturn: returns.reduce((a, b) => a + b, 0) / returns.length,
            winRate: (returns.filter(r => r > 0).length / returns.length) * 100
        })).sort((a, b) => a.month - b.month);

        return { monthlyReturns, avgMonthlyReturns };
    }, [data]);

    if (!processedData) return null;

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const getColor = (value: number) => {
        if (value >= 5) return "bg-green-500";
        if (value >= 2) return "bg-green-600/80";
        if (value > 0) return "bg-green-800/60";
        if (value <= -5) return "bg-red-500";
        if (value <= -2) return "bg-red-600/80";
        return "bg-red-800/60";
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-3xl p-6 shadow-xl"
        >
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-orange-500/10 rounded-xl">
                    <Calendar className="w-6 h-6 text-orange-400" />
                </div>
                <div>
                    <h3 className="text-xl font-semibold text-white">Seasonality Check</h3>
                    <p className="text-sm text-gray-400">Average monthly returns (Last 10 Years)</p>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-2 mb-4">
                {processedData.avgMonthlyReturns.map((stat, idx) => (
                    <div key={idx} className="flex flex-col items-center gap-2 group cursor-pointer">
                        {/* Bar Representation */}
                        <div className="relative w-full h-32 bg-gray-800/30 rounded-lg overflow-hidden flex flex-col justify-end items-center">
                            <div
                                className={`w-full transition-all duration-500 ${getColor(stat.avgReturn)}`}
                                style={{ height: `${Math.min(100, Math.abs(stat.avgReturn) * 5)}%` }} // Scaling factor
                            />

                            {/* Value Label */}
                            <div className={`absolute ${stat.avgReturn >= 0 ? 'bottom-1' : 'top-1'} text-[10px] font-bold text-white drop-shadow-md`}>
                                {stat.avgReturn.toFixed(1)}%
                            </div>
                        </div>

                        {/* Month Label */}
                        <span className="text-xs font-medium text-gray-400 group-hover:text-white transition-colors">{months[stat.month]}</span>

                        {/* Win Rate Chip */}
                        <div className="text-[9px] bg-gray-800 px-1 py-0.5 rounded text-gray-500">
                            {stat.winRate.toFixed(0)}%
                        </div>
                    </div>
                ))}
            </div>

            <div className="text-center text-xs text-gray-500 mt-2">
                *Win Rate: Percentage of years with positive returns for that month
            </div>
        </motion.div>
    );
}
