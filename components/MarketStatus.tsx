"use client";

import { useEffect, useState, memo } from "react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { TrendingUp, TrendingDown, Activity, AlertTriangle, Zap } from "lucide-react";
import { motion } from "framer-motion";

export interface MarketData {
    vix: {
        current: number;
        date: string | null;
        history: { date: string; close: number }[];
    };
    metrics: {
        gex: { current: number | null; date: string | null; change: number; history: { date: string; value: number }[] };
        dix: { current: number | null; date: string | null; change: number; history: { date: string; value: number }[] };
        fearGreed: { current: number | null; date: string | null; change: number; history: { date: string; value: number }[] };
    };
}

interface MarketStatusProps {
    data: MarketData | null;
    loading: boolean;
}

function MarketStatus({ data, loading }: MarketStatusProps) {

    if (loading) return <div className="animate-pulse h-32 bg-gray-900/50 rounded-3xl mb-8"></div>;
    if (!data) return null;

    const getFearGreedColor = (value: number) => {
        if (value >= 75) return "text-green-500"; // Extreme Greed
        if (value >= 55) return "text-green-400"; // Greed
        if (value >= 45) return "text-gray-400";  // Neutral
        if (value >= 25) return "text-red-400";   // Fear
        return "text-red-500";                    // Extreme Fear
    };

    const getFearGreedLabel = (value: number) => {
        if (value >= 75) return "Extreme Greed";
        if (value >= 55) return "Greed";
        if (value >= 45) return "Neutral";
        if (value >= 25) return "Fear";
        return "Extreme Fear";
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return "";
        const date = new Date(dateString);
        return `${date.getMonth() + 1}/${date.getDate()}`;
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
        >
            {/* VIX Chart Card */}
            <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-2xl p-4 relative overflow-hidden group">
                <div className="flex justify-between items-start mb-2 relative z-10">
                    <div>
                        <div className="text-gray-400 text-xs font-medium uppercase tracking-wider flex items-center gap-1">
                            <Activity className="w-3 h-3" /> VIX Index
                            {data.vix.date && <span className="text-gray-600 ml-1">({formatDate(data.vix.date)})</span>}
                        </div>
                        <div className="text-white font-bold text-2xl mt-1">{data.vix.current.toFixed(2)}</div>
                    </div>
                    <div className={`text-xs px-2 py-1 rounded-full ${data.vix.current > 20 ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                        {data.vix.current > 20 ? 'High Volatility' : 'Stable'}
                    </div>
                </div>
                {/* Mini Sparkline */}
                <div className="h-16 w-full absolute bottom-0 left-0 right-0 opacity-50 group-hover:opacity-100 transition-opacity">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data.vix.history}>
                            <Line
                                type="monotone"
                                dataKey="close"
                                stroke={data.vix.current > 20 ? "#ef4444" : "#10b981"}
                                strokeWidth={2}
                                dot={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Fear & Greed Index */}
            <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden group">
                <div className="flex justify-between items-start relative z-10">
                    <div className="text-gray-400 text-xs font-medium uppercase tracking-wider flex items-center gap-1">
                        <Zap className="w-3 h-3" /> Fear & Greed
                        {data.metrics.fearGreed.date && <span className="text-gray-600 ml-1">({formatDate(data.metrics.fearGreed.date)})</span>}
                    </div>
                </div>
                <div className="flex items-end gap-2 mt-2 relative z-10">
                    <div className={`text-3xl font-bold ${getFearGreedColor(data.metrics.fearGreed.current || 50)}`}>
                        {data.metrics.fearGreed.current ?? "N/A"}
                    </div>
                    <div className="text-sm text-gray-400 mb-1 font-medium">
                        {data.metrics.fearGreed.current ? getFearGreedLabel(data.metrics.fearGreed.current) : ""}
                    </div>
                    {typeof data.metrics.fearGreed.change === 'number' && data.metrics.fearGreed.change !== 0 && (
                        <span className={`text-sm mb-1 ml-1 ${data.metrics.fearGreed.change > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {data.metrics.fearGreed.change > 0 ? '+' : ''}{data.metrics.fearGreed.change.toFixed(0)}
                        </span>
                    )}
                </div>

                {/* Mini Sparkline */}
                <div className="h-16 w-full absolute bottom-0 left-0 right-0 opacity-30 group-hover:opacity-60 transition-opacity">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data.metrics.fearGreed.history}>
                            <Line
                                type="monotone"
                                dataKey="value"
                                stroke={getFearGreedColor(data.metrics.fearGreed.current || 50).replace('text-', '#').replace('500', 'ef4444').replace('400', '9ca3af').replace('green-500', '22c55e').replace('green-400', '4ade80').replace('red-400', 'f87171').replace('red-500', 'ef4444')}
                                strokeWidth={2}
                                dot={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Gamma Exposure (GEX) */}
            <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-2xl p-4 flex flex-col justify-center relative overflow-hidden group">
                <div className="text-gray-400 text-xs font-medium uppercase tracking-wider flex items-center gap-1 mb-1 relative z-10">
                    <TrendingUp className="w-3 h-3" /> Gamma Exposure (GEX)
                    {data.metrics.gex.date && <span className="text-gray-600 ml-1">({formatDate(data.metrics.gex.date)})</span>}
                </div>
                <div className="text-white font-bold text-2xl relative z-10 flex items-end gap-2">
                    {data.metrics.gex.current ? `$${data.metrics.gex.current.toFixed(1)} B` : <span className="text-gray-600 text-lg">N/A</span>}
                    {typeof data.metrics.gex.change === 'number' && data.metrics.gex.change !== 0 && (
                        <span className={`text-sm mb-1 ${data.metrics.gex.change > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {data.metrics.gex.change > 0 ? '+' : ''}{data.metrics.gex.change.toFixed(1)}
                        </span>
                    )}
                </div>
                <div className="text-xs text-gray-500 mt-1 relative z-10">
                    Higher values imply market stability.
                </div>
                {/* Mini Sparkline */}
                <div className="h-16 w-full absolute bottom-0 left-0 right-0 opacity-30 group-hover:opacity-60 transition-opacity">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data.metrics.gex.history}>
                            <Line
                                type="monotone"
                                dataKey="value"
                                stroke="#8b5cf6"
                                strokeWidth={2}
                                dot={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Dark Index (DIX) */}
            <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-2xl p-4 flex flex-col justify-center relative overflow-hidden group">
                <div className="text-gray-400 text-xs font-medium uppercase tracking-wider flex items-center gap-1 mb-1 relative z-10">
                    <AlertTriangle className="w-3 h-3" /> Dark Index (DIX)
                    {data.metrics.dix.date && <span className="text-gray-600 ml-1">({formatDate(data.metrics.dix.date)})</span>}
                </div>
                <div className="text-white font-bold text-2xl relative z-10 flex items-end gap-2">
                    {data.metrics.dix.current ? `${data.metrics.dix.current.toFixed(1)}%` : <span className="text-gray-600 text-lg">N/A</span>}
                    {typeof data.metrics.dix.change === 'number' && data.metrics.dix.change !== 0 && (
                        <span className={`text-sm mb-1 ${data.metrics.dix.change > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {data.metrics.dix.change > 0 ? '+' : ''}{data.metrics.dix.change.toFixed(1)}%
                        </span>
                    )}
                </div>
                <div className="text-xs text-gray-500 mt-1 relative z-10">
                    {data.metrics.dix.current && data.metrics.dix.current > 45 ? "High dark pool buying" : "Low dark pool activity"}
                </div>
                {/* Mini Sparkline */}
                <div className="h-16 w-full absolute bottom-0 left-0 right-0 opacity-30 group-hover:opacity-60 transition-opacity">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data.metrics.dix.history}>
                            <Line
                                type="monotone"
                                dataKey="value"
                                stroke="#eab308"
                                strokeWidth={2}
                                dot={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </motion.div>
    );
}

export default memo(MarketStatus);
