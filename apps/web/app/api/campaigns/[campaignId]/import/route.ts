import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ campaignId: string }> };

/**
 * POST /api/campaigns/:campaignId/import — Batch import existing creators into a campaign.
 *
 * Body: { creatorIds: string[] }
 *
 * Creates CampaignCreator rows with reviewStatus: "pending" (PENDING_REVIEW).
 * Skips creators already in the campaign.
 */
export async function POST(request: NextRequest, context: RouteContext) {
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

    // Verify campaign access
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, brandId: membership.brandId },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    const body = (await request.json()) as { creatorIds: string[] };

    if (
      !body.creatorIds ||
      !Array.isArray(body.creatorIds) ||
      body.creatorIds.length === 0
    ) {
      return NextResponse.json(
        { error: "creatorIds array required" },
        { status: 400 }
      );
    }

    // Verify all creators belong to this brand
    const creators = await prisma.creator.findMany({
      where: {
        id: { in: body.creatorIds },
        brandId: membership.brandId,
      },
      select: { id: true },
    });

    const validIds = new Set(creators.map((c) => c.id));

    // Find existing campaign creators to avoid duplicates
    const existing = await prisma.campaignCreator.findMany({
      where: {
        campaignId,
        creatorId: { in: body.creatorIds },
      },
      select: { creatorId: true },
    });

    const existingIds = new Set(existing.map((e) => e.creatorId));

    // Filter to only new, valid creators
    const toCreate = body.creatorIds.filter(
      (id) => validIds.has(id) && !existingIds.has(id)
    );

    if (toCreate.length > 0) {
      await prisma.campaignCreator.createMany({
        data: toCreate.map((creatorId) => ({
          campaignId,
          creatorId,
          reviewStatus: "pending",
          lifecycleStatus: "ready",
        })),
      });
    }

    return NextResponse.json({
      added: toCreate.length,
      skipped: existingIds.size,
      invalid: body.creatorIds.length - validIds.size,
    });
  } catch (error) {
    console.error("[campaigns/import/POST]", error);
    return NextResponse.json(
      { error: "Failed to import creators" },
      { status: 500 }
    );
  }
}
