import type { StockData } from "@/lib/types/stock";
import type {
  CashflowStatementRow,
  DefaultKeyStatisticsModule,
  EarningsHistoryRow,
  EarningsTrendRow,
  IncomeStatementRow,
  InsiderTransactionRow,
  SummaryDetailModule,
  YahooFundamentalsRow,
  YahooQuote,
} from "@/lib/server/yahoo/types";

const toIso = (d: string | Date | undefined): string =>
  d ? new Date(d).toISOString() : "";

/**
 * Buyback + dividend yield.
 *
 * `quote.dividendYield` is reported by Yahoo as a percent (1.5 => 1.5%), while
 * this block expresses yields as fractions, so it is divided by 100 here.
 * Note the resulting unit differs from the top-level `dividendYield` field on
 * the payload, which stays a percent; see assemble.ts.
 */
export function mapShareholderYield(
  quote: YahooQuote,
  stats: DefaultKeyStatisticsModule | undefined,
  summary: SummaryDetailModule | undefined,
  cashFlowSeries: YahooFundamentalsRow[],
  cashflowStatements: CashflowStatementRow[] | undefined,
): StockData["shareholderYield"] | null {
  const marketCap = summary?.marketCap ?? stats?.marketCap ?? quote.marketCap;
  if (!marketCap) return null;

  let buybacks = 0;
  if (Array.isArray(cashFlowSeries) && cashFlowSeries.length > 0) {
    const latest = cashFlowSeries
      .filter(
        (item) =>
          item.repurchaseOfCapitalStock !== undefined ||
          item.commonStockPayments !== undefined,
      )
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .pop();
    buybacks = Math.abs(
      latest?.repurchaseOfCapitalStock ?? latest?.commonStockPayments ?? 0,
    );
  }

  // The time series is missing for many non-US listings; fall back to the
  // annual cash-flow statement.
  if (buybacks === 0) {
    buybacks = Math.abs(cashflowStatements?.[0]?.repurchaseOfCapitalStock ?? 0);
  }

  const buybackYield = buybacks / marketCap;
  const dividendYield =
    (quote.dividendYield !== undefined && quote.dividendYield !== null
      ? quote.dividendYield / 100
      : undefined) ??
    stats?.trailingAnnualDividendYield ??
    0;

  return {
    buybackYield,
    dividendYield,
    totalYield: buybackYield + dividendYield,
    payoutRatio: stats?.payoutRatio,
    annualBuybacks: buybacks,
  };
}

export function mapSmartMoneyFlow(
  transactions: InsiderTransactionRow[] | undefined,
  stats: DefaultKeyStatisticsModule | undefined,
): NonNullable<StockData["smartMoneyFlow"]> {
  return {
    insiderTransactions:
      transactions?.slice(0, 10).map((t) => ({
        shares: t.shares ?? 0,
        value: t.value ?? 0,
        date: toIso(t.startDate),
        text: t.transactionText ?? "",
        insiderName: t.insiderName ?? "",
        insiderTitle: t.insiderTitle ?? "",
        ownership: t.ownership ?? "",
      })) ?? [],
    ownership: {
      insiderPercent: stats?.heldPercentInsiders,
      institutionPercent: stats?.heldPercentInstitutions,
      floatPercent: stats?.floatPercentHeld,
    },
    shortInterest: {
      shortPercentOfFloat: stats?.shortPercentOfFloat,
      shortRatio: stats?.shortRatio,
      shortPreviousMonthDate: stats?.shortPreviousMonthDate
        ? toIso(stats.shortPreviousMonthDate)
        : undefined,
    },
  };
}

export function mapEarningsGrowth(
  earningsHistory: EarningsHistoryRow[] | undefined,
  earningsTrend: EarningsTrendRow[] | undefined,
  annualIncomeStatements: IncomeStatementRow[] | undefined,
): NonNullable<StockData["earningsGrowth"]> {
  const safeRatio = (numerator?: number, denominator?: number): number =>
    denominator ? (numerator ?? 0) / denominator : 0;

  return {
    history:
      earningsHistory?.map((h) => ({
        quarter: h.quarter ? String(h.quarter) : "",
        actual: h.epsActual ?? 0,
        estimate: h.epsEstimate ?? 0,
        surprise: h.epsDifference ?? 0,
        surprisePercent: h.surprisePercent ?? 0,
        period: h.period ?? "",
      })) ?? [],
    trend:
      earningsTrend?.map((t) => ({
        period: t.period ?? "",
        endDate: toIso(t.endDate),
        growth: t.growth ?? 0,
        earningsEstimate: t.earningsEstimate?.avg ?? 0,
        revenueEstimate: t.revenueEstimate?.avg ?? 0,
      })) ?? [],
    margins:
      annualIncomeStatements?.map((item) => ({
        date: toIso(item.endDate),
        grossMargin: safeRatio(item.grossProfit, item.totalRevenue),
        // EBIT stands in for operating income; Yahoo does not expose the latter.
        operatingMargin: safeRatio(item.ebit, item.totalRevenue),
        netMargin: safeRatio(item.netIncome, item.totalRevenue),
      })) ?? [],
  };
}
