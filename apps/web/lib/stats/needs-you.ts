/**
 * The database queries behind Home's "needs you" rows. Home, the campaign
 * page, and System status all call these, so they always agree. The rules
 * themselves (what "Needs your answer" or "Address to check" means) live in
 * ./campaign-counts.ts.
 */

import { prisma } from "@/lib/prisma";
import { STUCK_AFTER_DAYS, addressToCheck, needsAnswer } from "./campaign-counts";
import { displayStage, type DisplayStage } from "./stage-display";

/** Statuses where a creator is finished, so a quiet week isn't a problem. */
const FINISHED_STATUSES = ["posted", "completed", "opted_out", "closed"];

/**
 * Number of creators whose newest message is from them with no decision yet.
 * Home shows this as "N creators need your answer"; the campaign page's
 * "Needs your answer" chip is the same rule for one campaign.
 */
export async function countNeedsAnswer(brandId: string): Promise<number> {
  const threads = await prisma.conversationThread.findMany({
    where: { brandId, campaignCreator: { replyDecision: null } },
    select: { messages: { orderBy: { createdAt: "desc" }, take: 1, select: { direction: true } } },
  });
  return threads.filter((t) => needsAnswer({ replyDecision: null, latestMessageDirection: t.messages[0]?.direction }))
    .length;
}

/**
 * Same rule as countNeedsAnswer, per campaign, so a campaign's badge can say
 * "Replies to answer" when its people are waiting on you.
 */
export async function countNeedsAnswerByCampaign(brandId: string): Promise<Map<string, number>> {
  const threads = await prisma.conversationThread.findMany({
    where: { brandId, campaignCreator: { replyDecision: null } },
    select: {
      campaignCreator: { select: { campaignId: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { direction: true } },
    },
  });
  const counts = new Map<string, number>();
  for (const t of threads) {
    if (!needsAnswer({ replyDecision: null, latestMessageDirection: t.messages[0]?.direction })) continue;
    const id = t.campaignCreator.campaignId;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

export type StuckCreator = {
  id: string;
  lifecycleStatus: string;
  /** Same stage the campaign Overview shows for them. */
  stage: DisplayStage;
  updatedAt: Date;
  campaign: { id: string; name: string };
  creator: { name: string | null; instagramHandle: string | null };
};

/**
 * Creators in sending campaigns with no progress for 3+ days. Leaves out
 * people not emailed yet (they're waiting on you to start, not stuck) and
 * anyone another Home row already covers: a reply to answer, an address to
 * check, or a gift order to finish. Anyone who posted or said no is finished,
 * so they never show here. Home and System status both use this.
 */
export async function findStuckCreators(
  brandId: string,
  opts: { campaignId?: string; now?: Date } = {},
): Promise<StuckCreator[]> {
  const cutoff = new Date((opts.now ?? new Date()).getTime() - STUCK_AFTER_DAYS * 24 * 60 * 60 * 1000);
  const rows = await prisma.campaignCreator.findMany({
    where: {
      campaign: { brandId, status: "active", ...(opts.campaignId ? { id: opts.campaignId } : {}) },
      updatedAt: { lt: cutoff },
      lifecycleStatus: { notIn: [...FINISHED_STATUSES, "ready"] },
    },
    select: {
      id: true,
      creatorId: true,
      createdAt: true,
      reviewStatus: true,
      lifecycleStatus: true,
      outreachCount: true,
      lastOutreachAt: true,
      lastReplyAt: true,
      updatedAt: true,
      replyDecision: true,
      campaign: { select: { id: true, name: true } },
      creator: { select: { name: true, instagramHandle: true } },
      conversationThread: {
        select: { messages: { orderBy: { createdAt: "desc" }, take: 1, select: { direction: true } } },
      },
      shippingSnapshots: { select: { isActive: true, confirmedAt: true } },
      shopifyOrder: { select: { status: true } },
      _count: { select: { mentionAssets: true } },
    },
    orderBy: { updatedAt: "asc" },
  });

  // Posts count the same way as the campaign page: hand-added links, plus tagged
  // posts that went up after they joined. Someone who posted is finished, not stuck.
  const tagged = rows.length
    ? await prisma.contentPost.findMany({
        where: { brandId, hidden: false, creatorId: { in: [...new Set(rows.map((r) => r.creatorId))] } },
        select: { creatorId: true, postedAt: true, createdAt: true },
      })
    : [];
  const postCount = (r: (typeof rows)[number]) =>
    r._count.mentionAssets +
    tagged.filter((p) => p.creatorId === r.creatorId && (p.postedAt ?? p.createdAt) >= r.createdAt).length;

  return rows
    .map((r) => ({
      r,
      stage: displayStage({
        reviewStatus: r.reviewStatus,
        lifecycleStatus: r.lifecycleStatus,
        outreachCount: r.outreachCount,
        lastOutreachAt: r.lastOutreachAt,
        lastReplyAt: r.lastReplyAt,
        replyDecision: r.replyDecision,
        latestMessageDirection: r.conversationThread?.messages[0]?.direction,
        shippingSnapshots: r.shippingSnapshots,
        orderStatus: r.shopifyOrder?.status ?? null,
        postCount: postCount(r),
      }),
    }))
    .filter(({ stage }) => stage !== "posted" && stage !== "done" && stage !== "said_no")
    .filter(
      ({ r }) =>
        !needsAnswer({
          replyDecision: r.replyDecision,
          latestMessageDirection: r.conversationThread?.messages[0]?.direction,
        }) &&
        !addressToCheck({ shippingSnapshots: r.shippingSnapshots }) &&
        r.shopifyOrder?.status !== "draft_created",
    )
    .map(({ r, stage }) => ({
      id: r.id,
      lifecycleStatus: r.lifecycleStatus,
      stage,
      updatedAt: r.updatedAt,
      campaign: r.campaign,
      creator: r.creator,
    }));
}

export type CampaignGroup = { campaignId: string; campaignName: string; count: number };

/** Count items per campaign, biggest first. */
export function groupByCampaign(items: readonly { campaign: { id: string; name: string } }[]): CampaignGroup[] {
  const groups = new Map<string, CampaignGroup>();
  for (const item of items) {
    const group = groups.get(item.campaign.id) ?? { campaignId: item.campaign.id, campaignName: item.campaign.name, count: 0 };
    group.count += 1;
    groups.set(item.campaign.id, group);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count);
}

/**
 * Creators with a written first email that hasn't been sent, per campaign.
 * Counts creators, not drafts, and only people not emailed yet in campaigns
 * that aren't finished or archived.
 */
export async function findOutreachWaitingToSend(brandId: string): Promise<CampaignGroup[]> {
  const rows = await prisma.campaignCreator.findMany({
    where: {
      campaign: { brandId, status: { in: ["draft", "active", "paused"] } },
      lifecycleStatus: "ready",
      aiDrafts: { some: { type: "outreach", status: "draft" } },
    },
    select: { campaign: { select: { id: true, name: true } } },
  });
  return groupByCampaign(rows);
}
