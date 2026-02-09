"use client";

import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";

interface AIInsightsProps {
    data: {
        bullCase: string;
        bearCase: string;
    } | null;
}

export default function AIInsights({ data }: AIInsightsProps) {
    if (!data) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
            {/* Bull Case */}
            <div className="bg-gray-900/50 backdrop-blur-xl border border-green-900/30 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <TrendingUp className="w-24 h-24 text-green-500" />
                </div>

                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-green-500/10 rounded-xl">
                        <TrendingUp className="w-5 h-5 text-green-400" />
                    </div>
                    <h3 className="text-lg font-bold text-green-100">Bull Case</h3>
                </div>

                <p className="text-gray-300 text-sm leading-relaxed">
                    {data.bullCase}
                </p>
            </div>

            {/* Bear Case */}
            <div className="bg-gray-900/50 backdrop-blur-xl border border-red-900/30 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <TrendingDown className="w-24 h-24 text-red-500" />
                </div>

                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-red-500/10 rounded-xl">
                        <TrendingDown className="w-5 h-5 text-red-400" />
                    </div>
                    <h3 className="text-lg font-bold text-red-100">Bear Case</h3>
                </div>

                <p className="text-gray-300 text-sm leading-relaxed">
                    {data.bearCase}
                </p>
            </div>

            <div className="col-span-1 md:col-span-2 text-center text-[10px] text-gray-600">
                AI-generated content based on latest market data. Not financial advice.
            </div>
        </motion.div>
    );
}
