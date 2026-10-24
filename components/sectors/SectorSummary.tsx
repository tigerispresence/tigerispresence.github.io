"use client";

import type { SectorData, SectorPeriod } from "@/lib/types/sectors";
import { changeText, formatPct } from "./format";

interface Props {
  data: SectorData;
  period: SectorPeriod;
}

function Tile({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-2xl p-4">
      <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-2">{label}</div>
      <div className="text-white font-bold text-xl">{children}</div>
      {hint && <div className="text-gray-500 text-xs mt-1">{hint}</div>}
    </div>
  );
}

/** Headline read of the tab: who leads, who lags, and how broad the trend is. */
export default function SectorSummary({ data, period }: Props) {
  const ranked = data.sectors
    .filter((s) => s.returns[period] !== null)
    .sort((a, b) => (b.returns[period] as number) - (a.returns[period] as number));
  const best = ranked[0];
  const worst = ranked.at(-1);

  const withTrend = data.sectors.filter((s) => s.aboveSma200 !== null);
  const above200 = withTrend.filter((s) => s.aboveSma200).length;
  const beatingSpy = ranked.filter((s) => (s.relative[period] ?? 0) > 0).length;
  const leading = data.sectors.filter((s) => s.quadrant === "leading").map((s) => s.symbol);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      <Tile label={`Best · ${period}`} hint={best?.name}>
        {best ? (
          <>
            {best.symbol} <span className={`text-base ${changeText(best.returns[period])}`}>{formatPct(best.returns[period], 1)}</span>
          </>
        ) : "—"}
      </Tile>
      <Tile label={`Worst · ${period}`} hint={worst?.name}>
        {worst ? (
          <>
            {worst.symbol} <span className={`text-base ${changeText(worst.returns[period])}`}>{formatPct(worst.returns[period], 1)}</span>
          </>
        ) : "—"}
      </Tile>
      <Tile label="Breadth" hint={`${beatingSpy} of ${ranked.length} beat SPY over ${period}`}>
        {above200} / {withTrend.length} <span className="text-base text-gray-400 font-medium">above 200-day</span>
      </Tile>
      <Tile label="Leading Rotation" hint="Strong and strengthening vs SPY">
        {leading.length > 0 ? leading.join(", ") : <span className="text-gray-500">None</span>}
      </Tile>
    </div>
  );
}
