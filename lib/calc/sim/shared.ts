import type { Dividend } from "@/lib/types/stock";
import type { SimPoint, SimulationResult } from "./types";

/** Normalize any date-ish string to YYYY-MM-DD for map lookups. */
export function dayKey(date: string | Date): string {
  return new Date(date).toISOString().split("T")[0];
}

/** Index dividends by day so the simulation loop can look them up in O(1). */
export function buildDividendMap(
  dividends: readonly Dividend[] | undefined,
): Map<string, number> {
  const map = new Map<string, number>();
  if (!dividends) return map;
  for (const d of dividends) map.set(dayKey(d.date), d.amount);
  return map;
}

/**
 * Mutable bookkeeping for the two scenarios every simulation runs side by
 * side: dividends reinvested vs dividends kept as cash. Both scenarios buy the
 * same shares with new capital; they differ only in what happens to payouts.
 */
export class Portfolio {
  sharesReinvest = 0;
  sharesNoReinvest = 0;
  cashNoReinvest = 0;
  totalInvested = 0;
  totalDividends = 0;
  buyCount = 0;
  readonly buyDates = new Set<string>();

  /** Apply a dividend payment at `price` (reinvested scenario buys more shares). */
  applyDividend(amountPerShare: number, price: number): void {
    const payoutReinvest = this.sharesReinvest * amountPerShare;
    if (payoutReinvest > 0 && price > 0) {
      this.sharesReinvest += payoutReinvest / price;
      this.totalDividends += payoutReinvest;
    }
    const payoutCash = this.sharesNoReinvest * amountPerShare;
    if (payoutCash > 0) this.cashNoReinvest += payoutCash;
  }

  /** Buy `shares` at `price` in both scenarios. */
  buy(price: number, date: string, shares = 1): void {
    this.sharesReinvest += shares;
    this.sharesNoReinvest += shares;
    this.totalInvested += price * shares;
    this.buyCount += shares;
    this.buyDates.add(date);
  }

  snapshot(date: string, price: number): SimPoint {
    return {
      date,
      invested: this.totalInvested,
      valueReinvest: this.sharesReinvest * price,
      valueNoReinvest: this.sharesNoReinvest * price + this.cashNoReinvest,
    };
  }
}

/**
 * Close out a simulation.
 *
 * `currentPrice` comes from the live quote, which can be missing or zero when
 * the upstream quote call failed. Valuing a portfolio at zero reports a -100%
 * return as though it were real, so we fall back to the last close instead.
 */
export function finalize(
  portfolio: Portfolio,
  history: SimPoint[],
  currentPrice: number,
  lastClose: number,
): SimulationResult {
  const price = currentPrice > 0 ? currentPrice : lastClose;
  const currentValue = portfolio.sharesReinvest * price;
  const totalReturn =
    portfolio.totalInvested > 0
      ? ((currentValue - portfolio.totalInvested) / portfolio.totalInvested) * 100
      : 0;

  return {
    history,
    totalBuys: portfolio.buyCount,
    totalInvested: portfolio.totalInvested,
    totalDividends: portfolio.totalDividends,
    currentValue,
    totalReturn,
    avgPrice:
      portfolio.buyCount > 0 ? portfolio.totalInvested / portfolio.buyCount : 0,
    buyDates: portfolio.buyDates,
  };
}
