export interface OptionLeg {
  strike: number;
  openInterest?: number;
}

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
): number | null {
  const strikes = [
    ...new Set([...calls.map((c) => c.strike), ...puts.map((p) => p.strike)]),
  ]
    .filter((s) => Number.isFinite(s))
    .sort((a, b) => a - b);

  if (strikes.length === 0) return null;

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
