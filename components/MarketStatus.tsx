"use client";

import { memo } from "react";
import { Activity, Zap, DollarSign, BarChart2, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";

export interface MarketData {
    indices: {
        vix: { current: number; changePercent: number; date: string | null };
        sp500: { current: number; changePercent: number; date: string | null };
        nasdaq: { current: number; changePercent: number; date: string | null };
        usdkrw: { current: number; changePercent: number; date: string | null };
    };
    fearGreed: { current: number; changePercent: number; date: string | null };
}

interface MarketStatusProps {
    data: MarketData | null;
    loading: boolean;
}

const getChangeColor = (value: number) => {
    if (value > 0) return "text-green-400";
    if (value < 0) return "text-red-400";
    return "text-gray-400";
};

interface MetricCardProps {
    title: string;
    value: number;
    change?: number;
    prefix?: string;
    suffix?: string;
    icon?: React.ElementType;
    href?: string;
}

const MetricCard = ({ title, value, change, prefix = "", suffix = "", icon: Icon, href }: MetricCardProps) => {
    const content = (
        <div className={`bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-2xl p-4 flex flex-col justify-between transition-colors ${href ? 'hover:bg-gray-800/80 cursor-pointer group' : 'hover:bg-gray-800/50'}`}>
            <div className="flex justify-between items-start mb-2">
                <div className="text-gray-400 text-xs font-medium uppercase tracking-wider flex items-center gap-1 group-hover:text-blue-400 transition-colors">
                    {Icon && <Icon className="w-3 h-3" />} {title}
                    {href && <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />}
                </div>
            </div>
            <div className="flex items-end gap-2">
                <div className="text-white font-bold text-2xl">
                    {prefix}{value.toLocaleString(undefined, { maximumFractionDigits: 2 })}{suffix}
                </div>
                {change !== undefined && (
                    <span className={`text-sm mb-1 ${getChangeColor(change)}`}>
                        {change > 0 ? '+' : ''}{change.toFixed(2)}%
                    </span>
                )}
            </div>
        </div>
    );

    if (href) {
        return (
            <a href={href} target="_blank" rel="noopener noreferrer" className="block h-full">
                {content}
            </a>
        );
    }

    return content;
};

function MarketStatus({ data, loading }: MarketStatusProps) {

    const defaultData: MarketData = {
        indices: {
            vix: { current: 0, changePercent: 0, date: null },
            sp500: { current: 0, changePercent: 0, date: null },
            nasdaq: { current: 0, changePercent: 0, date: null },
            usdkrw: { current: 0, changePercent: 0, date: null },
        },
        fearGreed: { current: 50, changePercent: 0, date: null }
    };

    // Robust merge to handle partial API failures (e.g. missing usdkrw)
    const displayData = {
        indices: {
            vix: data?.indices?.vix || defaultData.indices.vix,
            sp500: data?.indices?.sp500 || defaultData.indices.sp500,
            nasdaq: data?.indices?.nasdaq || defaultData.indices.nasdaq,
            usdkrw: data?.indices?.usdkrw || defaultData.indices.usdkrw,
        },
        fearGreed: data?.fearGreed || defaultData.fearGreed
    };

    if (loading) return <div className="animate-pulse h-32 bg-gray-900/50 rounded-3xl mb-8"></div>;

    const getFearGreedColor = (value: number) => {
        if (value >= 75) return "text-green-500";
        if (value >= 55) return "text-green-400";
        if (value >= 45) return "text-gray-400";
        if (value >= 25) return "text-red-400";
        return "text-red-500";
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 space-y-4"
        >
            {/* Main Indices Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <MetricCard
                    title="S&P 500"
                    value={displayData.indices.sp500.current}
                    change={displayData.indices.sp500.changePercent}
                    icon={BarChart2}
                    href="https://finance.yahoo.com/quote/%5EGSPC"
                />
                <MetricCard
                    title="NASDAQ"
                    value={displayData.indices.nasdaq.current}
                    change={displayData.indices.nasdaq.changePercent}
                    icon={BarChart2}
                    href="https://finance.yahoo.com/quote/%5EIXIC"
                />
                <MetricCard
                    title="USD/KRW"
                    value={displayData.indices.usdkrw.current}
                    change={displayData.indices.usdkrw.changePercent}
                    prefix="₩"
                    icon={DollarSign}
                    href="https://finance.yahoo.com/quote/KRW=X"
                />
                <MetricCard
                    title="VIX"
                    value={displayData.indices.vix.current}
                    change={displayData.indices.vix.changePercent}
                    icon={Activity}
                    href="https://finance.yahoo.com/quote/%5EVIX"
                />

                {/* Fear & Greed (Custom Card for Label) */}
                <a href="https://edition.cnn.com/markets/fear-and-greed" target="_blank" rel="noopener noreferrer" className="block">
                    <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-2xl p-4 flex flex-col justify-between hover:bg-gray-800/50 transition-colors h-full">
                        <div className="text-gray-400 text-xs font-medium uppercase tracking-wider flex items-center gap-1 mb-2">
                            <Zap className="w-3 h-3" /> Fear & Greed
                        </div>
                        <div className="flex items-end gap-2">
                            <div className={`text-2xl font-bold ${getFearGreedColor(displayData.fearGreed.current)}`}>
                                {displayData.fearGreed.current.toFixed(2)}
                            </div>
                            {displayData.fearGreed.changePercent !== undefined && displayData.fearGreed.changePercent !== null && (
                                <span className={`text-sm mb-1 ${getChangeColor(displayData.fearGreed.changePercent)}`}>
                                    {displayData.fearGreed.changePercent > 0 ? '+' : ''}{displayData.fearGreed.changePercent.toFixed(1)}%
                                </span>
                            )}
                        </div>
                    </div>
                </a>
            </div>

            {/* Quick Links for GEX/DIX */}
            <div className="flex gap-3 justify-end text-xs">
                <a href="https://squeezemetrics.com/monitor/dix" target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 px-3 py-2 bg-gray-800/50 hover:bg-gray-700 text-gray-400 hover:text-white rounded-lg transition-colors border border-gray-700">
                    Gamma Exposure (GEX) <ExternalLink className="w-3 h-3" />
                </a>
                <a href="https://squeezemetrics.com/monitor/dix" target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 px-3 py-2 bg-gray-800/50 hover:bg-gray-700 text-gray-400 hover:text-white rounded-lg transition-colors border border-gray-700">
                    Dark Index (DIX) <ExternalLink className="w-3 h-3" />
                </a>
            </div>
        </motion.div>
    );
}

export default memo(MarketStatus);
