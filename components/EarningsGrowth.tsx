"use client";

import { motion } from "framer-motion";
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    Legend, LineChart, Line, ComposedChart, Area
} from "recharts";
import { TrendingUp, Award, BarChart3, Activity, Zap, Info } from "lucide-react";

interface EarningsGrowthProps {
    data: {
        earningsGrowth?: {
            history: {
                quarter: string;
                actual: number;
                estimate: number;
                surprise: number;
                surprisePercent: number;
                period: string;
            }[];
            trend: {
                period: string;
                endDate: string;
                growth: number;
                earningsEstimate: number;
                revenueEstimate: number;
            }[];
            margins: {
                date: string;
                grossMargin: number;
                operatingMargin: number;
                netMargin: number;
            }[];
        };
    };
}

const formatPercent = (val: number) => (val * 100).toFixed(1) + "%";

interface CustomTooltipProps {
    active?: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload?: any[];
    label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 p-3 rounded-xl shadow-2xl">
                <p className="text-xs font-bold text-slate-400 mb-2">{label}</p>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {payload.map((entry: any, index: number) => (
                    <div key={index} className="flex items-center gap-2 text-xs">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                        <span className="text-slate-300">{entry.name}:</span>
                        <span className="text-white font-mono font-bold">
                            {entry.name.includes("Margin") || entry.name.includes("Surprise") ? formatPercent(entry.value) : entry.value.toFixed(2)}
                        </span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

const EarningsGrowth = ({ data }: EarningsGrowthProps) => {
    const { earningsGrowth } = data;
    if (!earningsGrowth) return null;

    const { history, trend, margins } = earningsGrowth;

    return (
        <div className="w-full mt-12 space-y-10">
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-amber-500/10 rounded-lg">
                    <BarChart3 className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white tracking-tight">Earnings & Growth</h2>
                    <p className="text-xs text-slate-500 uppercase tracking-widest font-medium">Performance Metrics & Margin Analysis</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* 1. Earnings Surprise History */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-slate-900/40 backdrop-blur-md border border-slate-800/50 rounded-3xl p-6"
                >
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <Award className="w-4 h-4 text-purple-400" />
                            <h3 className="text-sm font-bold text-slate-200">Earnings Surprise History</h3>
                        </div>
                        <div className="px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 rounded-md text-[10px] text-purple-400 font-bold uppercase tracking-wider">
                            Last 4 Quarters
                        </div>
                    </div>
                    
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={history.slice(-4)}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                <XAxis 
                                    dataKey="quarter" 
                                    stroke="#64748b" 
                                    fontSize={10} 
                                    tickFormatter={(val) => {
                                        const date = new Date(val);
                                        return `Q${Math.floor(date.getMonth() / 3) + 1} '${date.getFullYear().toString().slice(-2)}`;
                                    }}
                                />
                                <YAxis stroke="#64748b" fontSize={10} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                                <Bar name="Actual EPS" dataKey="actual" fill="#a855f7" radius={[4, 4, 0, 0]} />
                                <Bar name="Estimate EPS" dataKey="estimate" fill="#334155" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-[10px] text-slate-500 bg-slate-800/20 p-2 rounded-lg">
                        <Zap className="w-3 h-3 text-amber-400" />
                        <span>Average Surprise: <span className="text-white font-bold">{(history.reduce((acc, h) => acc + h.surprisePercent, 0) / history.length * 100).toFixed(1)}%</span> over last 4 quarters.</span>
                    </div>
                </motion.div>

                {/* 2. Margin Trends */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-slate-900/40 backdrop-blur-md border border-slate-800/50 rounded-3xl p-6"
                >
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-emerald-400" />
                            <h3 className="text-sm font-bold text-slate-200">Profit Margin Trends</h3>
                        </div>
                    </div>
                    
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={margins}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                <XAxis 
                                    dataKey="date" 
                                    stroke="#64748b" 
                                    fontSize={10} 
                                    tickFormatter={(val) => new Date(val).getFullYear().toString()}
                                />
                                <YAxis stroke="#64748b" fontSize={10} tickFormatter={(val) => (val * 100).toFixed(0) + "%"} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                                <Line name="Gross Margin" type="monotone" dataKey="grossMargin" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981' }} />
                                <Line name="Operating Margin" type="monotone" dataKey="operatingMargin" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 5" dot={{ fill: '#3b82f6' }} />
                                <Line name="Net Margin" type="monotone" dataKey="netMargin" stroke="#f43f5e" strokeWidth={2} dot={{ fill: '#f43f5e' }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-4 p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl flex items-start gap-2">
                        <Info className="w-3.5 h-3.5 text-indigo-400 mt-0.5 shrink-0" />
                        <p className="text-[10px] text-slate-400 leading-tight">
                            Increasing margins indicate improved operational efficiency and pricing power. A widening gap between Gross and Net margin often reflects high fixed costs or tax structure changes.
                        </p>
                    </div>
                </motion.div>

                {/* 3. Growth Estimates & CAGR */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="lg:col-span-2 bg-slate-900/40 backdrop-blur-md border border-slate-800/50 rounded-3xl p-6"
                >
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-blue-400" />
                            <h3 className="text-sm font-bold text-slate-200">Growth Forecast (Revenue & Earnings)</h3>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-blue-500" />
                                <span className="text-[10px] text-slate-400">Revenue Estimate</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-amber-500" />
                                <span className="text-[10px] text-slate-400">EPS Growth</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={trend}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                <XAxis 
                                    dataKey="period" 
                                    stroke="#64748b" 
                                    fontSize={10}
                                    tickFormatter={(val) => val === '+5y' ? '5Y Forecast' : val}
                                />
                                <YAxis yAxisId="left" stroke="#64748b" fontSize={10} label={{ value: 'Est. Value', angle: -90, position: 'insideLeft', style: { fill: '#64748b', fontSize: '10px' } }} />
                                <YAxis yAxisId="right" orientation="right" stroke="#64748b" fontSize={10} tickFormatter={(val) => (val * 100).toFixed(0) + "%"} label={{ value: 'Growth %', angle: 90, position: 'insideRight', style: { fill: '#64748b', fontSize: '10px' } }} />
                                <Tooltip content={<CustomTooltip />} />
                                <Area yAxisId="left" name="Revenue Estimate" dataKey="revenueEstimate" fill="#3b82f6" fillOpacity={0.1} stroke="#3b82f6" strokeWidth={2} />
                                <Bar yAxisId="right" name="Growth Est." dataKey="growth" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={40} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default EarningsGrowth;
