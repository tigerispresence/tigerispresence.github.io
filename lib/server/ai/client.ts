import Anthropic from "@anthropic-ai/sdk";

/**
 * Anthropic client.
 *
 * The key is read from ANTHROPIC_API_KEY by the SDK. It is deliberately NOT
 * prefixed NEXT_PUBLIC_ — that prefix inlines a value into the browser bundle,
 * which is how the previous Gemini key ended up publicly readable.
 */
export const anthropic = new Anthropic({
  maxRetries: 2,
  timeout: 45_000,
});

export const AI_MODEL = "claude-opus-5";

/** True when a key is configured; call sites degrade instead of throwing. */
export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
