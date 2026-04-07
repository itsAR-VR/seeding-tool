import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCurrentBrandMembership,
  BrandAccessError,
} from "@/lib/integrations/brand-access";

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
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { campaignId } = await context.params;
    const membership = await getCurrentBrandMembership();

    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, brandId: membership.brandId },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // --- Lifecycle stage breakdown ---
    const campaignCreators = await prisma.campaignCreator.findMany({
      where: { campaignId },
      select: {
        id: true,
        lifecycleStatus: true,
        reviewStatus: true,
      },
    });

    const totalCreators = campaignCreators.length;

    const lifecycleBreakdown = LIFECYCLE_STAGES.reduce<Record<string, number>>(
      (acc, stage) => {
        acc[stage] = campaignCreators.filter(
          (cc) => cc.lifecycleStatus === stage
        ).length;
        return acc;
      },
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

    const mentionAssets = await prisma.mentionAsset.findMany({
      where: { campaignCreatorId: { in: campaignCreatorIds } },
      select: {
        id: true,
        platform: true,
        likes: true,
        comments: true,
        views: true,
        type: true,
      },
    });

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
      (acc, m) => {
        acc[m.platform] = (acc[m.platform] ?? 0) + 1;
        return acc;
      },
      {}
    );

    // --- Order / shipping stats ---
    const orders = await prisma.shopifyOrder.findMany({
      where: { campaignCreatorId: { in: campaignCreatorIds } },
      select: {
        id: true,
        status: true,
        totalPrice: true,
      },
    });

    const totalOrders = orders.length;
    const orderStatusBreakdown = orders.reduce<Record<string, number>>(
      (acc, o) => {
        acc[o.status] = (acc[o.status] ?? 0) + 1;
        return acc;
      },
      {}
    );

    const totalProductValue = orders.reduce(
      (sum, o) => sum + (o.totalPrice ?? 0),
      0
    );

    // --- Cost records ---
    const costRecords = await prisma.costRecord.findMany({
      where: { campaignCreatorId: { in: campaignCreatorIds } },
      select: { amount: true, currency: true, type: true },
    });

    const totalCost = costRecords.reduce((sum, c) => sum + c.amount, 0);

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
    });
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[campaigns/analytics/GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
