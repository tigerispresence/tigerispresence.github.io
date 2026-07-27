"use client";

import { createContext, useContext } from "react";
import type { StockData } from "@/lib/types/stock";
import type { StockAnalytics } from "@/hooks/useStockAnalytics";

export interface StockDataContextValue {
  data: StockData;
  analytics: StockAnalytics;
  formatCurrency: (value: number) => string;
  /**
   * Strategy selections for the two interactive simulations.
   *
   * Held by the dashboard rather than by the chart components because they
   * feed useStockAnalytics, which owns the single memo boundary; pushing them
   * down would mean recomputing simulations in two places.
   */
  selectedZones: string[];
  toggleZone: (zone: string) => void;
  selectedFgZones: string[];
  toggleFgZone: (zone: string) => void;
}

const StockDataContext = createContext<StockDataContextValue | null>(null);

export const StockDataProvider = StockDataContext.Provider;

/**
 * Access the current stock, its derived analytics, and the currency formatter.
 *
 * Using context rather than prop drilling: the chart components sit three
 * levels down and each needs a different slice, so threading them through
 * would mean every intermediate layout div taking props it does not use.
 */
export function useStockData(): StockDataContextValue {
  const ctx = useContext(StockDataContext);
  if (!ctx) {
    throw new Error("useStockData must be used inside <StockDashboard>");
  }
  return ctx;
}
