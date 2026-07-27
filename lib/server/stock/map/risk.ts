import {
  altmanZScore,
  piotroskiFScore,
  type AltmanInputs,
  type FinancialYear,
} from "@/lib/calc/scores";
import type {
  IncomeStatementRow,
  QuoteSummaryBundle,
  YahooFundamentalsRow,
  YahooQuote,
} from "@/lib/server/yahoo/types";

export interface RiskScores {
  altmanZScore?: number;
  piotroskiFScore?: number;
  riskSummary?: string;
}

export interface RiskInputs {
  quoteSummary: QuoteSummaryBundle | null;
  quote: YahooQuote | null;
  /** fundamentalsTimeSeries, module "balance-sheet". */
  balanceSheets: YahooFundamentalsRow[];
  /** fundamentalsTimeSeries, module "cash-flow". */
  cashFlows: YahooFundamentalsRow[];
}

const fiscalYear = (d: string | Date | undefined): number | null => {
  if (!d) return null;
  const year = new Date(d).getUTCFullYear();
  return Number.isFinite(year) ? year : null;
};

/** Index annual rows by fiscal year so the three feeds can be aligned. */
function byYear<T extends { date?: string | Date; endDate?: string | Date }>(
  rows: T[],
): Map<number, T> {
  const map = new Map<number, T>();
  for (const row of rows) {
    const year = fiscalYear(row.date ?? row.endDate);
    if (year !== null) map.set(year, row);
  }
  return map;
}

/** Describe the computed scores in one sentence, replacing the AI-written summary. */
export function summarizeRisk(
  altman: number | null,
  piotroski: number | null,
  beta?: number,
): string | undefined {
  const parts: string[] = [];

  if (altman !== null) {
    const band =
      altman > 2.99
        ? "in the safe zone"
        : altman >= 1.81
          ? "in the grey zone"
          : "in the distress zone";
    parts.push(`an Altman Z-Score of ${altman.toFixed(2)} places it ${band}`);
  }

  if (piotroski !== null) {
    const strength =
      piotroski >= 8 ? "strong" : piotroski >= 5 ? "moderate" : "weak";
    parts.push(`a Piotroski F-Score of ${piotroski}/9 indicates ${strength} fundamentals`);
  }

  if (typeof beta === "number" && Number.isFinite(beta)) {
    const volatility =
      beta > 1.2 ? "more volatile than" : beta < 0.8 ? "less volatile than" : "in line with";
    parts.push(`a beta of ${beta.toFixed(2)} makes it ${volatility} the market`);
  }

  if (parts.length === 0) return undefined;
  const sentence = parts.join("; ");
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
}

/**
 * Compute the risk scores from annual statements.
 *
 * Balance-sheet and cash-flow figures come from fundamentalsTimeSeries rather
 * than quoteSummary: the quoteSummary equivalents have returned rows carrying
 * nothing but maxAge and endDate since late 2024, so an Altman Z built on them
 * could never produce a number. The income statement still comes from
 * quoteSummary, which does populate it.
 */
export function mapRiskScores(inputs: RiskInputs): RiskScores | undefined {
  const { quoteSummary, quote, balanceSheets, cashFlows } = inputs;

  const stats = quoteSummary?.defaultKeyStatistics;
  const marketCap =
    quoteSummary?.summaryDetail?.marketCap ?? stats?.marketCap ?? quote?.marketCap;

  const incomeByYear = byYear<IncomeStatementRow>(
    quoteSummary?.incomeStatementHistory?.incomeStatementHistory ?? [],
  );
  const balanceByYear = byYear(balanceSheets);
  const cashByYear = byYear(cashFlows);

  // Newest first; the three feeds do not agree on ordering.
  const years = [...balanceByYear.keys()].sort((a, b) => b - a);
  const [latest, prior] = years;

  const balance = latest !== undefined ? balanceByYear.get(latest) : undefined;
  const income = latest !== undefined ? incomeByYear.get(latest) : undefined;

  const altmanInputs: AltmanInputs = {
    totalAssets: balance?.totalAssets,
    totalLiabilities: balance?.totalLiabilitiesNetMinorityInterest,
    totalCurrentAssets: balance?.currentAssets,
    totalCurrentLiabilities: balance?.currentLiabilities,
    retainedEarnings: balance?.retainedEarnings,
    ebit: income?.ebit,
    totalRevenue: income?.totalRevenue,
    marketCap,
  };

  const toYear = (year: number | undefined): FinancialYear => {
    if (year === undefined) return {};
    const b = balanceByYear.get(year);
    const i = incomeByYear.get(year);
    const c = cashByYear.get(year);
    return {
      totalAssets: b?.totalAssets,
      totalCurrentAssets: b?.currentAssets,
      totalCurrentLiabilities: b?.currentLiabilities,
      longTermDebt: b?.longTermDebt,
      netIncome: i?.netIncome,
      operatingCashFlow: c?.operatingCashFlow,
      totalRevenue: i?.totalRevenue,
      grossProfit: i?.grossProfit,
      sharesOutstanding: b?.shareIssued ?? b?.ordinarySharesNumber,
    };
  };

  const altman = altmanZScore(altmanInputs);
  const piotroski =
    latest !== undefined && prior !== undefined
      ? piotroskiFScore(toYear(latest), toYear(prior))
      : null;

  const summary = summarizeRisk(altman, piotroski?.score ?? null, stats?.beta);
  if (altman === null && piotroski === null && !summary) return undefined;

  return {
    altmanZScore: altman ?? undefined,
    piotroskiFScore: piotroski?.score,
    riskSummary: summary,
  };
}
