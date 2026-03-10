import type { Prisma } from "@prisma/client";
import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";
import {
  normalizeUnifiedDiscoveryQuery,
  type UnifiedDiscoveryQuery,
} from "@/lib/creator-search/contracts";
import { shouldBypassDiscoveryValidation } from "@/lib/creator-search/cache-policy";
import { orchestrateUnifiedDiscovery } from "@/lib/creator-search/orchestrator";
import { recordCreatorDiscoveryTouch } from "@/lib/creator-search/provenance";
import { applyValidationResultToCreator } from "@/lib/creators/validation-ops";
import {
  validateInstagramCreators,
  type InstagramValidationResult,
} from "@/lib/instagram/validator";

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
  validationStatus: "valid" | "invalid";
  validationError: string | null;
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
      validationStatus: "valid",
      validationError: null,
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
          status: "invalid",
          errorCode: "navigation_failed",
          error: "navigation_failed",
        } satisfies InstagramValidationResult);

      return toValidatedCandidate(candidate, validation);
    });

  const validatedCandidates = [...prevalidated, ...newlyValidated];

  return {
    valid: validatedCandidates.filter(
      (candidate) => candidate.validationStatus === "valid"
    ),
    invalid: validatedCandidates.filter(
      (candidate) => candidate.validationStatus === "invalid"
    ),
  };
}

async function persistDiscoveredCandidate({
  brandId,
  searchJobId,
  candidate,
  campaignId,
  attachToCampaign,
}: {
  brandId: string;
  searchJobId: string;
  candidate: ValidatedDiscoveryCandidate;
  campaignId?: string | null;
  attachToCampaign: boolean;
}) {
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
          validationStatus: "valid",
          lastValidatedAt: new Date(),
          lastValidationError: null,
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
          validationStatus: "valid",
          lastValidatedAt: new Date(),
          lastValidationError: null,
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
        validationError: candidate.validationError,
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
        validationError: candidate.validationError,
      } as Prisma.InputJsonValue,
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
        isCached: candidate.isCached,
        sourceMetadata: candidate.sourceMetadata,
      } as Prisma.InputJsonValue,
    });
  }

  if (campaignId && attachToCampaign) {
    await prisma.campaignCreator.upsert({
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

    const { valid, invalid } = await validateDiscoveryCandidates(
      candidates,
      storedQuery
    );
    const selectedValid = valid.slice(0, storedQuery.limit);
    const overflowValid = valid.slice(storedQuery.limit);
    const invalidToPersist = invalid.slice(
      0,
      Math.max(0, storedQuery.limit * 3 - selectedValid.length)
    );

    for (const candidate of invalid) {
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
            status: "invalid",
            errorCode: null,
            error: candidate.validationError,
          },
        });
      }
    }

    await prisma.creatorSearchResult.deleteMany({
      where: { searchJobId: jobId },
    });

    for (const candidate of [...selectedValid, ...invalidToPersist]) {
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
          metadata: {
            relevanceScore: candidate.relevanceScore,
            classificationConfidence: candidate.classificationConfidence,
            matchedCategorySignals: candidate.matchedCategorySignals,
            profileDump: candidate.profileDump,
            isCached: candidate.isCached,
            lastValidatedAt: candidate.lastValidatedAt,
            sourceMetadata: candidate.sourceMetadata,
          } as Prisma.InputJsonValue,
          validationStatus: candidate.validationStatus,
          validationError: candidate.validationError,
          validatedFollowerCount: candidate.validatedFollowerCount,
          validatedAvgViews: candidate.validatedAvgViews,
        },
      });
    }

    await prisma.creatorSearchJob.update({
      where: { id: jobId },
      data: {
        progressPercent: 80,
        etaSeconds: Math.max(5, selectedValid.length * 2),
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
        });
        overflowCreatorIds.push(creatorId);
      }

      if (overflowCreatorIds.length > 0) {
        await triggerAvgViewsEnrichment(overflowCreatorIds);
      }
    }

    const finalStatus =
      selectedValid.length >= storedQuery.limit
        ? "completed"
        : "completed_with_shortfall";

    await prisma.creatorSearchJob.update({
      where: { id: jobId },
      data: {
        status: finalStatus,
        candidateCount: candidates.length,
        validatedCount: valid.length,
        invalidCount: invalid.length,
        cachedCount: selectedValid.filter((candidate) => candidate.isCached)
          .length,
        resultCount: selectedValid.length,
        progressPercent: 100,
        etaSeconds: 0,
        finishedAt: new Date(),
      },
    });

    return {
      jobId,
      status: finalStatus,
      resultCount: selectedValid.length,
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
