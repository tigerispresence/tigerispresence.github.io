"use client";

import { useState } from "react";
import { motion } from "framer-motion";

const PRESETS = ["1y", "2y", "3y", "5y", "10y"] as const;

interface TimeRangeControlProps {
  timeRange: string;
  onChange: (range: string, from?: string) => void;
}

/** Sticky preset buttons plus a custom month slider. */
export default function TimeRangeControl({
  timeRange,
  onChange,
}: TimeRangeControlProps) {
  const [sliderValue, setSliderValue] = useState(12);

  const commitSlider = (months: number) => {
    const date = new Date();
    date.setMonth(date.getMonth() - months);
    onChange("custom", date.toISOString().split("T")[0]);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="sticky top-2 md:top-4 z-50 mt-4 w-full max-w-2xl mx-auto"
    >
      <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-3 md:p-4 shadow-2xl flex flex-col gap-3 md:gap-4">
        <div className="flex flex-wrap justify-between items-center gap-2">
          <div className="flex gap-1 bg-gray-800/50 p-1 rounded-xl border border-gray-700/50 overflow-x-auto scrollbar-hide">
            {PRESETS.map((range) => (
              <button
                key={range}
                onClick={() => onChange(range)}
                className={`px-2.5 py-1.5 md:px-3 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all whitespace-nowrap ${
                  timeRange === range
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/25"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {range.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="hidden sm:block text-xs text-gray-500 font-medium px-2">
            {timeRange === "custom" ? "Custom Range" : "Presets"}
          </div>
        </div>

        <div className="flex items-center gap-3 px-1">
          <span className="text-[10px] md:text-xs font-medium text-gray-400 w-8 md:w-12">
            Custom
          </span>
          <input
            type="range"
            min="1"
            max="120"
            step="1"
            value={sliderValue}
            onChange={(e) => setSliderValue(parseInt(e.target.value))}
            // Commit on release, not on every drag frame — otherwise each
            // pixel of travel would fire a request.
            onMouseUp={(e) =>
              commitSlider(parseInt((e.target as HTMLInputElement).value))
            }
            onTouchEnd={(e) =>
              commitSlider(parseInt((e.target as HTMLInputElement).value))
            }
            className="flex-1 h-1.5 md:h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400"
          />
          <span className="text-[10px] md:text-xs font-medium text-blue-400 w-12 md:w-16 text-right whitespace-nowrap">
            {sliderValue} mo
          </span>
        </div>
      </div>
    </motion.div>
  );
}
