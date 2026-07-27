import { describe, expect, it } from "vitest";
import { toDividends, toPricePoints } from "./normalize";

describe("toPricePoints", () => {
  it("drops rows with a null or undefined close", () => {
    // Yahoo emits these for the in-progress session and for halted days.
    const out = toPricePoints([
      { date: new Date("2024-01-02"), close: 185 },
      { date: new Date("2024-01-03"), close: null },
      { date: new Date("2024-01-04"), close: undefined as unknown as null },
      { date: new Date("2024-01-05"), close: 195 },
    ]);
    expect(out).toHaveLength(2);
    expect(out.map((p) => p.close)).toEqual([185, 195]);
  });

  it("emits ISO strings so entries are cache-serializable", () => {
    const out = toPricePoints([{ date: new Date("2024-01-02"), close: 1 }]);
    expect(typeof out[0].date).toBe("string");
    expect(out[0].date).toMatch(/^2024-01-02T/);
  });

  it("handles an empty input", () => {
    expect(toPricePoints([])).toEqual([]);
  });
});

describe("toDividends", () => {
  it("maps the dividends field to an amount", () => {
    const out = toDividends([
      { date: new Date("2024-02-15"), close: null, dividends: 0.24 },
    ]);
    expect(out).toEqual([{ date: expect.stringMatching(/^2024-02-15T/), amount: 0.24 }]);
  });

  it("defaults a missing amount to zero rather than undefined", () => {
    const out = toDividends([{ date: new Date("2024-02-15"), close: null }]);
    expect(out[0].amount).toBe(0);
  });
});
