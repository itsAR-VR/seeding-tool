import { prisma } from "@/lib/prisma";
import { recordOutcomeEvent } from "@/lib/seeding/outcome-recorder";

/**
 * Link a MentionAsset to a CampaignCreator and update lifecycle.
 *
 * - Links the mention to the campaign creator
 * - Updates CampaignCreator.lifecycleStatus to "posted"
 * - Cancels any pending reminders
 */
export class MentionAccessError extends Error {}

export async function attributeMention(
  mentionAssetId: string,
  campaignCreatorId: string,
  brandId?: string
): Promise<void> {
  // Verify both exist and, when a brand is given, both belong to it.
  const brandScope = brandId ? { campaign: { brandId } } : {};
  const [mention, campaignCreator] = await Promise.all([
    prisma.mentionAsset.findFirst({
      where: { id: mentionAssetId, ...(brandId ? { campaignCreator: brandScope } : {}) },
    }),
    prisma.campaignCreator.findFirst({ where: { id: campaignCreatorId, ...brandScope } }),
  ]);

  if (!mention) {
    throw new MentionAccessError(`MentionAsset ${mentionAssetId} not found`);
  }

  if (!campaignCreator) {
    throw new MentionAccessError(`CampaignCreator ${campaignCreatorId} not found`);
  }

  // Update mention to link to campaign creator (if not already)
  if (mention.campaignCreatorId !== campaignCreatorId) {
    await prisma.mentionAsset.update({
      where: { id: mentionAssetId },
      data: { campaignCreatorId },
    });
  }

  // Update lifecycle status to "posted"
  if (!["completed", "opted_out"].includes(campaignCreator.lifecycleStatus)) {
    await prisma.campaignCreator.update({
      where: { id: campaignCreatorId },
      data: { lifecycleStatus: "posted" },
    });
    await recordOutcomeEvent({
      campaignCreatorId,
      event: {
        type: "posted",
        reach: mention.views ?? undefined,
        engagement:
          mention.views && (mention.likes != null || mention.comments != null)
            ? ((mention.likes ?? 0) + (mention.comments ?? 0)) / Math.max(1, mention.views)
            : undefined,
      },
    });
  }

  // Emit confirm event for 7-day completion check
  try {
    const { inngest } = await import("@/lib/inngest/client");
    await inngest.send({
      name: "mention/posted.confirm",
      data: {
        campaignCreatorId,
        mentionAssetId,
      },
    });
  } catch {
    // Inngest may not be configured — log and continue
  }

  // Cancel any pending reminders
  await prisma.reminderSchedule.updateMany({
    where: {
      campaignCreatorId,
      status: "pending",
    },
    data: {
      status: "cancelled",
      cancelReason: "Mention attributed — creator posted",
    },
  });
}

/**
 * Create a MentionAsset and attribute it to a campaign creator.
 */
export async function createAndAttributeMention(params: {
  platform: string;
  mediaUrl: string;
  type?: string;
  caption?: string;
  likes?: number;
  comments?: number;
  views?: number;
  postedAt?: Date;
  campaignCreatorId: string;
  attributionConfidence?: string;
  /** When given, the campaign creator must belong to this brand. */
  brandId?: string;
}): Promise<string> {
  const target = await prisma.campaignCreator.findFirst({
    where: {
      id: params.campaignCreatorId,
      ...(params.brandId ? { campaign: { brandId: params.brandId } } : {}),
    },
    select: { campaign: { select: { brandId: true } } },
  });
  if (!target) {
    throw new MentionAccessError(`CampaignCreator ${params.campaignCreatorId} not found`);
  }

  // Already stored for this exact creator: nothing to do (and re-attributing
  // another copy onto it would break the one-per-creator rule).
  const exact = await prisma.mentionAsset.findFirst({
    where: { platform: params.platform, mediaUrl: params.mediaUrl, campaignCreatorId: params.campaignCreatorId },
    select: { id: true },
  });
  if (exact) return exact.id;

  // Dedupe within the same brand only; another brand's copy of the same post is separate.
  const existing = await prisma.mentionAsset.findFirst({
    where: {
      platform: params.platform,
      mediaUrl: params.mediaUrl,
      campaignCreator: { campaign: { brandId: target.campaign.brandId } },
    },
  });

  if (existing) {
    // If it exists but points to a different creator in this brand, re-attribute
    if (existing.campaignCreatorId !== params.campaignCreatorId) {
      await attributeMention(existing.id, params.campaignCreatorId, target.campaign.brandId);
    }
    return existing.id;
  }

  const mention = await prisma.mentionAsset.create({
    data: {
      platform: params.platform,
      mediaUrl: params.mediaUrl,
      type: params.type,
      caption: params.caption,
      likes: params.likes,
      comments: params.comments,
      views: params.views,
      postedAt: params.postedAt,
      campaignCreatorId: params.campaignCreatorId,
      attributionConfidence: params.attributionConfidence,
    },
  });

  // Attribution side effects
  await attributeMention(mention.id, params.campaignCreatorId);

  return mention.id;
}
