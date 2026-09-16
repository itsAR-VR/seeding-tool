import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { completeDraftOrder } from "@/lib/shopify/orders";
import { getFeatureFlags } from "@/lib/feature-flags";
import { recordOutcomeEvent } from "@/lib/seeding/outcome-recorder";
import {
  getCurrentBrandMembership,
  requireWriteAccess,
  BrandAccessError,
} from "@/lib/integrations/brand-access";

type RouteContext = {
  params: Promise<{ campaignId: string; creatorId: string }>;
};

/**
 * POST /api/campaigns/[campaignId]/creators/[creatorId]/order
 *
 * Completes a reviewed Shopify draft order for a creator.
 * Human-initiated only.
 */
export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { campaignId, creatorId } = await context.params;
    const membership = await getCurrentBrandMembership();
    requireWriteAccess(membership);

    // Feature flag guard: Shopify order creation must be enabled
    const flags = await getFeatureFlags(membership.brandId);
    if (!flags.shopifyOrderEnabled) {
      return NextResponse.json({ error: "Shopify order creation is disabled for this brand" }, { status: 403 });
    }

    // Verify campaign belongs to brand
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign || campaign.brandId !== membership.brandId) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Complete the reviewed draft order into a real Shopify order.
    const result = await completeDraftOrder(
      membership.brandId,
      creatorId,
      campaignId
    );

    await recordOutcomeEvent({
      campaignCreatorId: result.campaignCreatorId,
      event: { type: "order_created" },
    });

    return NextResponse.json({
      success: true,
      shopifyOrderId: result.shopifyOrderId,
      orderId: result.orderId,
    });
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message =
      error instanceof Error ? error.message : "Failed to create order";
    console.error("[order/POST]", message);

    // Create intervention for order failures
    try {
      const { campaignId, creatorId } = await context.params;
      const campaignCreator = await prisma.campaignCreator.findUnique({
        where: {
          campaignId_creatorId: { campaignId, creatorId },
        },
        include: { campaign: true },
      });

      if (campaignCreator) {
        await prisma.interventionCase.create({
          data: {
            type: "duplicate_order",
            status: "open",
            priority: "high",
            title: "Order creation failed",
            description: `Failed to create Shopify order: ${message}`,
            brandId: campaignCreator.campaign.brandId,
            campaignCreatorId: campaignCreator.id,
          },
        });
      }
    } catch {
      // Don't fail the response if intervention creation fails
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
