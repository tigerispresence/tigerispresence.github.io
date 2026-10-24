import { describe, expect, it } from "vitest";
import {
  currentRegime,
  latestDaily,
  monthEnd,
  monthlyReturns,
  rateSensitivity,
  regimeAt,
  regimeStats,
  regression,
  shiftMonth,
  yoy,
  type MonthSeries,
} from "./macro";
import type { MacroRegime } from "@/lib/types/macro";

/** Consecutive months starting at `start`, valued by `f(i)`. */
function months(start: string, n: number, f: (i: number) => number): MonthSeries {
  return new Map(Array.from({ length: n }, (_, i) => [shiftMonth(start, i), f(i)]));
}

describe("shiftMonth", () => {
  it("crosses year boundaries both ways", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2025-11", 3)).toBe("2026-02");
    expect(shiftMonth("2026-10", -12)).toBe("2025-10");
  });
});

describe("yoy", () => {
  it("compares with twelve months earlier", () => {
    const cpi = months("2024-01", 24, (i) => 100 * 1.03 ** (i / 12));
    expect(yoy(cpi).get("2025-06")).toBeCloseTo(0.03);
  });

  it("skips months whose base or own print is missing", () => {
    // October 2025 CPI was never published.
    const cpi = months("2024-01", 34, () => 100);
    cpi.delete("2025-10");
    const out = yoy(cpi);
    expect(out.has("2025-10")).toBe(false);
    expect(out.has("2026-10")).toBe(false);
    expect(out.has("2026-09")).toBe(true);
  });
});

describe("monthEnd and monthlyReturns", () => {
  it("takes the last daily value of each month", () => {
    const daily = [
      { date: "2026-08-28", value: 4.1 },
      { date: "2026-08-31", value: 4.2 },
      { date: "2026-09-30", value: 4.5 },
    ];
    expect([...monthEnd(daily)]).toEqual([["2026-08", 4.2], ["2026-09", 4.5]]);
  });

  it("needs the previous month to compute a return", () => {
    const prices = new Map([["2026-01", 100], ["2026-02", 110], ["2026-04", 121]]);
    const r = monthlyReturns(prices);
    expect(r.get("2026-02")).toBeCloseTo(0.1);
    expect(r.has("2026-04")).toBe(false);
  });
});

describe("regimeAt", () => {
  it("uses only data published before the month starts", () => {
    // Inflation rose from month −5 to −2; yields fell from −4 to −1.
    const cpi = new Map([["2026-01", 0.02], ["2026-04", 0.03]]);
    const yields = new Map([["2026-02", 4.5], ["2026-05", 4.0]]);
    expect(regimeAt("2026-06", cpi, yields)).toBe("rising-falling");
  });

  it("ignores same-month data an investor would not yet have", () => {
    const cpi = new Map([["2026-01", 0.02], ["2026-04", 0.03], ["2026-06", 0.01]]);
    const yields = new Map([["2026-02", 4.5], ["2026-05", 4.0], ["2026-06", 9.9]]);
    expect(regimeAt("2026-06", cpi, yields)).toBe("rising-falling");
  });

  it("returns null when an input month is missing", () => {
    expect(regimeAt("2026-06", new Map(), new Map())).toBeNull();
  });
});

describe("currentRegime", () => {
  it("reads both trends off the three-month change", () => {
    expect(
      currentRegime(
        { value: 0.037, previous: 0.035, date: "2026-09" },
        { value: 4.5, previous: 4.9, date: "2026-10-22" },
      ),
    ).toEqual({ key: "rising-falling", inflation: "rising", rates: "falling" });
  });

  it("is unknown without a prior reading", () => {
    expect(currentRegime({ value: 0.03, previous: null, date: "2026-09" }, null)).toBeNull();
  });
});

describe("latestDaily", () => {
  it("pairs the latest value with the last one at least three months older", () => {
    const daily = [
      { date: "2026-07-20", value: 4.6 },
      { date: "2026-07-22", value: 4.7 },
      { date: "2026-07-23", value: 4.8 },
      { date: "2026-10-22", value: 5.0 },
    ];
    expect(latestDaily(daily)).toEqual({ value: 5.0, previous: 4.7, date: "2026-10-22" });
  });
});

describe("regimeStats", () => {
  it("averages excess return per regime and counts the months", () => {
    const sector = new Map([["2026-01", 0.03], ["2026-02", 0.01], ["2026-03", -0.02]]);
    const bench = new Map([["2026-01", 0.01], ["2026-02", 0.01], ["2026-03", 0.0]]);
    const regimes = new Map<string, MacroRegime>([
      ["2026-01", "rising-rising"],
      ["2026-02", "rising-rising"],
      ["2026-03", "falling-falling"],
    ]);
    const stats = regimeStats(sector, bench, regimes);
    expect(stats["rising-rising"]!.avgExcess).toBeCloseTo(0.01);
    expect(stats["rising-rising"]).toMatchObject({ hitRate: 0.5, months: 2 });
    expect(stats["falling-falling"]!.avgExcess).toBeCloseTo(-0.02);
    expect(stats["falling-falling"]).toMatchObject({ months: 1, tStat: null });
    expect(stats["rising-falling"]).toBeNull();
  });

  it("gives a large t-statistic only to a consistent edge", () => {
    const n = 60;
    const bench = months("2020-01", n, () => 0);
    const regimes = new Map([...bench.keys()].map((m) => [m, "rising-rising" as MacroRegime]));
    const steady = months("2020-01", n, (i) => 0.01 + (i % 2 ? 0.002 : -0.002));
    const noisy = months("2020-01", n, (i) => 0.001 + (i % 2 ? 0.05 : -0.05));
    expect(regimeStats(steady, bench, regimes)["rising-rising"]!.tStat!).toBeGreaterThan(2);
    expect(Math.abs(regimeStats(noisy, bench, regimes)["rising-rising"]!.tStat!)).toBeLessThan(2);
  });
});

describe("regression and rateSensitivity", () => {
  it("recovers a known slope", () => {
    const x = Array.from({ length: 24 }, (_, i) => i);
    const fit = regression(x, x.map((v) => 2 * v + 1))!;
    expect(fit.beta).toBeCloseTo(2);
    expect(fit.r).toBeCloseTo(1);
  });

  it("refuses too few points", () => {
    expect(regression([1, 2, 3], [1, 2, 3])).toBeNull();
  });

  it("measures excess return per +1pp move in the yield", () => {
    // Yields alternate ±0.25pp; the sector loses 1.5% vs the benchmark per +0.25pp.
    const yields = months("2020-01", 40, (i) => 4 + (i % 2) * 0.25);
    const bench = months("2020-01", 40, () => 0.01);
    const sector = months("2020-01", 40, (i) => 0.01 + (i % 2 ? -0.015 : 0.015));
    const { beta, months: n } = rateSensitivity(sector, bench, yields);
    expect(beta).toBeCloseTo(-0.06);
    expect(n).toBe(39);
  });
});
