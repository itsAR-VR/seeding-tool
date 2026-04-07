import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type OutcomeEvent =
  | { type: "review"; decision: string; reason?: string; by?: string | null }
  | { type: "outreach_sent"; method: string }
  | { type: "reply_received"; replyType: string }
  | { type: "accepted" }
  | { type: "address_confirmed" }
  | { type: "shipped" }
  | { type: "delivered" }
  | { type: "posted"; reach?: number; engagement?: number }
  | { type: "completed"; contentQuality?: string; costPerCreator?: number }
  | { type: "order_created" }
  | { type: "opted_out" }
  | { type: "stalled"; reason: string };

function calculateResponseTimeHours(referenceTime: Date | null | undefined) {
  if (!referenceTime) {
    return undefined;
  }

  return (Date.now() - referenceTime.getTime()) / (1000 * 60 * 60);
}

function buildOutcomePatch(
  event: OutcomeEvent,
  responseReferenceTime?: Date | null
): Prisma.CampaignOutcomeUncheckedUpdateInput {
  const now = new Date();
  switch (event.type) {
    case "review":
      return {
        reviewDecision: event.decision,
        reviewedAt: now,
        reviewedBy: event.by ?? null,
        declineReason: event.reason ?? null,
      };
    case "outreach_sent":
      return { outreachSentAt: now, outreachMethod: event.method };
    case "reply_received":
      return {
        repliedAt: now,
        replyType: event.replyType,
        responseTimeHours: calculateResponseTimeHours(responseReferenceTime),
      };
    case "accepted":
      return { acceptedAt: now };
    case "address_confirmed":
      return { addressConfirmedAt: now };
    case "order_created":
      return { orderCreatedAt: now };
    case "shipped":
      return { shippedAt: now };
    case "delivered":
      return { deliveredAt: now };
    case "posted":
      return {
        postedAt: now,
        contentReach: event.reach ?? undefined,
        contentEngagement: event.engagement ?? undefined,
      };
    case "completed":
      return {
        completedAt: now,
        contentQuality: event.contentQuality ?? undefined,
        costPerCreator: event.costPerCreator ?? undefined,
      };
    case "opted_out":
      return { optedOutAt: now };
    case "stalled":
      return { stalledAt: now, stallReason: event.reason };
  }
}

function buildOutcomeCreatePatch(
  event: OutcomeEvent,
  responseReferenceTime?: Date | null
): Omit<
  Prisma.CampaignOutcomeUncheckedCreateInput,
  "campaignCreatorId" | "campaignId" | "creatorId"
> {
  const now = new Date();
  switch (event.type) {
    case "review":
      return {
        reviewDecision: event.decision,
        reviewedAt: now,
        reviewedBy: event.by ?? null,
        declineReason: event.reason ?? null,
      };
    case "outreach_sent":
      return { outreachSentAt: now, outreachMethod: event.method };
    case "reply_received":
      return {
        repliedAt: now,
        replyType: event.replyType,
        responseTimeHours: calculateResponseTimeHours(responseReferenceTime),
      };
    case "accepted":
      return { acceptedAt: now };
    case "address_confirmed":
      return { addressConfirmedAt: now };
    case "order_created":
      return { orderCreatedAt: now };
    case "shipped":
      return { shippedAt: now };
    case "delivered":
      return { deliveredAt: now };
    case "posted":
      return {
        postedAt: now,
        contentReach: event.reach ?? undefined,
        contentEngagement: event.engagement ?? undefined,
      };
    case "completed":
      return {
        completedAt: now,
        contentQuality: event.contentQuality ?? undefined,
        costPerCreator: event.costPerCreator ?? undefined,
      };
    case "opted_out":
      return { optedOutAt: now };
    case "stalled":
      return { stalledAt: now, stallReason: event.reason };
  }
}

export async function recordOutcomeEvent(input: {
  campaignCreatorId: string;
  event: OutcomeEvent;
}) {
  const campaignCreator = await prisma.campaignCreator.findUnique({
    where: { id: input.campaignCreatorId },
    include: {
      creator: {
        select: {
          influencerIdentityId: true,
        },
      },
      outcome: {
        select: {
          outreachSentAt: true,
        },
      },
    },
  });

  if (!campaignCreator) {
    throw new Error("campaign_creator_not_found");
  }

  const responseReferenceTime =
    input.event.type === "reply_received"
      ? campaignCreator.outcome?.outreachSentAt ?? campaignCreator.lastOutreachAt
      : undefined;

  return prisma.campaignOutcome.upsert({
    where: { campaignCreatorId: input.campaignCreatorId },
    update: buildOutcomePatch(input.event, responseReferenceTime),
    create: {
      campaignCreatorId: input.campaignCreatorId,
      campaignId: campaignCreator.campaignId,
      creatorId: campaignCreator.creatorId,
      identityId: campaignCreator.creator.influencerIdentityId,
      ...buildOutcomeCreatePatch(input.event, responseReferenceTime),
    },
  });
}
