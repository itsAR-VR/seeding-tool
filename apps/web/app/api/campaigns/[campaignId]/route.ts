import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCurrentBrandMembership,
  requireWriteAccess,
  BrandAccessError,
} from "@/lib/integrations/brand-access";

type RouteContext = { params: Promise<{ campaignId: string }> };

/**
 * GET /api/campaigns/:campaignId — Campaign detail with stats.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { campaignId } = await context.params;
    const membership = await getCurrentBrandMembership();

    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, brandId: membership.brandId },
      include: {
        campaignProducts: {
          include: { product: true },
        },
        campaignCreators: {
          include: {
            creator: {
              include: { profiles: true },
            },
          },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Compute stats
    const creators = campaign.campaignCreators;
    const stats = {
      total: creators.length,
      pendingReview: creators.filter((c) => c.reviewStatus === "pending")
        .length,
      approved: creators.filter((c) => c.reviewStatus === "approved").length,
      declined: creators.filter((c) => c.reviewStatus === "declined").length,
      outreachSent: creators.filter(
        (c) =>
          c.lifecycleStatus !== "ready" && c.reviewStatus === "approved"
      ).length,
      replied: creators.filter((c) => c.lifecycleStatus === "replied").length,
      addressConfirmed: creators.filter(
        (c) => c.lifecycleStatus === "address_confirmed"
      ).length,
    };

    return NextResponse.json({ ...campaign, stats });
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[campaigns/GET:id]", error);
    return NextResponse.json(
      { error: "Failed to fetch campaign" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/campaigns/:campaignId — Update campaign.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { campaignId } = await context.params;
    const membership = await getCurrentBrandMembership();
    requireWriteAccess(membership);

    // Verify campaign belongs to brand
    const existing = await prisma.campaign.findFirst({
      where: { id: campaignId, brandId: membership.brandId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    const body = (await request.json()) as {
      name?: string;
      description?: string;
      status?: string;
    };

    const campaign = await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        name: body.name?.trim(),
        description: body.description?.trim(),
        status: body.status,
      },
    });

    return NextResponse.json(campaign);
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[campaigns/PATCH]", error);
    return NextResponse.json(
      { error: "Failed to update campaign" },
      { status: 500 }
    );
  }
}
