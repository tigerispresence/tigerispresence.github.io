import { describe, expect, it } from "vitest";
import { normalizeSymbol } from "./symbols";

describe("normalizeSymbol", () => {
  it("upper-cases plain tickers", () => {
    expect(normalizeSymbol("aapl")).toBe("AAPL");
  });

  it("converts share-class dots to hyphens for Yahoo", () => {
    expect(normalizeSymbol("BRK.B")).toBe("BRK-B");
    expect(normalizeSymbol("bf.b")).toBe("BF-B");
  });

  it("preserves exchange suffixes on international tickers", () => {
    // The KOSPI suffix is two characters and must survive intact — this is the
    // case a naive `.replace(".", "-")` breaks.
    expect(normalizeSymbol("005930.KS")).toBe("005930.KS");
    expect(normalizeSymbol("247540.KQ")).toBe("247540.KQ");
  });

  it("strips the TradingView EXCHANGE:SYMBOL prefix", () => {
    expect(normalizeSymbol("NASDAQ:AAPL")).toBe("AAPL");
    expect(normalizeSymbol("NYSE:BRK.B")).toBe("BRK-B");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeSymbol("  msft  ")).toBe("MSFT");
  });

  it("returns an empty string for blank input", () => {
    expect(normalizeSymbol("   ")).toBe("");
  });
});
