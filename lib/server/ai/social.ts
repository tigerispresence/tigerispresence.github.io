import { generateStructured } from "./generate";
import { SocialPostsSchema } from "./schemas";

export interface SocialContext {
  symbol: string;
  newsHeadlines?: string;
  businessSummary?: string;
}

/**
 * Trending social discussions for a ticker.
 *
 * A real web-search task: the answer is by definition about what is being said
 * right now, so the model's training data cannot supply it.
 */
export async function getSocialPosts(context: SocialContext) {
  const { symbol, newsHeadlines, businessSummary } = context;

  const prompt = `
Identify up to 5 recent, trending social media discussions about the stock "${symbol}"
on Reddit, X or StockTwits. Focus on sentiment and specific community reactions.

Context:
- Business: ${businessSummary ?? "N/A"}
- Recent news: ${newsHeadlines ?? "N/A"}

Only include discussions you can link to. Prefer real, working URLs.
`.trim();

  return generateStructured({
    schema: SocialPostsSchema,
    prompt,
    system:
      "You summarize retail investor sentiment. Report what is being discussed " +
      "without endorsing it, and never invent links.",
    webSearch: { maxUses: 5 },
    maxTokens: 8192,
    effort: "medium",
  });
}

/** Generic search links, used whenever the AI call is unavailable or empty. */
export function backupSocialLinks(symbol: string) {
  return [
    { title: `Search $${symbol} on Reddit`, url: `https://www.reddit.com/search/?q=$${symbol}`, source: "Reddit" },
    { title: `Search $${symbol} on X`, url: `https://twitter.com/search?q=$${symbol}`, source: "X" },
    { title: `Search $${symbol} on Stocktwits`, url: `https://stocktwits.com/symbol/${symbol}`, source: "Stocktwits" },
    { title: `Search $${symbol} on Google`, url: `https://www.google.com/search?q=${symbol}+stock+discussion`, source: "Google" },
  ];
}
