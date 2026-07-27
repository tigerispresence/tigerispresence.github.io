import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

// vi.mock is hoisted above module-level consts, so the spies have to be
// created inside vi.hoisted to exist by the time the factory runs.
const { parse, create } = vi.hoisted(() => ({
  parse: vi.fn(),
  create: vi.fn(),
}));

// Mock the SDK so these tests never open a socket and need no API key.
vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error {}
  class RateLimitError extends APIError {}
  class AuthenticationError extends APIError {}
  class PermissionDeniedError extends APIError {}
  class APIConnectionError extends APIError {}
  class APIConnectionTimeoutError extends APIConnectionError {}

  const Anthropic = class {
    messages = { parse, create };
    static APIError = APIError;
    static RateLimitError = RateLimitError;
    static AuthenticationError = AuthenticationError;
    static PermissionDeniedError = PermissionDeniedError;
    static APIConnectionError = APIConnectionError;
    static APIConnectionTimeoutError = APIConnectionTimeoutError;
  };
  return { default: Anthropic };
});

vi.mock("@anthropic-ai/sdk/helpers/zod", () => ({
  zodOutputFormat: (schema: unknown) => ({ type: "json_schema", schema }),
}));

import Anthropic from "@anthropic-ai/sdk";
import { generateStructured } from "./generate";

const Schema = z.object({ answer: z.string() });

/**
 * Build an SDK error instance without invoking its constructor.
 *
 * The real constructors take (status, error, message, headers); we only care
 * that `instanceof` matches so classifyAiError picks the right branch.
 */
function sdkError<T>(Ctor: abstract new (...args: never[]) => T, message: string): T {
  const error = Object.create(Ctor.prototype) as T & { message: string };
  error.message = message;
  return error;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ANTHROPIC_API_KEY = "test-key";
});

describe("generateStructured", () => {
  it("returns parsed data on success", async () => {
    parse.mockResolvedValue({
      stop_reason: "end_turn",
      parsed_output: { answer: "42" },
    });

    const result = await generateStructured({ schema: Schema, prompt: "q" });
    expect(result).toEqual({ ok: true, data: { answer: "42" } });
  });

  it("reports a missing API key without calling the SDK", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const result = await generateStructured({ schema: Schema, prompt: "q" });

    expect(result).toMatchObject({ ok: false, reason: "not_configured" });
    expect(parse).not.toHaveBeenCalled();
  });

  it("distinguishes a refusal from a schema mismatch", async () => {
    // Both leave parsed_output null; conflating them makes the failure
    // impossible to diagnose from logs.
    parse.mockResolvedValue({
      stop_reason: "refusal",
      stop_details: { explanation: "declined" },
      parsed_output: null,
    });

    const result = await generateStructured({ schema: Schema, prompt: "q" });
    expect(result).toMatchObject({ ok: false, reason: "refusal", message: "declined" });
  });

  it("reports truncation distinctly from a schema mismatch", async () => {
    parse.mockResolvedValue({ stop_reason: "max_tokens", parsed_output: null });

    const result = await generateStructured({ schema: Schema, prompt: "q" });
    expect(result).toMatchObject({ ok: false, reason: "invalid" });
    expect((result as { message: string }).message).toMatch(/truncat/i);
  });

  it("reports a schema mismatch when parsing yields nothing", async () => {
    parse.mockResolvedValue({ stop_reason: "end_turn", parsed_output: null });

    const result = await generateStructured({ schema: Schema, prompt: "q" });
    expect(result).toMatchObject({ ok: false, reason: "invalid" });
  });

  it("classifies rate limits", async () => {
    parse.mockRejectedValue(sdkError(Anthropic.RateLimitError, "429"));
    const result = await generateStructured({ schema: Schema, prompt: "q" });
    expect(result).toMatchObject({ ok: false, reason: "rate_limit" });
  });

  it("classifies timeouts", async () => {
    parse.mockRejectedValue(sdkError(Anthropic.APIConnectionTimeoutError, "timeout"));
    const result = await generateStructured({ schema: Schema, prompt: "q" });
    expect(result).toMatchObject({ ok: false, reason: "timeout" });
  });

  it("classifies auth failures as unavailable rather than throwing", async () => {
    parse.mockRejectedValue(sdkError(Anthropic.AuthenticationError, "401"));
    const result = await generateStructured({ schema: Schema, prompt: "q" });
    expect(result).toMatchObject({ ok: false, reason: "unavailable" });
  });

  it("never throws, even on an unrecognised error", async () => {
    parse.mockRejectedValue(new Error("something odd"));
    await expect(
      generateStructured({ schema: Schema, prompt: "q" }),
    ).resolves.toMatchObject({ ok: false });
  });

  it("runs web search as a separate step before extraction", async () => {
    // Structured outputs and citations are mutually exclusive, and the search
    // tool attaches citations, so the two must not share a call.
    create.mockResolvedValue({
      content: [{ type: "text", text: "found this" }],
    });
    parse.mockResolvedValue({
      stop_reason: "end_turn",
      parsed_output: { answer: "ok" },
    });

    const result = await generateStructured({
      schema: Schema,
      prompt: "what happened",
      webSearch: { maxUses: 3 },
    });

    expect(result).toMatchObject({ ok: true });
    expect(create).toHaveBeenCalledTimes(1);

    const searchCall = create.mock.calls[0][0];
    expect(searchCall.tools[0].type).toBe("web_search_20260209");
    expect(searchCall.tools[0].max_uses).toBe(3);

    // The extraction call must carry no tools at all.
    const parseCall = parse.mock.calls[0][0];
    expect(parseCall.tools).toBeUndefined();
    expect(parseCall.messages[0].content).toContain("found this");
  });

  it("skips web search when not requested", async () => {
    parse.mockResolvedValue({
      stop_reason: "end_turn",
      parsed_output: { answer: "ok" },
    });
    await generateStructured({ schema: Schema, prompt: "q" });
    expect(create).not.toHaveBeenCalled();
  });

  it("uses claude-opus-5 and a token budget covering thinking", async () => {
    parse.mockResolvedValue({
      stop_reason: "end_turn",
      parsed_output: { answer: "ok" },
    });
    await generateStructured({ schema: Schema, prompt: "q" });

    const call = parse.mock.calls[0][0];
    expect(call.model).toBe("claude-opus-5");
    // Opus 5 reasons by default and max_tokens covers thinking plus output.
    expect(call.max_tokens).toBeGreaterThanOrEqual(2048);
    expect(call.output_config.effort).toBe("low");
  });
});
