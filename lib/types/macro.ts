export type Trend = "rising" | "falling";

/** `${inflation}-${yields}`: each judged by its change over the prior three months. */
export const MACRO_REGIMES = [
  "rising-rising",
  "rising-falling",
  "falling-rising",
  "falling-falling",
] as const;
export type MacroRegime = (typeof MACRO_REGIMES)[number];

/** A latest value beside the value three months earlier. */
export interface MacroReading {
  value: number;
  previous: number | null;
  /** ISO date (daily series) or YYYY-MM (monthly series) of `value`. */
  date: string;
}

export interface RegimeStats {
  /** Mean monthly total return minus SPY's, as a fraction. */
  avgExcess: number;
  /** Share of months the sector beat SPY. */
  hitRate: number;
  months: number;
  /**
   * avgExcess over its standard error. Monthly excess returns are noisy, so
   * |t| < 2 means the average is within what chance alone would produce.
   */
  tStat: number | null;
}

export interface SectorMacroRow {
  symbol: string;
  name: string;
  /** Monthly excess return vs SPY per +1pp change in the 10-year yield. */
  rateBeta: number | null;
  /** Correlation behind `rateBeta`. */
  rateR: number | null;
  rateMonths: number;
  regimes: Record<MacroRegime, RegimeStats | null>;
}

export interface MacroHistoryPoint {
  month: string;
  cpi: number | null;
  coreCpi: number | null;
  ten: number | null;
  two: number | null;
}

export interface SectorMacroData {
  snapshot: {
    /** Year-over-year, as a fraction. */
    cpi: MacroReading | null;
    coreCpi: MacroReading | null;
    /** Yields in percent (4.25 = 4.25%). */
    ten: MacroReading | null;
    two: MacroReading | null;
    spread: MacroReading | null;
    real: MacroReading | null;
  };
  regime: { key: MacroRegime; inflation: Trend; rates: Trend } | null;
  /** Monthly, oldest first, for the chart. */
  history: MacroHistoryPoint[];
  sectors: SectorMacroRow[];
  /** How many months of history fell in each regime. */
  regimeMonths: Record<MacroRegime, number>;
  /** First month (YYYY-MM) of the regime history. */
  since: string | null;
}
