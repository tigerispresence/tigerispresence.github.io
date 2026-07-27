import { z } from "zod";

/** Single best-guess ticker for a free-form query. */
export const SymbolResolutionSchema = z.object({
  symbol: z
    .string()
    .describe(
      'Yahoo Finance ticker. Korean listings use a .KS (KOSPI) or .KQ (KOSDAQ) suffix, e.g. "005930.KS".',
    ),
  name: z.string().describe("Company name in English."),
});
export type SymbolResolution = z.infer<typeof SymbolResolutionSchema>;

/** Candidate list for the search box. */
export const SymbolCandidatesSchema = z.object({
  candidates: z
    .array(
      z.object({
        symbol: z.string().describe("Yahoo Finance ticker, with .KS/.KQ suffix for Korean listings."),
        name: z.string(),
        exchange: z.string().describe('Exchange code, e.g. "NMS", "KSC".'),
      }),
    )
    .max(5),
});
export type SymbolCandidates = z.infer<typeof SymbolCandidatesSchema>;

/** Bull/bear thesis for the AI Insights panel. */
export const ThesisSchema = z.object({
  bullCase: z
    .string()
    .describe("Positive catalysts, one concise paragraph of at most 300 characters."),
  bearCase: z
    .string()
    .describe("Risks and negatives, one concise paragraph of at most 300 characters."),
});
export type Thesis = z.infer<typeof ThesisSchema>;

/** Trending social discussion links for the News panel. */
export const SocialPostsSchema = z.object({
  posts: z
    .array(
      z.object({
        title: z.string().describe("Short summary of the discussion."),
        url: z.string().describe("Link to the discussion."),
        source: z.string().describe('Platform, e.g. "Reddit", "X", "StockTwits".'),
      }),
    )
    .max(5),
});
export type SocialPosts = z.infer<typeof SocialPostsSchema>;
