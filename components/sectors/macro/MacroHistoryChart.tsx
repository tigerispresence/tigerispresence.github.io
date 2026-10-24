"use client";

import {
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SectorMacroData } from "@/lib/types/macro";
import { niceTicks } from "../format";
import { formatMonth } from "./labels";

/**
 * Validated as a set against the dark surface (dataviz palette, slots 1–4 in
 * order). The dashed line in each pair is the secondary encoding the
 * yellow↔aqua pair needs under protanopia.
 */
const LINES = [
  { key: "ten", label: "10-Yr Yield", color: "#3987e5", dash: undefined },
  { key: "cpi", label: "CPI YoY", color: "#d95926", dash: undefined },
  { key: "two", label: "2-Yr Yield", color: "#199e70", dash: "5 4" },
  { key: "coreCpi", label: "Core CPI YoY", color: "#c98500", dash: "5 4" },
] as const;

/** Ten years of CPI inflation against Treasury yields, all in percent on one axis. */
export default function MacroHistoryChart({ data }: { data: SectorMacroData }) {
  const rows = data.history.map((p) => ({
    month: p.month,
    cpi: p.cpi === null ? null : p.cpi * 100,
    coreCpi: p.coreCpi === null ? null : p.coreCpi * 100,
    ten: p.ten,
    two: p.two,
  }));
  const values = rows.flatMap((r) => [r.cpi, r.coreCpi, r.ten, r.two]).filter((v): v is number => v !== null);
  const ticks = niceTicks(Math.min(0, ...values), Math.max(...values), 5);
  const lastIndex = rows.length - 1;

  return (
    <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-3xl p-4 md:p-6">
      <h2 className="text-white font-semibold text-lg">Inflation vs Treasury Yields</h2>
      <p className="text-sm text-gray-400 mb-4">
        Monthly, last 10 years. When CPI runs above the 10-year yield, real rates are negative.
      </p>
      <div className="h-[360px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 88, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="#1f2937" vertical={false} />
            <XAxis
              dataKey="month"
              stroke="#6b7280"
              tickFormatter={(m: string) => m.slice(0, 4)}
              ticks={rows.filter((r) => r.month.endsWith("-01")).map((r) => r.month)}
            />
            <YAxis
              stroke="#6b7280"
              width={44}
              ticks={ticks}
              domain={[ticks[0], ticks[ticks.length - 1]]}
              tickFormatter={(v: number) => `${v}%`}
            />
            <Tooltip
              contentStyle={{ backgroundColor: "#111827", borderColor: "#374151", borderRadius: "12px" }}
              labelStyle={{ color: "#9ca3af" }}
              itemStyle={{ color: "#e5e7eb" }}
              cursor={{ stroke: "#4b5563" }}
              labelFormatter={(m) => formatMonth(String(m))}
              formatter={(v) => `${Number(v).toFixed(2)}%`}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: "#d1d5db" }} />
            {LINES.map((line) => (
              <Line
                key={line.key}
                type="monotone"
                dataKey={line.key}
                name={line.label}
                stroke={line.color}
                strokeWidth={2}
                strokeDasharray={line.dash}
                dot={false}
                activeDot={{ r: 4, stroke: "#0b0d12", strokeWidth: 2 }}
                isAnimationActive={false}
                // The missing October 2025 CPI is a real gap; bridging it would invent a print.
                connectNulls={false}
              >
                <LabelList
                  dataKey={line.key}
                  content={({ index, x, y, value }) =>
                    index === lastIndex && value != null ? (
                      <text x={Number(x) + 6} y={Number(y) + 4} fontSize={11} fill="#d1d5db">
                        {line.label.replace(" YoY", "").replace("-Yr Yield", "Y")} {Number(value).toFixed(1)}%
                      </text>
                    ) : null
                  }
                />
              </Line>
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
