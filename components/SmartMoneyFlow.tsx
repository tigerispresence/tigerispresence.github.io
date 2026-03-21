"use client";

import { motion } from "framer-motion";
import { Users, Handshake, TrendingDown, Info, ArrowUpRight, ArrowDownRight, Activity, ShieldCheck } from "lucide-react";

interface SmartMoneyFlowProps {
    data: {
        smartMoneyFlow?: {
            insiderTransactions: Array<{
                shares: number;
                value: number;
                date: string;
                text: string;
                insiderName: string;
                insiderTitle: string;
                ownership: string;
            }>;
            ownership: {
                insiderPercent?: number;
                institutionPercent?: number;
                floatPercent?: number;
            };
            shortInterest: {
                shortPercentOfFloat?: number;
                shortRatio?: number;
                shortPreviousMonthDate?: string;
            };
        };
    };
}

const SmartMoneyFlow = ({ data }: SmartMoneyFlowProps) => {
    const { smartMoneyFlow } = data;
    if (!smartMoneyFlow) return null;

    const { insiderTransactions, ownership, shortInterest } = smartMoneyFlow;

    // Format numbers
    const formatValue = (val?: number) => {
        if (val === undefined || val === null) return "0";
        if (val >= 1e9) return `${(val / 1e9).toFixed(2)}B`;
        if (val >= 1e6) return `${(val / 1e6).toFixed(2)}M`;
        if (val >= 1e3) return `${(val / 1e3).toFixed(2)}K`;
        return val.toString();
    };

    const containerVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: {
            opacity: 1,
            y: 0,
            transition: {
                duration: 0.6,
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, scale: 0.95 },
        visible: { opacity: 1, scale: 1 }
    };

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="w-full space-y-6 mt-8"
        >
            <div className="flex items-center gap-2 mb-6">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Activity className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white tracking-tight">Smart Money Flow</h2>
                    <p className="text-xs text-slate-500 uppercase tracking-widest font-medium">Institutional & Insider Activity</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Ownership Card */}
                <motion.div
                    variants={itemVariants}
                    className="bg-slate-900/40 backdrop-blur-md border border-slate-800/50 rounded-2xl p-6 relative overflow-hidden group"
                >
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Users className="w-24 h-24 text-blue-400" />
                    </div>

                    <div className="flex items-center gap-2 mb-4">
                        <Users className="w-4 h-4 text-blue-400" />
                        <h3 className="text-sm font-semibold text-slate-300">Ownership Breakdown</h3>
                    </div>

                    <div className="space-y-4">
                        <div className="relative pt-1">
                            <div className="flex mb-2 items-center justify-between">
                                <div>
                                    <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-blue-400 bg-blue-500/10">
                                        Institutions
                                    </span>
                                </div>
                                <div className="text-right">
                                    <span className="text-xs font-bold inline-block text-blue-400">
                                        {(ownership.institutionPercent ? ownership.institutionPercent * 100 : 0).toFixed(1)}%
                                    </span>
                                </div>
                            </div>
                            <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-slate-800">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(ownership.institutionPercent || 0) * 100}%` }}
                                    transition={{ duration: 1, delay: 0.2 }}
                                    className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500"
                                ></motion.div>
                            </div>
                        </div>

                        <div className="relative pt-1">
                            <div className="flex mb-2 items-center justify-between">
                                <div>
                                    <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-purple-400 bg-purple-500/10">
                                        Insiders
                                    </span>
                                </div>
                                <div className="text-right">
                                    <span className="text-xs font-bold inline-block text-purple-400">
                                        {(ownership.insiderPercent ? ownership.insiderPercent * 100 : 0).toFixed(1)}%
                                    </span>
                                </div>
                            </div>
                            <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-slate-800">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(ownership.insiderPercent || 0) * 100}%` }}
                                    transition={{ duration: 1, delay: 0.4 }}
                                    className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-purple-500"
                                ></motion.div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Short Interest Card */}
                <motion.div
                    variants={itemVariants}
                    className="bg-slate-900/40 backdrop-blur-md border border-slate-800/50 rounded-2xl p-6 relative overflow-hidden group"
                >
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                        <TrendingDown className="w-24 h-24 text-red-400" />
                    </div>

                    <div className="flex items-center gap-2 mb-4">
                        <TrendingDown className="w-4 h-4 text-red-400" />
                        <h3 className="text-sm font-semibold text-slate-300">Short Interest</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-700/30">
                            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Short % of Float</p>
                            <p className={`text-xl font-bold ${(shortInterest.shortPercentOfFloat || 0) > 0.1 ? 'text-red-400' : 'text-emerald-400'}`}>
                                {(shortInterest.shortPercentOfFloat ? shortInterest.shortPercentOfFloat * 100 : 0).toFixed(2)}%
                            </p>
                        </div>
                        <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-700/30">
                            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Days to Cover</p>
                            <p className={`text-xl font-bold ${(shortInterest.shortRatio || 0) > 5 ? 'text-red-400' : 'text-blue-400'}`}>
                                {(shortInterest.shortRatio || 0).toFixed(1)}
                            </p>
                        </div>
                    </div>

                    <div className="mt-4 flex items-center gap-2 text-[10px] text-slate-500">
                        <Info className="w-3 h-3" />
                        <span>Higher short interest indicates negative sentiment or potential squeeze risk.</span>
                    </div>
                </motion.div>

                {/* Insider Sentiment Summary */}
                <motion.div
                    variants={itemVariants}
                    className="bg-slate-900/40 backdrop-blur-md border border-slate-800/50 rounded-2xl p-6 relative overflow-hidden group"
                >
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Handshake className="w-24 h-24 text-emerald-400" />
                    </div>

                    <div className="flex items-center gap-2 mb-4">
                        <Handshake className="w-4 h-4 text-emerald-400" />
                        <h3 className="text-sm font-semibold text-slate-300">Insider Activity</h3>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="h-16 w-16 rounded-full border-4 border-slate-800 flex items-center justify-center relative">
                            <ShieldCheck className="w-6 h-6 text-emerald-400" />
                            <motion.div
                                initial={{ rotate: 0 }}
                                animate={{ rotate: 360 }}
                                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                                className="absolute inset-[-4px] rounded-full border-4 border-emerald-500/20 border-t-emerald-500"
                            />
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 leading-relaxed italic">
                                &quot;{insiderTransactions.length > 0
                                    ? `Latest activity involves ${insiderTransactions[0].insiderName} (${insiderTransactions[0].insiderTitle}).`
                                    : "No recent significant insider transactions reported."}&quot;
                            </p>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Insider Transactions Table */}
            {insiderTransactions.length > 0 && (
                <motion.div
                    variants={itemVariants}
                    className="bg-slate-900/40 backdrop-blur-md border border-slate-800/50 rounded-2xl overflow-hidden"
                >
                    <div className="px-6 py-4 border-b border-slate-800/50 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-300">Recent Insider Transactions</h3>
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-400 font-medium">
                            Latest 10 Transactions
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="text-slate-500 border-b border-slate-800/50 bg-slate-800/10">
                                <tr>
                                    <th className="px-6 py-3 font-medium uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-3 font-medium uppercase tracking-wider">Insider / Title</th>
                                    <th className="px-6 py-3 font-medium uppercase tracking-wider">Transaction</th>
                                    <th className="px-6 py-3 font-medium uppercase tracking-wider text-right">Shares</th>
                                    <th className="px-6 py-3 font-medium uppercase tracking-wider text-right">Value</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/30">
                                {insiderTransactions.map((t, idx) => {
                                    const isBuy = t.text.toLowerCase().includes('buy') || t.text.toLowerCase().includes('acquisition');
                                    const isSell = t.text.toLowerCase().includes('sell') || t.text.toLowerCase().includes('disposition');

                                    return (
                                        <tr key={idx} className="hover:bg-slate-800/20 transition-colors">
                                            <td className="px-6 py-4 text-slate-400">{new Date(t.date).toLocaleDateString()}</td>
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-slate-200">{t.insiderName}</div>
                                                <div className="text-[10px] text-slate-500">{t.insiderTitle}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className={`flex items-center gap-1.5 font-semibold ${isBuy ? 'text-emerald-400' : isSell ? 'text-red-400' : 'text-slate-400'}`}>
                                                    {isBuy ? <ArrowUpRight className="w-3 h-3" /> : isSell ? <ArrowDownRight className="w-3 h-3" /> : null}
                                                    {t.text}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right text-slate-300">{(t.shares || 0).toLocaleString()}</td>
                                            <td className="px-6 py-4 text-right font-medium text-slate-200">${formatValue(t.value)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </motion.div>
            )}
        </motion.div>
    );
};

export default SmartMoneyFlow;
