"use client";

import { memo, useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { StockData } from "@/lib/types/stock";
import { useStockAnalytics } from "@/hooks/useStockAnalytics";
import { StockDataProvider } from "./StockDataContext";
import StockHeader from "./StockHeader";
import KeyStatsGrid from "./KeyStatsGrid";
import AnalystTargets from "./AnalystTargets";
import PriceBollingerChart from "./charts/PriceBollingerChart";
import VolatilityChart from "./charts/VolatilityChart";
import DistributionChart from "./charts/DistributionChart";
import DcaSimulationChart from "./charts/DcaSimulationChart";
import VolatilitySimulationChart from "./charts/VolatilitySimulationChart";
import FearGreedSimulationChart from "./charts/FearGreedSimulationChart";
import RiskMetrics from "../RiskMetrics";
import SmartMoneyFlow from "../SmartMoneyFlow";
import ShareholderYield from "../ShareholderYield";
import EarningsGrowth from "../EarningsGrowth";
import AIInsights from "../AIInsights";
import FinancialsChart from "../FinancialsChart";
import SeasonalityHeatmap from "../SeasonalityHeatmap";
import NewsSection from "../NewsSection";

export type { StockData };

interface StockDashboardProps {
  data: StockData | null;
}

const toggle = (list: string[], value: string) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

/**
 * Layout shell.
 *
 * Owns only the two strategy selections and the currency formatter; every
 * section reads what it needs from context, and all derivation happens in
 * useStockAnalytics.
 */
const StockDashboard = memo(({ data }: StockDashboardProps) => {
  // Default to buying dips at or beyond one sigma below the mean.
  const [selectedZones, setSelectedZones] = useState<string[]>(["-2", "-1"]);
  const [selectedFgZones, setSelectedFgZones] = useState<string[]>([
    "extreme fear",
    "fear",
  ]);

  const toggleZone = useCallback(
    (zone: string) => setSelectedZones((prev) => toggle(prev, zone)),
    [],
  );
  const toggleFgZone = useCallback(
    (zone: string) => setSelectedFgZones((prev) => toggle(prev, zone)),
    [],
  );

  const analytics = useStockAnalytics(data, selectedZones, selectedFgZones);

  const currency = data?.currency;
  const formatCurrency = useCallback(
    (value: number) => {
      if (currency === "KRW") return `${value.toLocaleString()}원`;
      if (currency === "USD") return `$${value.toLocaleString()}`;
      return `${value.toLocaleString()} ${currency ?? ""}`.trim();
    },
    [currency],
  );

  const contextValue = useMemo(
    () =>
      data
        ? {
            data,
            analytics,
            formatCurrency,
            selectedZones,
            toggleZone,
            selectedFgZones,
            toggleFgZone,
          }
        : null,
    [
      data,
      analytics,
      formatCurrency,
      selectedZones,
      toggleZone,
      selectedFgZones,
      toggleFgZone,
    ],
  );

  // After the hooks, so hook order stays stable across renders.
  if (!data || !contextValue) return null;

  return (
    <StockDataProvider value={contextValue}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-6xl mx-auto mt-8 space-y-8"
      >
        <StockHeader />

        <RiskMetrics data={data} />
        <SmartMoneyFlow data={data} />
        <ShareholderYield data={data} />
        <EarningsGrowth data={data} />

        <KeyStatsGrid />

        <AIInsights symbol={data.symbol} stockName={data.name} />

        <AnalystTargets />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <PriceBollingerChart />

          {/* Both span the full grid width. */}
          {data.financials && (
            <div className="lg:col-span-2">
              <FinancialsChart data={data.financials} />
            </div>
          )}

          {data.seasonality && data.seasonality.length > 0 && (
            <div className="lg:col-span-2">
              <SeasonalityHeatmap data={data.seasonality} />
            </div>
          )}

          <VolatilityChart />
          <DistributionChart />
          <DcaSimulationChart />
          <VolatilitySimulationChart />
          <FearGreedSimulationChart />
        </div>

        <NewsSection symbol={data.symbol} />
      </motion.div>
    </StockDataProvider>
  );
});

StockDashboard.displayName = "StockDashboard";

export default StockDashboard;
