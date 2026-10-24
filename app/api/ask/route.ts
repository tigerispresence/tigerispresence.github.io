import { NextResponse } from "next/server";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { NO_STORE } from "@/lib/server/http";
import { streamAnswer, type AskEvent } from "@/lib/server/ask/claude";
import { sectorsContext, stockContext } from "@/lib/server/ask/context";
import { checkRateLimit } from "@/lib/server/ask/rateLimit";
import { cachedSectorData } from "@/lib/server/cache/sectors";
import { cachedSectorMacroData } from "@/lib/server/cache/sectorMacro";
import { getStockPayload } from "@/lib/server/stock/getStockPayload";
import { resolveSymbol } from "@/lib/server/stock/resolveSymbol";

// Web search plus a long answer can take a while.
export const maxDuration = 120;

const turn = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(8000),
});

const body = z.object({
  question: z.string().trim().min(1).max(1000),
  context: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("stock"), symbol: z.string().trim().min(1).max(20) }),
    z.object({ kind: z.literal("sectors") }),
  ]),
  /** Earlier turns of this conversation, oldest first, without the data block. */
  history: z
    .array(turn)
    .max(12)
    .default([])
    // user, assistant, user, assistant, ... so the new question continues it.
    .refine((h) => h.every((t, i) => t.role === (i % 2 === 0 ? "user" : "assistant")), "Turns must alternate")
    .refine((h) => h.length % 2 === 0, "History must end with an answer"),
});

const json = (data: unknown, status: number) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": NO_STORE } });

/** Optional value: either half failing should not sink the question. */
const optional = <T,>(p: Promise<T>) => p.catch(() => null);

async function buildContext(context: z.infer<typeof body>["context"]) {
  const macro = await optional(cachedSectorMacroData());
  if (context.kind === "sectors") {
    return sectorsContext(await optional(cachedSectorData()), macro);
  }
  const resolved = await resolveSymbol(context.symbol);
  if (!resolved) return null;
  // Two years so the 1Y return and the 200-day average both have enough history.
  return stockContext(await getStockPayload(resolved, "2y"), macro);
}

/**
 * Ask Claude about the stock or sectors on screen; streams newline-delimited
 * JSON events (see AskEvent).
 */
export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return json({ error: "Ask Claude is not configured on this server." }, 503);

  const accessCode = process.env.ASK_ACCESS_CODE;
  if (accessCode && req.headers.get("x-ask-code") !== accessCode) {
    return json({ error: "Access code required.", code: "access_code" }, 401);
  }

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Invalid question." }, 400);
  const { question, context, history } = parsed.data;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const retryAfter = checkRateLimit(ip);
  if (retryAfter > 0) {
    return json({ error: `Too many questions. Try again in ${Math.ceil(retryAfter / 60)} min.` }, 429);
  }

  let data;
  try {
    data = await buildContext(context);
  } catch (error) {
    console.error("[api/ask] context failed:", error);
    return json({ error: "Could not load the data for this question." }, 502);
  }
  if (!data) return json({ error: "Stock not found." }, 404);

  // The data block rides on the first user turn, so it stays in the cached
  // prefix while follow-up questions are appended after it.
  const subject = context.kind === "stock" ? `the stock ${context.symbol}` : "the 11 S&P 500 sectors";
  const turns = [...history, { role: "user" as const, content: question }];
  const messages: Anthropic.Beta.BetaMessageParam[] = turns.map((t, i) =>
    i === 0 ? { role: "user", content: `<data subject="${subject}">\n${JSON.stringify(data)}\n</data>\n\n${t.content}` } : t,
  );

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AskEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      for await (const event of streamAnswer(apiKey, messages, req.signal)) send(event);
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": NO_STORE,
      // Stop proxies from buffering the stream into one late chunk.
      "X-Accel-Buffering": "no",
    },
  });
}
