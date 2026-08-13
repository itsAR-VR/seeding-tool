import type { UnifiedDiscoveryCandidate } from "@/lib/creator-search/orchestrator-types";
import {
  compareSourceConfidence,
  computeCompositeSourceConfidence,
  getSourceConfidence,
} from "@/lib/creator-search/source-confidence";

function mergeField<T>(
  current: T | null,
  incoming: T | null,
  currentSource: string,
  incomingSource: string
) {
  if (incoming == null) {
    return current;
  }
  if (current == null) {
    return incoming;
  }
  return compareSourceConfidence(currentSource, incomingSource) <= 0
    ? incoming
    : current;
}

export function mergeDiscoveryCandidates(
  current: UnifiedDiscoveryCandidate,
  incoming: UnifiedDiscoveryCandidate
): UnifiedDiscoveryCandidate {
  const mergedSources = Array.from(new Set([...current.sources, ...incoming.sources]));
  const currentMatchedSignals = current.matchedCategorySignals ?? [];
  const incomingMatchedSignals = incoming.matchedCategorySignals ?? [];
  const currentExpandedCategories = current.expandedCategories ?? [];
  const incomingExpandedCategories = incoming.expandedCategories ?? [];
  const currentTopicSignals = current.topicSignals ?? [];
  const incomingTopicSignals = incoming.topicSignals ?? [];
  const preferredSource =
    compareSourceConfidence(current.primarySource, incoming.primarySource) <= 0
      ? incoming.primarySource
      : current.primarySource;

  return {
    ...current,
    creatorId: current.creatorId ?? incoming.creatorId,
    name: mergeField(current.name, incoming.name, current.primarySource, incoming.primarySource),
    bio: mergeField(current.bio, incoming.bio, current.primarySource, incoming.primarySource),
    profileDump: mergeField(
      current.profileDump,
      incoming.profileDump,
      current.primarySource,
      incoming.primarySource
    ),
    rawSourceCategory: mergeField(
      current.rawSourceCategory,
      incoming.rawSourceCategory,
      current.primarySource,
      incoming.primarySource
    ),
    canonicalCategory: mergeField(
      current.canonicalCategory,
      incoming.canonicalCategory,
      current.primarySource,
      incoming.primarySource
    ),
    classificationConfidence: mergeField(
      current.classificationConfidence,
      incoming.classificationConfidence,
      current.primarySource,
      incoming.primarySource
    ),
    matchedCategorySignals: Array.from(
      new Set([...currentMatchedSignals, ...incomingMatchedSignals])
    ),
    expandedCategories: Array.from(
      new Set([...currentExpandedCategories, ...incomingExpandedCategories])
    ),
    languageDetected: mergeField(
      current.languageDetected,
      incoming.languageDetected,
      current.primarySource,
      incoming.primarySource
    ),
    topicSignals: Array.from(
      new Map(
        [...currentTopicSignals, ...incomingTopicSignals].map((signal) => [
          `${signal.source}:${signal.topic}`,
          signal,
        ])
      ).values()
    ),
    followerCount: mergeField(
      current.followerCount,
      incoming.followerCount,
      current.primarySource,
      incoming.primarySource
    ),
    avgViews: mergeField(
      current.avgViews,
      incoming.avgViews,
      current.primarySource,
      incoming.primarySource
    ),
    engagementRate: mergeField(
      current.engagementRate,
      incoming.engagementRate,
      current.primarySource,
      incoming.primarySource
    ),
    profileUrl: mergeField(
      current.profileUrl,
      incoming.profileUrl,
      current.primarySource,
      incoming.primarySource
    ),
    imageUrl: mergeField(
      current.imageUrl,
      incoming.imageUrl,
      current.primarySource,
      incoming.primarySource
    ),
    isVerified: current.isVerified || incoming.isVerified,
    email: mergeField(
      current.email,
      incoming.email,
      current.primarySource,
      incoming.primarySource
    ),
    seedCreatorId: current.seedCreatorId ?? incoming.seedCreatorId,
    isCached: current.isCached || incoming.isCached,
    existingValidationStatus:
      current.existingValidationStatus ?? incoming.existingValidationStatus,
    lastValidatedAt: current.lastValidatedAt ?? incoming.lastValidatedAt,
    primarySource: preferredSource,
    sources: mergedSources,
    sourceConfidence: computeCompositeSourceConfidence(mergedSources),
    sourceConfidenceTier: getSourceConfidence(preferredSource).tier,
    sourceMetadata: {
      ...current.sourceMetadata,
      ...incoming.sourceMetadata,
    },
    relevanceScore: Math.max(current.relevanceScore, incoming.relevanceScore),
  };
}
