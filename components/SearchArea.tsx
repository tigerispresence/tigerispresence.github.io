"use client";

import { useState, useEffect, useRef } from "react";
import { Search, History, TrendingUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface SearchAreaProps {
    onSearch: (query: string) => void;
    isLoading: boolean;
}

interface Suggestion {
    symbol: string;
    name: string;
    exchange: string;
}

export default function SearchArea({ onSearch, isLoading }: SearchAreaProps) {
    const [query, setQuery] = useState("");
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [history, setHistory] = useState<string[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const saved = localStorage.getItem("stockSearchHistory");
        if (saved) {
            // eslint-disable-next-line
            setHistory(JSON.parse(saved));
        }

        // Close dropdown when clicking outside
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const fetchSuggestions = async (q: string) => {
        try {
            const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
            const data = await res.json();
            if (data.results) setSuggestions(data.results);
        } catch (e) {
            console.error("Suggestion fetch error:", e);
        }
    };

    // Debounced Search Fetch
    useEffect(() => {
        const timer = setTimeout(() => {
            if (query.trim().length > 1) {
                fetchSuggestions(query);
            } else {
                setSuggestions([]);
            }
        }, 400); // 400ms debounce to reduce API calls
        return () => clearTimeout(timer);
    }, [query]);

    const addToHistory = (q: string) => {
        const newHistory = [q, ...history.filter((h) => h !== q)].slice(0, 10);
        setHistory(newHistory);
        localStorage.setItem("stockSearchHistory", JSON.stringify(newHistory));
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;
        addToHistory(query);
        onSearch(query);
        setShowDropdown(false);
    };

    const handleSelect = (item: Suggestion) => {
        // Use symbol for search, but maybe show name?
        // Usually searching by Symbol is safest.
        const value = item.symbol;
        setQuery(value); // Update input to selected symbol
        addToHistory(value);
        onSearch(value);
        setShowDropdown(false);
    };

    const handleHistoryClick = (item: string) => {
        setQuery(item);
        onSearch(item);
        setShowDropdown(false);
    };

    const clearHistory = (e: React.MouseEvent) => {
        e.stopPropagation();
        setHistory([]);
        localStorage.removeItem("stockSearchHistory");
    };

    const hasSuggestions = suggestions.length > 0 && query.trim().length > 1;
    const showHistoryList = !hasSuggestions && history.length > 0;

    return (
        <div ref={wrapperRef} className="w-full max-w-2xl mx-auto relative z-50">
            <form onSubmit={handleSearch} className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                </div>
                <input
                    type="text"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    placeholder="Search stocks (e.g., Apple, 삼성전자, 005930)..."
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
                {showDropdown && (hasSuggestions || showHistoryList) && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute w-full mt-2 bg-gray-900/95 border border-gray-800 rounded-xl shadow-2xl backdrop-blur-xl overflow-hidden"
                    >
                        {/* Suggestions Section */}
                        {hasSuggestions && (
                            <div className="py-2">
                                <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Suggestions
                                </div>
                                {suggestions.map((item, index) => (
                                    <button
                                        key={`${item.symbol}-${index}`}
                                        onClick={() => handleSelect(item)}
                                        className="w-full text-left px-4 py-3 hover:bg-blue-600/20 transition-colors flex items-center justify-between group border-b border-gray-800/50 last:border-0"
                                    >
                                        <div className="flex flex-col">
                                            <span className="font-bold text-white flex items-center gap-2">
                                                {item.symbol}
                                                <span className="text-xs font-normal text-gray-400 bg-gray-800 px-1.5 py-0.5 rounded">
                                                    {item.exchange}
                                                </span>
                                            </span>
                                            <span className="text-sm text-gray-400 group-hover:text-gray-300">
                                                {item.name}
                                            </span>
                                        </div>
                                        <TrendingUp className="h-4 w-4 text-gray-600 group-hover:text-blue-400" />
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* History Section */}
                        {showHistoryList && (
                            <div>
                                <div className="flex items-center justify-between px-4 py-2 bg-gray-800/30 border-b border-gray-800">
                                    <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        <History className="h-3 w-3" />
                                        <span>Recent Searches</span>
                                    </div>
                                    <button
                                        onClick={clearHistory}
                                        className="text-xs text-red-400 hover:text-red-300 transition-colors"
                                    >
                                        Clear
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
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
