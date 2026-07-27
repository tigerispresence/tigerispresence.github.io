"use client";

import { useMemo, useState, memo } from "react";
import {
    Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area, BarChart, Bar, Legend, ComposedChart, ReferenceLine, Scatter
} from "recharts";
import { motion } from "framer-motion";
import { ArrowUp, ArrowDown, TrendingUp, Activity } from "lucide-react";
import NewsSection from "./NewsSection";
import SeasonalityHeatmap from "./SeasonalityHeatmap";
import FinancialsChart from "./FinancialsChart";
import AIInsights from "./AIInsights";
import AnalystRatings from "./AnalystRatings";
import RiskMetrics from "./RiskMetrics";
import SmartMoneyFlow from "./SmartMoneyFlow";
import ShareholderYield from "./ShareholderYield";
import EarningsGrowth from "./EarningsGrowth";
import type { StockData } from "@/lib/types/stock";
import { computeSeries } from "@/lib/calc/series";
import { computeDistribution } from "@/lib/calc/distribution";
import { downsample } from "@/lib/calc/downsample";
import { simulateDca } from "@/lib/calc/sim/dca";
import { simulateVolatility } from "@/lib/calc/sim/volatility";
import { simulateFearGreed } from "@/lib/calc/sim/fearGreed";

export type { StockData };

interface StockDashboardProps {
    data: StockData | null;
}

const StockDashboard = memo(({ data }: StockDashboardProps) => {
    // if (!data) return null; // Moved to after hooks

    // State for Simulation Strategy
    // Zones: "-2" (<= -2sd), "-1" (-2sd < x <= -1sd), "0" (-1sd < x < 1sd), "1" (1sd <= x < 2sd), "2" (>= 2sd)
    const [selectedZones, setSelectedZones] = useState<string[]>(["-2", "-1"]);

    const toggleZone = (zone: string) => {
        setSelectedZones(prev =>
            prev.includes(zone)
                ? prev.filter(z => z !== zone)
                : [...prev, zone]
        );
    };

    // State for Fear & Greed Simulation Strategy
    const [selectedFgZones, setSelectedFgZones] = useState<string[]>(["extreme fear", "fear"]);

    const toggleFgZone = (zone: string) => {
        setSelectedFgZones(prev =>
            prev.includes(zone)
                ? prev.filter(z => z !== zone)
                : [...prev, zone]
        );
    };

    // All derivation lives in lib/calc so it can be unit tested without React.
    const processedData = useMemo(
        () => computeSeries(data?.history ?? []),
        [data?.history],
    );

    const distributionData = useMemo(
        () => computeDistribution(data?.history ?? []),
        [data?.history],
    );

    const simulationData = useMemo(
        () =>
            simulateVolatility(
                processedData,
                distributionData,
                { currentPrice: data?.currentPrice ?? 0, dividends: data?.dividends },
                selectedZones,
            ),
        [processedData, distributionData, data?.currentPrice, data?.dividends, selectedZones],
    );

    const dcaSimulationData = useMemo(
        () =>
            simulateDca(processedData, {
                currentPrice: data?.currentPrice ?? 0,
                dividends: data?.dividends,
            }),
        [processedData, data?.currentPrice, data?.dividends],
    );

    const fearGreedSimulationData = useMemo(
        () =>
            simulateFearGreed(
                processedData,
                data?.fearGreedHistory,
                { currentPrice: data?.currentPrice ?? 0, dividends: data?.dividends },
                selectedFgZones,
            ),
        [processedData, data?.fearGreedHistory, data?.currentPrice, data?.dividends, selectedFgZones],
    );

    const chartData = useMemo(() => {
        const downsampled = downsample(processedData, 500);
        if (!simulationData) return downsampled;
        return downsampled.map((point) => ({
            ...point,
            buyPrice: simulationData.buyDates.has(point.date) ? point.close : null,
        }));
    }, [processedData, simulationData]);

    const simulationChartData = useMemo(
        () => (simulationData ? downsample(simulationData.history, 500) : []),
        [simulationData],
    );
    const dcaChartData = useMemo(
        () => (dcaSimulationData ? downsample(dcaSimulationData.history, 500) : []),
        [dcaSimulationData],
    );
    const fearGreedChartData = useMemo(
        () => (fearGreedSimulationData ? downsample(fearGreedSimulationData.history, 500) : []),
        [fearGreedSimulationData],
    );

    if (!data) return null;

    const isPositive = data.change >= 0;

    const formatCurrency = (value: number) => {
        if (data.currency === 'KRW') return `${value.toLocaleString()}원`;
        if (data.currency === 'USD') return `$${value.toLocaleString()}`;
        return `${value.toLocaleString()} ${data.currency}`;
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-6xl mx-auto mt-8 space-y-8"
        >
            {/* Header Section */}
            <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-3xl p-8 shadow-2xl">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-4xl font-bold text-white tracking-tight">{data.symbol}</h1>
                        <p className="text-gray-400 text-lg">{data.name}</p>
                    </div>
                    <div className="text-right">
                        <div className="text-5xl font-bold text-white tracking-tighter">
                            {formatCurrency(data.currentPrice)}
                        </div>
                        <div className={`flex items-center justify-end gap-2 text-xl font-medium mt-2 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                            {isPositive ? <ArrowUp className="w-6 h-6" /> : <ArrowDown className="w-6 h-6" />}
                            {Math.abs(data.change).toFixed(2)} ({Math.abs(data.changePercent).toFixed(2)}%)
                        </div>
                    </div>
                </div>
            </div>

            {/* Risk Metrics Section */}
            <RiskMetrics data={data} />

            {/* Smart Money Flow Section */}
            <SmartMoneyFlow data={data} />

            {/* Shareholder Yield Section */}
            <ShareholderYield data={data} />

            {/* Earnings & Growth Section */}
            <EarningsGrowth data={data} />

            {/* Key Statistics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-2xl p-4 flex flex-col items-center justify-center relative group">
                    <div className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-1">TTM PER</div>
                    <div className="text-white font-bold text-2xl">
                        {data.trailingPE ? data.trailingPE.toFixed(2) : <span className="text-gray-600 text-lg">N/A</span>}
                    </div>
                    {data.geminiMetrics?.trailingPE && (
                        <div className="text-xs text-blue-400 mt-1 flex items-center gap-1 opacity-80">
                            <span>G: {data.geminiMetrics.trailingPE.toFixed(2)}</span>
                        </div>
                    )}
                </div>
                <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-2xl p-4 flex flex-col items-center justify-center relative group">
                    <div className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-1">Forward PER</div>
                    <div className="text-white font-bold text-2xl">
                        {data.forwardPE ? data.forwardPE.toFixed(2) : <span className="text-gray-600 text-lg">N/A</span>}
                    </div>
                    {data.geminiMetrics?.forwardPE && (
                        <div className="text-xs text-blue-400 mt-1 flex items-center gap-1 opacity-80">
                            <span>G: {data.geminiMetrics.forwardPE.toFixed(2)}</span>
                        </div>
                    )}
                </div>
                <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-2xl p-4 flex flex-col items-center justify-center relative group">
                    <div className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-1">Dividend Yield</div>
                    <div className="text-white font-bold text-2xl">
                        {data.dividendYield ? `${data.dividendYield.toFixed(2)}%` : <span className="text-gray-600 text-lg">N/A</span>}
                    </div>
                    {data.geminiMetrics?.dividendYield && (
                        <div className="text-xs text-blue-400 mt-1 flex items-center gap-1 opacity-80">
                            <span>G: {data.geminiMetrics.dividendYield.toFixed(2)}%</span>
                        </div>
                    )}
                </div>
                {/* Max Pain Card */}
                <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-2xl p-4 flex flex-col items-center justify-center relative group">
                    <div className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-1">Max Pain</div>
                    <div className="text-white font-bold text-2xl">
                        {data.maxPain ? formatCurrency(data.maxPain.price) : <span className="text-gray-600 text-lg">N/A</span>}
                    </div>
                    {data.maxPain && (
                        <div className="text-xs text-blue-400 border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 mt-1 rounded opacity-80 whitespace-nowrap">
                            Exp: {new Date(data.maxPain.expirationDate).toISOString().split('T')[0]}
                        </div>
                    )}
                </div>
            </div>

            {/* AI Insights & Thesis */}
            <AIInsights symbol={data.symbol} stockName={data.name} />

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

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

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
                            <ComposedChart data={chartData}>
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

                {/* Financials Chart */}
                {data.financials && (
                    <div className="lg:col-span-2">
                        <FinancialsChart data={data.financials} />
                    </div>
                )}

                {/* Seasonality Heatmap */}
                {data.seasonality && data.seasonality.length > 0 && (
                    <div className="lg:col-span-2">
                        <SeasonalityHeatmap data={data.seasonality} />
                    </div>
                )}

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
                            <ComposedChart data={chartData}>
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
                            <div className="text-white font-bold text-lg">{distributionData.mean.toFixed(2)}%</div>
                        </div>
                        <div className="bg-gray-800/50 rounded-2xl p-3 border border-gray-700/50 text-center">
                            <div className="text-pink-400 text-xs font-medium uppercase tracking-wider mb-1">1 Sigma (1σ)</div>
                            <div className="text-white font-bold text-lg">±{distributionData.sd.toFixed(2)}%</div>
                            <div className="text-gray-400 text-xs mt-1">{distributionData.count1Sigma} days ({(distributionData.count1Sigma / distributionData.totalDays * 100).toFixed(1)}%)</div>
                        </div>
                        <div className="bg-gray-800/50 rounded-2xl p-3 border border-gray-700/50 text-center">
                            <div className="text-red-400 text-xs font-medium uppercase tracking-wider mb-1">2 Sigma (2σ)</div>
                            <div className="text-white font-bold text-lg">±{(distributionData.sd * 2).toFixed(2)}%</div>
                            <div className="text-gray-400 text-xs mt-1">{distributionData.count2Sigma} days ({(distributionData.count2Sigma / distributionData.totalDays * 100).toFixed(1)}%)</div>
                        </div>
                    </div>

                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={distributionData.data}>
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
                                <ReferenceLine x={parseFloat((Math.round(distributionData.mean / 0.1) * 0.1).toFixed(1))} stroke="#fff" strokeDasharray="3 3" label={{ value: "Mean", position: "top", fill: "#fff", fontSize: 10 }} />
                                <ReferenceLine x={parseFloat((Math.round((distributionData.mean + distributionData.sd) / 0.1) * 0.1).toFixed(1))} stroke="#f472b6" strokeDasharray="3 3" label={{ value: "+1σ", position: "top", fill: "#f472b6", fontSize: 10 }} />
                                <ReferenceLine x={parseFloat((Math.round((distributionData.mean - distributionData.sd) / 0.1) * 0.1).toFixed(1))} stroke="#f472b6" strokeDasharray="3 3" label={{ value: "-1σ", position: "top", fill: "#f472b6", fontSize: 10 }} />
                                <ReferenceLine x={parseFloat((Math.round((distributionData.mean + (2 * distributionData.sd)) / 0.1) * 0.1).toFixed(1))} stroke="#ef4444" strokeDasharray="3 3" label={{ value: "+2σ", position: "top", fill: "#ef4444", fontSize: 10 }} />
                                <ReferenceLine x={parseFloat((Math.round((distributionData.mean - (2 * distributionData.sd)) / 0.1) * 0.1).toFixed(1))} stroke="#ef4444" strokeDasharray="3 3" label={{ value: "-2σ", position: "top", fill: "#ef4444", fontSize: 10 }} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* Monthly DCA Simulation Chart */}
                {dcaSimulationData && (
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
                                <div className="text-white font-bold text-lg">{dcaSimulationData.totalBuys}</div>
                            </div>
                            <div className="bg-gray-800/50 rounded-2xl p-3 border border-gray-700/50">
                                <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">Total Invested</div>
                                <div className="text-white font-bold text-lg">${dcaSimulationData.totalInvested.toLocaleString()}</div>
                            </div>
                            <div className="bg-gray-800/50 rounded-2xl p-3 border border-gray-700/50">
                                <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">Avg Buy Price</div>
                                <div className="text-white font-bold text-lg">${dcaSimulationData.avgPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                            </div>

                            <div className="bg-gray-800/50 rounded-2xl p-3 border border-gray-700/50">
                                <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">Total Dividends</div>
                                <div className="text-green-400 font-bold text-lg">+${dcaSimulationData.totalDividends.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                            </div>
                            <div className="bg-gray-800/50 rounded-2xl p-3 border border-gray-700/50">
                                <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">Current Value</div>
                                <div className="text-white font-bold text-lg">${dcaSimulationData.currentValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                            </div>
                            <div className="bg-gray-800/50 rounded-2xl p-3 border border-gray-700/50">
                                <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">Total Return</div>
                                <div className={`font-bold text-lg ${dcaSimulationData.totalReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {dcaSimulationData.totalReturn >= 0 ? '+' : ''}{dcaSimulationData.totalReturn.toFixed(2)}%
                                </div>
                            </div>
                        </div>

                        <div className="h-[350px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={dcaChartData}>
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

                {/* Volatility Trading Simulation Chart */}
                {simulationData && (
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
                                <div className="text-white font-bold text-lg">{simulationData.totalBuys}</div>
                            </div>
                            <div className="bg-gray-800/50 rounded-2xl p-3 border border-gray-700/50">
                                <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">Total Invested</div>
                                <div className="text-white font-bold text-lg">${simulationData.totalInvested.toLocaleString()}</div>
                            </div>
                            <div className="bg-gray-800/50 rounded-2xl p-3 border border-gray-700/50">
                                <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">Avg Buy Price</div>
                                <div className="text-white font-bold text-lg">${simulationData.avgPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                            </div>

                            <div className="bg-gray-800/50 rounded-2xl p-3 border border-gray-700/50">
                                <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">Total Dividends</div>
                                <div className="text-green-400 font-bold text-lg">+${simulationData.totalDividends.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                            </div>
                            <div className="bg-gray-800/50 rounded-2xl p-3 border border-gray-700/50">
                                <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">Val (Reinvest)</div>
                                <div className="text-white font-bold text-lg">${simulationData.currentValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                            </div>
                            <div className="bg-gray-800/50 rounded-2xl p-3 border border-gray-700/50">
                                <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">Total Return</div>
                                <div className={`font-bold text-lg ${simulationData.totalReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {simulationData.totalReturn >= 0 ? '+' : ''}{simulationData.totalReturn.toFixed(2)}%
                                </div>
                            </div>
                        </div>

                        <div className="h-[350px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={simulationChartData}>
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
                                        dataKey="valueReinvest"
                                        name="With Reinvestment"
                                        stroke="none"
                                        fill="url(#colorValueReinvest)"
                                        activeDot={false}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="valueNoReinvest"
                                        name="Without Reinvestment"
                                        stroke="none"
                                        fill="url(#colorValueNoReinvest)"
                                        activeDot={false}
                                    />

                                    {/* Lines for Stroke - Green on top of Blue */}
                                    <Line
                                        type="monotone"
                                        dataKey="valueNoReinvest"
                                        stroke="#3b82f6"
                                        strokeWidth={2}
                                        dot={false}
                                        legendType="none"
                                        tooltipType="none"
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="valueReinvest"
                                        stroke="#10b981"
                                        strokeWidth={2}
                                        dot={false}
                                        legendType="none"
                                        tooltipType="none"
                                    />

                                    <Line
                                        type="step"
                                        dataKey="invested"
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

                {/* Fear & Greed Trading Simulation Chart */}
                {fearGreedSimulationData && (
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
                                <div className="text-white font-bold text-lg">{fearGreedSimulationData.totalBuys}</div>
                            </div>
                            <div className="bg-gray-800/50 rounded-2xl p-3 border border-gray-700/50">
                                <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">Total Invested</div>
                                <div className="text-white font-bold text-lg">${fearGreedSimulationData.totalInvested.toLocaleString()}</div>
                            </div>
                            <div className="bg-gray-800/50 rounded-2xl p-3 border border-gray-700/50">
                                <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">Avg Buy Price</div>
                                <div className="text-white font-bold text-lg">${fearGreedSimulationData.avgPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                            </div>

                            <div className="bg-gray-800/50 rounded-2xl p-3 border border-gray-700/50">
                                <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">Total Dividends</div>
                                <div className="text-green-400 font-bold text-lg">+${fearGreedSimulationData.totalDividends.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                            </div>
                            <div className="bg-gray-800/50 rounded-2xl p-3 border border-gray-700/50">
                                <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">Val (Reinvest)</div>
                                <div className="text-white font-bold text-lg">${fearGreedSimulationData.currentValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                            </div>
                            <div className="bg-gray-800/50 rounded-2xl p-3 border border-gray-700/50">
                                <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">Total Return</div>
                                <div className={`font-bold text-lg ${fearGreedSimulationData.totalReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {fearGreedSimulationData.totalReturn >= 0 ? '+' : ''}{fearGreedSimulationData.totalReturn.toFixed(2)}%
                                </div>
                            </div>
                        </div>

                        <div className="h-[350px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={fearGreedChartData}>
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
                                        dataKey="valueReinvest"
                                        name="With Reinvestment"
                                        stroke="none"
                                        fill="url(#colorFgValueReinvest)"
                                        activeDot={false}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="valueNoReinvest"
                                        name="Without Reinvestment"
                                        stroke="none"
                                        fill="url(#colorFgValueNoReinvest)"
                                        activeDot={false}
                                    />

                                    <Line
                                        type="monotone"
                                        dataKey="valueNoReinvest"
                                        stroke="#f97316"
                                        strokeWidth={2}
                                        dot={false}
                                        legendType="none"
                                        tooltipType="none"
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="valueReinvest"
                                        stroke="#10b981"
                                        strokeWidth={2}
                                        dot={false}
                                        legendType="none"
                                        tooltipType="none"
                                    />

                                    <Line
                                        type="step"
                                        dataKey="invested"
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


            </div>
            {/* News & Social Insights Section */}
            <NewsSection symbol={data.symbol} />

        </motion.div>
    );
});

StockDashboard.displayName = "StockDashboard";

export default StockDashboard;
