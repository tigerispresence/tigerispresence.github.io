"use client";

import { useMemo, useState } from "react";
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area, BarChart, Bar, Legend, ComposedChart, ReferenceLine, Scatter
} from "recharts";
import { motion } from "framer-motion";
import { ArrowUp, ArrowDown, TrendingUp, Activity } from "lucide-react";

export interface StockData {
    symbol: string;
    name: string;
    currentPrice: number;
    currency: string;
    change: number;
    changePercent: number;
    trailingPE?: number;
    forwardPE?: number;
    dividendYield?: number;
    geminiMetrics?: {
        trailingPE: number | null;
        forwardPE: number | null;
        dividendYield: number | null;
    };
    history: {
        date: string;
        close: number;
    }[];
    dividends?: {
        date: string;
        amount: number;
    }[];
}

interface StockDashboardProps {
    data: StockData | null;
}

export default function StockDashboard({ data }: StockDashboardProps) {
    if (!data) return null;

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

    const processedData = useMemo(() => {
        if (!data.history || data.history.length === 0) return [];

        const history = [...data.history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        return history.map((day, index) => {
            const prevDay = history[index - 1];
            const changePercent = prevDay
                ? ((day.close - prevDay.close) / prevDay.close) * 100
                : 0;

            // Calculate 20-day rolling stats
            let rollingSD = 0;
            let sma20 = null;
            let upperBand = null;
            let lowerBand = null;

            if (index >= 19) { // Need 20 points (0 to 19)
                const slice = history.slice(index - 19, index + 1);

                // 1. Volatility (SD of Returns)
                const changes = slice.map((d, i) => {
                    if (i === 0) return 0; // Skip first change in slice for simplicity or look back further
                    const p = slice[i - 1];
                    return ((d.close - p.close) / p.close) * 100;
                }).slice(1); // Remove the first 0

                if (changes.length > 0) {
                    const meanChange = changes.reduce((a, b) => a + b, 0) / changes.length;
                    const varianceChange = changes.reduce((a, b) => a + Math.pow(b - meanChange, 2), 0) / changes.length;
                    rollingSD = Math.sqrt(varianceChange);
                }

                // 2. Bollinger Bands (SD of Price)
                const prices = slice.map(d => d.close);
                const meanPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
                const variancePrice = prices.reduce((a, b) => a + Math.pow(b - meanPrice, 2), 0) / prices.length;
                const sdPrice = Math.sqrt(variancePrice);

                sma20 = meanPrice;
                upperBand = meanPrice + (2 * sdPrice);
                lowerBand = meanPrice - (2 * sdPrice);
            }

            return {
                ...day,
                changePercent,
                rollingSD,
                sma20,
                upperBand,
                lowerBand
            };
        });
    }, [data]);
    // Calculate Distribution Data
    const distributionData = useMemo(() => {
        if (!data.history || data.history.length < 2) return { data: [], mean: 0, sd: 0, count1Sigma: 0, count2Sigma: 0, totalDays: 0 };

        const changes = data.history.map((day, i) => {
            if (i === 0) return 0;
            const prev = data.history[i - 1].close;
            return ((day.close - prev) / prev) * 100;
        }).slice(1);

        const mean = changes.reduce((a, b) => a + b, 0) / changes.length;
        const variance = changes.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / changes.length;
        const sd = Math.sqrt(variance);

        // Calculate counts within sigma ranges
        const count1Sigma = changes.filter(c => Math.abs(c - mean) <= sd).length;
        const count2Sigma = changes.filter(c => Math.abs(c - mean) <= 2 * sd).length;

        // Calculate Sigma Markers
        const sigmaMarkers = [
            mean,
            mean + sd,
            mean - sd,
            mean + 2 * sd,
            mean - 2 * sd
        ];

        // Create Bins
        const dataMin = Math.min(...changes);
        const dataMax = Math.max(...changes);
        const markersMin = Math.min(...sigmaMarkers);
        const markersMax = Math.max(...sigmaMarkers);

        const binSize = 0.1;

        // Range should cover both data and sigma markers
        const min = Math.floor(Math.min(dataMin, markersMin) / binSize) * binSize;
        const max = Math.ceil(Math.max(dataMax, markersMax) / binSize) * binSize;

        const bins: { [key: string]: number } = {};

        // Initialize bins
        // Use a small epsilon to avoid floating point loop issues
        for (let i = min; i <= max + (binSize / 2); i += binSize) {
            bins[i.toFixed(1)] = 0;
        }

        changes.forEach(change => {
            const bin = (Math.floor(change / binSize) * binSize).toFixed(1);
            // Ensure bin exists (it should, given the range expansion)
            if (bins[bin] !== undefined) bins[bin]++;
        });

        const chartData = Object.entries(bins).map(([bin, count]) => ({
            bin: parseFloat(bin),
            count
        })).sort((a, b) => a.bin - b.bin);

        return { data: chartData, mean, sd, count1Sigma, count2Sigma, totalDays: changes.length };
    }, [data]);

    // Calculate Trading Simulation Data
    const simulationData = useMemo(() => {
        if (!processedData || processedData.length === 0 || !distributionData.sd) return null;

        const sigma = distributionData.sd;

        let sharesReinvest = 0;
        let totalInvested = 0;
        let buyCount = 0;
        let totalDividendsReinvested = 0;
        const buyDates = new Set<string>();

        // Scenario 2: No Reinvestment (Cash)
        let sharesNoReinvest = 0;
        let cashNoReinvest = 0;
        let totalDividendsCash = 0;

        // Create a map for quick dividend lookup: date string (YYYY-MM-DD) -> amount
        const dividendMap = new Map();
        if (data.dividends) {
            data.dividends.forEach(d => {
                const dateStr = new Date(d.date).toISOString().split('T')[0];
                dividendMap.set(dateStr, d.amount);
            });
        }

        const simHistory = processedData.map(day => {
            const dateStr = new Date(day.date).toISOString().split('T')[0];

            // 1. Check for Dividend Payment
            if (dividendMap.has(dateStr)) {
                const divAmount = dividendMap.get(dateStr);

                // Scenario 1: Reinvest
                const payoutReinvest = sharesReinvest * divAmount;
                if (payoutReinvest > 0) {
                    const sharesBought = payoutReinvest / day.close;
                    sharesReinvest += sharesBought;
                    totalDividendsReinvested += payoutReinvest;
                }

                // Scenario 2: Keep as Cash
                const payoutCash = sharesNoReinvest * divAmount;
                if (payoutCash > 0) {
                    cashNoReinvest += payoutCash;
                    totalDividendsCash += payoutCash;
                }
            }

            // 2. Check if volatility trigger is met based on selected zones
            const change = day.changePercent;
            const diff = change - distributionData.mean;
            let zone = "0";

            if (diff <= -2 * sigma) zone = "-2";
            else if (diff <= -1 * sigma) zone = "-1";
            else if (diff >= 2 * sigma) zone = "2";
            else if (diff >= 1 * sigma) zone = "1";

            if (selectedZones.includes(zone)) {
                const sharesBought = 100 / day.close;

                // Both scenarios buy the same amount of stock with new capital
                sharesReinvest += sharesBought;
                sharesNoReinvest += sharesBought;

                totalInvested += 100;
                buyCount++;
                buyDates.add(day.date);
            }

            return {
                date: day.date,
                invested: totalInvested,
                valueReinvest: sharesReinvest * day.close,
                valueNoReinvest: (sharesNoReinvest * day.close) + cashNoReinvest
            };
        });

        const currentValueReinvest = sharesReinvest * data.currentPrice;
        const totalReturnReinvest = totalInvested > 0 ? ((currentValueReinvest - totalInvested) / totalInvested) * 100 : 0;

        return {
            history: simHistory,
            totalBuys: buyCount,
            totalInvested,
            totalDividends: totalDividendsReinvested,
            currentValue: currentValueReinvest,
            totalReturn: totalReturnReinvest,
            buyDates
        };

    }, [processedData, distributionData.sd, distributionData.mean, data.currentPrice, data.dividends, selectedZones]);

    // Helper to downsample data for charts to improve performance
    const downsample = (data: any[], limit: number) => {
        if (!data || data.length <= limit) return data;
        const step = Math.ceil(data.length / limit);
        return data.filter((_, i) => i % step === 0);
    };

    const chartData = useMemo(() => {
        const downsampled = downsample(processedData, 500);
        if (!simulationData) return downsampled;

        return downsampled.map(point => ({
            ...point,
            buyPrice: simulationData.buyDates.has(point.date) ? point.close : null
        }));
    }, [processedData, simulationData]);
    const simulationChartData = useMemo(() => simulationData ? downsample(simulationData.history, 500) : [], [simulationData]);

    const isPositive = data.change >= 0;

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
                            {data.currency === "USD" ? "$" : ""}{data.currentPrice.toLocaleString()}
                        </div>
                        <div className={`flex items-center justify-end gap-2 text-xl font-medium mt-2 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                            {isPositive ? <ArrowUp className="w-6 h-6" /> : <ArrowDown className="w-6 h-6" />}
                            {Math.abs(data.change).toFixed(2)} ({Math.abs(data.changePercent).toFixed(2)}%)
                        </div>
                    </div>
                </div>
            </div>

            {/* Key Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            </div>

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
                                    tickFormatter={(str) => new Date(str).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })}
                                    minTickGap={30}
                                />
                                <YAxis
                                    stroke="#6b7280"
                                    domain={['auto', 'auto']}
                                    tickFormatter={(val) => `$${val}`}
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
                                    tickFormatter={(str) => new Date(str).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })}
                                    minTickGap={30}
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
                                    formatter={(value, name) => [value, "Days"]}
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

                {/* Trading Simulation Chart */}
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
                                <p className="text-gray-400 text-sm">Strategy: Buy $100 when daily change is in selected zones + <span className="text-green-400">Reinvest Dividends</span></p>
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
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            <div className="bg-gray-800/50 rounded-2xl p-3 border border-gray-700/50">
                                <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">Total Buys</div>
                                <div className="text-white font-bold text-lg">{simulationData.totalBuys}</div>
                            </div>
                            <div className="bg-gray-800/50 rounded-2xl p-3 border border-gray-700/50">
                                <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">Total Invested</div>
                                <div className="text-white font-bold text-lg">${simulationData.totalInvested.toLocaleString()}</div>
                            </div>
                            <div className="bg-gray-800/50 rounded-2xl p-3 border border-gray-700/50">
                                <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">Total Dividends</div>
                                <div className="text-green-400 font-bold text-lg">+${simulationData.totalDividends.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                            </div>
                            <div className="bg-gray-800/50 rounded-2xl p-3 border border-gray-700/50">
                                <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">Current Value</div>
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
                                        tickFormatter={(str) => new Date(str).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })}
                                        minTickGap={30}
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
                                        stroke="#10b981"
                                        fill="url(#colorValueReinvest)"
                                        strokeWidth={2}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="valueNoReinvest"
                                        name="Without Reinvestment"
                                        stroke="#3b82f6"
                                        fill="url(#colorValueNoReinvest)"
                                        strokeWidth={2}
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
        </motion.div>
    );
}
