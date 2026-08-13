import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";
import { applyValidationResultToCreator } from "@/lib/creators/validation-ops";
import { validateInstagramCreators } from "@/lib/instagram/validator";
import { getValidator } from "@/lib/validation/registry";
import type { UnifiedDiscoveryPlatform } from "@/lib/creator-search/contracts";

export const creatorAvgViewsEnrichment = inngest.createFunction(
  {
    id: "creator-avg-views-enrichment",
    name: "Creator Avg Views Enrichment",
    retries: 1,
    concurrency: [{ limit: 1 }],
  },
  { event: "creator-avg-views/requested" },
  async ({ event }) => {
    const { creatorIds, platform: rawPlatform } = event.data as {
      creatorIds: string[];
      platform?: string;
    };

    if (!Array.isArray(creatorIds) || creatorIds.length === 0) {
      return { processed: 0 };
    }

    const platform: UnifiedDiscoveryPlatform =
      rawPlatform === "tiktok" ? "tiktok" : "instagram";

    // For Instagram, use the existing direct path (Playwright with avg views)
    if (platform === "instagram") {
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
        creators.map((creator) => ({
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
          platform: "instagram",
        });
      }

      return { processed: creators.length };
    }

    // For non-Instagram platforms, use the validator registry
    const validator = getValidator(platform);
    if (!validator) {
      return { processed: 0, error: `no_validator_for_${platform}` };
    }

    const handleField =
      platform === "tiktok" ? "tiktokHandle" : "instagramHandle";

    const creators = await prisma.creator.findMany({
      where: {
        id: { in: creatorIds },
        [handleField]: { not: null },
      },
      include: {
        profiles: {
          where: { platform },
          take: 1,
        },
      },
    });

    if (creators.length === 0) {
      return { processed: 0 };
    }

    const targets = creators.map((creator) => ({
      creatorId: creator.id,
      handle:
        (platform === "tiktok"
          ? creator.tiktokHandle
          : creator.instagramHandle) ?? creator.id,
    }));

    const results = await validator.validateBatch(targets, {
      concurrency: 1,
      includeAvgViews: false,
    });

    const resultByCreatorId = new Map(
      results
        .filter((result) => result.creatorId)
        .map((result) => [result.creatorId as string, result])
    );

    for (const creator of creators) {
      const validation = resultByCreatorId.get(creator.id);
      if (!validation) {
        continue;
      }

      await applyValidationResultToCreator({
        creatorId: creator.id,
        result: {
          creatorId: validation.creatorId,
          handle: validation.handle,
          url: validation.url ?? "",
          followerCount: validation.followerCount,
          avgViews: validation.avgViews,
          checkedVideoCount: 0,
          blocked: false,
          status: validation.status,
          errorCode: validation.errorCode as import("@/lib/instagram/validator").InstagramValidationErrorCode | null,
          error: validation.error,
          attemptCount: validation.attemptCount,
        },
        profileUrl: creator.profiles[0]?.url ?? null,
        engagementRate:
          validation.engagementRate ??
          creator.profiles[0]?.engagementRate ??
          null,
        isVerified: validation.isVerified,
        metadata: creator.profiles[0]?.metadata,
        cleanupInvalidLinks: validation.status === "invalid",
        platform,
      });
    }

    return { processed: creators.length };
  }
);
