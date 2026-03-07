import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ campaignId: string; creatorId: string }>;
};

/**
 * POST /api/campaigns/:campaignId/creators/:creatorId/review
 * Body: { action: "approve" | "decline" | "defer", reason?: string }
 *
 * Mutates both reviewStatus and lifecycleStatus correctly:
 * - approve → reviewStatus: "approved", lifecycleStatus: "ready"
 * - decline → reviewStatus: "declined", lifecycleStatus stays unchanged
 * - defer   → reviewStatus: "deferred", lifecycleStatus stays unchanged
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { campaignId, creatorId } = await context.params;

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
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, brandId: membership.brandId },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Find the campaign creator
    const campaignCreator = await prisma.campaignCreator.findUnique({
      where: {
        campaignId_creatorId: { campaignId, creatorId },
      },
    });

    if (!campaignCreator) {
      return NextResponse.json(
        { error: "Creator not found in campaign" },
        { status: 404 }
      );
    }

    const body = (await request.json()) as {
      action: "approve" | "decline" | "defer";
      reason?: string;
    };

    if (!["approve", "decline", "defer"].includes(body.action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be: approve, decline, or defer" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {
      reviewedAt: new Date(),
      reviewedBy: user.id,
    };

    switch (body.action) {
      case "approve":
        updateData.reviewStatus = "approved";
        updateData.lifecycleStatus = "ready";
        break;
      case "decline":
        updateData.reviewStatus = "declined";
        updateData.declineReason = body.reason ?? null;
        break;
      case "defer":
        updateData.reviewStatus = "deferred";
        break;
    }

    const updated = await prisma.campaignCreator.update({
      where: { id: campaignCreator.id },
      data: updateData,
      include: {
        creator: { include: { profiles: true } },
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        action: `creator.${body.action}`,
        entityType: "CampaignCreator",
        entityId: campaignCreator.id,
        metadata: { reason: body.reason },
        userId: user.id,
        brandId: membership.brandId,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[creators/review/POST]", error);
    return NextResponse.json(
      { error: "Failed to review creator" },
      { status: 500 }
    );
  }
}
