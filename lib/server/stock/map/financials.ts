import type { StockData } from "@/lib/types/stock";
import type {
  EarningsHistoryRow,
  IncomeStatementRow,
} from "@/lib/server/yahoo/types";

/** "2024 Q3" — the join key between the earnings and income-statement feeds. */
export function quarterLabel(date: string | Date): string {
  const d = new Date(date);
  return `${d.getFullYear()} Q${Math.floor((d.getMonth() + 3) / 3)}`;
}

/**
 * Join quarterly EPS (from earningsHistory) with quarterly revenue (from
 * incomeStatementHistoryQuarterly). The two feeds share no id, so they are
 * matched by calendar quarter.
 */
export function mapQuarterlyFinancials(
  earningsHistory: EarningsHistoryRow[] | undefined,
  incomeStatements: IncomeStatementRow[] | undefined,
  currency: string,
): StockData["financials"] | null {
  if (!earningsHistory || !incomeStatements) return null;

  const revenueByQuarter = new Map<string, number>();
  for (const item of incomeStatements) {
    if (!item.endDate) continue;
    revenueByQuarter.set(quarterLabel(item.endDate), item.totalRevenue ?? 0);
  }

  const quarterly = earningsHistory
    .map((item) => {
      const dateSource = item.quarter ?? item.epochGradeDate;
      if (!dateSource) return null;
      const label = quarterLabel(dateSource);
      const revenue = revenueByQuarter.get(label) ?? 0;
      const eps = item.epsActual;

      return {
        date: label,
        revenue: {
          raw: revenue,
          fmt: `${(revenue / 1e9).toFixed(2)}B`,
          longFmt: revenue.toLocaleString(),
        },
        earnings: {
          raw: eps ?? 0,
          fmt: eps?.toFixed(2) ?? "",
          longFmt: eps?.toFixed(2) ?? "",
        },
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => {
      const [yearA, qA] = a.date.split(" Q");
      const [yearB, qB] = b.date.split(" Q");
      return (
        parseInt(yearA) - parseInt(yearB) || parseInt(qA) - parseInt(qB)
      );
    });

  return {
    financialsChart: { quarterly, yearly: [] },
    financialCurrency: currency,
  };
}
