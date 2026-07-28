export interface OptionLeg {
  strike: number;
  openInterest?: number;
}

/**
 * Open interest a chain must carry before max pain means anything.
 *
 * Max pain marks where the most contracts expire worthless, so it is only
 * informative on a liquid chain. Yahoo's free feed often returns a few hundred
 * contracts spread over ~90 strikes, where the result is driven by a handful
 * of positions and can land far from spot.
 */
export const MIN_MEANINGFUL_OPEN_INTEREST = 1_000;

/**
 * Max pain: the strike at which the total intrinsic value owed to option
 * holders is smallest — i.e. where the most contracts expire worthless.
 *
 * At a candidate settlement price S, calls with strike < S are in the money by
 * (S - strike) per share, and puts with strike > S by (strike - S). Weighting
 * each by open interest and summing gives total writer pain at S; the minimum
 * over all listed strikes is the max-pain price.
 */
export function computeMaxPain(
  calls: readonly OptionLeg[],
  puts: readonly OptionLeg[],
  minOpenInterest = 0,
): number | null {
  const strikes = [
    ...new Set([...calls.map((c) => c.strike), ...puts.map((p) => p.strike)]),
  ]
    .filter((s) => Number.isFinite(s))
    .sort((a, b) => a - b);

  if (strikes.length === 0) return null;

  // Without open interest there is no pain to minimise: every strike scores 0,
  // and the loop below would return whichever it happened to scan first — the
  // lowest. Freshly listed weeklies routinely have a whole chain at zero OI,
  // which surfaced as a max pain far below the traded price.
  const totalOpenInterest =
    calls.reduce((sum, c) => sum + (c.openInterest ?? 0), 0) +
    puts.reduce((sum, p) => sum + (p.openInterest ?? 0), 0);
  if (totalOpenInterest <= 0) return null;
  if (totalOpenInterest < minOpenInterest) return null;

  let minPain = Infinity;
  let maxPainStrike: number | null = null;

  for (const settle of strikes) {
    let pain = 0;
    for (const c of calls) {
      if (settle > c.strike) pain += (settle - c.strike) * (c.openInterest ?? 0);
    }
    for (const p of puts) {
      if (settle < p.strike) pain += (p.strike - settle) * (p.openInterest ?? 0);
    }
    if (pain < minPain) {
      minPain = pain;
      maxPainStrike = settle;
    }
  }

  return maxPainStrike;
}
