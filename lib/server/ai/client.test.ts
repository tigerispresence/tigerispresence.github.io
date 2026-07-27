import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { configuredProviderName, isAiConfigured } from "./client";

const ORIGINAL = { ...process.env };

function setEnv(env: Record<string, string | undefined>) {
  delete process.env.GEMINI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.AI_PROVIDER;
  for (const [k, v] of Object.entries(env)) {
    if (v !== undefined) process.env[k] = v;
  }
}

beforeEach(() => setEnv({}));
afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("configuredProviderName", () => {
  it("returns null when no key is set", () => {
    expect(configuredProviderName()).toBeNull();
    expect(isAiConfigured()).toBe(false);
  });

  it("selects gemini when only a Gemini key is set", () => {
    setEnv({ GEMINI_API_KEY: "g" });
    expect(configuredProviderName()).toBe("gemini");
  });

  it("selects claude when only an Anthropic key is set", () => {
    setEnv({ ANTHROPIC_API_KEY: "a" });
    expect(configuredProviderName()).toBe("claude");
  });

  it("prefers gemini when both keys are present", () => {
    setEnv({ GEMINI_API_KEY: "g", ANTHROPIC_API_KEY: "a" });
    expect(configuredProviderName()).toBe("gemini");
  });

  it("honours an explicit AI_PROVIDER override", () => {
    setEnv({ GEMINI_API_KEY: "g", ANTHROPIC_API_KEY: "a", AI_PROVIDER: "claude" });
    expect(configuredProviderName()).toBe("claude");
  });

  it("returns null when the forced provider has no key", () => {
    // Better to degrade than to silently use the other provider, which would
    // send prompts somewhere the operator did not choose.
    setEnv({ GEMINI_API_KEY: "g", AI_PROVIDER: "claude" });
    expect(configuredProviderName()).toBeNull();
  });

  it("ignores case and whitespace in AI_PROVIDER", () => {
    setEnv({ GEMINI_API_KEY: "g", AI_PROVIDER: "  GEMINI  " });
    expect(configuredProviderName()).toBe("gemini");
  });
});
