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

function nicheTerms(niche: string): string[] {
  return niche
    .toLowerCase()
    .split(/[^a-z0-9&]+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 2);
}

/**
 * Keyword overlap fallback. A profile matches when the niche shares at
 * least one term with the bio/category/name haystack, the canonical
 * category, or the classifier's own matched keywords.
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

  const hits = terms.filter((term) => haystack.includes(term));
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
