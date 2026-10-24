/**
 * Per-visitor limit on Ask Claude questions.
 *
 * In memory, so it is per server instance and resets on a cold start: it
 * stops one visitor hammering the endpoint, not a determined abuser spread
 * across instances. Set ASK_ACCESS_CODE for a hard gate on a public URL.
 */
export const ASK_LIMIT = 8;
export const ASK_WINDOW_MS = 10 * 60 * 1000;

const hits = new Map<string, number[]>();

/** Records a request; returns seconds until the next one is allowed, or 0 when allowed now. */
export function checkRateLimit(key: string, now = Date.now()): number {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < ASK_WINDOW_MS);
  if (recent.length >= ASK_LIMIT) {
    hits.set(key, recent);
    return Math.ceil((recent[0] + ASK_WINDOW_MS - now) / 1000);
  }
  recent.push(now);
  hits.set(key, recent);
  // Keep the map from growing without bound on a long-lived instance.
  if (hits.size > 5000) {
    for (const [k, times] of hits) if (times.every((t) => now - t >= ASK_WINDOW_MS)) hits.delete(k);
  }
  return 0;
}

export function resetRateLimit() {
  hits.clear();
}
