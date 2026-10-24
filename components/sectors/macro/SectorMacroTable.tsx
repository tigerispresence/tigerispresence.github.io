"use client";

import Link from "next/link";
import { MACRO_REGIMES, type MacroRegime, type RegimeStats, type SectorMacroData } from "@/lib/types/macro";
import type { RotationQuadrant, SectorData } from "@/lib/types/sectors";
import { QUADRANT_LABELS, formatPct } from "../format";
import { NEUTRAL_EXCESS, REGIME_LABELS, T_SIGNIFICANT, formatMonth } from "./labels";

interface Props {
  macro: SectorMacroData;
  /** The momentum view, for the rotation column. Optional: the table stands without it. */
  sectors: SectorData | null;
  highlighted: string | null;
  onHighlight: (symbol: string | null) => void;
}

type Alignment = "tailwind" | "headwind" | "mixed";

/**
 * Do history and momentum agree? A sector that has historically beaten SPY in
 * this regime and is already gaining on it has both behind it.
 */
function alignment(stats: RegimeStats | null, quadrant: RotationQuadrant | null): Alignment | null {
  if (!stats || !quadrant) return null;
  const improving = quadrant === "leading" || quadrant === "improving";
  if (stats.avgExcess > NEUTRAL_EXCESS && improving) return "tailwind";
  if (stats.avgExcess < -NEUTRAL_EXCESS && !improving) return "headwind";
  return "mixed";
}

const ALIGNMENT_LABELS: Record<Alignment, { text: string; className: string; hint: string }> = {
  tailwind: { text: "▲ Both positive", className: "text-green-400", hint: "Beats SPY historically in this regime, and gaining on SPY now" },
  headwind: { text: "▼ Both negative", className: "text-red-400", hint: "Trails SPY historically in this regime, and losing ground now" },
  mixed: { text: "◆ Mixed", className: "text-gray-400", hint: "History and current momentum disagree, or the historical edge is under ±0.1%/month" },
};

/** Diverging tint for a monthly excess return, saturating at ±1%/month. */
function tint(value: number | null, scale = 0.01): string | undefined {
  if (value === null || value === 0) return undefined;
  const alpha = Math.min(Math.abs(value) / scale, 1) * 0.35;
  return value > 0 ? `rgba(34,197,94,${alpha})` : `rgba(239,68,68,${alpha})`;
}

const textFor = (value: number | null) =>
  value === null || value === 0 ? "text-gray-400" : value > 0 ? "text-green-400" : "text-red-400";

function RegimeCell({ stats, current }: { stats: RegimeStats | null; current: boolean }) {
  if (!stats) return <td className="text-right px-3 text-gray-600">—</td>;
  const significant = stats.tStat !== null && Math.abs(stats.tStat) >= T_SIGNIFICANT;
  return (
    <td
      className={`text-right px-3 ${textFor(stats.avgExcess)} ${current ? "ring-1 ring-inset ring-blue-500/60" : ""} ${significant ? "font-bold" : ""}`}
      style={{ backgroundColor: tint(stats.avgExcess) }}
      title={`${formatPct(stats.avgExcess)} per month vs SPY over ${stats.months} months · beat SPY in ${Math.round(stats.hitRate * 100)}% of them · t = ${stats.tStat?.toFixed(1) ?? "—"}${significant ? " (unlikely to be chance)" : " (could be chance)"}`}
    >
      {formatPct(stats.avgExcess)}
      {significant && <span aria-label="statistically significant"> ●</span>}
    </td>
  );
}

export default function SectorMacroTable({ macro, sectors, highlighted, onHighlight }: Props) {
  const current: MacroRegime | null = macro.regime?.key ?? null;
  const quadrants = new Map(sectors?.sectors.map((s) => [s.symbol, s.quadrant]) ?? []);
  const rows = [...macro.sectors].sort((a, b) =>
    current ? (b.regimes[current]?.avgExcess ?? -Infinity) - (a.regimes[current]?.avgExcess ?? -Infinity) : 0,
  );

  return (
    <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-3xl p-4 md:p-6">
      <h2 className="text-white font-semibold text-lg">Sectors Across Macro Regimes</h2>
      <p className="text-sm text-gray-400 mb-4">
        Average monthly total return vs SPY in each regime since {macro.since ? formatMonth(macro.since) : "2000"},
        using only data published before each month began. <span className="font-bold text-gray-300">Bold ●</span> marks
        averages unlikely to be chance (|t| ≥ {T_SIGNIFICANT}); the rest are within normal noise. Hover a cell for details.
      </p>
      <div className="overflow-x-auto -mx-4 md:mx-0">
        <table className="w-full text-sm tabular-nums min-w-[920px]">
          <thead>
            <tr className="text-gray-400 text-xs uppercase tracking-wider align-bottom">
              <th className="text-left font-medium py-2 pl-4 md:pl-2">Sector</th>
              <th className="text-right font-medium py-2 px-3" title="Monthly return vs SPY per +1 percentage point move in the 10-year yield, last 10 years">
                Per +1pp<br />10Y yield
              </th>
              {MACRO_REGIMES.map((r) => (
                <th
                  key={r}
                  className={`text-right font-medium py-2 px-3 ${r === current ? "text-blue-300" : ""}`}
                >
                  {r === current && <div className="text-[10px] text-blue-400 font-bold">● NOW</div>}
                  {REGIME_LABELS[r]}
                  <div className="text-[10px] normal-case text-gray-500">{macro.regimeMonths[r]} months</div>
                </th>
              ))}
              <th className="text-left font-medium py-2 px-3">Rotation now</th>
              <th className="text-left font-medium py-2 px-3 pr-4 md:pr-2">History + momentum</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const quadrant = quadrants.get(s.symbol) ?? null;
              const align = current ? alignment(s.regimes[current], quadrant) : null;
              return (
                <tr
                  key={s.symbol}
                  onMouseEnter={() => onHighlight(s.symbol)}
                  onMouseLeave={() => onHighlight(null)}
                  className={`border-t border-gray-800 transition-colors ${highlighted === s.symbol ? "bg-white/5" : ""}`}
                >
                  <td className="py-2 pl-4 md:pl-2">
                    <Link href={`/?q=${s.symbol}`} className="group">
                      <span className="text-white font-semibold group-hover:text-blue-400 transition-colors">{s.symbol}</span>
                      <span className="text-gray-400 ml-2 hidden sm:inline">{s.name}</span>
                    </Link>
                  </td>
                  <td
                    className={`text-right px-3 ${textFor(s.rateBeta)}`}
                    style={{ backgroundColor: tint(s.rateBeta, 0.08) }}
                    title={s.rateBeta === null ? undefined : `Correlation ${s.rateR?.toFixed(2)} over ${s.rateMonths} months`}
                  >
                    {formatPct(s.rateBeta, 1)}
                  </td>
                  {MACRO_REGIMES.map((r) => (
                    <RegimeCell key={r} stats={s.regimes[r]} current={r === current} />
                  ))}
                  <td className="px-3 text-gray-300">{quadrant ? QUADRANT_LABELS[quadrant] : "—"}</td>
                  <td className={`px-3 pr-4 md:pr-2 ${align ? ALIGNMENT_LABELS[align].className : "text-gray-600"}`} title={align ? ALIGNMENT_LABELS[align].hint : undefined}>
                    {align ? ALIGNMENT_LABELS[align].text : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
