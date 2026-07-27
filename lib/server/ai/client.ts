import type { AiProvider } from "./provider";
import { createClaudeProvider } from "./providers/claude";
import { createGeminiProvider } from "./providers/gemini";

/**
 * Provider selection.
 *
 * Whichever key is present wins; GEMINI_API_KEY takes precedence when both are
 * set, and AI_PROVIDER forces one explicitly. Switching providers is therefore
 * an environment change, not a code change.
 *
 * Neither key may be prefixed NEXT_PUBLIC_ — that inlines the value into the
 * browser bundle, which is how the original Gemini key ended up public.
 */
export type ProviderName = "gemini" | "claude";

export function configuredProviderName(): ProviderName | null {
  const forced = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (forced === "gemini") return process.env.GEMINI_API_KEY ? "gemini" : null;
  if (forced === "claude") return process.env.ANTHROPIC_API_KEY ? "claude" : null;

  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.ANTHROPIC_API_KEY) return "claude";
  return null;
}

/**
 * Built per call rather than memoized at module load: reading the key lazily
 * keeps an unset environment from throwing at import time, which would take
 * down routes that never touch AI.
 */
export function getProvider(): AiProvider | null {
  switch (configuredProviderName()) {
    case "gemini":
      return createGeminiProvider(process.env.GEMINI_API_KEY!);
    case "claude":
      return createClaudeProvider(process.env.ANTHROPIC_API_KEY!);
    default:
      return null;
  }
}

export function isAiConfigured(): boolean {
  return configuredProviderName() !== null;
}
