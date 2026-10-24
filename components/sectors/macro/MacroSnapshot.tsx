"use client";

import type { MacroReading, SectorMacroData } from "@/lib/types/macro";
import { REGIME_LABELS, formatMonth } from "./labels";

interface TileProps {
  label: string;
  reading: MacroReading | null;
  /** Monthly CPI readings are fractions; yields are already in percent. */
  kind: "fraction" | "percent";
  hint: string;
}

function Tile({ label, reading, kind, hint }: TileProps) {
  const scale = kind === "fraction" ? 100 : 1;
  const value = reading ? reading.value * scale : null;
  const change = reading?.previous != null ? (reading.value - reading.previous) * scale : null;
  const asOf = reading
    ? kind === "fraction"
      ? formatMonth(reading.date)
      : new Date(reading.date).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" })
    : null;

  return (
    <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-2xl p-4" title={hint}>
      <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-2">{label}</div>
      <div className="flex items-end gap-2">
        <div className="text-white font-bold text-2xl">{value === null ? "—" : `${value.toFixed(2)}%`}</div>
        {change !== null && (
          // Direction only, not good/bad: rising inflation and rising yields
          // help some sectors and hurt others, so no green/red here.
          <span className="text-sm mb-1 text-gray-300">
            {change > 0 ? "▲" : change < 0 ? "▼" : "■"} {Math.abs(change).toFixed(2)}pp
          </span>
        )}
      </div>
      {asOf && <div className="text-gray-500 text-[10px] mt-1">{asOf} · change vs 3 months earlier</div>}
    </div>
  );
}

/** The latest inflation and rate readings, and the regime they put us in. */
export default function MacroSnapshot({ data }: { data: SectorMacroData }) {
  const { snapshot, regime } = data;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4">
        <Tile label="CPI YoY" reading={snapshot.cpi} kind="fraction" hint="Consumer Price Index, all items, year over year (FRED CPIAUCSL)" />
        <Tile label="Core CPI YoY" reading={snapshot.coreCpi} kind="fraction" hint="CPI excluding food and energy, year over year (FRED CPILFESL)" />
        <Tile label="10-Yr Yield" reading={snapshot.ten} kind="percent" hint="10-year Treasury constant maturity (FRED DGS10)" />
        <Tile label="2-Yr Yield" reading={snapshot.two} kind="percent" hint="2-year Treasury constant maturity (FRED DGS2)" />
        <Tile label="10Y − 2Y Spread" reading={snapshot.spread} kind="percent" hint="Yield curve slope; negative means inverted" />
        <Tile label="10-Yr Real Yield" reading={snapshot.real} kind="percent" hint="10-year TIPS yield: the rate after expected inflation (FRED DFII10)" />
      </div>
      {regime && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl px-4 py-3 text-sm text-gray-200">
          <span className="text-gray-400 uppercase tracking-wider text-xs font-medium mr-2">Current regime</span>
          <span className="font-semibold text-white">{REGIME_LABELS[regime.key]}</span>
          <span className="text-gray-400">
            {" "}— CPI inflation is {regime.inflation} and the 10-year yield is {regime.rates} over the last three months.
          </span>
        </div>
      )}
    </div>
  );
}
