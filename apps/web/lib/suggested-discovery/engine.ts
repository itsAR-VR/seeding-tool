/**
 * Suggested Discovery — per-candidate verdict engine.
 *
 * Decision order: vision classification (screenshot + fields) when an
 * OpenAI key is configured, otherwise the existing keyword classifier
 * over bio/category/name. Both paths produce the same MatchVerdict
 * shape so the UI never cares which one answered.
 */

import { classifyDiscoveryText } from "@/lib/creator-search/classification";
import type { DiscoveryCandidate, MatchVerdict, SuggestedProfile } from "./types";
import { classifyCandidate } from "./vision";

const CONFIDENCE_BY_LEVEL = { high: 0.85, medium: 0.6, low: 0.35 } as const;

/**
 * Generic words that appear in almost any niche brief ("creators",
 * "for", "audience") — matching on them would approve anything.
 */
const NICHE_STOP_WORDS = new Set([
  "for", "the", "and", "with", "who", "that", "this", "from", "your",
  "you", "are", "our", "their", "them", "has", "have", "not", "but",
  "all", "can", "will", "would", "about", "into", "than", "then",
  "they", "when", "like", "just", "over", "such", "take", "good",
  "some", "see", "how", "its", "out", "use", "using", "new", "get",
  "via", "per", "any", "each", "more", "most", "very", "well", "also",
  "best", "top", "based", "looking", "want", "wants", "need", "needs",
  "creator", "creators", "influencer", "influencers", "brand", "brands",
  "product", "products", "audience", "audiences", "content", "niche",
]);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function nicheTerms(niche: string): string[] {
  return niche
    .toLowerCase()
    .split(/[^a-z0-9&]+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 2 && !NICHE_STOP_WORDS.has(term));
}

/**
 * Keyword overlap fallback. A profile matches when a niche term appears
 * as a whole word in the bio/category/name haystack, the canonical
 * category, or the classifier's own matched keywords. Whole-word
 * matching matters: substring matching turns "men" into a hit on
 * "women" and "art" into a hit on "party".
 */
export function textFallbackVerdict(
  profile: SuggestedProfile,
  niche: string
): MatchVerdict {
  const classification = classifyDiscoveryText({
    rawSourceCategory: profile.category,
    bio: profile.bio,
    name: profile.displayName,
  });

  const terms = nicheTerms(niche);
  const haystack = [
    profile.bio ?? "",
    profile.category ?? "",
    profile.displayName ?? "",
    classification.canonicalCategory,
    ...classification.matchedKeywords,
    ...(classification.expandedCategories ?? []),
  ]
    .join(" ")
    .toLowerCase();

  const hits = terms.filter((term) =>
    new RegExp(`\\b${escapeRegExp(term)}\\b`).test(haystack)
  );
  const match = hits.length > 0;

  return {
    match,
    confidence: match ? CONFIDENCE_BY_LEVEL[classification.confidence] : 0.2,
    tags: [classification.canonicalCategory],
    reason: match
      ? `Keyword match on "${hits.join('", "')}" — classified as ${classification.canonicalCategory}.`
      : `No niche overlap — classified as ${classification.canonicalCategory}.`,
    source: "text",
  };
}

export async function decideCandidate(
  profile: SuggestedProfile,
  niche: string,
  screenshot: Buffer | null
): Promise<DiscoveryCandidate> {
  const vision = await classifyCandidate({ niche, profile, screenshot });
  const verdict = vision ?? textFallbackVerdict(profile, niche);

  return {
    profile,
    verdict,
    status: verdict.match ? "match" : "rejected",
  };
}
