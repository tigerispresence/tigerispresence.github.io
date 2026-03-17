"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { ShieldAlert, ShieldCheck, Zap, Info, TrendingDown, Activity } from "lucide-react";

interface RiskMetricsProps {
    data: {
        currentPrice: number;
        riskMetrics?: {
            beta?: number;
            fiftyTwoWeekHigh?: number;
            fiftyTwoWeekLow?: number;
            marketCap?: number;
        };
        geminiRiskMetrics?: {
            altmanZScore?: number;
            piotroskiFScore?: number;
            riskSummary?: string;
        };
    };
}

export default function RiskMetrics({ data }: RiskMetricsProps) {
    const { currentPrice, riskMetrics, geminiRiskMetrics } = data;

    const mdd = useMemo(() => {
        if (!currentPrice || !riskMetrics?.fiftyTwoWeekHigh) return null;
        return ((currentPrice - riskMetrics.fiftyTwoWeekHigh) / riskMetrics.fiftyTwoWeekHigh) * 100;
    }, [currentPrice, riskMetrics]);

    const zScoreInfo = useMemo(() => {
        const score = geminiRiskMetrics?.altmanZScore;
        if (score === undefined || score === null) return null;
        if (score > 3.0) return { label: "Safe", color: "text-green-400", bg: "bg-green-400/10", border: "border-green-400/20" };
        if (score > 1.8) return { label: "Gray Zone", color: "text-yellow-400", bg: "bg-yellow-400/10", border: "border-yellow-400/20" };
        return { label: "Distress", color: "text-red-400", bg: "bg-red-400/10", border: "border-red-400/20" };
    }, [geminiRiskMetrics?.altmanZScore]);

    const fScoreInfo = useMemo(() => {
        const score = geminiRiskMetrics?.piotroskiFScore;
        if (score === undefined || score === null) return null;
        if (score >= 7) return { label: "Strong", color: "text-green-400", bg: "bg-green-400/10", border: "border-green-400/20" };
        if (score >= 4) return { label: "Average", color: "text-yellow-400", bg: "bg-yellow-400/10", border: "border-yellow-400/20" };
        return { label: "Weak", color: "text-red-400", bg: "bg-red-400/10", border: "border-red-400/20" };
    }, [geminiRiskMetrics?.piotroskiFScore]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {/* Beta Card */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl backdrop-blur-xl"
            >
                <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-400 text-sm font-medium">Beta (Market = 1.0)</span>
                    <Zap className="w-4 h-4 text-blue-400" />
                </div>
                <div className="flex items-end gap-2">
                    <span className="text-2xl font-bold text-white">
                        {riskMetrics?.beta?.toFixed(2) || "N/A"}
                    </span>
                    <span className={`text-xs mb-1 font-medium ${
                        !riskMetrics?.beta ? "text-slate-500" :
                        riskMetrics.beta > 1.2 ? "text-orange-400" :
                        riskMetrics.beta < 0.8 ? "text-emerald-400" : "text-blue-400"
                    }`}>
                        {!riskMetrics?.beta ? "" :
                         riskMetrics.beta > 1.2 ? "High Volatility" :
                         riskMetrics.beta < 0.8 ? "Low Volatility" : "Moderate"}
                    </span>
                </div>
            </motion.div>

            {/* MDD Card */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl backdrop-blur-xl"
            >
                <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-400 text-sm font-medium">Max Drawdown (52W)</span>
                    <TrendingDown className="w-4 h-4 text-red-400" />
                </div>
                <div className="flex items-end gap-2">
                    <span className="text-2xl font-bold text-white">
                        {mdd !== null ? `${mdd.toFixed(2)}%` : "N/A"}
                    </span>
                    <span className="text-xs mb-1 text-slate-500 font-medium">
                        from peak
                    </span>
                </div>
            </motion.div>

            {/* Altman Z-Score Card */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl backdrop-blur-xl"
            >
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1">
                        <span className="text-slate-400 text-sm font-medium">Altman Z-Score</span>
                        <Info className="w-3 h-3 text-slate-500 cursor-help" />
                    </div>
                    {zScoreInfo ? (
                        <ShieldCheck className={`w-4 h-4 ${zScoreInfo.color}`} />
                    ) : (
                        <ShieldAlert className="w-4 h-4 text-slate-600" />
                    )}
                </div>
                <div className="flex items-end gap-2">
                    <span className="text-2xl font-bold text-white">
                        {geminiRiskMetrics?.altmanZScore?.toFixed(2) || "N/A"}
                    </span>
                    {zScoreInfo && (
                        <span className={`text-xs px-2 py-0.5 rounded-full mb-1 border font-semibold ${zScoreInfo.bg} ${zScoreInfo.color} ${zScoreInfo.border}`}>
                            {zScoreInfo.label}
                        </span>
                    )}
                </div>
            </motion.div>

            {/* Piotroski F-Score Card */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl backdrop-blur-xl"
            >
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1">
                        <span className="text-slate-400 text-sm font-medium">Piotroski F-Score</span>
                        <Info className="w-3 h-3 text-slate-500 cursor-help" />
                    </div>
                    {fScoreInfo ? (
                        <Activity className={`w-4 h-4 ${fScoreInfo.color}`} />
                    ) : (
                        <Activity className="w-4 h-4 text-slate-600" />
                    )}
                </div>
                <div className="flex items-end gap-2">
                    <span className="text-2xl font-bold text-white">
                        {geminiRiskMetrics?.piotroskiFScore || "N/A"}/9
                    </span>
                    {fScoreInfo && (
                        <span className={`text-xs px-2 py-0.5 rounded-full mb-1 border font-semibold ${fScoreInfo.bg} ${fScoreInfo.color} ${fScoreInfo.border}`}>
                            {fScoreInfo.label}
                        </span>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
