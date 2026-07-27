import { generateStructured } from "./generate";
import { ThesisSchema } from "./schemas";

export interface ThesisContext {
  symbol: string;
  name: string;
  price?: number;
  changePercent?: number;
  sector?: string;
  industry?: string;
  businessSummary?: string;
}

/**
 * Bull/bear investment thesis.
 *
 * Genuinely generative work, and user-initiated (the AI Insights panel is
 * behind a toggle), so the web-search round-trip is worth it here. When Yahoo
 * already supplied a business summary we skip search and rely on that context.
 */
export async function getThesis(context: ThesisContext) {
  const {
    symbol,
    name,
    price,
    changePercent,
    sector,
    industry,
    businessSummary,
  } = context;

  const prompt = `
Analyze the stock "${symbol}" (${name}) and write a bull case and a bear case.

Context:
- Price: ${price ?? "N/A"}
- 1D change: ${changePercent !== undefined ? `${(changePercent * 100).toFixed(2)}%` : "N/A"}
- Sector: ${sector ?? "N/A"}
- Industry: ${industry ?? "N/A"}
- Business summary: ${businessSummary ?? "N/A"}

Be objective and professional. Keep each case under 300 characters.
`.trim();

  return generateStructured({
    schema: ThesisSchema,
    prompt,
    system:
      "You are an objective equity analyst. Present both sides fairly and avoid " +
      "recommendations to buy or sell.",
    // Only reach for live sources when we have no business context at all.
    webSearch: businessSummary ? undefined : { maxUses: 4 },
    maxTokens: 8192,
    effort: "medium",
  });
}
