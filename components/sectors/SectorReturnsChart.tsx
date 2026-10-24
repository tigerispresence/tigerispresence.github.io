"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SectorData, SectorPeriod } from "@/lib/types/sectors";
import { DOWN, UP, formatPct, niceTicks } from "./format";

interface Props {
  data: SectorData;
  period: SectorPeriod;
  highlighted: string | null;
  onHighlight: (symbol: string | null) => void;
}

/** Sector returns for one period, best first, against SPY's as a reference line. */
export default function SectorReturnsChart({ data, period, highlighted, onHighlight }: Props) {
  const rows = data.sectors
    .filter((s) => s.returns[period] !== null)
    .map((s) => ({
      symbol: s.symbol,
      name: s.name,
      value: s.returns[period] as number,
      relative: s.relative[period],
    }))
    .sort((a, b) => b.value - a.value);
  const benchmark = data.benchmark.returns[period];
  const values = [0, ...rows.map((r) => r.value), ...(benchmark === null ? [] : [benchmark])];
  // Headroom past the longest bars so their end labels have somewhere to sit.
  const ticks = niceTicks(Math.min(...values) * 1.35, Math.max(...values) * 1.2);

  return (
    <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-3xl p-4 md:p-6">
      <h2 className="text-white font-semibold text-lg">Sector Returns · {period}</h2>
      <p className="text-sm text-gray-400 mb-4">
        Price return of each sector ETF. The dashed line is SPY ({formatPct(benchmark)}).
      </p>
      <div className="h-[420px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ top: 20, right: 56, bottom: 8, left: 0 }}
            onMouseLeave={() => onHighlight(null)}
          >
            <CartesianGrid stroke="#1f2937" horizontal={false} />
            <XAxis
              type="number"
              stroke="#6b7280"
              ticks={ticks}
              domain={[ticks[0], ticks[ticks.length - 1]]}
              tickFormatter={(v: number) => formatPct(v, Math.abs(ticks[1] - ticks[0]) < 0.01 ? 1 : 0)}
            />
            <YAxis
              type="category"
              dataKey="symbol"
              stroke="#6b7280"
              width={52}
              tick={{ fill: "#d1d5db", fontSize: 12 }}
            />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              contentStyle={{ backgroundColor: "#111827", borderColor: "#374151", borderRadius: "12px" }}
              labelStyle={{ color: "#9ca3af" }}
              itemStyle={{ color: "#e5e7eb" }}
              labelFormatter={(symbol) => {
                const row = rows.find((r) => r.symbol === symbol);
                return row ? `${row.symbol} · ${row.name}` : String(symbol);
              }}
              formatter={(value: number, _name, item) => [
                `${formatPct(value)} (vs SPY ${formatPct(item.payload.relative)})`,
                "Return",
              ]}
            />
            <ReferenceLine x={0} stroke="#4b5563" />
            {benchmark !== null && (
              <ReferenceLine
                x={benchmark}
                stroke="#9ca3af"
                strokeDasharray="4 4"
                label={{ value: "SPY", position: "top", fill: "#9ca3af", fontSize: 11 }}
              />
            )}
            <Bar
              dataKey="value"
              radius={[0, 4, 4, 0]}
              maxBarSize={22}
              isAnimationActive={false}
              onMouseEnter={(entry) => onHighlight((entry.payload as { symbol?: string })?.symbol ?? null)}
            >
              {rows.map((row) => (
                <Cell
                  key={row.symbol}
                  fill={row.value >= 0 ? UP : DOWN}
                  fillOpacity={highlighted && highlighted !== row.symbol ? 0.35 : 1}
                />
              ))}
              <LabelList
                dataKey="value"
                position="right"
                formatter={(v) => formatPct(Number(v), 1)}
                style={{ fill: "#d1d5db", fontSize: 11 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
