import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentBrandMembership, BrandAccessError } from "@/lib/integrations/brand-access";
import {
  computeConversionRates,
  computeTimeToPost,
} from "@/lib/analytics/conversion";
import type {
  AnalyticsResponse,
  CreatorLeaderboardEntry,
} from "@/lib/analytics/types";
import { loadCampaignPosts } from "../_components/campaign-posts";
import { AnalyticsDashboard } from "./components/analytics-dashboard";

type PageProps = {
  params: Promise<{ campaignId: string }>;
};

/** Every stored lifecycle status we count. address_review is "address in, needs a check". */
const LIFECYCLE_KEYS = [
  "ready",
  "outreach_sent",
  "replied",
  "address_review",
  "address_confirmed",
  "order_created",
  "shipped",
  "delivered",
  "posted",
  "completed",
  "opted_out",
  "stalled",
] as const;

export default async function CampaignAnalyticsPage({ params }: PageProps) {
  const { campaignId } = await params;

  let membership;
  try {
    membership = await getCurrentBrandMembership();
  } catch (error) {
    if (error instanceof BrandAccessError) notFound();
    throw error;
  }

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, brandId: membership.brandId },
  });

  if (!campaign) notFound();

  // Load all campaign creators
  const campaignCreators = await prisma.campaignCreator.findMany({
    where: { campaignId, campaign: { brandId: membership.brandId } },
    select: {
      id: true,
      lifecycleStatus: true,
      reviewStatus: true,
      creatorId: true,
    },
  });

  const campaignCreatorIds = campaignCreators.map((cc) => cc.id);
  const totalCreators = campaignCreators.length;

  // Lifecycle breakdown
  const lifecycleBreakdown: Record<string, number> = {};
  for (const key of LIFECYCLE_KEYS) {
    lifecycleBreakdown[key] = campaignCreators.filter(
      (cc) => cc.lifecycleStatus === key
    ).length;
  }

  // Mention assets
  const mentionAssets = campaignCreatorIds.length > 0
    ? await prisma.mentionAsset.findMany({
        where: { campaignCreatorId: { in: campaignCreatorIds } },
        select: {
          id: true,
          platform: true,
          likes: true,
          comments: true,
          views: true,
          campaignCreatorId: true,
        },
      })
    : [];

  const totalMentions = mentionAssets.length;
  const totalLikes = mentionAssets.reduce((sum, m) => sum + (m.likes ?? 0), 0);
  const totalComments = mentionAssets.reduce(
    (sum, m) => sum + (m.comments ?? 0),
    0
  );
  const totalViews = mentionAssets.reduce((sum, m) => sum + (m.views ?? 0), 0);

  // Orders
  const orders = campaignCreatorIds.length > 0
    ? await prisma.shopifyOrder.findMany({
        where: { campaignCreatorId: { in: campaignCreatorIds } },
        select: { id: true, status: true, totalPrice: true },
      })
    : [];

  const totalOrders = orders.length;
  const totalProductValueCents = orders.reduce(
    (sum, o) => sum + (o.totalPrice ?? 0),
    0
  );

  // Cost records
  const costRecords = campaignCreatorIds.length > 0
    ? await prisma.costRecord.findMany({
        where: { campaignCreatorId: { in: campaignCreatorIds } },
        select: { amount: true, type: true },
      })
    : [];

  const totalCostCents = costRecords.reduce((sum, c) => sum + c.amount, 0);

  // --- Conversion rates ---
  const conversionRates = computeConversionRates(lifecycleBreakdown);

  // --- Time to post ---
  const outcomes = campaignCreatorIds.length > 0
    ? await prisma.campaignOutcome.findMany({
        where: { campaignCreatorId: { in: campaignCreatorIds } },
        select: { outreachSentAt: true, postedAt: true },
      })
    : [];

  const timeToPost = computeTimeToPost(outcomes);

  // --- Creator leaderboard ---
  const creatorIds = [...new Set(campaignCreators.map((cc) => cc.creatorId))];

  const creators = creatorIds.length > 0
    ? await prisma.creator.findMany({
        where: { id: { in: creatorIds } },
        select: {
          id: true,
          name: true,
          instagramHandle: true,
          tiktokHandle: true,
        },
      })
    : [];

  const creatorsById = new Map(creators.map((c) => [c.id, c]));
  const ccToCreator = new Map(
    campaignCreators.map((cc) => [cc.id, cc.creatorId])
  );

  const mentionsByCreator = new Map<
    string,
    { likes: number; comments: number; views: number; count: number }
  >();
  for (const m of mentionAssets) {
    const creatorId = ccToCreator.get(m.campaignCreatorId);
    if (!creatorId) continue;
    const existing = mentionsByCreator.get(creatorId) ?? {
      likes: 0,
      comments: 0,
      views: 0,
      count: 0,
    };
    mentionsByCreator.set(creatorId, {
      likes: existing.likes + (m.likes ?? 0),
      comments: existing.comments + (m.comments ?? 0),
      views: existing.views + (m.views ?? 0),
      count: existing.count + 1,
    });
  }

  const creatorLeaderboard: CreatorLeaderboardEntry[] = Array.from(
    mentionsByCreator.entries()
  )
    .map(([creatorId, stats]) => {
      const creator = creatorsById.get(creatorId);
      const handle = creator?.instagramHandle ?? creator?.tiktokHandle ?? "";
      const platform = creator?.instagramHandle ? "instagram" : "tiktok";
      return {
        creatorId,
        creatorName: creator?.name ?? "Unnamed creator",
        handle,
        platform,
        totalLikes: stats.likes,
        totalComments: stats.comments,
        totalViews: stats.views,
        mentionCount: stats.count,
      };
    })
    .sort(
      (a, b) =>
        b.totalLikes +
        b.totalComments +
        b.totalViews -
        (a.totalLikes + a.totalComments + a.totalViews)
    )
    .slice(0, 20);

  // --- Costs by type ---
  const costsByType = costRecords.reduce<Record<string, number>>(
    (acc, c) => ({
      ...acc,
      [c.type]: (acc[c.type] ?? 0) + c.amount,
    }),
    {}
  );

  // --- Build initial data for client components ---
  const mentionsByPlatform = mentionAssets.reduce<Record<string, number>>(
    (acc, m) => ({
      ...acc,
      [m.platform]: (acc[m.platform] ?? 0) + 1,
    }),
    {}
  );

  const orderStatusBreakdown = orders.reduce<Record<string, number>>(
    (acc, o) => ({
      ...acc,
      [o.status]: (acc[o.status] ?? 0) + 1,
    }),
    {}
  );

  const initialData: AnalyticsResponse = {
    campaignId,
    summary: {
      totalCreators,
      totalMentions,
      totalOrders,
      totalLikes,
      totalComments,
      totalViews,
      totalProductValueCents,
      totalCostCents,
    },
    lifecycle: lifecycleBreakdown,
    review: {
      pending: campaignCreators.filter((cc) => cc.reviewStatus === "pending").length,
      approved: campaignCreators.filter((cc) => cc.reviewStatus === "approved").length,
      declined: campaignCreators.filter((cc) => cc.reviewStatus === "declined").length,
      deferred: campaignCreators.filter((cc) => cc.reviewStatus === "deferred").length,
    },
    mentions: {
      total: totalMentions,
      byPlatform: mentionsByPlatform,
      engagement: { likes: totalLikes, comments: totalComments, views: totalViews },
    },
    orders: {
      total: totalOrders,
      byStatus: orderStatusBreakdown,
    },
    conversionRates,
    timeToPost,
    creatorLeaderboard,
    costsByType,
  };

  // Posts: tagged Instagram posts from this campaign's creators plus posts added by hand.
  const posts = await loadCampaignPosts(membership.brandId, campaignId);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Results</h1>
        <p className="mt-1 text-muted-foreground">
          How {campaign.name} is going, from first email to posts.
        </p>
      </header>

      {totalCreators === 0 ? (
        <div className="rounded-xl border bg-card p-5">
          <p>
            No results yet. Add creators to this campaign and email them, and their replies, orders,
            and posts will show up here.
          </p>
          <Link
            href={`/campaigns/${campaignId}/discover`}
            className="mt-2 inline-block font-medium underline"
          >
            Find creators
          </Link>
        </div>
      ) : (
        <AnalyticsDashboard
          initialData={initialData}
          campaignName={campaign.name}
          postCount={posts.length}
        />
      )}
    </div>
  );
}
