import Anthropic from "@anthropic-ai/sdk";
import type {
  AiProvider,
  AiResult,
  JsonRequest,
  SearchRequest,
} from "../provider";

export const CLAUDE_MODEL = "claude-opus-5";

function classify(error: unknown): AiResult<never> {
  const message = error instanceof Error ? error.message : String(error);

  if (error instanceof Anthropic.RateLimitError) {
    return { ok: false, reason: "rate_limit", message };
  }
  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return { ok: false, reason: "timeout", message };
  }
  if (
    error instanceof Anthropic.AuthenticationError ||
    error instanceof Anthropic.PermissionDeniedError
  ) {
    return { ok: false, reason: "unavailable", message };
  }
  return { ok: false, reason: "unavailable", message };
}

export function createClaudeProvider(apiKey: string): AiProvider {
  const client = new Anthropic({ apiKey, maxRetries: 2, timeout: 45_000 });

  return {
    name: "claude",

    async generateJson(request: JsonRequest): Promise<AiResult<string>> {
      try {
        const response = await client.messages.create({
          model: CLAUDE_MODEL,
          // Opus 5 reasons by default and max_tokens covers thinking plus the
          // visible response, so this is well above the size of the JSON.
          max_tokens: request.maxTokens,
          ...(request.system ? { system: request.system } : {}),
          output_config: {
            effort: request.effort,
            format: {
              type: "json_schema",
              schema: request.jsonSchema,
            },
          },
          messages: [{ role: "user", content: request.prompt }],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);

        // A refusal and a truncation both yield unusable output; keeping them
        // distinct is what makes the failure diagnosable from logs.
        if (response.stop_reason === "refusal") {
          return {
            ok: false,
            reason: "refusal",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            message: (response as any).stop_details?.explanation ?? "Declined",
          };
        }
        if (response.stop_reason === "max_tokens") {
          return { ok: false, reason: "invalid", message: "Response was truncated" };
        }

        const text = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("");

        if (!text) {
          return { ok: false, reason: "invalid", message: "Empty response" };
        }
        return { ok: true, data: text };
      } catch (error) {
        return classify(error);
      }
    },

    async searchWeb(request: SearchRequest): Promise<AiResult<string>> {
      try {
        const response = await client.messages.create({
          model: CLAUDE_MODEL,
          max_tokens: request.maxTokens,
          ...(request.system ? { system: request.system } : {}),
          tools: [
            {
              type: "web_search_20260209",
              name: "web_search",
              max_uses: request.maxUses,
            },
          ],
          messages: [{ role: "user", content: request.prompt }],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);

        const text = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n");

        return { ok: true, data: text };
      } catch (error) {
        return classify(error);
      }
    },
  };
}
