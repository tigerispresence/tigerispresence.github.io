/**
 * Symbol normalization shared by the client, the search route and the stock route.
 *
 * Yahoo Finance uses a hyphen where the ticker itself has a dot (BRK.B -> BRK-B),
 * and the TradingView heatmap hands us "EXCHANGE:SYMBOL". Both rules were
 * previously duplicated in three places and had drifted apart.
 */

/** Tickers whose canonical form uses a dot that Yahoo expects as a hyphen. */
const DOT_CLASS_TICKER = /^([A-Z]+)\.([A-Z])$/;

/**
 * Normalize free-form user/widget input into something Yahoo will accept.
 *
 * Leaves non-US suffixed symbols alone (005930.KS must keep its dot), because
 * the exchange suffix is two or more characters and the share-class suffix is
 * exactly one.
 */
export function normalizeSymbol(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";

  // "NASDAQ:AAPL" -> "AAPL"
  const withoutExchange = trimmed.includes(":")
    ? trimmed.slice(trimmed.lastIndexOf(":") + 1).trim()
    : trimmed;

  const upper = withoutExchange.toUpperCase();

  // BRK.B -> BRK-B, BF.B -> BF-B, but 005930.KS is untouched.
  return upper.replace(DOT_CLASS_TICKER, "$1-$2");
}
