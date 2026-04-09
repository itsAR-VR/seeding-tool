import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordCreatorDiscoveryTouch } from "@/lib/creator-search/provenance";
import { recordCreatorRawPayload } from "@/lib/creator-search/raw-payload";
import { syncIdentityForCreator } from "@/lib/identity/matching";
import { recordOpportunisticSnapshot } from "@/lib/metrics/snapshot";
import type { ScoredDecisionCandidate } from "@/lib/creator-search/decision-engine";
import type { FeatureFlags } from "@/lib/feature-flags";
import type { ValidatedDiscoveryCandidate } from "./job-validation";

export function isScoredCandidate(
  candidate: ValidatedDiscoveryCandidate | ScoredDecisionCandidate
): candidate is ScoredDecisionCandidate {
  return "fitScore" in candidate;
}

export function searchResultMetadata(candidate: ScoredDecisionCandidate) {
  return {
    relevanceScore: candidate.relevanceScore,
    classificationConfidence: candidate.classificationConfidence,
    matchedCategorySignals: candidate.matchedCategorySignals,
    expandedCategories: candidate.expandedCategories,
    languageDetected: candidate.languageDetected,
    topicSignals: candidate.topicSignals,
    profileDump: candidate.profileDump,
    isCached: candidate.isCached,
    lastValidatedAt: candidate.lastValidatedAt,
    sourceMetadata: candidate.sourceMetadata,
    bestIdentityEdgeScore: candidate.bestIdentityEdgeScore,
    identityEdgeCount: candidate.identityEdgeCount,
    crossPlatformProfileCount: candidate.crossPlatformProfileCount,
    contactabilityBand: candidate.contactabilityBand,
    authenticityBand: candidate.authenticityBand,
  } as Prisma.InputJsonValue;
}

export async function persistDiscoveredCandidate({
  brandId,
  searchJobId,
  candidate,
  campaignId,
  attachToCampaign,
  featureFlags,
  platform = "instagram",
}: {
  brandId: string;
  searchJobId: string;
  candidate: ValidatedDiscoveryCandidate | ScoredDecisionCandidate;
  campaignId?: string | null;
  attachToCampaign: boolean;
  featureFlags: FeatureFlags;
  platform?: "instagram" | "tiktok";
}) {
  const scoredCandidate = isScoredCandidate(candidate) ? candidate : null;

  // Platform-aware dedup: look up by the correct handle field
  const handleWhereClause =
    platform === "tiktok"
      ? { tiktokHandle: candidate.handle }
      : { instagramHandle: candidate.handle };

  const existing = await prisma.creator.findFirst({
    where: {
      brandId,
      ...handleWhereClause,
    },
  });

  // Platform-aware handle fields for create
  const handleCreateData =
    platform === "tiktok"
      ? { tiktokHandle: candidate.handle }
      : { instagramHandle: candidate.handle };

  const defaultProfileUrl =
    platform === "tiktok"
      ? `https://tiktok.com/@${candidate.handle}`
      : `https://instagram.com/${candidate.handle}`;

  const creator = existing
    ? await prisma.creator.update({
        where: { id: existing.id },
        data: {
          name: candidate.name ?? existing.name,
          email: candidate.email ?? existing.email,
          bio: candidate.bio ?? existing.bio,
          bioCategory:
            candidate.canonicalCategory ?? existing.bioCategory,
          imageUrl: candidate.imageUrl ?? existing.imageUrl,
          followerCount:
            candidate.validatedFollowerCount ?? existing.followerCount,
          avgViews: candidate.validatedAvgViews ?? existing.avgViews,
          discoverySource: candidate.primarySource,
          validationStatus: candidate.validationStatus,
          validationErrorCode: candidate.validationErrorCode,
          validationAttempts: {
            increment: candidate.validationAttempts,
          },
          lastValidatedAt: new Date(),
          lastValidationError: candidate.validationError,
        },
      })
    : await prisma.creator.create({
        data: {
          brandId,
          ...handleCreateData,
          name: candidate.name ?? candidate.handle,
          email: candidate.email,
          bio: candidate.bio,
          bioCategory: candidate.canonicalCategory,
          imageUrl: candidate.imageUrl,
          followerCount: candidate.validatedFollowerCount,
          avgViews: candidate.validatedAvgViews,
          discoverySource: candidate.primarySource,
          validationStatus: candidate.validationStatus,
          validationErrorCode: candidate.validationErrorCode,
          validationAttempts: candidate.validationAttempts,
          lastValidatedAt: new Date(),
          lastValidationError: candidate.validationError,
        },
      });

  await prisma.creatorProfile.upsert({
    where: {
      creatorId_platform: {
        creatorId: creator.id,
        platform,
      },
    },
    update: {
      handle: candidate.handle,
      url:
        candidate.validatedProfileUrl ??
        candidate.profileUrl ??
        defaultProfileUrl,
      followerCount: candidate.validatedFollowerCount ?? undefined,
      engagementRate: candidate.engagementRate ?? undefined,
      isVerified: candidate.isVerified,
      metadata: {
        ...(candidate.sourceMetadata as Record<string, unknown>),
        validationStatus: candidate.validationStatus,
        validationErrorCode: candidate.validationErrorCode,
        validationError: candidate.validationError,
        scoreComponents: scoredCandidate?.scoreComponents,
        triage: scoredCandidate?.triage,
        sourceConfidence: scoredCandidate?.sourceConfidence,
      } as Prisma.InputJsonValue,
    },
    create: {
      creatorId: creator.id,
      platform,
      handle: candidate.handle,
      url:
        candidate.validatedProfileUrl ??
        candidate.profileUrl ??
        defaultProfileUrl,
      followerCount: candidate.validatedFollowerCount ?? null,
      engagementRate: candidate.engagementRate ?? null,
      isVerified: candidate.isVerified,
      metadata: {
        ...(candidate.sourceMetadata as Record<string, unknown>),
        validationStatus: candidate.validationStatus,
        validationErrorCode: candidate.validationErrorCode,
        validationError: candidate.validationError,
        scoreComponents: scoredCandidate?.scoreComponents,
        triage: scoredCandidate?.triage,
        sourceConfidence: scoredCandidate?.sourceConfidence,
      } as Prisma.InputJsonValue,
    },
  });

  await recordCreatorRawPayload({
    creatorId: creator.id,
    searchJobId,
    source: candidate.primarySource,
    eventType: "discovery",
    payload: {
      primarySource: candidate.primarySource,
      sources: candidate.sources,
      rawSourceCategory: candidate.rawSourceCategory,
      sourceMetadata: candidate.sourceMetadata,
      profileDump: candidate.profileDump,
    },
  });

  await recordCreatorRawPayload({
    creatorId: creator.id,
    searchJobId,
    source: "instagram_validated",
    eventType: "validation",
    payload: {
      validationStatus: candidate.validationStatus,
      validationErrorCode: candidate.validationErrorCode,
      validationError: candidate.validationError,
      validatedFollowerCount: candidate.validatedFollowerCount,
      validatedAvgViews: candidate.validatedAvgViews,
      validatedProfileUrl: candidate.validatedProfileUrl,
    },
  });

  for (const source of candidate.sources) {
    await recordCreatorDiscoveryTouch({
      creatorId: creator.id,
      searchJobId,
      source,
      externalId: candidate.handle,
      rawSourceCategory: candidate.rawSourceCategory,
      canonicalCategory: candidate.canonicalCategory,
      email: candidate.email,
      seedCreatorId: candidate.seedCreatorId,
      metadata: {
        primarySource: candidate.primarySource,
        sources: candidate.sources,
        relevanceScore: candidate.relevanceScore,
        fitScore: scoredCandidate?.fitScore,
        fitReasoning: scoredCandidate?.fitReasoning,
        triage: scoredCandidate?.triage,
        sourceConfidence: scoredCandidate?.sourceConfidence,
        isCached: candidate.isCached,
        sourceMetadata: candidate.sourceMetadata,
      } as Prisma.InputJsonValue,
    });
  }

  const identitySync = featureFlags.identityGraphEnabled
    ? await syncIdentityForCreator({
        creatorId: creator.id,
        displayName: candidate.name,
        platform,
        handle: candidate.handle,
        profileUrl:
          candidate.validatedProfileUrl ??
          candidate.profileUrl ??
          defaultProfileUrl,
        profileImageUrl: candidate.imageUrl,
        websiteUrl:
          typeof candidate.sourceMetadata.website === "string"
            ? (candidate.sourceMetadata.website as string)
            : null,
        bioText: candidate.bio,
        email: candidate.email,
        region:
          typeof candidate.sourceMetadata.location === "string"
            ? (candidate.sourceMetadata.location as string)
            : null,
        isVerified: candidate.isVerified,
        sources: candidate.sources,
        autoLinkEnabled: featureFlags.identityAutoLinkEnabled,
      })
    : {
        influencerIdentityId: null,
        profileId: null,
        resolution: null,
      };

  if (candidate.validatedFollowerCount != null || candidate.validatedAvgViews != null) {
    await recordOpportunisticSnapshot({
      handle: candidate.handle,
      platform,
      source: `${platform}_validated`,
      metrics: {
        followers: candidate.validatedFollowerCount,
        avgViews: candidate.validatedAvgViews,
        engagementRate: candidate.engagementRate,
      },
    });
  }

  if (campaignId && attachToCampaign) {
    const campaignCreator = await prisma.campaignCreator.upsert({
      where: {
        campaignId_creatorId: {
          campaignId,
          creatorId: creator.id,
        },
      },
      update: {},
      create: {
        campaignId,
        creatorId: creator.id,
        reviewStatus: "pending",
        lifecycleStatus: "ready",
      },
    });

    if (featureFlags.outcomeLearningEnabled) {
      await prisma.campaignOutcome.upsert({
        where: { campaignCreatorId: campaignCreator.id },
        update: {
          identityId: identitySync.influencerIdentityId,
          fitScoreAtSeed: scoredCandidate?.fitScore ?? null,
          triageAtSeed: scoredCandidate?.triage ?? null,
          scoreComponentsAtSeed: scoredCandidate?.scoreComponents ?? undefined,
        },
        create: {
          campaignCreatorId: campaignCreator.id,
          campaignId,
          creatorId: creator.id,
          identityId: identitySync.influencerIdentityId,
          fitScoreAtSeed: scoredCandidate?.fitScore ?? null,
          triageAtSeed: scoredCandidate?.triage ?? null,
          scoreComponentsAtSeed: scoredCandidate?.scoreComponents ?? undefined,
        },
      });
    }
  }

  return creator.id;
}
