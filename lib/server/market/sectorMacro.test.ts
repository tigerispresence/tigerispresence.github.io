import { describe, expect, it } from "vitest";
import { toMonthlyPrices } from "./sectorMacro";
import { parseFredCsv } from "@/lib/server/fred/series";

describe("parseFredCsv", () => {
  it("drops missing observations instead of reading them as zero", () => {
    const csv = [
      "observation_date,CPIAUCSL",
      "2025-09-01,324.245",
      "2025-10-01,",
      "2025-11-01,.",
      "2025-12-01,326.031",
    ].join("\n");
    expect(parseFredCsv(csv)).toEqual([
      { date: "2025-09-01", value: 324.245 },
      { date: "2025-12-01", value: 326.031 },
    ]);
  });
});

describe("toMonthlyPrices", () => {
  const now = new Date("2026-10-24T01:00:00Z");

  it("keeps completed months only, preferring the adjusted close", () => {
    const rows = [
      { date: new Date("2026-08-01T04:00:00Z"), close: 40, adjClose: 39 },
      { date: new Date("2026-09-01T04:00:00Z"), close: 41, adjClose: 40.5 },
      // Yahoo's in-progress month and its extra row for today's quote.
      { date: new Date("2026-10-01T04:00:00Z"), close: 42.87, adjClose: 42.87 },
      { date: new Date("2026-10-23T20:00:00Z"), close: 42.56, adjClose: 42.56 },
    ];
    expect([...toMonthlyPrices(rows, now)]).toEqual([["2026-08", 39], ["2026-09", 40.5]]);
  });

  it("falls back to the close when there is no adjusted close", () => {
    const rows = [{ date: new Date("2026-09-01T04:00:00Z"), close: 41 }];
    expect(toMonthlyPrices(rows, now).get("2026-09")).toBe(41);
  });
});
