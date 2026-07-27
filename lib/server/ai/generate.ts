import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { AI_MODEL, anthropic, isAiConfigured } from "./client";

export type AiFailureReason =
  | "not_configured"
  | "refusal"
  | "rate_limit"
  | "timeout"
  | "invalid"
  | "unavailable";

export type AiResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: AiFailureReason; message: string };

export interface GenerateOptions<S extends z.ZodType> {
  schema: S;
  prompt: string;
  system?: string;
  /** Ground the answer in live web results before extracting structured data. */
  webSearch?: { maxUses?: number };
  maxTokens?: number;
  effort?: "low" | "medium" | "high";
}

/** Map a thrown SDK error to a failure reason. */
export function classifyAiError(error: unknown): {
  reason: AiFailureReason;
  message: string;
} {
  const message = error instanceof Error ? error.message : String(error);

  if (error instanceof Anthropic.RateLimitError) return { reason: "rate_limit", message };
  if (error instanceof Anthropic.APIConnectionTimeoutError) return { reason: "timeout", message };
  if (error instanceof Anthropic.AuthenticationError) return { reason: "unavailable", message };
  if (error instanceof Anthropic.PermissionDeniedError) return { reason: "unavailable", message };
  if (error instanceof Anthropic.APIError) return { reason: "unavailable", message };

  return { reason: "unavailable", message };
}

/**
 * Run a web search and return the model's free-text findings.
 *
 * Kept as a separate first step because structured outputs and citations are
 * mutually exclusive, and the server-side search tool attaches citations to the
 * text blocks it produces. Asking for both in one call risks a 400, so search
 * and extraction are split: this call gathers, the next one shapes.
 */
async function gatherWithWebSearch(
  prompt: string,
  system: string | undefined,
  maxUses: number,
  maxTokens: number,
): Promise<string> {
  const response = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: maxTokens,
    ...(system ? { system } : {}),
    tools: [
      { type: "web_search_20260209", name: "web_search", max_uses: maxUses },
    ],
    messages: [{ role: "user", content: prompt }],
  });

  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

/**
 * Generate schema-validated JSON.
 *
 * Returns a discriminated result rather than throwing: every call site here has
 * a deterministic fallback, and an AI outage should degrade one panel rather
 * than fail the request.
 */
export async function generateStructured<S extends z.ZodType>(
  options: GenerateOptions<S>,
): Promise<AiResult<z.infer<S>>> {
  if (!isAiConfigured()) {
    return {
      ok: false,
      reason: "not_configured",
      message: "ANTHROPIC_API_KEY is not set",
    };
  }

  // Opus 5 reasons by default and max_tokens covers thinking plus the visible
  // response, so these budgets are well above the size of the JSON itself.
  const maxTokens = options.maxTokens ?? 4096;
  const effort = options.effort ?? "low";

  try {
    let prompt = options.prompt;

    if (options.webSearch) {
      const findings = await gatherWithWebSearch(
        options.prompt,
        options.system,
        options.webSearch.maxUses ?? 5,
        Math.max(maxTokens, 8192),
      );
      prompt = `${options.prompt}\n\nResearch findings:\n${findings}`;
    }

    const response = await anthropic.messages.parse({
      model: AI_MODEL,
      max_tokens: maxTokens,
      ...(options.system ? { system: options.system } : {}),
      output_config: { effort, format: zodOutputFormat(options.schema) },
      messages: [{ role: "user", content: prompt }],
    });

    // Order matters: a refusal and a truncation both leave parsed_output null,
    // and conflating them makes the failure impossible to diagnose.
    if (response.stop_reason === "refusal") {
      return {
        ok: false,
        reason: "refusal",
        message: response.stop_details?.explanation ?? "Request was declined",
      };
    }
    if (response.stop_reason === "max_tokens") {
      return { ok: false, reason: "invalid", message: "Response was truncated" };
    }
    if (!response.parsed_output) {
      return { ok: false, reason: "invalid", message: "Response did not match schema" };
    }

    return { ok: true, data: response.parsed_output };
  } catch (error) {
    const { reason, message } = classifyAiError(error);
    console.error(`[ai] generation failed (${reason}):`, message);
    return { ok: false, reason, message };
  }
}
