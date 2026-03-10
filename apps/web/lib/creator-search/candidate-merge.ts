import type { UnifiedDiscoveryCandidate } from "@/lib/creator-search/orchestrator-types";

export function mergeDiscoveryCandidates(
  current: UnifiedDiscoveryCandidate,
  incoming: UnifiedDiscoveryCandidate
): UnifiedDiscoveryCandidate {
  return {
    ...current,
    name: current.name ?? incoming.name,
    bio: current.bio ?? incoming.bio,
    profileDump: current.profileDump ?? incoming.profileDump,
    rawSourceCategory: current.rawSourceCategory ?? incoming.rawSourceCategory,
    canonicalCategory: current.canonicalCategory ?? incoming.canonicalCategory,
    classificationConfidence:
      current.classificationConfidence ?? incoming.classificationConfidence,
    matchedCategorySignals: Array.from(
      new Set([
        ...current.matchedCategorySignals,
        ...incoming.matchedCategorySignals,
      ])
    ),
    followerCount: incoming.followerCount ?? current.followerCount,
    avgViews: incoming.avgViews ?? current.avgViews,
    engagementRate: incoming.engagementRate ?? current.engagementRate,
    profileUrl: incoming.profileUrl ?? current.profileUrl,
    imageUrl: incoming.imageUrl ?? current.imageUrl,
    isVerified: current.isVerified || incoming.isVerified,
    email: incoming.email ?? current.email,
    seedCreatorId: current.seedCreatorId ?? incoming.seedCreatorId,
    sources: Array.from(new Set([...current.sources, ...incoming.sources])),
    sourceMetadata: {
      ...current.sourceMetadata,
      ...incoming.sourceMetadata,
    },
    relevanceScore: Math.max(current.relevanceScore, incoming.relevanceScore),
  };
}
