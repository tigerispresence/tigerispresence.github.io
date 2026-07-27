import { beforeEach, describe, expect, it, vi } from "vitest";

// The route pulls in the whole server layer; stub the network-touching seams so
// these tests never reach Yahoo, CNN or the AI provider.
vi.mock("@/lib/server/stock/resolveSymbol", () => ({
  resolveSymbol: vi.fn(),
}));
vi.mock("@/lib/server/stock/getStockPayload", () => ({
  getStockPayload: vi.fn(),
}));
import { GET } from "./route";
import { resolveSymbol } from "@/lib/server/stock/resolveSymbol";
import { getStockPayload } from "@/lib/server/stock/getStockPayload";

const mockResolve = vi.mocked(resolveSymbol);
const mockPayload = vi.mocked(getStockPayload);

/** Invoke the handler the way Next would, with params as a promise. */
function get(
  symbol: string,
  query: Record<string, string> = {},
): Promise<Response> {
  const params = new URLSearchParams(query);
  const req = new Request(
    `http://localhost/api/stock/${encodeURIComponent(symbol)}?${params}`,
  );
  return GET(req, { params: Promise.resolve({ symbol }) });
}

const samplePayload = {
  symbol: "AAPL",
  name: "Apple Inc.",
  currentPrice: 190,
  currency: "USD",
  change: 1,
  changePercent: 0.5,
  history: [{ date: "2024-01-02T00:00:00.000Z", close: 190 }],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/stock", () => {
  it("returns 400 when the query is missing", async () => {
    const res = await get("");
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: expect.any(String) });
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it("returns 400 for a whitespace-only symbol", async () => {
    const res = await get("   ");
    expect(res.status).toBe(400);
  });

  it("returns 404 when the symbol cannot be resolved", async () => {
    mockResolve.mockResolvedValue(null);
    const res = await get("not a real company");
    expect(res.status).toBe(404);
  });

  it("returns the assembled payload on success", async () => {
    mockResolve.mockResolvedValue({ symbol: "AAPL", name: "Apple Inc.", source: "yahoo" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockPayload.mockResolvedValue(samplePayload as any);

    const res = await get("AAPL", { range: "1y" });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ symbol: "AAPL", currentPrice: 190 });
  });

  it("passes the range and from date through to the assembler", async () => {
    mockResolve.mockResolvedValue({ symbol: "AAPL", name: "Apple Inc.", source: "yahoo" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockPayload.mockResolvedValue(samplePayload as any);

    await get("AAPL", { range: "5y", from: "2020-01-01" });
    expect(mockPayload).toHaveBeenCalledWith(
      expect.objectContaining({ symbol: "AAPL" }),
      "5y",
      "2020-01-01",
    );
  });

  it("defaults to a one year range", async () => {
    mockResolve.mockResolvedValue({ symbol: "AAPL", name: "Apple Inc.", source: "yahoo" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockPayload.mockResolvedValue(samplePayload as any);

    await get("AAPL");
    expect(mockPayload).toHaveBeenCalledWith(expect.anything(), "1y", undefined);
  });

  it("surfaces upstream rate limits as 429", async () => {
    mockResolve.mockResolvedValue({ symbol: "AAPL", name: "Apple Inc.", source: "yahoo" });
    mockPayload.mockRejectedValue(new Error("Request failed with status 429"));

    const res = await get("AAPL");
    expect(res.status).toBe(429);
  });

  it("returns 500 for unexpected failures", async () => {
    mockResolve.mockResolvedValue({ symbol: "AAPL", name: "Apple Inc.", source: "yahoo" });
    mockPayload.mockRejectedValue(new Error("kaboom"));

    const res = await get("AAPL");
    expect(res.status).toBe(500);
  });

  it("returns 400 for an unsupported range", async () => {
    const res = await get("AAPL", { range: "7y" });
    expect(res.status).toBe(400);
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it("marks error responses no-store so the CDN cannot cache a failure", async () => {
    mockResolve.mockResolvedValue(null);
    const res = await get("nope");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("sets a CDN cache header on success", async () => {
    mockResolve.mockResolvedValue({ symbol: "AAPL", name: "Apple Inc.", source: "yahoo" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockPayload.mockResolvedValue(samplePayload as any);
    const res = await get("AAPL");
    expect(res.headers.get("cache-control")).toContain("s-maxage=300");
  });
});
