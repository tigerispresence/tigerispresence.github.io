/**
 * Reduce a series to at most `limit` points by taking every Nth element.
 *
 * Used to keep Recharts responsive on multi-year daily histories. Returns the
 * input unchanged (same reference) when it already fits.
 *
 * Returns a mutable array because Recharts' `data` prop is typed that way;
 * callers are still not expected to mutate it.
 */
export function downsample<T>(data: readonly T[], limit: number): T[] {
  if (!data || data.length <= limit) return data as T[];
  const step = Math.ceil(data.length / limit);
  const result: T[] = [];
  for (let i = 0; i < data.length; i += step) result.push(data[i]);
  return result;
}
