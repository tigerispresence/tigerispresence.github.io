import { afterEach, describe, expect, it, vi } from "vitest";
import { FEAR_GREED_EARLIEST, getFearGreedHistory } from "./fearGreed";

const feed = (days: string[]) =>
  new Response(
    JSON.stringify({
      fear_and_greed_historical: {
        data: days.map((d) => ({ x: Date.parse(d), y: 40, rating: "fear" })),
      },
    }),
    { status: 200 },
  );

describe("getFearGreedHistory", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("requests the history from the given start date", async () => {
    const fetchMock = vi.fn().mockResolvedValue(feed(["2020-07-15", "2026-10-23"]));
    vi.stubGlobal("fetch", fetchMock);

    const history = await getFearGreedHistory(FEAR_GREED_EARLIEST);

    expect(fetchMock.mock.calls[0][0]).toMatch(/\/graphdata\/2020-07-15$/);
    expect(history?.map((p) => p.date.slice(0, 10))).toEqual(["2020-07-15", "2026-10-23"]);
  });

  it("falls back to the default one-year feed when the dated request fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("error", { status: 500 }))
      .mockResolvedValueOnce(feed(["2025-10-24"]));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});

    const history = await getFearGreedHistory(FEAR_GREED_EARLIEST);

    expect(fetchMock.mock.calls[1][0]).toMatch(/\/graphdata$/);
    expect(history).toHaveLength(1);
  });
});
