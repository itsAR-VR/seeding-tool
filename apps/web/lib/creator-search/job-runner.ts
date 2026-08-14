import type { Prisma } from "@prisma/client";
import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";
import {
  normalizeUnifiedDiscoveryQuery,
  type UnifiedDiscoveryQuery,
} from "@/lib/creator-search/contracts";
import { orchestrateUnifiedDiscovery } from "@/lib/creator-search/orchestrator";
import { scoreDecisionCandidate, type ScoredDecisionCandidate } from "@/lib/creator-search/decision-engine";
import { applyValidationResultToCreator } from "@/lib/creators/validation-ops";
import type { ValidationResult } from "@/lib/validation/types";
import { deriveBrandICP } from "@/lib/brands/icp";
import { classifyDiscoveryText } from "@/lib/creator-search/classification";
import { getFeatureFlags } from "@/lib/feature-flags";
import {
  parseJobQuery,
  validateDiscoveryCandidates,
  type ValidatedDiscoveryCandidate,
} from "./job-validation";
import {
  isScoredCandidate,
  searchResultMetadata,
  persistDiscoveredCandidate,
} from "./job-persistence";

export type CreatorSearchRequestedEvent = {
  jobId: string;
  brandId: string;
  campaignId?: string | null;
  query?: unknown;
};

async function scoreDiscoveryCandidates(input: {
  brandId: string;
  campaignId?: string | null;
  query: UnifiedDiscoveryQuery;
  candidates: ValidatedDiscoveryCandidate[];
}) {
  const icp = await deriveBrandICP(input.brandId, input.campaignId ?? undefined);

  return Promise.all(
    input.candidates.map((candidate) =>
      scoreDecisionCandidate({
        brandSummary: icp.summary,
        query: input.query,
        candidate,
        classification: classifyDiscoveryText({
          rawSourceCategory: candidate.rawSourceCategory,
          bio: candidate.bio,
          name: candidate.name,
          profileDump: candidate.profileDump,
        }),
      })
    )
  );
}

async function triggerAvgViewsEnrichment(creatorIds: string[]) {
  if (creatorIds.length === 0) {
    return;
  }

  try {
    await inngest.send({
      name: "creator-avg-views/requested",
      data: {
        creatorIds,
      },
    });
  } catch (error) {
    console.warn(
      "[creator-search] Skipping creator avg-views enqueue",
      error
    );
  }
}

async function claimPendingCreatorSearchJob({
  jobId,
  brandId,
  campaignId,
  query,
}: CreatorSearchRequestedEvent) {
  const existingJob = await prisma.creatorSearchJob.findFirst({
    where: {
      id: jobId,
      brandId,
    },
    select: {
      id: true,
      status: true,
      query: true,
      campaignId: true,
    },
  });

  if (!existingJob) {
    return {
      status: "missing" as const,
      storedQuery: normalizeUnifiedDiscoveryQuery({}),
      boundCampaignId: campaignId || null,
    };
  }

  const storedQuery = parseJobQuery(query ?? existingJob.query);
  // Standalone search and automation dispatch campaignId as "" — ?? keeps
  // that empty string and the creator_search_jobs.campaign_id FK then
  // rejects the claim. Normalize to null.
  const boundCampaignId = existingJob.campaignId || campaignId || null;

  const claim = await prisma.creatorSearchJob.updateMany({
    where: {
      id: jobId,
      brandId,
      status: "pending",
    },
    data: {
      status: "running",
      startedAt: new Date(),
      progressPercent: 10,
      campaignId: boundCampaignId,
      query: storedQuery as Prisma.InputJsonValue,
      error: null,
      finishedAt: null,
    },
  });

  if (claim.count === 0) {
    const currentJob = await prisma.creatorSearchJob.findUnique({
      where: { id: jobId },
      select: { status: true },
    });

    return {
      status:
        currentJob?.status === "running"
          ? ("already_claimed" as const)
          : ("not_pending" as const),
      storedQuery,
      boundCampaignId,
    };
  }

  return {
    status: "claimed" as const,
    storedQuery,
    boundCampaignId,
  };
}

export async function runCreatorSearchJob(
  input: CreatorSearchRequestedEvent
) {
  const claim = await claimPendingCreatorSearchJob(input);

  if (claim.status === "missing") {
    return { status: "skipped", reason: "job_missing" as const };
  }

  if (claim.status !== "claimed") {
    return {
      status: "skipped",
      reason: claim.status,
    } as const;
  }

  const { jobId, brandId } = input;
  const storedQuery = claim.storedQuery;
  const boundCampaignId = claim.boundCampaignId;

  try {
    const featureFlags = await getFeatureFlags(brandId);
    const candidates = await orchestrateUnifiedDiscovery({
      brandId,
      campaignId: boundCampaignId,
      query: storedQuery,
    });

    await prisma.creatorSearchJob.update({
      where: { id: jobId },
      data: {
        candidateCount: candidates.length,
        progressPercent: 45,
        etaSeconds: Math.max(15, candidates.length * 8),
      },
    });

    const { valid, unknown, invalid } = await validateDiscoveryCandidates(
      candidates,
      storedQuery
    );
    const visibleCandidates = [...valid, ...unknown].sort(
      (left, right) => right.relevanceScore - left.relevanceScore
    );
    const rankedVisible = featureFlags.decisionEngineScoringEnabled
      ? await scoreDiscoveryCandidates({
          brandId,
          campaignId: boundCampaignId,
          query: storedQuery,
          candidates: visibleCandidates,
        }).then((items) =>
          items.sort((left, right) => {
            if (right.fitScore !== left.fitScore) {
              return right.fitScore - left.fitScore;
            }
            return right.relevanceScore - left.relevanceScore;
          })
        )
      : visibleCandidates;
    const selectedVisible = rankedVisible.slice(0, storedQuery.limit);
    const selectedValid = selectedVisible.filter(
      (candidate) => candidate.validationStatus === "valid"
    );
    const overflowValid = rankedVisible
      .slice(storedQuery.limit)
      .filter((candidate) => candidate.validationStatus === "valid");
    const invalidToPersist = invalid.slice(
      0,
      Math.max(0, storedQuery.limit * 3 - selectedVisible.length)
    );

    // Only definitive results touch canonical creator records: writing a
    // transient unknown/retry outcome would clear previously valid
    // follower/view metrics on the creator.
    for (const candidate of invalid) {
      if (candidate.creatorId) {
        await applyValidationResultToCreator({
          creatorId: candidate.creatorId,
          platform: storedQuery.platform,
          result: {
            creatorId: candidate.creatorId,
            handle: candidate.handle,
            url:
              candidate.validatedProfileUrl ??
              candidate.profileUrl ??
              (storedQuery.platform === "tiktok"
                ? `https://tiktok.com/@${candidate.handle}`
                : `https://instagram.com/${candidate.handle}`),
            followerCount: null,
            avgViews: null,
            engagementRate: null,
            isVerified: false,
            metadata: {},
            status: candidate.validationStatus,
            errorCode: candidate.validationErrorCode,
            error: candidate.validationError,
            attemptCount: candidate.validationAttempts,
          } satisfies ValidationResult,
        });
      }
    }

    await prisma.creatorSearchResult.deleteMany({
      where: { searchJobId: jobId },
    });

    for (const candidate of [...selectedVisible, ...invalidToPersist]) {
      const scoredCandidate = isScoredCandidate(candidate) ? candidate : null;
      await prisma.creatorSearchResult.create({
        data: {
          searchJobId: jobId,
          platform: storedQuery.platform,
          handle: candidate.handle,
          source: candidate.primarySource,
          primarySource: candidate.primarySource,
          sources: candidate.sources as Prisma.InputJsonValue,
          name: candidate.name,
          followerCount: candidate.followerCount,
          engagementRate: candidate.engagementRate,
          profileUrl: candidate.profileUrl,
          imageUrl: candidate.imageUrl,
          bio: candidate.bio,
          email: candidate.email,
          bioCategory: candidate.canonicalCategory,
          rawSourceCategory: candidate.rawSourceCategory,
          seedCreatorId: candidate.seedCreatorId,
          metadata:
            scoredCandidate
              ? searchResultMetadata(scoredCandidate)
              : ({
                  relevanceScore: candidate.relevanceScore,
                  classificationConfidence: candidate.classificationConfidence,
                  matchedCategorySignals: candidate.matchedCategorySignals,
                  profileDump: candidate.profileDump,
                  isCached: candidate.isCached,
                  lastValidatedAt: candidate.lastValidatedAt,
                  sourceMetadata: candidate.sourceMetadata,
                } as Prisma.InputJsonValue),
          validationStatus: candidate.validationStatus,
          validationError: candidate.validationError,
          validatedFollowerCount: candidate.validatedFollowerCount,
          validatedAvgViews: candidate.validatedAvgViews,
          fitScore: scoredCandidate?.fitScore ?? null,
          fitReasoning: scoredCandidate?.fitReasoning ?? null,
          scoreComponents: scoredCandidate?.scoreComponents ?? undefined,
          triage: scoredCandidate?.triage ?? null,
          sourceConfidence: scoredCandidate?.sourceConfidence ?? null,
          sourceConfidenceTier: scoredCandidate?.sourceConfidenceTier ?? null,
        },
      });
    }

    await prisma.creatorSearchJob.update({
      where: { id: jobId },
      data: {
        progressPercent: 80,
        etaSeconds: Math.max(5, selectedVisible.length * 2),
      },
    });

    if (boundCampaignId) {
      const creatorIdsToEnrich: string[] = [];
      for (const candidate of selectedValid) {
        const creatorId = await persistDiscoveredCandidate({
          brandId,
          searchJobId: jobId,
          candidate,
          campaignId: boundCampaignId,
          attachToCampaign: true,
          featureFlags,
          platform: storedQuery.platform,
        });
        creatorIdsToEnrich.push(creatorId);
      }

      for (const candidate of overflowValid) {
        const creatorId = await persistDiscoveredCandidate({
          brandId,
          searchJobId: jobId,
          candidate,
          campaignId: boundCampaignId,
          attachToCampaign: false,
          featureFlags,
          platform: storedQuery.platform,
        });
        creatorIdsToEnrich.push(creatorId);
      }

      if (creatorIdsToEnrich.length > 0 && storedQuery.platform === "instagram") {
        await triggerAvgViewsEnrichment(creatorIdsToEnrich);
      }
    } else {
      const overflowCreatorIds: string[] = [];
      for (const candidate of overflowValid) {
        const creatorId = await persistDiscoveredCandidate({
          brandId,
          searchJobId: jobId,
          candidate,
          attachToCampaign: false,
          featureFlags,
          platform: storedQuery.platform,
        });
        overflowCreatorIds.push(creatorId);
      }

      if (overflowCreatorIds.length > 0 && storedQuery.platform === "instagram") {
        await triggerAvgViewsEnrichment(overflowCreatorIds);
      }
    }

    const finalStatus =
      selectedVisible.length >= storedQuery.limit
        ? "completed"
        : "completed_with_shortfall";

    await prisma.creatorSearchJob.update({
      where: { id: jobId },
      data: {
        status: finalStatus,
        candidateCount: candidates.length,
        validatedCount: valid.length,
        invalidCount: invalid.length,
        cachedCount: selectedVisible.filter((candidate) => candidate.isCached)
          .length,
        resultCount: selectedVisible.length,
        progressPercent: 100,
        etaSeconds: 0,
        finishedAt: new Date(),
      },
    });

    return {
      jobId,
      status: finalStatus,
      resultCount: selectedVisible.length,
    } as const;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";

    await prisma.creatorSearchJob.update({
      where: { id: jobId },
      data: {
        status: "failed",
        error: errMsg,
        finishedAt: new Date(),
      },
    });

    try {
      await prisma.interventionCase.create({
        data: {
          type: "other",
          status: "open",
          priority: "normal",
          title: "Unified creator search failed",
          description: `Search job ${jobId} failed: ${errMsg}`,
          brandId,
        },
      });
    } catch (interventionError) {
      console.error(
        `[creator-search] Failed to create intervention for job ${jobId}`,
        interventionError
      );
    }

    return {
      jobId,
      status: "failed",
      error: errMsg,
    } as const;
  }
}
