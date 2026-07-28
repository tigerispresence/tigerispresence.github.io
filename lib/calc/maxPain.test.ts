import { describe, expect, it } from "vitest";
import { computeMaxPain } from "./maxPain";

describe("computeMaxPain", () => {
  it("returns null when there are no strikes", () => {
    expect(computeMaxPain([], [])).toBeNull();
  });

  it("finds the strike minimising total writer pain", () => {
    // All open interest sits at 100: settling there means every call below and
    // every put above expires worthless, so pain is minimised at 100.
    const calls = [
      { strike: 90, openInterest: 0 },
      { strike: 100, openInterest: 1000 },
      { strike: 110, openInterest: 0 },
    ];
    const puts = [
      { strike: 90, openInterest: 0 },
      { strike: 100, openInterest: 1000 },
      { strike: 110, openInterest: 0 },
    ];
    expect(computeMaxPain(calls, puts)).toBe(100);
  });

  it("is pulled toward the side with more open interest", () => {
    // Heavy put OI at 110 makes settling low expensive, so max pain sits high.
    const calls = [{ strike: 100, openInterest: 10 }];
    const puts = [{ strike: 110, openInterest: 5000 }];
    expect(computeMaxPain(calls, puts)).toBe(110);
  });

  it("hand-checked five-strike chain", () => {
    // Pain(S) = sum over calls of max(0, S-K)*OI + sum over puts of max(0, K-S)*OI
    //   S=80 : puts (100-80)*10 = 200
    //   S=90 : calls (90-80)*10=100 ; puts (100-90)*10=100  -> 200
    //   S=100: calls (100-80)*10=200                        -> 200
    // Ties resolve to the lowest strike scanned first.
    const calls = [
      { strike: 80, openInterest: 10 },
      { strike: 100, openInterest: 0 },
    ];
    const puts = [
      { strike: 100, openInterest: 10 },
      { strike: 80, openInterest: 0 },
    ];
    expect(computeMaxPain(calls, puts)).toBe(80);
  });

  it("returns null when the whole chain has no open interest", () => {
    // Regression test: freshly listed weeklies routinely carry zero OI on every
    // contract. Pain is then 0 at every strike and the scan returned whichever
    // it saw first — the lowest — which rendered as a max pain far below the
    // traded price (210 for a stock at 337).
    expect(computeMaxPain([{ strike: 50 }], [{ strike: 60 }])).toBeNull();
    expect(
      computeMaxPain(
        [{ strike: 200, openInterest: 0 }, { strike: 210, openInterest: 0 }],
        [{ strike: 200, openInterest: 0 }],
      ),
    ).toBeNull();
  });

  it("still computes when only one side carries open interest", () => {
    const result = computeMaxPain(
      [{ strike: 100, openInterest: 500 }],
      [{ strike: 110, openInterest: 0 }],
    );
    expect(result).not.toBeNull();
  });

  it("ignores non-finite strikes", () => {
    const result = computeMaxPain(
      [{ strike: Number.NaN, openInterest: 1 }, { strike: 100, openInterest: 1 }],
      [],
    );
    expect(result).toBe(100);
  });
});
