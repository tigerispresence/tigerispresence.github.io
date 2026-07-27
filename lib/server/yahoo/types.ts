/**
 * Narrow, hand-written shapes for the slices of yahoo-finance2 we consume.
 *
 * The library's `quoteSummary` return type is a wide union that does not
 * narrow by the `modules` array, so every access previously needed a
 * `@ts-ignore`. Describing only the fields we actually read gives real type
 * safety downstream at the cost of one cast at the fetch boundary.
 *
 * Every field is optional: Yahoo omits modules for many symbols (ETFs have no
 * income statement, Korean listings have no options chain, and so on).
 */

export interface YahooQuote {
  symbol?: string;
  shortName?: string;
  longName?: string;
  regularMarketPrice?: number;
  currency?: string;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  trailingPE?: number;
  forwardPE?: number;
  /** Yahoo reports this as a percent (1.5 means 1.5%). */
  dividendYield?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  marketCap?: number;
}

export interface YahooHistoryRow {
  date: Date;
  close: number | null;
  /** Present only when the request passes `events: 'dividends'`. */
  dividends?: number;
}

export interface YahooOptionLeg {
  strike: number;
  openInterest?: number;
}

export interface YahooOptionChain {
  expirationDate: Date;
  calls: YahooOptionLeg[];
  puts: YahooOptionLeg[];
}

export interface YahooOptionsResult {
  options?: YahooOptionChain[];
}

export interface YahooSearchQuote {
  symbol: string;
  shortname?: string;
  longname?: string;
  exchange?: string;
  quoteType?: string;
}

export interface YahooFundamentalsRow {
  date: string | Date;
  // cash-flow module
  repurchaseOfCapitalStock?: number;
  commonStockPayments?: number;
  operatingCashFlow?: number;
  // balance-sheet module
  totalAssets?: number;
  totalLiabilitiesNetMinorityInterest?: number;
  currentAssets?: number;
  currentLiabilities?: number;
  retainedEarnings?: number;
  longTermDebt?: number;
  shareIssued?: number;
  ordinarySharesNumber?: number;
}

// --- quoteSummary modules -------------------------------------------------

export interface FinancialDataModule {
  targetLowPrice?: number;
  targetHighPrice?: number;
  targetMeanPrice?: number;
  targetMedianPrice?: number;
  numberOfAnalystOpinions?: number;
}

export interface UpgradeDowngradeRow {
  firm?: string;
  currentPriceTarget?: number;
  epochGradeDate?: string | Date;
  action?: string;
}

export interface EarningsHistoryRow {
  quarter?: string | Date;
  epochGradeDate?: string | Date;
  epsActual?: number;
  epsEstimate?: number;
  epsDifference?: number;
  surprisePercent?: number;
  period?: string;
}

export interface IncomeStatementRow {
  endDate?: string | Date;
  totalRevenue?: number;
  grossProfit?: number;
  ebit?: number;
  netIncome?: number;
}

export interface BalanceSheetRow {
  endDate?: string | Date;
  totalAssets?: number;
  totalLiab?: number;
  totalCurrentAssets?: number;
  totalCurrentLiabilities?: number;
  retainedEarnings?: number;
  longTermDebt?: number;
  commonStock?: number;
}

export interface CashflowStatementRow {
  endDate?: string | Date;
  repurchaseOfCapitalStock?: number;
  totalCashFromOperatingActivities?: number;
}

export interface RecommendationTrendRow {
  period?: string;
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
}

export interface DefaultKeyStatisticsModule {
  beta?: number;
  marketCap?: number;
  payoutRatio?: number;
  trailingAnnualDividendYield?: number;
  heldPercentInsiders?: number;
  heldPercentInstitutions?: number;
  floatPercentHeld?: number;
  shortPercentOfFloat?: number;
  shortRatio?: number;
  shortPreviousMonthDate?: string | Date;
  sharesOutstanding?: number;
}

export interface SummaryDetailModule {
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  marketCap?: number;
}

export interface InsiderTransactionRow {
  shares?: number;
  value?: number;
  startDate?: string | Date;
  transactionText?: string;
  insiderName?: string;
  insiderTitle?: string;
  ownership?: string;
}

export interface EarningsTrendRow {
  period?: string;
  endDate?: string | Date;
  growth?: number;
  earningsEstimate?: { avg?: number };
  revenueEstimate?: { avg?: number };
}

/** The subset of quoteSummary modules this app requests. */
export interface QuoteSummaryBundle {
  financialData?: FinancialDataModule;
  upgradeDowngradeHistory?: { history?: UpgradeDowngradeRow[] };
  earningsHistory?: { history?: EarningsHistoryRow[] };
  incomeStatementHistoryQuarterly?: {
    incomeStatementHistory?: IncomeStatementRow[];
  };
  incomeStatementHistory?: { incomeStatementHistory?: IncomeStatementRow[] };
  balanceSheetHistory?: { balanceSheetStatements?: BalanceSheetRow[] };
  cashflowStatementHistory?: { cashflowStatements?: CashflowStatementRow[] };
  recommendationTrend?: { trend?: RecommendationTrendRow[] };
  defaultKeyStatistics?: DefaultKeyStatisticsModule;
  summaryDetail?: SummaryDetailModule;
  insiderTransactions?: { transactions?: InsiderTransactionRow[] };
  majorHoldersBreakdown?: Record<string, unknown>;
  earningsTrend?: { trend?: EarningsTrendRow[] };
}
