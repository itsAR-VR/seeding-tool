import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ campaignId: string }> };

/**
 * GET /api/campaigns/:campaignId — Campaign detail with stats.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { campaignId } = await context.params;

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

    const membership = await prisma.brandMembership.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    });

    if (!membership) {
      return NextResponse.json({ error: "No brand found" }, { status: 404 });
    }

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

    const membership = await prisma.brandMembership.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    });

    if (!membership) {
      return NextResponse.json({ error: "No brand found" }, { status: 404 });
    }

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
    console.error("[campaigns/PATCH]", error);
    return NextResponse.json(
      { error: "Failed to update campaign" },
      { status: 500 }
    );
  }
}
