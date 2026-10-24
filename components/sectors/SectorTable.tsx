"use client";

import Link from "next/link";
import { SECTOR_PERIODS, type SectorData, type SectorPeriod } from "@/lib/types/sectors";
import { QUADRANT_HINTS, QUADRANT_LABELS, changeText, formatPct } from "./format";

interface Props {
  data: SectorData;
  period: SectorPeriod;
  onPeriodChange: (period: SectorPeriod) => void;
  highlighted: string | null;
  onHighlight: (symbol: string | null) => void;
}

/** Diverging tint: green above zero, red below, saturating at ±10%. */
function cellTint(value: number | null): string | undefined {
  if (value === null || value === 0) return undefined;
  const alpha = Math.min(Math.abs(value) / 0.1, 1) * 0.35;
  return value > 0 ? `rgba(34,197,94,${alpha})` : `rgba(239,68,68,${alpha})`;
}

function TrendBadge({ label, above }: { label: string; above: boolean | null }) {
  if (above === null) return <span className="text-gray-600">—</span>;
  return (
    <span
      title={`${above ? "Above" : "Below"} its ${label}-day moving average`}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold border ${
        above ? "text-green-400 border-green-500/30" : "text-red-400 border-red-500/30"
      }`}
    >
      {above ? "▲" : "▼"} {label}
    </span>
  );
}

/** Every sector across every period; the header doubles as the period picker. */
export default function SectorTable({ data, period, onPeriodChange, highlighted, onHighlight }: Props) {
  const rows = [...data.sectors].sort(
    (a, b) => (b.returns[period] ?? -Infinity) - (a.returns[period] ?? -Infinity),
  );

  return (
    <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-3xl p-4 md:p-6">
      <h2 className="text-white font-semibold text-lg">Sector Performance</h2>
      <p className="text-sm text-gray-400 mb-4">
        Sorted by the selected period — click a column header to switch. Click a sector to analyze its ETF.
      </p>
      <div className="overflow-x-auto -mx-4 md:mx-0">
        <table className="w-full text-sm tabular-nums min-w-[880px]">
          <thead>
            <tr className="text-gray-400 text-xs uppercase tracking-wider">
              <th className="text-left font-medium py-2 pl-4 md:pl-2">Sector</th>
              <th className="text-right font-medium py-2 px-2">Price</th>
              {SECTOR_PERIODS.map((p) => (
                <th key={p} className="py-2 px-1">
                  <button
                    onClick={() => onPeriodChange(p)}
                    aria-pressed={period === p}
                    className={`w-full text-right px-2 py-1 rounded-md font-semibold transition-colors ${
                      period === p ? "bg-blue-600 text-white" : "hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {p}
                  </button>
                </th>
              ))}
              <th className="text-right font-medium py-2 px-2">vs SPY</th>
              <th className="text-center font-medium py-2 px-2">Trend</th>
              <th className="text-left font-medium py-2 px-2 pr-4 md:pr-2">Rotation</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
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
                <td className="text-right text-gray-200 px-2">${s.price.toFixed(2)}</td>
                {SECTOR_PERIODS.map((p) => (
                  <td
                    key={p}
                    className={`text-right px-3 ${changeText(s.returns[p])} ${p === period ? "font-semibold" : ""}`}
                    style={{ backgroundColor: cellTint(s.returns[p]) }}
                  >
                    {formatPct(s.returns[p], 1)}
                  </td>
                ))}
                <td className={`text-right px-2 font-semibold ${changeText(s.relative[period])}`}>
                  {formatPct(s.relative[period], 1)}
                </td>
                <td className="text-center px-2 whitespace-nowrap space-x-1">
                  <TrendBadge label="50" above={s.aboveSma50} />
                  <TrendBadge label="200" above={s.aboveSma200} />
                </td>
                <td className="px-2 pr-4 md:pr-2 text-gray-300" title={s.quadrant ? QUADRANT_HINTS[s.quadrant] : undefined}>
                  {s.quadrant ? QUADRANT_LABELS[s.quadrant] : "—"}
                </td>
              </tr>
            ))}
            <tr className="border-t border-gray-700 text-gray-400">
              <td className="py-2 pl-4 md:pl-2 font-semibold">
                SPY <span className="font-normal ml-2 hidden sm:inline">S&amp;P 500</span>
              </td>
              <td className="text-right px-2">${data.benchmark.price.toFixed(2)}</td>
              {SECTOR_PERIODS.map((p) => (
                <td key={p} className="text-right px-3">{formatPct(data.benchmark.returns[p], 1)}</td>
              ))}
              <td colSpan={3} />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
