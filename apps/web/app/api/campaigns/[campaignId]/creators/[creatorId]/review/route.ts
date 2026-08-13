import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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
 * POST /api/campaigns/:campaignId/creators/:creatorId/review
 * Body: { action: "approve" | "decline" | "defer", reason?: string }
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { campaignId, creatorId } = await context.params;
    const membership = await getCurrentBrandMembership();
    requireWriteAccess(membership);

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
      reviewedBy: membership.userId,
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

    await recordOutcomeEvent({
      campaignCreatorId: campaignCreator.id,
      event: {
        type: "review",
        decision:
          body.action === "approve"
            ? "approved"
            : body.action === "decline"
              ? "declined"
              : "deferred",
        reason: body.reason,
        by: membership.userId,
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        action: `creator.${body.action}`,
        entityType: "CampaignCreator",
        entityId: campaignCreator.id,
        metadata: { reason: body.reason },
        userId: membership.userId,
        brandId: membership.brandId,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[creators/review/POST]", error);
    return NextResponse.json(
      { error: "Failed to review creator" },
      { status: 500 }
    );
  }
}
