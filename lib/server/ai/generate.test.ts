import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

// Stub the provider seam so no SDK is constructed and no socket is opened.
const { generateJson, searchWeb, getProvider } = vi.hoisted(() => ({
  generateJson: vi.fn(),
  searchWeb: vi.fn(),
  getProvider: vi.fn(),
}));

vi.mock("./client", () => ({
  getProvider,
  isAiConfigured: () => getProvider() !== null,
  configuredProviderName: () => (getProvider() ? "gemini" : null),
}));

import { generateStructured } from "./generate";

const Schema = z.object({ answer: z.string() });

const provider = { name: "gemini" as const, generateJson, searchWeb };

beforeEach(() => {
  vi.clearAllMocks();
  getProvider.mockReturnValue(provider);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("generateStructured", () => {
  it("returns validated data on success", async () => {
    generateJson.mockResolvedValue({ ok: true, data: '{"answer":"42"}' });

    const result = await generateStructured({ schema: Schema, prompt: "q" });
    expect(result).toEqual({ ok: true, data: { answer: "42" } });
  });

  it("reports a missing key without calling a provider", async () => {
    getProvider.mockReturnValue(null);

    const result = await generateStructured({ schema: Schema, prompt: "q" });
    expect(result).toMatchObject({ ok: false, reason: "not_configured" });
    expect(generateJson).not.toHaveBeenCalled();
  });

  it("rejects output that is not valid JSON", async () => {
    generateJson.mockResolvedValue({ ok: true, data: "sorry, I can't do that" });

    const result = await generateStructured({ schema: Schema, prompt: "q" });
    expect(result).toMatchObject({ ok: false, reason: "invalid" });
  });

  it("rejects JSON that does not match the schema", async () => {
    // Zod is the contract: it is the only validation identical across providers.
    generateJson.mockResolvedValue({ ok: true, data: '{"wrong":"shape"}' });

    const result = await generateStructured({ schema: Schema, prompt: "q" });
    expect(result).toMatchObject({ ok: false, reason: "invalid" });
  });

  it("propagates a provider failure reason unchanged", async () => {
    for (const reason of ["rate_limit", "timeout", "refusal", "unavailable"] as const) {
      generateJson.mockResolvedValue({ ok: false, reason, message: "x" });
      const result = await generateStructured({ schema: Schema, prompt: "q" });
      expect(result).toMatchObject({ ok: false, reason });
    }
  });

  it("passes the derived JSON schema to the provider", async () => {
    generateJson.mockResolvedValue({ ok: true, data: '{"answer":"ok"}' });
    await generateStructured({ schema: Schema, prompt: "q" });

    const call = generateJson.mock.calls[0][0];
    expect(call.jsonSchema).toMatchObject({
      type: "object",
      properties: { answer: { type: "string" } },
    });
  });

  it("runs web search as a separate call and feeds findings forward", async () => {
    searchWeb.mockResolvedValue({ ok: true, data: "found this" });
    generateJson.mockResolvedValue({ ok: true, data: '{"answer":"ok"}' });

    const result = await generateStructured({
      schema: Schema,
      prompt: "what happened",
      webSearch: { maxUses: 3 },
    });

    expect(result).toMatchObject({ ok: true });
    expect(searchWeb).toHaveBeenCalledTimes(1);
    expect(searchWeb.mock.calls[0][0].maxUses).toBe(3);
    expect(generateJson.mock.calls[0][0].prompt).toContain("found this");
  });

  it("still answers when web search fails", async () => {
    // Search is best-effort: the model can answer from its own knowledge, and
    // failing the whole panel because grounding was unavailable is worse.
    searchWeb.mockResolvedValue({ ok: false, reason: "rate_limit", message: "429" });
    generateJson.mockResolvedValue({ ok: true, data: '{"answer":"ok"}' });

    const result = await generateStructured({
      schema: Schema,
      prompt: "q",
      webSearch: {},
    });

    expect(result).toMatchObject({ ok: true });
    expect(generateJson).toHaveBeenCalled();
  });

  it("skips web search when not requested", async () => {
    generateJson.mockResolvedValue({ ok: true, data: '{"answer":"ok"}' });
    await generateStructured({ schema: Schema, prompt: "q" });
    expect(searchWeb).not.toHaveBeenCalled();
  });

  it("gives web search a larger token budget than extraction", async () => {
    searchWeb.mockResolvedValue({ ok: true, data: "notes" });
    generateJson.mockResolvedValue({ ok: true, data: '{"answer":"ok"}' });

    await generateStructured({
      schema: Schema,
      prompt: "q",
      webSearch: {},
      maxTokens: 2048,
    });
    // Search results plus reasoning consume far more than the JSON itself.
    expect(searchWeb.mock.calls[0][0].maxTokens).toBeGreaterThanOrEqual(8192);
  });
});
