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

export interface JsonRequest {
  /** Prompt, already including any research findings. */
  prompt: string;
  system?: string;
  /** JSON Schema derived from the caller's zod schema. */
  jsonSchema: Record<string, unknown>;
  maxTokens: number;
  effort: "low" | "medium" | "high";
}

export interface SearchRequest {
  prompt: string;
  system?: string;
  maxUses: number;
  maxTokens: number;
}

/**
 * The two primitives every provider must supply.
 *
 * Deliberately narrow: strategy (when to search, how to validate) lives in
 * generate.ts so it stays identical across providers, and adding a provider
 * means implementing these two methods and nothing else.
 */
export interface AiProvider {
  readonly name: "gemini" | "claude";
  /** Return unstructured JSON text; the caller validates it against zod. */
  generateJson(request: JsonRequest): Promise<AiResult<string>>;
  /** Ground a question in live web results and return prose findings. */
  searchWeb(request: SearchRequest): Promise<AiResult<string>>;
}
