import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Stub every seam that would reach Claude, Yahoo or FRED.
vi.mock("@/lib/server/ask/claude", () => ({ streamAnswer: vi.fn() }));
vi.mock("@/lib/server/cache/sectors", () => ({ cachedSectorData: vi.fn() }));
vi.mock("@/lib/server/cache/sectorMacro", () => ({ cachedSectorMacroData: vi.fn() }));
vi.mock("@/lib/server/stock/resolveSymbol", () => ({ resolveSymbol: vi.fn() }));
vi.mock("@/lib/server/stock/getStockPayload", () => ({ getStockPayload: vi.fn() }));
import { POST } from "./route";
import { streamAnswer } from "@/lib/server/ask/claude";
import { cachedSectorData } from "@/lib/server/cache/sectors";
import { cachedSectorMacroData } from "@/lib/server/cache/sectorMacro";
import { resetRateLimit } from "@/lib/server/ask/rateLimit";

const mockStream = vi.mocked(streamAnswer);

function post(body: unknown, headers: Record<string, string> = {}) {
  return POST(
    new Request("http://localhost/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "9.9.9.9", ...headers },
      body: JSON.stringify(body),
    }),
  );
}

const sectorsQuestion = { question: "Which sectors lead?", context: { kind: "sectors" } };

describe("POST /api/ask", () => {
  const env = { ...process.env };

  beforeEach(() => {
    resetRateLimit();
    process.env.ANTHROPIC_API_KEY = "test-key";
    delete process.env.ASK_ACCESS_CODE;
    vi.mocked(cachedSectorData).mockResolvedValue({
      benchmark: { symbol: "SPY", price: 760, returns: {} as never },
      sectors: [],
      asOf: "2026-10-23T13:30:00.000Z",
    });
    vi.mocked(cachedSectorMacroData).mockRejectedValue(new Error("FRED down"));
    mockStream.mockImplementation(async function* () {
      yield { type: "text", text: "Energy leads." };
      yield { type: "done" };
    });
  });

  afterEach(() => {
    process.env = { ...env };
  });

  it("is unavailable without an API key", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect((await post(sectorsQuestion)).status).toBe(503);
  });

  it("requires the access code when one is configured", async () => {
    process.env.ASK_ACCESS_CODE = "secret";
    expect((await post(sectorsQuestion)).status).toBe(401);
    expect((await post(sectorsQuestion, { "x-ask-code": "secret" })).status).toBe(200);
  });

  it("rejects history that does not alternate", async () => {
    const res = await post({ ...sectorsQuestion, history: [{ role: "assistant", content: "hi" }] });
    expect(res.status).toBe(400);
  });

  it("streams events and puts the data block on the first user turn only", async () => {
    const res = await post({
      ...sectorsQuestion,
      history: [
        { role: "user", content: "First question" },
        { role: "assistant", content: "First answer" },
      ],
    });
    expect(res.headers.get("Content-Type")).toContain("ndjson");
    const lines = (await res.text()).trim().split("\n").map((l) => JSON.parse(l));
    expect(lines).toEqual([{ type: "text", text: "Energy leads." }, { type: "done" }]);

    const messages = mockStream.mock.lastCall![1];
    expect(messages).toHaveLength(3);
    expect(messages[0].content).toMatch(/^<data subject="the 11 S&P 500 sectors">/);
    expect(messages[0].content).toContain("First question");
    expect(messages[2]).toEqual({ role: "user", content: "Which sectors lead?" });
  });

  it("rate-limits a visitor after repeated questions", async () => {
    for (let i = 0; i < 8; i++) await post(sectorsQuestion);
    expect((await post(sectorsQuestion)).status).toBe(429);
  });
});
