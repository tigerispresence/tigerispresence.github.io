import { describe, expect, it } from "vitest";
import { computeMaxPain } from "./maxPain";

describe("computeMaxPain liquidity floor", () => {
  const thinChain = {
    calls: [
      { strike: 100, openInterest: 50 },
      { strike: 110, openInterest: 40 },
    ],
    puts: [{ strike: 120, openInterest: 30 }],
  };

  it("computes normally when no floor is given", () => {
    expect(computeMaxPain(thinChain.calls, thinChain.puts)).not.toBeNull();
  });

  it("returns null when the chain is below the floor", () => {
    // 120 contracts total. Max pain on a chain this thin is driven by a
    // handful of positions and can land far from spot, so reporting nothing
    // beats reporting a confident number that means nothing.
    expect(computeMaxPain(thinChain.calls, thinChain.puts, 1000)).toBeNull();
  });

  it("computes once the chain clears the floor", () => {
    const liquid = {
      calls: [
        { strike: 100, openInterest: 6000 },
        { strike: 110, openInterest: 500 },
      ],
      puts: [{ strike: 100, openInterest: 6000 }],
    };
    expect(computeMaxPain(liquid.calls, liquid.puts, 1000)).toBe(100);
  });
});
