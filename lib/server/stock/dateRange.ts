export const STOCK_RANGES = ["1y", "2y", "3y", "5y", "10y", "custom"] as const;
export type StockRange = (typeof STOCK_RANGES)[number];

export function isStockRange(value: unknown): value is StockRange {
  return typeof value === "string" && (STOCK_RANGES as readonly string[]).includes(value);
}

const YEARS_BY_RANGE: Record<Exclude<StockRange, "custom">, number> = {
  "1y": 1,
  "2y": 2,
  "3y": 3,
  "5y": 5,
  "10y": 10,
};

/**
 * Resolve a range (or an explicit `from` date) into a period1/period2 pair.
 *
 * period2 is pulled back to the start of yesterday: yahoo-finance2 v3 rejects
 * a result set containing the in-progress session, whose close is still null.
 */
export function rangeToDates(
  range: string | undefined,
  from?: string,
): { period1: Date; period2: Date } {
  const period2 = new Date();
  period2.setDate(period2.getDate() - 1);
  period2.setHours(0, 0, 0, 0);

  const period1 = new Date();

  if (from) {
    const parsed = new Date(from);
    if (!Number.isNaN(parsed.getTime())) {
      return { period1: parsed, period2 };
    }
  }

  const years =
    range && range !== "custom" && isStockRange(range)
      ? YEARS_BY_RANGE[range as Exclude<StockRange, "custom">]
      : 1;

  period1.setFullYear(period1.getFullYear() - years);
  return { period1, period2 };
}
