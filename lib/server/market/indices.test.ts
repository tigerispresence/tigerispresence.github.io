import { beforeEach, describe, expect, it, vi } from "vitest";

// Stub the network seams so these tests never reach Yahoo or CNN.
vi.mock("@/lib/server/yahoo/client", () => ({
  yahooFinance: { quote: vi.fn() },
}));
vi.mock("@/lib/server/cnn/fearGreed", () => ({
  getFearGreedCurrent: vi.fn(),
}));
import { getMarketData } from "./indices";
import { yahooFinance } from "@/lib/server/yahoo/client";
import { getFearGreedCurrent } from "@/lib/server/cnn/fearGreed";

const mockQuote = vi.mocked(yahooFinance.quote);

const quote = (symbol: string, price: number, time: string) => ({
  symbol,
  regularMarketPrice: price,
  regularMarketChangePercent: -0.13,
  regularMarketTime: new Date(time),
});

describe("getMarketData", () => {
  beforeEach(() => {
    vi.mocked(getFearGreedCurrent).mockResolvedValue(null);
  });

  it.each(["KRW=X", "USDKRW=X"])(
    "reads USD/KRW when Yahoo returns it as %s",
    async (symbol) => {
      mockQuote.mockResolvedValue([
        quote(symbol, 1323.66, "2026-10-23T21:29:05Z"),
      ]);
      const { indices } = await getMarketData();
      expect(indices.usdkrw.current).toBe(1323.66);
    },
  );

  it("dates each reading by its last trade, not the fetch time", async () => {
    mockQuote.mockResolvedValue([quote("^GSPC", 7623.68, "2026-10-23T20:38:20Z")]);
    const { indices } = await getMarketData();
    expect(indices.sp500.date).toBe("2026-10-23T20:38:20.000Z");
  });

  it("returns zeros when the batch quote fails", async () => {
    mockQuote.mockRejectedValue(new Error("upstream down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { indices } = await getMarketData();
    expect(indices.usdkrw).toEqual({ current: 0, changePercent: 0, date: null });
  });
});
