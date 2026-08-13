import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCurrentBrandMembership,
  requireWriteAccess,
  BrandAccessError,
} from "@/lib/integrations/brand-access";

type RouteContext = { params: Promise<{ campaignId: string }> };

/**
 * POST /api/campaigns/:campaignId/import — Batch import existing creators into a campaign.
 *
 * Body: { creatorIds: string[] }
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { campaignId } = await context.params;
    const membership = await getCurrentBrandMembership();
    requireWriteAccess(membership);

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
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[campaigns/import/POST]", error);
    return NextResponse.json(
      { error: "Failed to import creators" },
      { status: 500 }
    );
  }
}
