import { generateStructured } from "./generate";
import { SymbolCandidatesSchema, SymbolResolutionSchema } from "./schemas";

const SYSTEM =
  "You map company names and fuzzy queries to Yahoo Finance ticker symbols. " +
  "Korean listings require a .KS (KOSPI) or .KQ (KOSDAQ) suffix — for example " +
  "삼성전자 is 005930.KS and 에코프로 is 086520.KQ. Answer only from knowledge " +
  "you are confident in.";

/**
 * Last-resort symbol resolution, used only when the static Korean alias map
 * and Yahoo's own search have both missed. No web search: the model's built-in
 * knowledge of tickers is sufficient and a search round-trip would put this on
 * the critical path of a page load.
 */
export async function resolveSymbolWithAi(query: string) {
  return generateStructured({
    schema: SymbolResolutionSchema,
    system: SYSTEM,
    prompt: `Find the exact stock ticker symbol for "${query}".`,
    maxTokens: 2048,
    effort: "low",
  });
}

/**
 * Candidate list for the search box.
 *
 * Deliberately not wired to the typeahead: this used to fire on a 400ms
 * debounce whenever Yahoo returned fewer than three results, so an LLM call
 * could run on roughly every third keystroke.
 */
export async function searchCandidatesWithAi(query: string) {
  return generateStructured({
    schema: SymbolCandidatesSchema,
    system: SYSTEM,
    prompt: `A user is searching for a stock with the query "${query}". List up to 5 likely candidates.`,
    maxTokens: 2048,
    effort: "low",
  });
}
