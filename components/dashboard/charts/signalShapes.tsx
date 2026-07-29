/**
 * Scatter marker shapes for the crossover signals.
 *
 * Recharts' built-in "triangle" only ever points up, so the sell marker needs a
 * custom shape to point down. Both are drawn here so the two markers stay
 * visually symmetrical.
 *
 * Important: Recharts invokes a custom shape for *every* row in the dataset,
 * not just rows where the dataKey has a value. Signals are sparse — a handful
 * of sessions out of hundreds — so without the null check below the chart
 * renders a triangle on every single session.
 */

interface ShapeProps {
  cx?: number;
  cy?: number;
  fill?: string;
  payload?: Record<string, unknown>;
}

const SIZE = 7;

function hasValue(payload: Record<string, unknown> | undefined, key: string) {
  const value = payload?.[key];
  return typeof value === "number" && Number.isFinite(value);
}

/** Green triangle pointing up, sitting just below the price point. */
export function UpTriangle({ cx, cy, fill = "#22c55e", payload }: ShapeProps) {
  if (cx === undefined || cy === undefined) return null;
  if (!hasValue(payload, "buySignal")) return null;

  // Offset below the close so the marker does not sit on the price line.
  const y = cy + SIZE;
  return (
    <path
      d={`M ${cx} ${y - SIZE} L ${cx + SIZE} ${y + SIZE} L ${cx - SIZE} ${y + SIZE} Z`}
      fill={fill}
      stroke="#052e16"
      strokeWidth={1}
    />
  );
}

/** Red triangle pointing down, sitting just above the price point. */
export function DownTriangle({ cx, cy, fill = "#ef4444", payload }: ShapeProps) {
  if (cx === undefined || cy === undefined) return null;
  if (!hasValue(payload, "sellSignal")) return null;

  const y = cy - SIZE;
  return (
    <path
      d={`M ${cx} ${y + SIZE} L ${cx + SIZE} ${y - SIZE} L ${cx - SIZE} ${y - SIZE} Z`}
      fill={fill}
      stroke="#450a0a"
      strokeWidth={1}
    />
  );
}
