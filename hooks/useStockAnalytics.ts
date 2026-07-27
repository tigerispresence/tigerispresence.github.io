"use client";

import { useMemo } from "react";
import type { StockData } from "@/lib/types/stock";
import { computeSeries, type SeriesPoint } from "@/lib/calc/series";
import { computeDistribution, type DistributionResult } from "@/lib/calc/distribution";
import { downsample } from "@/lib/calc/downsample";
import { simulateDca } from "@/lib/calc/sim/dca";
import { simulateVolatility } from "@/lib/calc/sim/volatility";
import { simulateFearGreed } from "@/lib/calc/sim/fearGreed";
import type { SimPoint, SimulationResult } from "@/lib/calc/sim/types";

/** A price point annotated with the day the strategy bought, for the scatter overlay. */
export interface ChartPoint extends SeriesPoint {
  buyPrice?: number | null;
}

export interface StockAnalytics {
  series: SeriesPoint[];
  distribution: DistributionResult;
  volatilitySim: SimulationResult | null;
  dcaSim: SimulationResult | null;
  fearGreedSim: SimulationResult | null;
  /** Downsampled for rendering; the simulations still run on every session. */
  priceChart: ChartPoint[];
  volatilityChart: SimPoint[];
  dcaChart: SimPoint[];
  fearGreedChart: SimPoint[];
}

/** Charts stay readable and responsive at this many points. */
const CHART_POINT_LIMIT = 500;

/**
 * Every derivation the dashboard renders, memoized in one place.
 *
 * The maths lives in lib/calc and is unit tested there; this hook only decides
 * what to recompute and when.
 */
export function useStockAnalytics(
  data: StockData | null,
  selectedZones: string[],
  selectedFgZones: string[],
): StockAnalytics {
  const series = useMemo(
    () => computeSeries(data?.history ?? []),
    [data?.history],
  );

  const distribution = useMemo(
    () => computeDistribution(data?.history ?? []),
    [data?.history],
  );

  const context = useMemo(
    () => ({
      currentPrice: data?.currentPrice ?? 0,
      dividends: data?.dividends,
    }),
    [data?.currentPrice, data?.dividends],
  );

  const volatilitySim = useMemo(
    () => simulateVolatility(series, distribution, context, selectedZones),
    [series, distribution, context, selectedZones],
  );

  const dcaSim = useMemo(() => simulateDca(series, context), [series, context]);

  const fearGreedSim = useMemo(
    () => simulateFearGreed(series, data?.fearGreedHistory, context, selectedFgZones),
    [series, data?.fearGreedHistory, context, selectedFgZones],
  );

  const priceChart = useMemo<ChartPoint[]>(() => {
    const points = downsample(series, CHART_POINT_LIMIT);
    if (!volatilitySim) return points;
    return points.map((point) => ({
      ...point,
      buyPrice: volatilitySim.buyDates.has(point.date) ? point.close : null,
    }));
  }, [series, volatilitySim]);

  const volatilityChart = useMemo(
    () => (volatilitySim ? downsample(volatilitySim.history, CHART_POINT_LIMIT) : []),
    [volatilitySim],
  );
  const dcaChart = useMemo(
    () => (dcaSim ? downsample(dcaSim.history, CHART_POINT_LIMIT) : []),
    [dcaSim],
  );
  const fearGreedChart = useMemo(
    () => (fearGreedSim ? downsample(fearGreedSim.history, CHART_POINT_LIMIT) : []),
    [fearGreedSim],
  );

  return {
    series,
    distribution,
    volatilitySim,
    dcaSim,
    fearGreedSim,
    priceChart,
    volatilityChart,
    dcaChart,
    fearGreedChart,
  };
}
