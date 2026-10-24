/** Lookback windows the sector table and bar chart can show. */
export const SECTOR_PERIODS = ["1D", "1W", "1M", "3M", "6M", "YTD", "1Y"] as const;
export type SectorPeriod = (typeof SECTOR_PERIODS)[number];

/** Relative-rotation quadrant, by RS-Ratio (x) and RS-Momentum (y) against 100. */
export type RotationQuadrant = "leading" | "weakening" | "lagging" | "improving";

export interface RotationPoint {
  date: string;
  ratio: number;
  momentum: number;
}

export interface SectorStats {
  symbol: string;
  name: string;
  price: number;
  /** Price return per period as a fraction (0.05 = +5%); null when history is too short. */
  returns: Record<SectorPeriod, number | null>;
  /** Return minus the benchmark's over the same period. */
  relative: Record<SectorPeriod, number | null>;
  aboveSma50: boolean | null;
  aboveSma200: boolean | null;
  /** Weekly rotation path, oldest first; the last point is the current position. */
  rotation: RotationPoint[];
  quadrant: RotationQuadrant | null;
}

export interface SectorData {
  benchmark: { symbol: string; price: number; returns: Record<SectorPeriod, number | null> };
  sectors: SectorStats[];
  /** Date of the latest bar used, ISO. */
  asOf: string | null;
}
