import { prisma } from "@/lib/prisma";
import { applyValidationResultToCreator } from "@/lib/creators/validation-ops";
import { isCreatorValidationFresh } from "@/lib/creators/validation-policy";
import { validateInstagramCreators } from "@/lib/instagram/validator";

export async function runCreatorValidationSweep({
  brandId,
  campaignId,
  limit = 100,
  includeAvgViews = false,
  cleanupInvalidLinks = true,
}: {
  brandId?: string;
  campaignId?: string;
  limit?: number;
  includeAvgViews?: boolean;
  cleanupInvalidLinks?: boolean;
}) {
  const creators = await prisma.creator.findMany({
    where: {
      instagramHandle: { not: null },
      ...(brandId ? { brandId } : {}),
      ...(campaignId
        ? {
            campaignCreators: {
              some: { campaignId },
            },
          }
        : {}),
    },
    select: {
      id: true,
      instagramHandle: true,
      lastValidatedAt: true,
      validationStatus: true,
      profiles: {
        where: { platform: "instagram" },
        select: {
          url: true,
          engagementRate: true,
          isVerified: true,
          metadata: true,
        },
        take: 1,
      },
    },
    orderBy: [{ lastValidatedAt: "asc" }, { updatedAt: "asc" }],
    take: limit,
  });

  const staleCreators = creators.filter(
    (creator) =>
      creator.validationStatus !== "valid" ||
      !isCreatorValidationFresh(creator.lastValidatedAt)
  );

  if (staleCreators.length === 0) {
    return {
      scanned: 0,
      valid: 0,
      invalid: 0,
      removedCampaignLinks: 0,
      retainedCampaignLinks: 0,
    };
  }

  const validationResults = await validateInstagramCreators(
    staleCreators
      .map((creator) => creator.instagramHandle)
      .filter((value): value is string => Boolean(value))
      .map((handle, index) => ({
        creatorId: staleCreators[index]?.id,
        handle,
      })),
    {
      concurrency: 1,
      includeAvgViews,
    }
  );

  const validationByCreatorId = new Map(
    validationResults
      .filter((result) => result.creatorId)
      .map((result) => [result.creatorId as string, result])
  );

  let valid = 0;
  let invalid = 0;
  let removedCampaignLinks = 0;
  let retainedCampaignLinks = 0;

  for (const creator of staleCreators) {
    const validation = validationByCreatorId.get(creator.id);
    if (!validation) {
      continue;
    }

    const cleanup = await applyValidationResultToCreator({
      creatorId: creator.id,
      result: validation,
      profileUrl: creator.profiles[0]?.url ?? null,
      engagementRate: creator.profiles[0]?.engagementRate ?? null,
      isVerified: creator.profiles[0]?.isVerified ?? false,
      metadata: creator.profiles[0]?.metadata,
      cleanupInvalidLinks,
    });

    if (validation.status === "valid") {
      valid += 1;
    } else {
      invalid += 1;
    }

    removedCampaignLinks += cleanup?.removed ?? 0;
    retainedCampaignLinks += cleanup?.retained ?? 0;
  }

  return {
    scanned: staleCreators.length,
    valid,
    invalid,
    removedCampaignLinks,
    retainedCampaignLinks,
  };
}
