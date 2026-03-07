import { prisma } from "@/lib/prisma";

/**
 * Link a MentionAsset to a CampaignCreator and update lifecycle.
 *
 * - Links the mention to the campaign creator
 * - Updates CampaignCreator.lifecycleStatus to "posted"
 * - Cancels any pending reminders
 */
export async function attributeMention(
  mentionAssetId: string,
  campaignCreatorId: string
): Promise<void> {
  // Verify both exist
  const [mention, campaignCreator] = await Promise.all([
    prisma.mentionAsset.findUnique({ where: { id: mentionAssetId } }),
    prisma.campaignCreator.findUnique({ where: { id: campaignCreatorId } }),
  ]);

  if (!mention) {
    throw new Error(`MentionAsset ${mentionAssetId} not found`);
  }

  if (!campaignCreator) {
    throw new Error(`CampaignCreator ${campaignCreatorId} not found`);
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
}): Promise<string> {
  // Dedupe: check if mention already exists for this platform + mediaUrl
  const existing = await prisma.mentionAsset.findUnique({
    where: {
      platform_mediaUrl: {
        platform: params.platform,
        mediaUrl: params.mediaUrl,
      },
    },
  });

  if (existing) {
    // If it exists but points to a different creator, re-attribute
    if (existing.campaignCreatorId !== params.campaignCreatorId) {
      await attributeMention(existing.id, params.campaignCreatorId);
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
    },
  });

  // Attribution side effects
  await attributeMention(mention.id, params.campaignCreatorId);

  return mention.id;
}
