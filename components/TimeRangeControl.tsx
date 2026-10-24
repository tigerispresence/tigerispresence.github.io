"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const PRESETS = ["1y", "2y", "3y", "5y", "10y"] as const;
const PRESET_MONTHS: Record<string, number> = { "1y": 12, "2y": 24, "3y": 36, "5y": 60, "10y": 120 };

/** Commit this long after the slider stops moving, whatever moved it. */
const COMMIT_DELAY_MS = 400;

/**
 * The local date `months` calendar months before `now`, as YYYY-MM-DD.
 *
 * The day is clamped to the target month's length (May 31 − 3 months is
 * Feb 28, not March 3), and the date is formatted locally: toISOString()
 * would shift it to UTC, a day earlier just after midnight in Korea.
 */
export function monthsAgo(months: number, now = new Date()): string {
  const y = now.getFullYear();
  const m = now.getMonth() - months;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const d = new Date(y, m, Math.min(now.getDate(), lastDay));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Calendar months from `from` (YYYY-MM-DD) to `now`, clamped to the slider's 1–120. */
export function monthsSince(from: string, now = new Date()): number {
  const [y, m] = from.split("-").map(Number);
  const months = (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m);
  return Math.min(120, Math.max(1, months));
}

interface TimeRangeControlProps {
  timeRange: string;
  /** Start date of a custom range, so the slider can show what is loaded. */
  from?: string;
  onChange: (range: string, from?: string) => void;
}

/** Sticky preset buttons plus a custom month slider. */
export default function TimeRangeControl({
  timeRange,
  from,
  onChange,
}: TimeRangeControlProps) {
  // The slider shows the range that is actually loaded. It used to keep its
  // own value, starting at 12 on every mount and ignoring the presets, so it
  // could read "12 mo" over five years of data.
  const loadedMonths =
    timeRange === "custom" && from ? monthsSince(from) : (PRESET_MONTHS[timeRange] ?? 12);
  // Only set while the user is moving the slider.
  const [draft, setDraft] = useState<number | null>(null);
  const sliderValue = draft ?? loadedMonths;

  // Commit once the slider has been still briefly. Mouse-up and touch-end
  // missed keyboard input, and a release outside the track on some devices.
  useEffect(() => {
    if (draft === null || draft === loadedMonths) return;
    const timer = setTimeout(() => onChange("custom", monthsAgo(draft)), COMMIT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [draft, loadedMonths, onChange]);

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
                onClick={() => {
                  setDraft(null);
                  onChange(range);
                }}
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
            aria-label="Custom range in months"
            onChange={(e) => setDraft(parseInt(e.target.value))}
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
