import type { Dividend } from "@/lib/types/stock";

/** One row of a simulation's equity curve. */
export interface SimPoint {
  date: string;
  invested: number;
  /** Portfolio value with dividends reinvested. */
  valueReinvest: number;
  /** Portfolio value with dividends held as cash. */
  valueNoReinvest: number;
}

export interface SimulationResult {
  history: SimPoint[];
  totalBuys: number;
  totalInvested: number;
  totalDividends: number;
  currentValue: number;
  totalReturn: number;
  avgPrice: number;
  /** Dates on which the strategy bought, for scatter markers on the price chart. */
  buyDates: Set<string>;
}

export interface SimContext {
  dividends?: readonly Dividend[];
  /** Live quote. Falls back to the last close when non-positive. */
  currentPrice: number;
}
