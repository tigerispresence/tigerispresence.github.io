import type { Dividend, PricePoint } from "@/lib/types/stock";
import type { YahooHistoryRow } from "./types";

/**
 * Convert Yahoo history rows into the plain JSON the payload and cache use.
 *
 * Lives outside the "use cache" module so it stays unit-testable: cached
 * functions need Next's runtime and cannot run under plain Vitest.
 */
export function toPricePoints(rows: YahooHistoryRow[]): PricePoint[] {
  return rows
    // Yahoo returns a row for the in-progress session with a null close, and
    // occasionally for halted days.
    .filter((row) => row.close !== null && row.close !== undefined)
    .map((row) => ({
      date: new Date(row.date).toISOString(),
      close: row.close as number,
    }));
}

export function toDividends(rows: YahooHistoryRow[]): Dividend[] {
  return rows.map((row) => ({
    date: new Date(row.date).toISOString(),
    amount: row.dividends ?? 0,
  }));
}
