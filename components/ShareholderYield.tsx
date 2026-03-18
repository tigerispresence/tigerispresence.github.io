"use client";

import { motion } from "framer-motion";
import { Gift, RefreshCw, Percent, PiggyBank, ArrowUpRight, Info, ShieldCheck, ShieldAlert, Zap } from "lucide-react";

interface ShareholderYieldProps {
    data: {
        shareholderYield?: {
            buybackYield: number;
            dividendYield: number;
            totalYield: number;
            payoutRatio?: number;
            annualBuybacks: number;
        };
    };
}

const ShareholderYield = ({ data }: ShareholderYieldProps) => {
    const { shareholderYield } = data;
    if (!shareholderYield) return null;

    const { buybackYield, dividendYield, totalYield, payoutRatio, annualBuybacks } = shareholderYield;

    const formatPercent = (val: number) => (val * 100).toFixed(2) + "%";
    
    const formatValue = (val: number) => {
        if (val >= 1e9) return `${(val / 1e9).toFixed(2)}B`;
        if (val >= 1e6) return `${(val / 1e6).toFixed(2)}M`;
        return val.toLocaleString();
    };

    // Payout Ratio Safety
    const getPayoutStatus = (ratio: number) => {
        if (ratio < 0.6) return { label: "Sustainable", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", icon: ShieldCheck };
        if (ratio < 0.9) return { label: "High", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", icon: Zap };
        return { label: "Critical", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", icon: ShieldAlert };
    };

    const payoutStatus = payoutRatio ? getPayoutStatus(payoutRatio) : null;

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    const cardVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
    };

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="w-full mt-8"
        >
            <div className="flex items-center gap-2 mb-6">
                <div className="p-2 bg-indigo-500/10 rounded-lg">
                    <Gift className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white tracking-tight">Shareholder Yield</h2>
                    <p className="text-xs text-slate-500 uppercase tracking-widest font-medium">Dividends & Share Buybacks</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Yield Card */}
                <motion.div
                    variants={cardVariants}
                    className="bg-indigo-600/10 backdrop-blur-md border border-indigo-500/20 rounded-2xl p-6 relative overflow-hidden group"
                >
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <ArrowUpRight className="w-12 h-12 text-indigo-400" />
                    </div>
                    <p className="text-[10px] text-indigo-300 uppercase font-bold tracking-wider mb-1">Total Shareholder Yield</p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-black text-white">{formatPercent(totalYield)}</span>
                    </div>
                    <div className="mt-4 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: "100%" }}
                            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                        />
                    </div>
                </motion.div>

                {/* Dividend Yield Card */}
                <motion.div
                    variants={cardVariants}
                    className="bg-slate-900/40 backdrop-blur-md border border-slate-800/50 rounded-2xl p-6 relative overflow-hidden group"
                >
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <Percent className="w-12 h-12 text-emerald-400" />
                    </div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Dividend Yield</p>
                    <p className="text-3xl font-bold text-emerald-400">{formatPercent(dividendYield)}</p>
                    <div className="mt-2 text-[10px] text-slate-400 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        <span>Direct Cash Return</span>
                    </div>
                </motion.div>

                {/* Buyback Yield Card */}
                <motion.div
                    variants={cardVariants}
                    className="bg-slate-900/40 backdrop-blur-md border border-slate-800/50 rounded-2xl p-6 relative overflow-hidden group"
                >
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <RefreshCw className="w-12 h-12 text-blue-400" />
                    </div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Buyback Yield</p>
                    <p className="text-3xl font-bold text-blue-400">{formatPercent(buybackYield)}</p>
                    <div className="mt-2 text-[10px] text-slate-400 flex items-center gap-1">
                        <PiggyBank className="w-3 h-3 text-blue-400" />
                        <span>${formatValue(annualBuybacks)} Repurchased (TTM)</span>
                    </div>
                </motion.div>

                {/* Payout Ratio Card */}
                <motion.div
                    variants={cardVariants}
                    className={`bg-slate-900/40 backdrop-blur-md border border-slate-800/50 rounded-2xl p-6 relative overflow-hidden group`}
                >
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Payout Ratio</p>
                    <div className="flex items-center justify-between">
                        <p className={`text-3xl font-bold ${payoutStatus?.color || "text-white"}`}>
                            {payoutRatio ? (payoutRatio * 100).toFixed(1) + "%" : "N/A"}
                        </p>
                        {payoutStatus && (
                            <div className={`px-2 py-1 rounded-full ${payoutStatus.bg} ${payoutStatus.border} flex items-center gap-1`}>
                                <payoutStatus.icon className={`w-3 h-3 ${payoutStatus.color}`} />
                                <span className={`text-[10px] font-bold ${payoutStatus.color}`}>{payoutStatus.label}</span>
                            </div>
                        )}
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-[10px] text-slate-500">
                        <Info className="w-3 h-3" />
                        <span>% of earnings paid as dividends.</span>
                    </div>
                </motion.div>
            </div>
            
            <div className="mt-4 p-4 bg-slate-900/40 border border-slate-800/40 rounded-xl flex items-start gap-3">
                <Zap className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-400 leading-relaxed">
                    <span className="text-white font-semibold">Pro Insight:</span> Shareholder Yield combines dividends and net share repurchases. A higher buyback yield often indicates management believes the stock is undervalued, while a sustainable payout ratio ensures dividend longevity.
                </p>
            </div>
        </motion.div>
    );
};

export default ShareholderYield;
