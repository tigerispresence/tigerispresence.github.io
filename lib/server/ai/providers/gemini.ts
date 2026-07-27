import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
  AiProvider,
  AiResult,
  JsonRequest,
  SearchRequest,
} from "../provider";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Gemini adapter.
 *
 * Tries each model in turn: availability varies by key and region, and a model
 * that 404s for one project answers fine for another. GEMINI_MODEL pins a
 * single model when you want to bypass the chain.
 */
const DEFAULT_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
];

function models(): string[] {
  const pinned = process.env.GEMINI_MODEL?.trim();
  return pinned ? [pinned] : DEFAULT_MODELS;
}

function classify(error: unknown): AiResult<never> {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  // The SDK surfaces HTTP failures as plain Errors, so this matches on text.
  if (lower.includes("429") || lower.includes("quota") || lower.includes("rate limit")) {
    return { ok: false, reason: "rate_limit", message };
  }
  if (lower.includes("timeout") || lower.includes("etimedout")) {
    return { ok: false, reason: "timeout", message };
  }
  if (lower.includes("api key") || lower.includes("401") || lower.includes("403")) {
    return { ok: false, reason: "unavailable", message };
  }
  if (lower.includes("safety") || lower.includes("blocked")) {
    return { ok: false, reason: "refusal", message };
  }
  return { ok: false, reason: "unavailable", message };
}

/** Strip markdown fences the model sometimes wraps JSON in. */
function unfence(text: string): string {
  return text.replace(/```json/gi, "").replace(/```/g, "").trim();
}

export function createGeminiProvider(apiKey: string): AiProvider {
  const client = new GoogleGenerativeAI(apiKey);

  async function run(
    modelName: string,
    system: string | undefined,
    prompt: string,
    config: Record<string, unknown>,
    tools?: unknown[],
  ): Promise<string> {
    const model = client.getGenerativeModel({
      model: modelName,
      ...(system ? { systemInstruction: system } : {}),
      ...(tools ? { tools: tools as any } : {}),
    } as any);

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: config as any,
    } as any);

    const text = result.response.text();
    if (!text) throw new Error(`Empty response from ${modelName}`);
    return text;
  }

  return {
    name: "gemini",

    async generateJson(request: JsonRequest): Promise<AiResult<string>> {
      // The schema goes in the prompt rather than responseSchema: Gemini
      // accepts only a subset of JSON Schema there and rejects constructs zod
      // emits, and the caller validates with zod afterwards regardless.
      const prompt = `${request.prompt}

Respond with JSON only, matching this schema exactly:
${JSON.stringify(request.jsonSchema, null, 2)}`;

      let lastError: unknown = new Error("No Gemini model available");
      for (const modelName of models()) {
        try {
          const text = await run(modelName, request.system, prompt, {
            responseMimeType: "application/json",
            maxOutputTokens: request.maxTokens,
          });
          return { ok: true, data: unfence(text) };
        } catch (error) {
          console.warn(`[gemini] ${modelName} failed:`, error);
          lastError = error;
        }
      }
      return classify(lastError);
    },

    async searchWeb(request: SearchRequest): Promise<AiResult<string>> {
      let lastError: unknown = new Error("No Gemini model available");
      for (const modelName of models()) {
        try {
          const text = await run(
            modelName,
            request.system,
            request.prompt,
            { maxOutputTokens: request.maxTokens },
            [{ googleSearch: {} }],
          );
          return { ok: true, data: text };
        } catch (error) {
          console.warn(`[gemini] search via ${modelName} failed:`, error);
          lastError = error;
        }
      }
      return classify(lastError);
    },
  };
}
