"use client";

import { useState, useEffect } from "react";
import { Search, History, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface SearchAreaProps {
    onSearch: (query: string) => void;
    isLoading: boolean;
}

export default function SearchArea({ onSearch, isLoading }: SearchAreaProps) {
    const [query, setQuery] = useState("");
    const [history, setHistory] = useState<string[]>([]);
    const [showHistory, setShowHistory] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem("stockSearchHistory");
        if (saved) {
            setHistory(JSON.parse(saved));
        }
    }, []);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;

        const newHistory = [query, ...history.filter((h) => h !== query)].slice(0, 10);
        setHistory(newHistory);
        localStorage.setItem("stockSearchHistory", JSON.stringify(newHistory));

        onSearch(query);
        setShowHistory(false);
    };

    const handleHistoryClick = (item: string) => {
        setQuery(item);
        onSearch(item);
        setShowHistory(false);
    };

    const clearHistory = () => {
        setHistory([]);
        localStorage.removeItem("stockSearchHistory");
    };

    return (
        <div className="w-full max-w-2xl mx-auto relative z-50">
            <form onSubmit={handleSearch} className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                </div>
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setShowHistory(true)}
                    placeholder="Search stocks (e.g., Apple, TSLA, Samsung)..."
                    className="w-full pl-12 pr-4 py-4 bg-gray-900/50 border border-gray-700 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all backdrop-blur-xl shadow-lg"
                    disabled={isLoading}
                />
                {isLoading && (
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                    </div>
                )}
            </form>

            <AnimatePresence>
                {showHistory && history.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute w-full mt-2 bg-gray-900/90 border border-gray-800 rounded-xl shadow-xl backdrop-blur-xl overflow-hidden"
                    >
                        <div className="flex items-center justify-between p-3 border-b border-gray-800">
                            <div className="flex items-center gap-2 text-sm text-gray-400">
                                <History className="h-4 w-4" />
                                <span>Recent Searches</span>
                            </div>
                            <button
                                onClick={clearHistory}
                                className="text-xs text-red-400 hover:text-red-300 transition-colors"
                            >
                                Clear History
                            </button>
                        </div>
                        <div className="max-h-60 overflow-y-auto">
                            {history.map((item, index) => (
                                <button
                                    key={index}
                                    onClick={() => handleHistoryClick(item)}
                                    className="w-full text-left px-4 py-3 text-gray-300 hover:bg-gray-800/50 hover:text-white transition-colors flex items-center justify-between group"
                                >
                                    <span>{item}</span>
                                    <Search className="h-4 w-4 opacity-0 group-hover:opacity-50 transition-opacity" />
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Overlay to close history when clicking outside */}
            {showHistory && (
                <div
                    className="fixed inset-0 z-[-1]"
                    onClick={() => setShowHistory(false)}
                />
            )}
        </div>
    );
}
