import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { UnifiedDiscoveryQuery } from "@/lib/creator-search/contracts";
import type { UnifiedDiscoveryCandidate } from "@/lib/creator-search/orchestrator-types";
import type { DiscoveryClassification } from "@/lib/creator-search/classification";
import { resolveIdentityForCandidate } from "@/lib/identity/matching";
import {
  computeAuthenticity,
  computeCategoryConfidence,
  computeContactability,
  computeEngagementQuality,
  computeIdentityConfidence,
  computeScaleFit,
  computeTopicalMatch,
} from "@/lib/creator-search/scoring/features";
import {
  computeCompositeScore,
  type ScoredCandidate,
} from "@/lib/creator-search/scoring/composite";
import { generateFitReasoning } from "@/lib/creator-search/scoring/reasoning";
import { getSourceConfidence } from "@/lib/creator-search/source-confidence";

export type DecisionEngineCandidate = UnifiedDiscoveryCandidate & {
  validationStatus: "valid" | "unknown" | "retry" | "invalid";
  validationError: string | null;
  validationErrorCode: string | null;
  validationAttempts: number;
  validatedFollowerCount: number | null;
  validatedAvgViews: number | null;
  validatedProfileUrl: string | null;
};

export type ScoredDecisionCandidate = DecisionEngineCandidate & {
  influencerIdentityId: string | null;
  bestIdentityProfileId: string | null;
  bestIdentityEdgeScore: number | null;
  identityEdgeCount: number;
  crossPlatformProfileCount: number;
  fitScore: number;
  fitReasoning: string;
  triage: ScoredCandidate["triage"];
  scoreComponents: Prisma.InputJsonValue;
  sourceConfidence: number;
  sourceConfidenceTier: string;
  contactabilityBand: "strong" | "moderate" | "weak";
  authenticityBand: "high_trust" | "moderate" | "low_trust" | "unknown";
};

function contactabilityBand(score: number): ScoredDecisionCandidate["contactabilityBand"] {
  if (score >= 0.75) return "strong";
  if (score >= 0.4) return "moderate";
  return "weak";
}

function authenticityBand(score: number, snapshotCount: number): ScoredDecisionCandidate["authenticityBand"] {
  if (snapshotCount === 0) return "unknown";
  if (score >= 0.8) return "high_trust";
  if (score >= 0.55) return "moderate";
  return "low_trust";
}

export async function scoreDecisionCandidate(input: {
  brandSummary: string;
  query: UnifiedDiscoveryQuery;
  candidate: DecisionEngineCandidate;
  classification: DiscoveryClassification | null;
}) : Promise<ScoredDecisionCandidate> {
  const resolution = await resolveIdentityForCandidate({
    platform: "instagram",
    handle: input.candidate.handle,
    name: input.candidate.name,
    bioText: input.candidate.bio,
    websiteUrl:
      typeof input.candidate.sourceMetadata.website === "string"
        ? (input.candidate.sourceMetadata.website as string)
        : null,
    email: input.candidate.email,
    region:
      typeof input.candidate.sourceMetadata.location === "string"
        ? (input.candidate.sourceMetadata.location as string)
        : null,
  });

  const profileData = resolution.bestIdentityId
    ? await prisma.influencerPlatformProfile.findMany({
        where: { influencerId: resolution.bestIdentityId },
        include: {
          contactPoints: true,
          metricsDaily: {
            orderBy: { date: "desc" },
            take: 14,
          },
          authenticityAssessments: {
            orderBy: { computedAt: "desc" },
            take: 1,
          },
        },
      })
    : [];

  const contactPoints = profileData.flatMap((profile) => profile.contactPoints);
  const snapshots = profileData.flatMap((profile) => profile.metricsDaily);
  const latestAssessment =
    profileData
      .flatMap((profile) => profile.authenticityAssessments)
      .sort((left, right) => right.computedAt.getTime() - left.computedAt.getTime())[0] ??
    null;

  const topical = computeTopicalMatch({
    creatorBio: input.candidate.bio,
    creatorCategories: [
      input.candidate.canonicalCategory ?? "",
      ...input.candidate.expandedCategories,
    ],
    campaignKeywords: input.query.keywords,
    campaignCategories: input.query.canonicalCategories,
    briefText: input.brandSummary,
  });
  const category = computeCategoryConfidence({
    classification: input.classification,
    campaignCategories: input.query.canonicalCategories,
  });
  const engagement = computeEngagementQuality({
    followerCount: input.candidate.validatedFollowerCount ?? input.candidate.followerCount,
    avgViews: input.candidate.validatedAvgViews ?? input.candidate.avgViews,
    engagementRate: input.candidate.engagementRate,
    snapshotCount: snapshots.length,
  });
  const authenticity = computeAuthenticity({
    validationStatus: input.candidate.validationStatus,
    sourceConfidence: input.candidate.sourceConfidence,
    isVerified: input.candidate.isVerified,
    followerCount: input.candidate.validatedFollowerCount ?? input.candidate.followerCount,
    engagementRate: input.candidate.engagementRate ?? undefined,
    growthAnomalyScore: latestAssessment?.growthAnomalyScore ?? undefined,
    botRiskScore: latestAssessment?.botRiskScore ?? undefined,
    engagementQualityScore: latestAssessment?.engagementQualityScore ?? undefined,
    snapshotCount: snapshots.length,
    snapshots,
    bioText: input.candidate.bio,
    profileImageUrl: input.candidate.imageUrl,
    websiteUrl:
      typeof input.candidate.sourceMetadata.website === "string"
        ? (input.candidate.sourceMetadata.website as string)
        : null,
  });
  const scaleFit = computeScaleFit({
    followerCount: input.candidate.validatedFollowerCount ?? input.candidate.followerCount,
    avgViews: input.candidate.validatedAvgViews ?? input.candidate.avgViews,
    minFollowers: input.query.filters.minFollowers,
    maxFollowers: input.query.filters.maxFollowers,
    minAvgViews: input.query.filters.minAvgViews,
  });
  const identity = computeIdentityConfidence({
    identityEdgeCount: resolution.identityEdgeCount,
    bestEdgeScore: resolution.bestMatchScore,
    crossPlatformProfileCount: resolution.crossPlatformProfileCount,
    sourceCount: input.candidate.sources.length,
    sourceConfidence: input.candidate.sourceConfidence,
  });
  const contactability = computeContactability({
    contactPoints: contactPoints.length > 0
      ? contactPoints.map((point) => ({
          contactType: point.contactType,
          confidence: point.confidence,
          isStale: point.isStale,
        }))
      : input.candidate.email
        ? [{ contactType: "email", confidence: 0.55, isStale: false }]
        : [{ contactType: "dm", confidence: 0.35, isStale: false }],
    hasPublicEmail: Boolean(input.candidate.email),
  });

  const scored = computeCompositeScore({
    candidateHandle: input.candidate.handle,
    components: {
      topicalMatch: topical,
      categoryConfidence: category,
      engagementQuality: engagement,
      authenticity,
      scaleFit,
      identityConfidence: identity,
      contactability,
    },
  });

  const scoreComponents = {
    ...scored.components,
    retrievalRelevance: input.candidate.relevanceScore,
  } as Prisma.InputJsonValue;

  return {
    ...input.candidate,
    influencerIdentityId: resolution.bestIdentityId,
    bestIdentityProfileId: resolution.bestProfileId,
    bestIdentityEdgeScore: resolution.bestMatchScore,
    identityEdgeCount: resolution.identityEdgeCount,
    crossPlatformProfileCount: resolution.crossPlatformProfileCount,
    fitScore: scored.compositeScore,
    fitReasoning: generateFitReasoning(scored),
    triage: scored.triage,
    scoreComponents,
    contactabilityBand: contactabilityBand(contactability.score),
    authenticityBand: authenticityBand(authenticity.score, snapshots.length),
    sourceConfidenceTier: getSourceConfidence(input.candidate.primarySource).tier,
    sourceConfidence: input.candidate.sourceConfidence,
  };
}
