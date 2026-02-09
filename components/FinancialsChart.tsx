"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { DollarSign } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";

interface FinancialsProps {
    data: {
        financialsChart: {
            quarterly: {
                date: string;
                revenue: { raw: number; fmt: string; longFmt: string };
                earnings: { raw: number; fmt: string; longFmt: string };
            }[];
            yearly: {
                date: number;
                revenue: { raw: number; fmt: string; longFmt: string };
                earnings: { raw: number; fmt: string; longFmt: string };
            }[];
        };
        financialCurrency: string;
    };
    range?: string;
}

export default function FinancialsChart({ data, range = '1y' }: FinancialsProps) {
    const chartData = useMemo(() => {
        if (!data || !data.financialsChart || !data.financialsChart.quarterly) return [];

        let quartersToShow = 4;
        switch (range) {
            case '2y': quartersToShow = 8; break;
            case '3y': quartersToShow = 12; break;
            case '5y': quartersToShow = 20; break;
            case '10y': quartersToShow = 40; break;
            case '1y': default: quartersToShow = 4; break;
        }

        // Use slice to get the last N quarters (assuming data is sorted Oldest -> Newest)
        const filteredData = data.financialsChart.quarterly.slice(-quartersToShow);

        return filteredData.map(q => ({
            date: q.date, // Usually "3Q2023" type string or similar? Yahoo sends "4Q23" often
            revenue: q.revenue.raw,
            earnings: q.earnings.raw,
            margin: (q.earnings.raw / q.revenue.raw) * 100
        }));
    }, [data, range]);

    if (!chartData || chartData.length === 0) return null;

    const formatCurrency = (val: number) => {
        if (Math.abs(val) >= 1e12) return `${(val / 1e12).toFixed(2)}T`;
        if (Math.abs(val) >= 1e9) return `${(val / 1e9).toFixed(2)}B`;
        if (Math.abs(val) >= 1e6) return `${(val / 1e6).toFixed(2)}M`;
        return val.toLocaleString();
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-3xl p-6 shadow-xl"
        >
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-emerald-500/10 rounded-xl">
                    <DollarSign className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                    <h3 className="text-xl font-semibold text-white">Quarterly Financials</h3>
                    <p className="text-sm text-gray-400">Revenue & Earnings Trend (Currency: {data.financialCurrency})</p>
                </div>
            </div>

            <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                        <XAxis
                            dataKey="date"
                            stroke="#6b7280"
                            tick={{ fontSize: 12 }}
                        />
                        <YAxis
                            yAxisId="left"
                            stroke="#3b82f6"
                            tickFormatter={formatCurrency}
                            tick={{ fontSize: 12 }}
                            label={{ value: "Revenue", angle: -90, position: "insideLeft", fill: "#3b82f6" }}
                        />
                        <YAxis
                            yAxisId="right"
                            orientation="right"
                            stroke="#10b981"
                            tickFormatter={(val) => val.toFixed(2)}
                            tick={{ fontSize: 12 }}
                            label={{ value: "Earnings (EPS)", angle: 90, position: "insideRight", fill: "#10b981" }}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '12px' }}
                            itemStyle={{ color: '#e5e7eb' }}
                            cursor={{ fill: '#1f2937', opacity: 0.4 }}
                            formatter={(value: number, name: string) => {
                                if (name === 'margin') return `${value.toFixed(2)}%`;
                                if (name === 'Revenue') return formatCurrency(value);
                                if (name === 'Earnings') return value.toFixed(2);
                                return value;
                            }}
                        />
                        <Legend />
                        <Bar yAxisId="left" dataKey="revenue" name="Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={50} />
                        <Bar yAxisId="right" dataKey="earnings" name="Earnings" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={50} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </motion.div>
    );
}
