"use client";

import type { SectorMacroData } from "@/lib/types/macro";
import type { SectorData } from "@/lib/types/sectors";
import { formatPct } from "../format";
import { NEUTRAL_EXCESS, REGIME_LABELS, T_SIGNIFICANT } from "./labels";

interface Props {
  macro: SectorMacroData;
  sectors: SectorData | null;
}

/** The one-paragraph read: what this regime has favored, and where momentum agrees. */
export default function MacroTakeaway({ macro, sectors }: Props) {
  const regime = macro.regime;
  if (!regime) return null;

  const ranked = macro.sectors
    .flatMap((s) => {
      const stats = s.regimes[regime.key];
      return stats ? [{ symbol: s.symbol, ...stats }] : [];
    })
    .sort((a, b) => b.avgExcess - a.avgExcess);
  const best = ranked.slice(0, 3);
  const worst = ranked.slice(-3).reverse();
  const describe = (s: (typeof ranked)[number]) => {
    const strong = s.tStat !== null && Math.abs(s.tStat) >= T_SIGNIFICANT;
    return `${s.symbol} ${formatPct(s.avgExcess)}/mo${strong ? " ●" : ""}`;
  };

  const quadrants = new Map(sectors?.sectors.map((s) => [s.symbol, s.quadrant]) ?? []);
  const isUp = (symbol: string) => ["leading", "improving"].includes(quadrants.get(symbol) ?? "");
  const tailwinds = ranked.filter((s) => s.avgExcess > NEUTRAL_EXCESS && isUp(s.symbol)).map((s) => s.symbol);
  const headwinds = ranked
    .filter((s) => s.avgExcess < -NEUTRAL_EXCESS && quadrants.has(s.symbol) && !isUp(s.symbol))
    .map((s) => s.symbol);
  const strongCount = ranked.filter((s) => s.tStat !== null && Math.abs(s.tStat) >= T_SIGNIFICANT).length;

  return (
    <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-3xl p-4 md:p-6 space-y-3 text-sm">
      <h2 className="text-white font-semibold text-lg">What this regime has meant for sectors</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">Historically strongest in {REGIME_LABELS[regime.key]}</div>
          <div className="text-green-400 font-semibold">{best.map(describe).join(", ")}</div>
        </div>
        <div>
          <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">Historically weakest</div>
          <div className="text-red-400 font-semibold">{worst.map(describe).join(", ")}</div>
        </div>
        {sectors && (
          <>
            <div>
              <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">History and momentum both positive</div>
              <div className="text-white font-semibold">{tailwinds.length ? tailwinds.join(", ") : <span className="text-gray-500">None</span>}</div>
            </div>
            <div>
              <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">History and momentum both negative</div>
              <div className="text-white font-semibold">{headwinds.length ? headwinds.join(", ") : <span className="text-gray-500">None</span>}</div>
            </div>
          </>
        )}
      </div>
      <p className="text-xs text-gray-500">
        {strongCount === 0
          ? "None of these averages clears the significance bar in this regime, so treat them as tendencies, not signals. "
          : `● ${strongCount} of ${ranked.length} sectors show an edge unlikely to be chance (|t| ≥ ${T_SIGNIFICANT}). `}
        Past regime averages describe history; they are not forecasts or investment advice.
      </p>
    </div>
  );
}
