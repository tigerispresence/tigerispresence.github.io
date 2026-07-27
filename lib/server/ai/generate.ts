import { z } from "zod";
import { getProvider } from "./client";
import type { AiResult } from "./provider";

export type { AiResult, AiFailureReason } from "./provider";

export interface GenerateOptions<S extends z.ZodType> {
  schema: S;
  prompt: string;
  system?: string;
  /** Ground the answer in live web results before extracting structured data. */
  webSearch?: { maxUses?: number };
  maxTokens?: number;
  effort?: "low" | "medium" | "high";
}

/**
 * Generate schema-validated JSON, whichever provider is configured.
 *
 * Returns a discriminated result rather than throwing: every call site has a
 * deterministic fallback, so an AI outage should degrade one panel rather than
 * fail the request.
 *
 * Web search runs as a separate call from extraction on both providers.
 * Structured output and grounded search pull against each other — Claude's
 * structured outputs are incompatible with the citations its search tool
 * attaches, and Gemini's JSON mode conflicts with the googleSearch tool. One
 * call gathers, the next shapes.
 */
export async function generateStructured<S extends z.ZodType>(
  options: GenerateOptions<S>,
): Promise<AiResult<z.infer<S>>> {
  const provider = getProvider();
  if (!provider) {
    return {
      ok: false,
      reason: "not_configured",
      message: "Set GEMINI_API_KEY or ANTHROPIC_API_KEY",
    };
  }

  const maxTokens = options.maxTokens ?? 4096;
  const effort = options.effort ?? "low";

  let prompt = options.prompt;

  if (options.webSearch) {
    const findings = await provider.searchWeb({
      prompt: options.prompt,
      system: options.system,
      maxUses: options.webSearch.maxUses ?? 5,
      maxTokens: Math.max(maxTokens, 8192),
    });
    // Search is best-effort: without findings the model still answers from
    // its own knowledge, which beats failing the panel outright.
    if (findings.ok && findings.data.trim()) {
      prompt = `${options.prompt}\n\nResearch findings:\n${findings.data}`;
    }
  }

  const jsonSchema = z.toJSONSchema(options.schema) as Record<string, unknown>;

  const raw = await provider.generateJson({
    prompt,
    system: options.system,
    jsonSchema,
    maxTokens,
    effort,
  });
  if (!raw.ok) return raw;

  // Zod is the contract, not the provider's own validation: it is the only
  // check that holds identically across providers.
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.data);
  } catch {
    return {
      ok: false,
      reason: "invalid",
      message: "Response was not valid JSON",
    };
  }

  const result = options.schema.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false,
      reason: "invalid",
      message: `Response did not match schema: ${result.error.message.slice(0, 200)}`,
    };
  }

  return { ok: true, data: result.data };
}
