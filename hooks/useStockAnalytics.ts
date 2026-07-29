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
import {
  detectCrossovers,
  withCrossoverMarkers,
  type CrossoverSignal,
} from "@/lib/calc/signals";

/** A price point annotated with the markers the scatter overlays read. */
export interface ChartPoint extends SeriesPoint {
  buyPrice?: number | null;
  bullishSignal?: number | null;
  bearishSignal?: number | null;
}

export interface StockAnalytics {
  series: SeriesPoint[];
  distribution: DistributionResult;
  /** 20/60 moving-average crossovers, computed on the full series. */
  crossovers: CrossoverSignal[];
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

  const crossovers = useMemo(() => detectCrossovers(series), [series]);

  const priceChart = useMemo<ChartPoint[]>(() => {
    const kept = downsample(series, CHART_POINT_LIMIT);

    // Downsampling takes every Nth session, so a crossover can land on a
    // dropped one and its marker would silently disappear on long ranges.
    // Re-insert any signal session the thinning removed.
    let points = kept;
    if (kept.length < series.length && crossovers.length > 0) {
      const present = new Set(kept.map((p) => p.date));
      const missing = crossovers
        .filter((s) => !present.has(s.date))
        .map((s) => series.find((p) => p.date === s.date))
        .filter((p): p is SeriesPoint => p !== undefined);

      if (missing.length > 0) {
        points = [...kept, ...missing].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
        );
      }
    }

    const withSignals = withCrossoverMarkers(points, crossovers);
    if (!volatilitySim) return withSignals;
    return withSignals.map((point) => ({
      ...point,
      buyPrice: volatilitySim.buyDates.has(point.date) ? point.close : null,
    }));
  }, [series, volatilitySim, crossovers]);

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
    crossovers,
    volatilitySim,
    dcaSim,
    fearGreedSim,
    priceChart,
    volatilityChart,
    dcaChart,
    fearGreedChart,
  };
}
