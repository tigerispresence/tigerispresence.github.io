"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Newspaper, MessageCircle, ExternalLink, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface InsightData {
    news: {
        title: string;
        summary: string;
        source: string;
        date: string;
        url: string | null;
    }[];
    social: {
        sentiment: string;
        summary: string;
        trendingTopics: string[];
    };
}

export default function NewsSection({ symbol }: { symbol: string }) {
    const [data, setData] = useState<InsightData | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'news' | 'social'>('news');

    useEffect(() => {
        let mounted = true;
        const fetchInsights = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/insights?symbol=${encodeURIComponent(symbol)}`);
                const json = await res.json();
                if (mounted && !json.error) {
                    setData(json);
                }
            } catch (error) {
                console.error("Failed to fetch insights:", error);
            } finally {
                if (mounted) setLoading(false);
            }
        };

        fetchInsights();

        return () => { mounted = false; };
    }, [symbol]);

    const getSentimentIcon = (sentiment: string) => {
        const s = sentiment.toLowerCase();
        if (s.includes('positive') || s.includes('bullish') || s.includes('긍정')) return <TrendingUp className="w-5 h-5 text-green-400" />;
        if (s.includes('negative') || s.includes('bearish') || s.includes('부정')) return <TrendingDown className="w-5 h-5 text-red-400" />;
        return <Minus className="w-5 h-5 text-gray-400" />;
    };

    const getSentimentColor = (sentiment: string) => {
        const s = sentiment.toLowerCase();
        if (s.includes('positive') || s.includes('bullish') || s.includes('긍정')) return "text-green-400 border-green-400/30 bg-green-400/10";
        if (s.includes('negative') || s.includes('bearish') || s.includes('부정')) return "text-red-400 border-red-400/30 bg-red-400/10";
        return "text-gray-400 border-gray-400/30 bg-gray-400/10";
    };

    if (loading) {
        return (
            <div className="w-full max-w-6xl mx-auto mt-8 p-8 bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-3xl animate-pulse">
                <div className="h-6 w-48 bg-gray-800 rounded mb-4"></div>
                <div className="space-y-4">
                    <div className="h-24 w-full bg-gray-800 rounded-2xl"></div>
                    <div className="h-24 w-full bg-gray-800 rounded-2xl"></div>
                </div>
            </div>
        );
    }

    if (!data) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-6xl mx-auto mt-8 bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-3xl overflow-hidden shadow-xl"
        >
            {/* Header Tabs */}
            <div className="flex border-b border-gray-800">
                <button
                    onClick={() => setActiveTab('news')}
                    className={`flex-1 p-4 flex items-center justify-center gap-2 text-sm font-medium transition-colors ${activeTab === 'news'
                            ? 'bg-gray-800/50 text-white border-b-2 border-blue-500'
                            : 'text-gray-400 hover:text-white hover:bg-gray-800/30'
                        }`}
                >
                    <Newspaper className="w-4 h-4" />
                    Latest Headlines (Top 5)
                </button>
                <button
                    onClick={() => setActiveTab('social')}
                    className={`flex-1 p-4 flex items-center justify-center gap-2 text-sm font-medium transition-colors ${activeTab === 'social'
                            ? 'bg-gray-800/50 text-white border-b-2 border-purple-500'
                            : 'text-gray-400 hover:text-white hover:bg-gray-800/30'
                        }`}
                >
                    <MessageCircle className="w-4 h-4" />
                    Social Sentiment (SNS)
                </button>
            </div>

            {/* Content Area */}
            <div className="p-6 min-h-[300px]">
                {activeTab === 'news' ? (
                    <div className="space-y-4">
                        {data.news.map((item, idx) => (
                            <motion.a
                                key={idx}
                                href={item.url || "#"}
                                target={item.url ? "_blank" : undefined}
                                rel="noopener noreferrer"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.1 }}
                                className={`block p-4 rounded-xl border border-gray-800 bg-gray-800/20 hover:bg-gray-800/40 transition-all group ${!item.url ? 'cursor-default' : ''}`}
                            >
                                <div className="flex justify-between items-start gap-4">
                                    <div className="flex-1">
                                        <h4 className="text-white font-semibold text-lg mb-1 group-hover:text-blue-400 transition-colors">
                                            {item.title}
                                        </h4>
                                        <p className="text-gray-400 text-sm mb-2 leading-relaxed">
                                            {item.summary}
                                        </p>
                                        <div className="flex items-center gap-3 text-xs text-gray-500">
                                            <span className="bg-gray-800 px-2 py-1 rounded border border-gray-700">{item.source}</span>
                                            <span>{item.date}</span>
                                        </div>
                                    </div>
                                    {item.url && <ExternalLink className="w-5 h-5 text-gray-600 group-hover:text-white transition-colors" />}
                                </div>
                            </motion.a>
                        ))}
                        {data.news.length === 0 && (
                            <div className="text-center text-gray-500 py-10">No recent impactful news found.</div>
                        )}
                    </div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-6"
                    >
                        {/* Sentiment Badge */}
                        <div className="flex items-center gap-4">
                            <div className={`px-4 py-2 rounded-full border flex items-center gap-2 ${getSentimentColor(data.social.sentiment)}`}>
                                {getSentimentIcon(data.social.sentiment)}
                                <span className="font-bold">{data.social.sentiment}</span>
                            </div>
                            <span className="text-gray-500 text-sm">Based on trending discussions from X, StockTwits, Reddit</span>
                        </div>

                        {/* Summary */}
                        <div className="bg-gray-800/30 p-5 rounded-2xl border border-gray-700/50">
                            <h4 className="text-gray-300 font-medium mb-2 flex items-center gap-2">
                                <MessageCircle className="w-4 h-4 text-purple-400" />
                                Community Pulse
                            </h4>
                            <p className="text-gray-300 leading-relaxed">
                                {data.social.summary}
                            </p>
                        </div>

                        {/* Trending Topics */}
                        <div>
                            <h4 className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-3">Trending Topics</h4>
                            <div className="flex flex-wrap gap-2">
                                {data.social.trendingTopics.map((topic, i) => (
                                    <span key={i} className="px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full text-sm">
                                        #{topic}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}
            </div>
        </motion.div>
    );
}
