import { getMonthlyHistory } from "@/lib/server/yahoo/fetchers";
import { FRED_SERIES, getFredSeries } from "@/lib/server/fred/series";
import { BENCHMARK, SECTORS } from "@/lib/calc/sectors";
import {
  currentRegime,
  latestDaily,
  latestMonthly,
  monthEnd,
  monthKey,
  monthlyReturns,
  rateSensitivity,
  regimeAt,
  regimeStats,
  shiftMonth,
  yoy,
  type DatedValue,
  type MonthSeries,
} from "@/lib/calc/macro";
import { MACRO_REGIMES, type MacroRegime, type SectorMacroData } from "@/lib/types/macro";
import type { YahooHistoryRow } from "@/lib/server/yahoo/types";

/** SPY and the oldest sector ETFs date from 1998–99; start once all nine originals trade. */
const HISTORY_START = "2000-01";
/** Twelve extra months so the first year has a year-over-year CPI. */
const FRED_START = "1999-01-01";
const HISTORY_YEARS = new Date().getUTCFullYear() - 1999;
const CHART_MONTHS = 120;

/**
 * Month-end total-return prices from Yahoo's monthly bars.
 *
 * Only completed months are kept: Yahoo returns the in-progress month plus an
 * extra row for today's quote, and a partial month would be averaged in as if
 * it were a whole one.
 */
export function toMonthlyPrices(rows: YahooHistoryRow[], now: Date): MonthSeries {
  const current = monthKey(now.toISOString());
  const out: MonthSeries = new Map();
  for (const row of rows) {
    const price = row.adjClose ?? row.close;
    const month = monthKey(new Date(row.date).toISOString());
    if (price == null || month >= current || month < HISTORY_START) continue;
    out.set(month, price);
  }
  return out;
}

const spreadSeries = (ten: DatedValue[], two: DatedValue[]): DatedValue[] => {
  const twoByDate = new Map(two.map((p) => [p.date, p.value]));
  return ten.flatMap((p) => {
    const t = twoByDate.get(p.date);
    return t === undefined ? [] : [{ date: p.date, value: p.value - t }];
  });
};

/**
 * Sectors against the macro backdrop: CPI and Treasury yields from FRED,
 * monthly total returns from Yahoo.
 */
export async function getSectorMacroData(now = new Date()): Promise<SectorMacroData> {
  const [cpiRaw, coreRaw, tenDaily, twoDaily, realDaily, ...prices] = await Promise.all([
    getFredSeries(FRED_SERIES.cpi, FRED_START),
    getFredSeries(FRED_SERIES.coreCpi, FRED_START),
    getFredSeries(FRED_SERIES.ten, FRED_START),
    getFredSeries(FRED_SERIES.two, FRED_START),
    getFredSeries(FRED_SERIES.real, FRED_START),
    getMonthlyHistory(BENCHMARK, HISTORY_YEARS),
    ...SECTORS.map((s) => getMonthlyHistory(s.symbol, HISTORY_YEARS)),
  ]);

  const toMonthly = (points: DatedValue[]): MonthSeries =>
    new Map(points.map((p) => [monthKey(p.date), p.value]));
  const cpiYoY = yoy(toMonthly(cpiRaw));
  const coreYoY = yoy(toMonthly(coreRaw));
  const tenMonthly = monthEnd(tenDaily);
  const twoMonthly = monthEnd(twoDaily);

  const [benchPrices, ...sectorPrices] = prices.map((rows) => toMonthlyPrices(rows, now));
  const benchReturns = monthlyReturns(benchPrices);

  const regimes = new Map<string, MacroRegime>();
  for (const month of benchReturns.keys()) {
    const regime = regimeAt(month, cpiYoY, tenMonthly);
    if (regime) regimes.set(month, regime);
  }
  const regimeMonths = Object.fromEntries(MACRO_REGIMES.map((r) => [r, 0])) as Record<MacroRegime, number>;
  for (const r of regimes.values()) regimeMonths[r]++;

  const snapshot = {
    cpi: latestMonthly(cpiYoY),
    coreCpi: latestMonthly(coreYoY),
    ten: latestDaily(tenDaily),
    two: latestDaily(twoDaily),
    spread: latestDaily(spreadSeries(tenDaily, twoDaily)),
    real: latestDaily(realDaily),
  };

  const lastMonth = shiftMonth(monthKey(now.toISOString()), -1);
  const history = Array.from({ length: CHART_MONTHS }, (_, i) => {
    const month = shiftMonth(lastMonth, i - CHART_MONTHS + 1);
    return {
      month,
      cpi: cpiYoY.get(month) ?? null,
      coreCpi: coreYoY.get(month) ?? null,
      ten: tenMonthly.get(month) ?? null,
      two: twoMonthly.get(month) ?? null,
    };
  });

  const sectors = SECTORS.flatMap((sector, i) => {
    const returns = monthlyReturns(sectorPrices[i]);
    if (returns.size === 0) return [];
    const rate = rateSensitivity(returns, benchReturns, tenMonthly);
    return [
      {
        symbol: sector.symbol,
        name: sector.name,
        rateBeta: rate.beta,
        rateR: rate.r,
        rateMonths: rate.months,
        regimes: regimeStats(returns, benchReturns, regimes),
      },
    ];
  });

  return {
    snapshot,
    regime: currentRegime(snapshot.cpi, snapshot.ten),
    history,
    sectors,
    regimeMonths,
    since: [...regimes.keys()].sort()[0] ?? null,
  };
}

/** True when both halves arrived: macro data from FRED and returns from Yahoo. */
export function isUsableSectorMacroData(data: SectorMacroData): boolean {
  return data.sectors.length > 0 && data.snapshot.cpi !== null && data.snapshot.ten !== null;
}
