import type { Prisma } from "@prisma/client";
import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";
import {
  normalizeUnifiedDiscoveryQuery,
  type UnifiedDiscoveryQuery,
} from "@/lib/creator-search/contracts";
import {
  shouldBypassDiscoveryValidation,
} from "@/lib/creator-search/cache-policy";
import { orchestrateUnifiedDiscovery } from "@/lib/creator-search/orchestrator";
import { recordCreatorDiscoveryTouch } from "@/lib/creator-search/provenance";
import { recordCreatorRawPayload } from "@/lib/creator-search/raw-payload";
import { scoreDecisionCandidate, type ScoredDecisionCandidate } from "@/lib/creator-search/decision-engine";
import { applyValidationResultToCreator } from "@/lib/creators/validation-ops";
import { deriveBrandICP } from "@/lib/brands/icp";
import { classifyDiscoveryText } from "@/lib/creator-search/classification";
import { syncIdentityForCreator } from "@/lib/identity/matching";
import {
  validateInstagramCreators,
  type InstagramValidationErrorCode,
  type InstagramValidationResult,
} from "@/lib/instagram/validator";
import { recordOpportunisticSnapshot } from "@/lib/metrics/snapshot";
import { getFeatureFlags, type FeatureFlags } from "@/lib/feature-flags";

export type CreatorSearchRequestedEvent = {
  jobId: string;
  brandId: string;
  campaignId?: string | null;
  query?: unknown;
};

type DiscoveryCandidate = Awaited<
  ReturnType<typeof orchestrateUnifiedDiscovery>
>[number];

type ValidatedDiscoveryCandidate = DiscoveryCandidate & {
  validationStatus: "valid" | "unknown" | "retry" | "invalid";
  validationError: string | null;
  validationErrorCode: InstagramValidationErrorCode | null;
  validationAttempts: number;
  validatedFollowerCount: number | null;
  validatedAvgViews: number | null;
  validatedProfileUrl: string | null;
};

function parseJobQuery(value: Prisma.JsonValue | unknown): UnifiedDiscoveryQuery {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return normalizeUnifiedDiscoveryQuery(
      value as Partial<UnifiedDiscoveryQuery>
    );
  }

  return normalizeUnifiedDiscoveryQuery({});
}

function toValidatedCandidate(
  candidate: DiscoveryCandidate,
  validation: InstagramValidationResult
): ValidatedDiscoveryCandidate {
  return {
    ...candidate,
    validationStatus: validation.status,
    validationError: validation.error,
    validationErrorCode: validation.errorCode,
    validationAttempts: validation.attemptCount,
    validatedFollowerCount: validation.followerCount,
    validatedAvgViews: validation.avgViews,
    validatedProfileUrl: validation.url || candidate.profileUrl,
  };
}

async function validateDiscoveryCandidates(
  candidates: DiscoveryCandidate[],
  query: UnifiedDiscoveryQuery
) {
  const prevalidated = candidates
    .filter((candidate) =>
      shouldBypassDiscoveryValidation({
        isCached: candidate.isCached,
        existingValidationStatus: candidate.existingValidationStatus,
      })
    )
    .map<ValidatedDiscoveryCandidate>((candidate) => ({
      ...candidate,
      validationStatus:
        candidate.existingValidationStatus === "unknown"
          ? "unknown"
          : "valid",
      validationError: null,
      validationErrorCode: null,
      validationAttempts: 0,
      validatedFollowerCount: candidate.followerCount,
      validatedAvgViews: candidate.avgViews,
      validatedProfileUrl: candidate.profileUrl,
    }));

  const targets = candidates
    .filter(
      (candidate) =>
        !shouldBypassDiscoveryValidation({
          isCached: candidate.isCached,
          existingValidationStatus: candidate.existingValidationStatus,
        })
    )
    .map((candidate) => ({
      creatorId: candidate.creatorId ?? candidate.handle,
      handle: candidate.handle,
      minFollowers: query.filters.minFollowers ?? null,
      maxFollowers: query.filters.maxFollowers ?? null,
    }));

  const validationResults =
    targets.length > 0
      ? await validateInstagramCreators(targets, {
          concurrency: 1,
          includeAvgViews: false,
          navigationTimeoutSecs: 15,
          requestHandlerTimeoutSecs: 20,
          delayRangeMs: [200, 600],
          blockPauseMs: 1_000,
          maxPauseCycles: 0,
        })
      : [];

  const validationByHandle = new Map(
    validationResults.map((result) => [result.handle.toLowerCase(), result])
  );

  const newlyValidated = candidates
    .filter((candidate) => !candidate.isCached)
    .map<ValidatedDiscoveryCandidate>((candidate) => {
      const validation =
        validationByHandle.get(candidate.handle.toLowerCase()) ??
        ({
          creatorId: candidate.creatorId,
          handle: candidate.handle,
          url:
            candidate.profileUrl ??
            `https://instagram.com/${candidate.handle}`,
          followerCount: null,
          avgViews: null,
          checkedVideoCount: 0,
          blocked: false,
          status: "retry",
          errorCode: "navigation_failed",
          error: "navigation_failed",
          attemptCount: 1,
        } satisfies InstagramValidationResult);

      return toValidatedCandidate(candidate, validation);
    });

  const validatedCandidates = [...prevalidated, ...newlyValidated];

  return {
    valid: validatedCandidates.filter(
      (candidate) => candidate.validationStatus === "valid"
    ),
    unknown: validatedCandidates.filter(
      (candidate) =>
        candidate.validationStatus === "unknown" ||
        candidate.validationStatus === "retry"
    ),
    invalid: validatedCandidates.filter(
      (candidate) => candidate.validationStatus === "invalid"
    ),
  };
}

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

function isScoredCandidate(
  candidate: ValidatedDiscoveryCandidate | ScoredDecisionCandidate
): candidate is ScoredDecisionCandidate {
  return "fitScore" in candidate;
}

function searchResultMetadata(candidate: ScoredDecisionCandidate) {
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

async function persistDiscoveredCandidate({
  brandId,
  searchJobId,
  candidate,
  campaignId,
  attachToCampaign,
  featureFlags,
}: {
  brandId: string;
  searchJobId: string;
  candidate: ValidatedDiscoveryCandidate | ScoredDecisionCandidate;
  campaignId?: string | null;
  attachToCampaign: boolean;
  featureFlags: FeatureFlags;
}) {
  const scoredCandidate = isScoredCandidate(candidate) ? candidate : null;
  const existing = await prisma.creator.findFirst({
    where: {
      brandId,
      instagramHandle: candidate.handle,
    },
  });

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
          instagramHandle: candidate.handle,
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
        platform: "instagram",
      },
    },
    update: {
      handle: candidate.handle,
      url:
        candidate.validatedProfileUrl ??
        candidate.profileUrl ??
        `https://instagram.com/${candidate.handle}`,
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
      platform: "instagram",
      handle: candidate.handle,
      url:
        candidate.validatedProfileUrl ??
        candidate.profileUrl ??
        `https://instagram.com/${candidate.handle}`,
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
        platform: "instagram",
        handle: candidate.handle,
        profileUrl:
          candidate.validatedProfileUrl ??
          candidate.profileUrl ??
          `https://instagram.com/${candidate.handle}`,
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
      platform: "instagram",
      source: "instagram_validated",
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
      boundCampaignId: campaignId ?? null,
    };
  }

  const storedQuery = parseJobQuery(query ?? existingJob.query);
  const boundCampaignId = existingJob.campaignId ?? campaignId ?? null;

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

    for (const candidate of [...invalid, ...unknown]) {
      if (candidate.creatorId) {
        await applyValidationResultToCreator({
          creatorId: candidate.creatorId,
          result: {
            creatorId: candidate.creatorId,
            handle: candidate.handle,
            url:
              candidate.validatedProfileUrl ??
              candidate.profileUrl ??
              `https://instagram.com/${candidate.handle}`,
            followerCount: null,
            avgViews: null,
            checkedVideoCount: 0,
            blocked: false,
            status: candidate.validationStatus,
            errorCode: candidate.validationErrorCode,
            error: candidate.validationError,
            attemptCount: candidate.validationAttempts,
          },
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
          platform: "instagram",
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
        });
        creatorIdsToEnrich.push(creatorId);
      }

      if (creatorIdsToEnrich.length > 0) {
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
        });
        overflowCreatorIds.push(creatorId);
      }

      if (overflowCreatorIds.length > 0) {
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
