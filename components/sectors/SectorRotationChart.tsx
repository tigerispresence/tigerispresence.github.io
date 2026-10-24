"use client";

import {
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SectorData } from "@/lib/types/sectors";
import { QUADRANT_LABELS, niceTicks } from "./format";

interface Props {
  data: SectorData;
  highlighted: string | null;
  onHighlight: (symbol: string | null) => void;
}

interface PathPoint {
  symbol: string;
  date: string;
  ratio: number;
  momentum: number;
  isHead: boolean;
}

const MARK = "#60a5fa";
/** Weeks of tail drawn when no sector is highlighted; the full path shows on hover. */
const SHORT_TAIL = 3;
const MUTED = "#4b5563";

/**
 * Relative rotation: each sector's last eight weeks against SPY.
 *
 * Position already says which quadrant a sector is in, so the marks share one
 * colour and identity comes from the ticker label on each head — eleven
 * categorical hues could not be told apart.
 */
export default function SectorRotationChart({ data, highlighted, onHighlight }: Props) {
  const paths = data.sectors
    .filter((s) => s.rotation.length > 0)
    .map((s) => ({
      symbol: s.symbol,
      points: s.rotation.map<PathPoint>((p, i) => ({
        symbol: s.symbol,
        date: p.date,
        ratio: p.ratio,
        momentum: p.momentum,
        isHead: i === s.rotation.length - 1,
      })),
    }));

  // Symmetric around 100 so the four quadrants are equal-sized.
  const all = paths.flatMap((p) => p.points);
  const spanX = Math.max(1, ...all.map((p) => Math.abs(p.ratio - 100))) * 1.15;
  const spanY = Math.max(0.5, ...all.map((p) => Math.abs(p.momentum - 100))) * 1.15;
  const xTicks = niceTicks(100 - spanX, 100 + spanX, 6);
  const yTicks = niceTicks(100 - spanY, 100 + spanY, 6);
  const x: [number, number] = [xTicks[0], xTicks[xTicks.length - 1]];
  const y: [number, number] = [yTicks[0], yTicks[yTicks.length - 1]];

  const quadrantLabel = (text: string, position: "insideTopLeft" | "insideTopRight" | "insideBottomLeft" | "insideBottomRight") => ({
    value: text,
    position,
    fill: "#6b7280",
    fontSize: 12,
    fontWeight: 600,
  });

  return (
    <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-3xl p-4 md:p-6">
      <h2 className="text-white font-semibold text-lg">Sector Rotation</h2>
      <p className="text-sm text-gray-400 mb-4">
        Relative strength vs SPY (→) and its momentum (↑), sampled weekly. Hover a sector for its 8-week path. Sectors
        typically rotate clockwise: Improving → Leading → Weakening → Lagging.
      </p>
      <div className="h-[420px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 16, bottom: 24, left: 0 }}>
            <ReferenceArea x1={100} x2={x[1]} y1={100} y2={y[1]} fill="#22c55e" fillOpacity={0.05} stroke="none"
              label={quadrantLabel(QUADRANT_LABELS.leading, "insideTopRight")} />
            <ReferenceArea x1={100} x2={x[1]} y1={y[0]} y2={100} fill="#eab308" fillOpacity={0.05} stroke="none"
              label={quadrantLabel(QUADRANT_LABELS.weakening, "insideBottomRight")} />
            <ReferenceArea x1={x[0]} x2={100} y1={y[0]} y2={100} fill="#ef4444" fillOpacity={0.05} stroke="none"
              label={quadrantLabel(QUADRANT_LABELS.lagging, "insideBottomLeft")} />
            <ReferenceArea x1={x[0]} x2={100} y1={100} y2={y[1]} fill="#3b82f6" fillOpacity={0.05} stroke="none"
              label={quadrantLabel(QUADRANT_LABELS.improving, "insideTopLeft")} />
            <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
            <ReferenceLine x={100} stroke="#4b5563" />
            <ReferenceLine y={100} stroke="#4b5563" />
            <XAxis
              type="number"
              dataKey="ratio"
              domain={x}
              ticks={xTicks}
              stroke="#6b7280"
              tickFormatter={(v: number) => String(v)}
              label={{ value: "RS-Ratio", position: "insideBottom", offset: -16, fill: "#9ca3af", fontSize: 12 }}
            />
            <YAxis
              type="number"
              dataKey="momentum"
              domain={y}
              ticks={yTicks}
              stroke="#6b7280"
              width={64}
              tickFormatter={(v: number) => String(v)}
              label={{ value: "RS-Momentum", angle: -90, position: "insideLeft", offset: 8, fill: "#9ca3af", fontSize: 12 }}
            />
            <Tooltip
              cursor={false}
              contentStyle={{ backgroundColor: "#111827", borderColor: "#374151", borderRadius: "12px" }}
              content={({ active, payload }) => {
                const p = active ? (payload?.[0]?.payload as PathPoint | undefined) : undefined;
                if (!p) return null;
                return (
                  <div className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs">
                    <div className="text-white font-semibold">
                      {p.symbol} <span className="text-gray-400 font-normal">· week of {new Date(p.date).toLocaleDateString()}</span>
                    </div>
                    <div className="text-gray-300">RS-Ratio {p.ratio.toFixed(2)}</div>
                    <div className="text-gray-300">RS-Momentum {p.momentum.toFixed(2)}</div>
                  </div>
                );
              }}
            />
            {paths.map(({ symbol, points }) => {
              const active = highlighted === symbol;
              const dimmed = highlighted !== null && !active;
              const color = dimmed ? MUTED : MARK;
              // Eleven full tails at once are unreadable; show a short one until hovered.
              const shown = active ? points : points.slice(-SHORT_TAIL);
              return (
                <Scatter
                  key={symbol}
                  name={symbol}
                  data={shown}
                  line={{ stroke: color, strokeWidth: active ? 2 : 1.5, strokeOpacity: active ? 0.9 : dimmed ? 0.2 : 0.45 }}
                  isAnimationActive={false}
                  onMouseEnter={() => onHighlight(symbol)}
                  onMouseLeave={() => onHighlight(null)}
                  shape={(props: { cx?: number; cy?: number; payload?: PathPoint }) => {
                    const { cx = 0, cy = 0, payload } = props;
                    if (!payload?.isHead) {
                      return <circle cx={cx} cy={cy} r={active ? 3 : 2} fill={color} fillOpacity={active ? 0.9 : dimmed ? 0.2 : 0.45} />;
                    }
                    return (
                      <g>
                        {/* Surface ring keeps overlapping heads distinguishable. */}
                        <circle cx={cx} cy={cy} r={6} fill={color} stroke="#0b0d12" strokeWidth={2} />
                        <text x={cx + 9} y={cy + 4} fontSize={11} fontWeight={600} fill={dimmed ? "#6b7280" : "#e5e7eb"}>
                          {symbol}
                        </text>
                      </g>
                    );
                  }}
                />
              );
            })}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
