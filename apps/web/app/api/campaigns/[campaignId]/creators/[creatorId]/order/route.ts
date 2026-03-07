import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";
import { createDraftOrder } from "@/lib/shopify/orders";

type RouteContext = {
  params: Promise<{ campaignId: string; creatorId: string }>;
};

/**
 * POST /api/campaigns/[campaignId]/creators/[creatorId]/order
 *
 * Triggers Shopify order creation for a creator with confirmed address.
 * Human-initiated only.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserBySupabaseId(authUser.id);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { campaignId, creatorId } = await context.params;

    // Verify brand membership
    const membership = await prisma.brandMembership.findFirst({
      where: { userId: user.id },
    });

    if (!membership) {
      return NextResponse.json({ error: "No brand found" }, { status: 404 });
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

    // Create the order
    const result = await createDraftOrder(
      membership.brandId,
      creatorId,
      campaignId
    );

    return NextResponse.json({
      success: true,
      shopifyOrderId: result.shopifyOrderId,
      orderId: result.orderId,
    });
  } catch (error) {
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
