/**
 * Shared shape of the `/api/stock` payload.
 *
 * Lifted verbatim out of components/StockDashboard.tsx so that the server
 * assembler, the calc layer and the UI all reference one definition.
 */

export interface PricePoint {
  date: string;
  close: number;
}

export interface Dividend {
  date: string;
  amount: number;
}

export interface FearGreedPoint {
  date: string;
  score: number;
  rating: string;
}

export interface FinancialFigure {
  raw: number;
  fmt: string;
  longFmt: string;
}

export interface StockData {
  symbol: string;
  name: string;
  currentPrice: number;
  currency: string;
  change: number;
  changePercent: number;
  trailingPE?: number;
  forwardPE?: number;
  dividendYield?: number;
  geminiMetrics?: {
    trailingPE: number | null;
    forwardPE: number | null;
    dividendYield: number | null;
  };
  priceTargets?: {
    low: number;
    high: number;
    mean: number;
    median: number;
    numberOfAnalysts: number;
  } | null;
  analystHistory?: {
    firm: string;
    target: number;
    date: string;
    action: string;
  }[];
  recommendationTrend?: {
    strongBuy: number;
    buy: number;
    hold: number;
    sell: number;
    strongSell: number;
  } | null;
  history: PricePoint[];
  dividends?: Dividend[];
  seasonality?: PricePoint[];
  financials?: {
    financialsChart: {
      quarterly: {
        date: string;
        revenue: FinancialFigure;
        earnings: FinancialFigure;
      }[];
      yearly: {
        date: number;
        revenue: FinancialFigure;
        earnings: FinancialFigure;
      }[];
    };
    financialCurrency: string;
  };

  maxPain?: {
    price: number;
    expirationDate: string;
  } | null;

  riskMetrics?: {
    beta?: number;
    fiftyTwoWeekHigh?: number;
    fiftyTwoWeekLow?: number;
    marketCap?: number;
  };
  geminiRiskMetrics?: {
    altmanZScore?: number;
    piotroskiFScore?: number;
    riskSummary?: string;
  };

  smartMoneyFlow?: {
    insiderTransactions: Array<{
      shares: number;
      value: number;
      date: string;
      text: string;
      insiderName: string;
      insiderTitle: string;
      ownership: string;
    }>;
    ownership: {
      insiderPercent?: number;
      institutionPercent?: number;
      floatPercent?: number;
    };
    shortInterest: {
      shortPercentOfFloat?: number;
      shortRatio?: number;
      shortPreviousMonthDate?: string;
    };
  };

  shareholderYield?: {
    buybackYield: number;
    dividendYield: number;
    totalYield: number;
    payoutRatio?: number;
    annualBuybacks: number;
  };

  earningsGrowth?: {
    history: {
      quarter: string;
      actual: number;
      estimate: number;
      surprise: number;
      surprisePercent: number;
      period: string;
    }[];
    trend: {
      period: string;
      endDate: string;
      growth: number;
      earningsEstimate: number;
      revenueEstimate: number;
    }[];
    margins: {
      date: string;
      grossMargin: number;
      operatingMargin: number;
      netMargin: number;
    }[];
  };

  fearGreedHistory?: FearGreedPoint[] | null;
}
