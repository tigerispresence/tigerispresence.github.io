import {
  altmanZScore,
  piotroskiFScore,
  type AltmanInputs,
  type FinancialYear,
} from "@/lib/calc/scores";
import type { QuoteSummaryBundle, YahooQuote } from "@/lib/server/yahoo/types";

export interface RiskScores {
  altmanZScore?: number;
  piotroskiFScore?: number;
  riskSummary?: string;
}

/** Newest-first ordering; Yahoo is usually already sorted this way but not always. */
function byEndDateDesc<T extends { endDate?: string | Date }>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) =>
      new Date(b.endDate ?? 0).getTime() - new Date(a.endDate ?? 0).getTime(),
  );
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
    parts.push(`Altman Z-Score of ${altman.toFixed(2)} places it ${band}`);
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
  return `${parts.join("; ")}.`;
}

/**
 * Compute the risk scores from data already present in the quoteSummary
 * response. Replaces an LLM call that guessed at these numbers.
 */
export function mapRiskScores(
  quoteSummary: QuoteSummaryBundle | null,
  quote: YahooQuote | null,
): RiskScores | undefined {
  if (!quoteSummary) return undefined;

  const stats = quoteSummary.defaultKeyStatistics;
  const balanceSheets = byEndDateDesc(
    quoteSummary.balanceSheetHistory?.balanceSheetStatements ?? [],
  );
  const incomeStatements = byEndDateDesc(
    quoteSummary.incomeStatementHistory?.incomeStatementHistory ?? [],
  );
  const cashflows = byEndDateDesc(
    quoteSummary.cashflowStatementHistory?.cashflowStatements ?? [],
  );

  const marketCap =
    quoteSummary.summaryDetail?.marketCap ?? stats?.marketCap ?? quote?.marketCap;

  const altmanInputs: AltmanInputs = {
    totalAssets: balanceSheets[0]?.totalAssets,
    totalLiabilities: balanceSheets[0]?.totalLiab,
    totalCurrentAssets: balanceSheets[0]?.totalCurrentAssets,
    totalCurrentLiabilities: balanceSheets[0]?.totalCurrentLiabilities,
    retainedEarnings: balanceSheets[0]?.retainedEarnings,
    ebit: incomeStatements[0]?.ebit,
    totalRevenue: incomeStatements[0]?.totalRevenue,
    marketCap,
  };

  const toYear = (index: number): FinancialYear => ({
    totalAssets: balanceSheets[index]?.totalAssets,
    totalCurrentAssets: balanceSheets[index]?.totalCurrentAssets,
    totalCurrentLiabilities: balanceSheets[index]?.totalCurrentLiabilities,
    longTermDebt: balanceSheets[index]?.longTermDebt,
    netIncome: incomeStatements[index]?.netIncome,
    operatingCashFlow: cashflows[index]?.totalCashFromOperatingActivities,
    totalRevenue: incomeStatements[index]?.totalRevenue,
    grossProfit: incomeStatements[index]?.grossProfit,
    // Yahoo exposes only the current share count, so the issuance signal can
    // only be evaluated when both statements carry commonStock.
    sharesOutstanding: balanceSheets[index]?.commonStock,
  });

  const altman = altmanZScore(altmanInputs);
  const piotroski =
    balanceSheets.length >= 2 ? piotroskiFScore(toYear(0), toYear(1)) : null;

  const summary = summarizeRisk(altman, piotroski?.score ?? null, stats?.beta);

  if (altman === null && piotroski === null && !summary) return undefined;

  return {
    altmanZScore: altman ?? undefined,
    piotroskiFScore: piotroski?.score,
    riskSummary: summary,
  };
}
