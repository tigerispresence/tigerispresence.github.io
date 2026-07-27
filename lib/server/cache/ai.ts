import { cacheLife, cacheTag } from "next/cache";
import { CACHE_PROFILES } from "./profiles";
import { getSocialPosts, type SocialContext } from "@/lib/server/ai/social";
import { getThesis, type ThesisContext } from "@/lib/server/ai/thesis";
import type { SocialPosts, Thesis } from "@/lib/server/ai/schemas";

/**
 * Cached AI results.
 *
 * Only successes are cached. A failed generation returns null so the caller can
 * fall back, and caching that failure for 24 hours would strand the panel on a
 * transient rate limit.
 */

export async function cachedThesis(
  context: ThesisContext,
): Promise<Thesis | null> {
  "use cache";
  cacheLife(CACHE_PROFILES.ai);
  cacheTag(`ai:${context.symbol}`, `ai:${context.symbol}:thesis`);

  const result = await getThesis(context);
  return result.ok ? result.data : null;
}

export async function cachedSocialPosts(
  context: SocialContext,
): Promise<SocialPosts["posts"] | null> {
  "use cache";
  cacheLife(CACHE_PROFILES.ai);
  cacheTag(`ai:${context.symbol}`, `ai:${context.symbol}:social`);

  const result = await getSocialPosts(context);
  return result.ok && result.data.posts.length > 0 ? result.data.posts : null;
}
