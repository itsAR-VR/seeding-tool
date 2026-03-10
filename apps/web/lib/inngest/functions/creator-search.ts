import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import {
  normalizeUnifiedDiscoveryQuery,
  type UnifiedDiscoveryQuery,
} from "@/lib/creator-search/contracts";
import { orchestrateUnifiedDiscovery } from "@/lib/creator-search/orchestrator";
import { recordCreatorDiscoveryTouch } from "@/lib/creator-search/provenance";

type CreatorSearchRequestedEvent = {
  jobId: string;
  brandId: string;
  campaignId?: string | null;
  query?: unknown;
};

function parseJobQuery(value: Prisma.JsonValue | unknown): UnifiedDiscoveryQuery {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return normalizeUnifiedDiscoveryQuery(
      value as Partial<UnifiedDiscoveryQuery>
    );
  }

  return normalizeUnifiedDiscoveryQuery({});
}

async function persistCampaignCandidate(
  brandId: string,
  campaignId: string,
  candidate: Awaited<
    ReturnType<typeof orchestrateUnifiedDiscovery>
  >[number]
) {
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
          followerCount: candidate.followerCount ?? existing.followerCount,
          avgViews: candidate.avgViews ?? existing.avgViews,
          discoverySource: candidate.primarySource,
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
          followerCount: candidate.followerCount,
          avgViews: candidate.avgViews,
          discoverySource: candidate.primarySource,
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
        candidate.profileUrl ?? `https://instagram.com/${candidate.handle}`,
      followerCount: candidate.followerCount ?? undefined,
      engagementRate: candidate.engagementRate ?? undefined,
      isVerified: candidate.isVerified,
      metadata: candidate.sourceMetadata as Prisma.InputJsonValue,
    },
    create: {
      creatorId: creator.id,
      platform: "instagram",
      handle: candidate.handle,
      url:
        candidate.profileUrl ?? `https://instagram.com/${candidate.handle}`,
      followerCount: candidate.followerCount ?? null,
      engagementRate: candidate.engagementRate ?? null,
      isVerified: candidate.isVerified,
      metadata: candidate.sourceMetadata as Prisma.InputJsonValue,
    },
  });

  for (const source of candidate.sources) {
    await recordCreatorDiscoveryTouch({
      creatorId: creator.id,
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
        sourceMetadata: candidate.sourceMetadata,
      } as Prisma.InputJsonValue,
    });
  }

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

export const handleCreatorSearch = inngest.createFunction(
  {
    id: "handle-creator-search",
    name: "Handle Creator Search Request",
    retries: 1,
    concurrency: [{ limit: 2 }],
  },
  { event: "creator-search/requested" },
  async ({ event }) => {
    const { jobId, brandId, campaignId, query } =
      event.data as CreatorSearchRequestedEvent;

    const job = await prisma.creatorSearchJob.findFirst({
      where: {
        id: jobId,
        brandId,
      },
    });

    if (!job) {
      return { status: "skipped", reason: "Job not found" };
    }

    const storedQuery = parseJobQuery(query ?? job.query);
    const boundCampaignId = job.campaignId ?? campaignId ?? null;

    await prisma.creatorSearchJob.update({
      where: { id: jobId },
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

    try {
      const candidates = await orchestrateUnifiedDiscovery({
        brandId,
        campaignId: boundCampaignId,
        query: storedQuery,
      });

      await prisma.creatorSearchResult.deleteMany({
        where: { searchJobId: jobId },
      });

      for (const candidate of candidates) {
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
              sourceMetadata: candidate.sourceMetadata,
            } as Prisma.InputJsonValue,
          },
        });
      }

      if (boundCampaignId) {
        for (const candidate of candidates) {
          await persistCampaignCandidate(brandId, boundCampaignId, candidate);
        }
      }

      const finalStatus =
        candidates.length >= storedQuery.limit
          ? "completed"
          : "completed_with_shortfall";

      await prisma.creatorSearchJob.update({
        where: { id: jobId },
        data: {
          status: finalStatus,
          candidateCount: candidates.length,
          validatedCount: candidates.length,
          invalidCount: 0,
          resultCount: candidates.length,
          progressPercent: 100,
          etaSeconds: 0,
          finishedAt: new Date(),
        },
      });

      return {
        jobId,
        status: finalStatus,
        resultCount: candidates.length,
      };
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

      throw error;
    }
  }
);
