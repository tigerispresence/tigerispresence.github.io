import { describe, expect, it } from "vitest";
import { downsample } from "./downsample";

describe("downsample", () => {
  it("returns the same reference when already within the limit", () => {
    const data = [1, 2, 3];
    expect(downsample(data, 10)).toBe(data);
    expect(downsample(data, 3)).toBe(data);
  });

  it("never exceeds the limit", () => {
    const data = Array.from({ length: 5000 }, (_, i) => i);
    expect(downsample(data, 500).length).toBeLessThanOrEqual(500);
  });

  it("preserves the first element", () => {
    const data = Array.from({ length: 1000 }, (_, i) => i);
    expect(downsample(data, 100)[0]).toBe(0);
  });

  it("keeps ascending order", () => {
    const data = Array.from({ length: 1000 }, (_, i) => i);
    const out = downsample(data, 100) as number[];
    expect([...out].sort((a, b) => a - b)).toEqual(out);
  });

  it("handles an empty array", () => {
    expect(downsample([], 10)).toEqual([]);
  });
});
