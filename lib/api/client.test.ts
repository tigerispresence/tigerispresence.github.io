import { afterEach, describe, expect, it, vi } from "vitest";
import { AskError, askClaude, type AskStreamEvent } from "./client";

/** A fetch Response whose body arrives in the given chunks. */
function streamed(chunks: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const c of chunks) controller.enqueue(encoder.encode(c));
        controller.close();
      },
    }),
    { status: 200 },
  );
}

const request = { question: "Why?", context: { kind: "sectors" as const }, history: [] };

describe("askClaude", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reassembles events split across network chunks", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      streamed(['{"type":"text","te', 'xt":"Energy "}\n{"type":"text","text":"leads."}\n{"type":"do', 'ne"}']),
    ));
    const events: AskStreamEvent[] = [];
    await askClaude(request, (e) => events.push(e));
    expect(events).toEqual([
      { type: "text", text: "Energy " },
      { type: "text", text: "leads." },
      { type: "done" },
    ]);
  });

  it("sends the access code and surfaces the server's error code", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Access code required.", code: "access_code" }), { status: 401 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const err = await askClaude(request, () => {}, { accessCode: "abc" }).catch((e) => e);
    expect(err).toBeInstanceOf(AskError);
    expect(err.code).toBe("access_code");
    expect(fetchMock.mock.calls[0][1].headers["x-ask-code"]).toBe("abc");
  });
});
