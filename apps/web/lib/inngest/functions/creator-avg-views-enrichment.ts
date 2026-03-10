import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";
import { applyValidationResultToCreator } from "@/lib/creators/validation-ops";
import { validateInstagramCreators } from "@/lib/instagram/validator";

type CreatorAvgViewsRequestedEvent = {
  creatorIds: string[];
};

export const creatorAvgViewsEnrichment = inngest.createFunction(
  {
    id: "creator-avg-views-enrichment",
    name: "Creator Avg Views Enrichment",
    retries: 1,
    concurrency: [{ limit: 1 }],
  },
  { event: "creator-avg-views/requested" },
  async ({ event }) => {
    const { creatorIds } = event.data as CreatorAvgViewsRequestedEvent;

    if (!Array.isArray(creatorIds) || creatorIds.length === 0) {
      return { processed: 0 };
    }

    const creators = await prisma.creator.findMany({
      where: {
        id: { in: creatorIds },
        instagramHandle: { not: null },
      },
      include: {
        profiles: {
          where: { platform: "instagram" },
          take: 1,
        },
      },
    });

    if (creators.length === 0) {
      return { processed: 0 };
    }

    const validationResults = await validateInstagramCreators(
      creators
        .map((creator) => ({
          creatorId: creator.id,
          handle: creator.instagramHandle ?? creator.id,
        })),
      {
        concurrency: 1,
        includeAvgViews: true,
      }
    );

    const validationByCreatorId = new Map(
      validationResults
        .filter((result) => result.creatorId)
        .map((result) => [result.creatorId as string, result])
    );

    for (const creator of creators) {
      const validation = validationByCreatorId.get(creator.id);
      if (!validation) {
        continue;
      }

      await applyValidationResultToCreator({
        creatorId: creator.id,
        result: validation,
        profileUrl: creator.profiles[0]?.url ?? null,
        engagementRate: creator.profiles[0]?.engagementRate ?? null,
        isVerified: creator.profiles[0]?.isVerified ?? false,
        metadata: creator.profiles[0]?.metadata,
        cleanupInvalidLinks: validation.status === "invalid",
      });
    }

    return {
      processed: creators.length,
    };
  }
);
