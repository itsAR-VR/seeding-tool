import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  canAutoRemoveInvalidCampaignCreator,
  type CampaignCleanupCandidate,
} from "@/lib/creators/validation-policy";
import type { InstagramValidationResult } from "@/lib/instagram/validator";

function asMetadataRecord(value: unknown) {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return {};
  }

  return value as Record<string, unknown>;
}

function toCleanupCandidate(
  link: {
    reviewStatus: string;
    lifecycleStatus: string;
    outreachCount: number;
    lastOutreachAt: Date | null;
    lastReplyAt: Date | null;
    conversationThread: { id: string } | null;
    shopifyOrder: { id: string } | null;
    shippingSnapshots: Array<{ id: string }>;
    reminderSchedules: Array<{ id: string }>;
    costRecords: Array<{ id: string }>;
    mentionAssets: Array<{ id: string }>;
  }
): CampaignCleanupCandidate {
  return {
    reviewStatus: link.reviewStatus,
    lifecycleStatus: link.lifecycleStatus,
    outreachCount: link.outreachCount,
    lastOutreachAt: link.lastOutreachAt,
    lastReplyAt: link.lastReplyAt,
    hasConversationThread: Boolean(link.conversationThread),
    hasShopifyOrder: Boolean(link.shopifyOrder),
    shippingSnapshotCount: link.shippingSnapshots.length,
    reminderScheduleCount: link.reminderSchedules.length,
    costRecordCount: link.costRecords.length,
    mentionAssetCount: link.mentionAssets.length,
  };
}

export async function cleanupInvalidCreatorCampaignLinks(creatorId: string) {
  const links = await prisma.campaignCreator.findMany({
    where: { creatorId },
    select: {
      id: true,
      reviewStatus: true,
      lifecycleStatus: true,
      outreachCount: true,
      lastOutreachAt: true,
      lastReplyAt: true,
      conversationThread: { select: { id: true } },
      shopifyOrder: { select: { id: true } },
      shippingSnapshots: { select: { id: true }, take: 1 },
      reminderSchedules: { select: { id: true }, take: 1 },
      costRecords: { select: { id: true }, take: 1 },
      mentionAssets: { select: { id: true }, take: 1 },
    },
  });

  const removableIds = links
    .filter((link) => canAutoRemoveInvalidCampaignCreator(toCleanupCandidate(link)))
    .map((link) => link.id);

  if (removableIds.length > 0) {
    await prisma.campaignCreator.deleteMany({
      where: { id: { in: removableIds } },
    });
  }

  return {
    removed: removableIds.length,
    retained: links.length - removableIds.length,
  };
}

export async function applyValidationResultToCreator({
  creatorId,
  result,
  profileUrl,
  engagementRate,
  isVerified,
  metadata,
  cleanupInvalidLinks = true,
}: {
  creatorId: string;
  result: InstagramValidationResult;
  profileUrl?: string | null;
  engagementRate?: number | null;
  isVerified?: boolean;
  metadata?: Prisma.JsonValue | Prisma.InputJsonValue | null;
  cleanupInvalidLinks?: boolean;
}) {
  const creator = await prisma.creator.findUnique({
    where: { id: creatorId },
    include: {
      profiles: {
        where: { platform: "instagram" },
        take: 1,
      },
    },
  });

  if (!creator) {
    return null;
  }

  const profile = creator.profiles[0] ?? null;
  const nextFollowerCount =
    result.status === "valid" ? result.followerCount : null;
  const nextAvgViews =
    result.status === "valid" ? result.avgViews ?? creator.avgViews : null;
  const nextProfileUrl =
    profileUrl ??
    profile?.url ??
    result.url ??
    (creator.instagramHandle
      ? `https://instagram.com/${creator.instagramHandle}`
      : null);
  const mergedMetadata = {
    ...asMetadataRecord(profile?.metadata),
    ...asMetadataRecord(metadata),
    validationStatus: result.status,
    validationError: result.error,
    lastValidationUrl: result.url,
    lastValidatedAt: new Date().toISOString(),
  };

  await prisma.creator.update({
    where: { id: creatorId },
    data: {
      followerCount: nextFollowerCount,
      avgViews: nextAvgViews,
      validationStatus: result.status,
      lastValidatedAt: new Date(),
      lastValidationError: result.error,
    },
  });

  if (creator.instagramHandle) {
    await prisma.creatorProfile.upsert({
      where: {
        creatorId_platform: {
          creatorId,
          platform: "instagram",
        },
      },
      update: {
        handle: creator.instagramHandle,
        url: nextProfileUrl ?? undefined,
        followerCount: nextFollowerCount ?? undefined,
        engagementRate: engagementRate ?? profile?.engagementRate ?? undefined,
        isVerified: isVerified ?? profile?.isVerified ?? false,
        metadata: mergedMetadata as Prisma.InputJsonValue,
      },
      create: {
        creatorId,
        platform: "instagram",
        handle: creator.instagramHandle,
        url: nextProfileUrl,
        followerCount: nextFollowerCount,
        engagementRate: engagementRate ?? profile?.engagementRate ?? null,
        isVerified: isVerified ?? profile?.isVerified ?? false,
        metadata: mergedMetadata as Prisma.InputJsonValue,
      },
    });
  }

  if (result.status === "invalid" && cleanupInvalidLinks) {
    return cleanupInvalidCreatorCampaignLinks(creatorId);
  }

  return { removed: 0, retained: 0 };
}
