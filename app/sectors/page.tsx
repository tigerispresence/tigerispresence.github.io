"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import NavTabs from "@/components/NavTabs";
import SectorSummary from "@/components/sectors/SectorSummary";
import SectorReturnsChart from "@/components/sectors/SectorReturnsChart";
import SectorRotationChart from "@/components/sectors/SectorRotationChart";
import SectorTable from "@/components/sectors/SectorTable";
import { useSectorData } from "@/hooks/useSectorData";
import { SECTOR_PERIODS, type SectorPeriod } from "@/lib/types/sectors";

export default function SectorsPage() {
  const { data, error, loading } = useSectorData();
  const [period, setPeriod] = useState<SectorPeriod>("1M");
  // Hovering a sector in any view highlights it in the others.
  const [highlighted, setHighlighted] = useState<string | null>(null);

  return (
    <main className="min-h-screen bg-black text-white selection:bg-blue-500/30">
      <div className="fixed inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />

      <div className="relative z-10 container mx-auto px-4 py-6 md:py-12 flex flex-col items-center min-h-screen">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8 space-y-4"
        >
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-400">
            Sector Analysis
          </h1>
          <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto">
            The 11 S&amp;P 500 sectors against SPY
          </p>
        </motion.div>

        <NavTabs />

        {loading && <div className="w-full animate-pulse h-96 bg-gray-900/50 rounded-3xl" />}

        {error && !data && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 w-full max-w-2xl text-center">
            {error}
          </div>
        )}

        {data && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div role="group" aria-label="Period" className="flex gap-1 bg-gray-800/50 p-1 rounded-xl border border-gray-700/50 overflow-x-auto">
                {SECTOR_PERIODS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    aria-pressed={period === p}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                      period === p
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-500/25"
                        : "text-gray-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              {data.asOf && (
                <span className="text-xs text-gray-500">As of {new Date(data.asOf).toLocaleDateString()}</span>
              )}
            </div>
            <SectorSummary data={data} period={period} />
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <SectorReturnsChart data={data} period={period} highlighted={highlighted} onHighlight={setHighlighted} />
              <SectorRotationChart data={data} highlighted={highlighted} onHighlight={setHighlighted} />
            </div>
            <SectorTable
              data={data}
              period={period}
              onPeriodChange={setPeriod}
              highlighted={highlighted}
              onHighlight={setHighlighted}
            />
            {data.asOf && (
              <p className="text-xs text-gray-500 text-center">
                Price returns from Yahoo Finance daily closes, as of {new Date(data.asOf).toLocaleDateString()}.
                Dividends are not included.
              </p>
            )}
          </motion.div>
        )}
      </div>
    </main>
  );
}
