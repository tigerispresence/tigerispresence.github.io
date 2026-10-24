import type { DatedValue } from "@/lib/calc/macro";

/**
 * FRED (Federal Reserve Bank of St. Louis) series via its public CSV export.
 *
 * The graph CSV endpoint needs no API key, unlike the JSON API. Missing
 * observations arrive as an empty value (or "." on older series) — the
 * October 2025 CPI, never published because of the government shutdown, is
 * one — and are dropped rather than parsed as zero.
 */
const CSV_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv";

export const FRED_SERIES = {
  cpi: "CPIAUCSL",
  coreCpi: "CPILFESL",
  ten: "DGS10",
  two: "DGS2",
  real: "DFII10",
} as const;

export function parseFredCsv(csv: string): DatedValue[] {
  return csv
    .trim()
    .split("\n")
    .slice(1)
    .flatMap((line) => {
      const [date, raw] = line.split(",");
      const value = Number(raw);
      return raw && raw.trim() !== "." && Number.isFinite(value) ? [{ date, value }] : [];
    });
}

export async function getFredSeries(id: string, from: string): Promise<DatedValue[]> {
  try {
    const params = new URLSearchParams({ id, cosd: from });
    const res = await fetch(`${CSV_URL}?${params}`, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`FRED status ${res.status}`);
    return parseFredCsv(await res.text());
  } catch (error) {
    console.warn(`[fred] ${id} failed:`, error);
    return [];
  }
}
