import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCurrentBrandMembership,
  BrandAccessError,
} from "@/lib/integrations/brand-access";
import {
  computeConversionRates,
  computeTimeToPost,
} from "@/lib/analytics/conversion";
import type { CreatorLeaderboardEntry } from "@/lib/analytics/types";

type RouteContext = { params: Promise<{ campaignId: string }> };

const LIFECYCLE_STAGES = [
  "ready",
  "outreach_sent",
  "replied",
  "address_confirmed",
  "order_created",
  "shipped",
  "delivered",
  "posted",
  "completed",
  "opted_out",
  "stalled",
] as const;

/**
 * GET /api/campaigns/:campaignId/analytics
 *
 * Returns aggregated campaign analytics.
 * Query params:
 *   - from (ISO date): filter creators added on or after this date
 *   - to (ISO date): filter creators added on or before this date
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { campaignId } = await context.params;
    const membership = await getCurrentBrandMembership();

    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, brandId: membership.brandId },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // --- Parse date range filters ---
    const url = new URL(request.url);
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");

    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (fromParam) {
      const fromDate = new Date(fromParam);
      if (!Number.isNaN(fromDate.getTime())) {
        dateFilter.gte = fromDate;
      }
    }
    if (toParam) {
      const toDate = new Date(toParam);
      if (!Number.isNaN(toDate.getTime())) {
        // Set to end of day
        toDate.setHours(23, 59, 59, 999);
        dateFilter.lte = toDate;
      }
    }

    const creatorWhere = {
      campaignId,
      ...(Object.keys(dateFilter).length > 0
        ? { createdAt: dateFilter }
        : {}),
    };

    // --- Lifecycle stage breakdown ---
    const campaignCreators = await prisma.campaignCreator.findMany({
      where: creatorWhere,
      select: {
        id: true,
        lifecycleStatus: true,
        reviewStatus: true,
        creatorId: true,
      },
    });

    const totalCreators = campaignCreators.length;

    const lifecycleBreakdown = LIFECYCLE_STAGES.reduce<Record<string, number>>(
      (acc, stage) => ({
        ...acc,
        [stage]: campaignCreators.filter(
          (cc) => cc.lifecycleStatus === stage
        ).length,
      }),
      {}
    );

    const reviewBreakdown = {
      pending: campaignCreators.filter((cc) => cc.reviewStatus === "pending")
        .length,
      approved: campaignCreators.filter((cc) => cc.reviewStatus === "approved")
        .length,
      declined: campaignCreators.filter((cc) => cc.reviewStatus === "declined")
        .length,
      deferred: campaignCreators.filter((cc) => cc.reviewStatus === "deferred")
        .length,
    };

    // --- Mention / engagement metrics ---
    const campaignCreatorIds = campaignCreators.map((cc) => cc.id);

    const mentionAssets =
      campaignCreatorIds.length > 0
        ? await prisma.mentionAsset.findMany({
            where: { campaignCreatorId: { in: campaignCreatorIds } },
            select: {
              id: true,
              platform: true,
              likes: true,
              comments: true,
              views: true,
              type: true,
              campaignCreatorId: true,
            },
          })
        : [];

    const totalMentions = mentionAssets.length;
    const totalLikes = mentionAssets.reduce(
      (sum, m) => sum + (m.likes ?? 0),
      0
    );
    const totalComments = mentionAssets.reduce(
      (sum, m) => sum + (m.comments ?? 0),
      0
    );
    const totalViews = mentionAssets.reduce(
      (sum, m) => sum + (m.views ?? 0),
      0
    );

    const mentionsByPlatform = mentionAssets.reduce<Record<string, number>>(
      (acc, m) => ({
        ...acc,
        [m.platform]: (acc[m.platform] ?? 0) + 1,
      }),
      {}
    );

    // --- Order / shipping stats ---
    const orders =
      campaignCreatorIds.length > 0
        ? await prisma.shopifyOrder.findMany({
            where: { campaignCreatorId: { in: campaignCreatorIds } },
            select: {
              id: true,
              status: true,
              totalPrice: true,
            },
          })
        : [];

    const totalOrders = orders.length;
    const orderStatusBreakdown = orders.reduce<Record<string, number>>(
      (acc, o) => ({
        ...acc,
        [o.status]: (acc[o.status] ?? 0) + 1,
      }),
      {}
    );

    const totalProductValue = orders.reduce(
      (sum, o) => sum + (o.totalPrice ?? 0),
      0
    );

    // --- Cost records ---
    const costRecords =
      campaignCreatorIds.length > 0
        ? await prisma.costRecord.findMany({
            where: { campaignCreatorId: { in: campaignCreatorIds } },
            select: { amount: true, currency: true, type: true },
          })
        : [];

    const totalCost = costRecords.reduce((sum, c) => sum + c.amount, 0);

    // --- NEW: Conversion rates ---
    const conversionRates = computeConversionRates(lifecycleBreakdown);

    // --- NEW: Time to post ---
    const outcomes =
      campaignCreatorIds.length > 0
        ? await prisma.campaignOutcome.findMany({
            where: { campaignCreatorId: { in: campaignCreatorIds } },
            select: {
              outreachSentAt: true,
              postedAt: true,
            },
          })
        : [];

    const timeToPost = computeTimeToPost(outcomes);

    // --- NEW: Creator leaderboard (top 20 by engagement) ---
    const creatorIds = [
      ...new Set(campaignCreators.map((cc) => cc.creatorId)),
    ];

    const creators =
      creatorIds.length > 0
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

    // Map campaignCreatorId -> creatorId
    const ccToCreator = new Map(
      campaignCreators.map((cc) => [cc.id, cc.creatorId])
    );

    // Group mentions by creator
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
          creatorName: creator?.name ?? "Unknown",
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

    // --- NEW: Costs by type ---
    const costsByType = costRecords.reduce<Record<string, number>>(
      (acc, c) => ({
        ...acc,
        [c.type]: (acc[c.type] ?? 0) + c.amount,
      }),
      {}
    );

    return NextResponse.json({
      campaignId,
      summary: {
        totalCreators,
        totalMentions,
        totalOrders,
        totalLikes,
        totalComments,
        totalViews,
        totalProductValueCents: totalProductValue,
        totalCostCents: totalCost,
      },
      lifecycle: lifecycleBreakdown,
      review: reviewBreakdown,
      mentions: {
        total: totalMentions,
        byPlatform: mentionsByPlatform,
        engagement: {
          likes: totalLikes,
          comments: totalComments,
          views: totalViews,
        },
      },
      orders: {
        total: totalOrders,
        byStatus: orderStatusBreakdown,
      },
      conversionRates,
      timeToPost,
      creatorLeaderboard,
      costsByType,
    });
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("[campaigns/analytics/GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
