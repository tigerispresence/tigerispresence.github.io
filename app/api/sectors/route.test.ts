import { describe, expect, it, vi } from "vitest";

// Cached functions need Next's runtime; stub the seam so the handler runs under Vitest.
vi.mock("@/lib/server/cache/sectors", () => ({
  cachedSectorData: vi.fn(),
}));
import { GET } from "./route";
import { cachedSectorData } from "@/lib/server/cache/sectors";

const mockCached = vi.mocked(cachedSectorData);

describe("GET /api/sectors", () => {
  it("returns the payload with a CDN cache header", async () => {
    mockCached.mockResolvedValue({
      benchmark: { symbol: "SPY", price: 760, returns: {} as never },
      sectors: [],
      asOf: "2026-10-23T13:30:00.000Z",
    });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=300");
  });

  it("returns an uncached 503 when upstream is unavailable", async () => {
    mockCached.mockRejectedValue(new Error("Sector data unavailable upstream"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET();
    expect(res.status).toBe(503);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});
