"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { BarChart2 } from "lucide-react";

export interface RecommendationTrend {
    strongBuy: number;
    buy: number;
    hold: number;
    sell: number;
    strongSell: number;
}

interface AnalystRatingsProps {
    trend: RecommendationTrend | null | undefined;
}

const AnalystRatings = memo(({ trend }: AnalystRatingsProps) => {
    if (!trend) return null;

    const safeTrend = {
        strongBuy: trend.strongBuy || 0,
        buy: trend.buy || 0,
        hold: trend.hold || 0,
        sell: trend.sell || 0,
        strongSell: trend.strongSell || 0
    };

    const total = safeTrend.strongBuy + safeTrend.buy + safeTrend.hold + safeTrend.sell + safeTrend.strongSell;

    if (total === 0) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-3xl p-6 shadow-xl mt-6"
        >
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-emerald-500/10 rounded-xl">
                    <BarChart2 className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                    <h3 className="text-xl font-semibold text-white">Analyst Ratings</h3>
                    <p className="text-gray-400 text-sm">Based on {total} analyst recommendations</p>
                </div>
            </div>

            <div className="flex flex-col gap-4">
                {/* Horizontal Stacked Bar */}
                <div className="w-full h-8 flex rounded-full overflow-hidden shadow-inner bg-gray-800">
                    <div className="bg-emerald-500 h-full transition-all duration-1000 ease-out" style={{ width: `${(safeTrend.strongBuy / total) * 100}%` }} title={`Strong Buy: ${safeTrend.strongBuy}`} />
                    <div className="bg-emerald-400 h-full transition-all duration-1000 ease-out" style={{ width: `${(safeTrend.buy / total) * 100}%` }} title={`Buy: ${safeTrend.buy}`} />
                    <div className="bg-yellow-500 h-full transition-all duration-1000 ease-out" style={{ width: `${(safeTrend.hold / total) * 100}%` }} title={`Hold: ${safeTrend.hold}`} />
                    <div className="bg-orange-500 h-full transition-all duration-1000 ease-out" style={{ width: `${(safeTrend.sell / total) * 100}%` }} title={`Sell: ${safeTrend.sell}`} />
                    <div className="bg-red-500 h-full transition-all duration-1000 ease-out" style={{ width: `${(safeTrend.strongSell / total) * 100}%` }} title={`Strong Sell: ${safeTrend.strongSell}`} />
                </div>

                {/* Legend */}
                <div className="grid grid-cols-5 gap-2 text-center text-sm">
                    <div className="flex flex-col items-center">
                        <span className="text-emerald-500 font-bold">{safeTrend.strongBuy}</span>
                        <span className="text-emerald-500/80 text-xs">Strong Buy</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <span className="text-emerald-400 font-bold">{safeTrend.buy}</span>
                        <span className="text-emerald-400/80 text-xs">Buy</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <span className="text-yellow-500 font-bold">{safeTrend.hold}</span>
                        <span className="text-yellow-500/80 text-xs">Hold</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <span className="text-orange-500 font-bold">{safeTrend.sell}</span>
                        <span className="text-orange-500/80 text-xs">Sell</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <span className="text-red-500 font-bold">{safeTrend.strongSell}</span>
                        <span className="text-red-500/80 text-xs">Strong Sell</span>
                    </div>
                </div>
            </div>
        </motion.div>
    );
});

AnalystRatings.displayName = "AnalystRatings";

export default AnalystRatings;
