import { describe, expect, it } from "vitest";
import { SMA_LINES } from "./smaConfig";
import { SMA_PERIODS } from "@/lib/calc/series";

describe("SMA_LINES", () => {
  it("is ordered shortest to longest period", () => {
    // The toggle chips render straight from this array, so the array order is
    // the on-screen order. Recharts' own legend does not preserve it, which is
    // why the chips replaced it.
    const periods = SMA_LINES.map((l) => Number(l.key.replace("sma", "")));
    expect(periods).toEqual([5, 10, 20, 60, 120]);
    expect([...periods].sort((a, b) => a - b)).toEqual(periods);
  });

  it("covers exactly the periods computeSeries produces", () => {
    const configured = SMA_LINES.map((l) => Number(l.key.replace("sma", "")));
    expect(configured).toEqual([...SMA_PERIODS]);
  });

  it("labels match their period", () => {
    for (const line of SMA_LINES) {
      expect(line.label).toBe(`SMA ${line.key.replace("sma", "")}`);
    }
  });

  it("gives every line a distinct colour", () => {
    const colors = SMA_LINES.map((l) => l.color);
    expect(new Set(colors).size).toBe(colors.length);
  });

  it("draws longer averages at least as thick as shorter ones", () => {
    // Keeps the long-term trend readable with five lines on one chart.
    for (let i = 1; i < SMA_LINES.length; i++) {
      expect(SMA_LINES[i].width).toBeGreaterThanOrEqual(SMA_LINES[i - 1].width);
    }
  });
});
