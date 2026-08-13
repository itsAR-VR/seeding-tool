import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateInstagramCreators } from "@/lib/instagram/validator";
import { inngest } from "@/lib/inngest/client";
import {
  getCurrentBrandMembership,
  requireWriteAccess,
  BrandAccessError,
} from "@/lib/integrations/brand-access";

type RouteContext = { params: Promise<{ campaignId: string }> };

/**
 * GET /api/campaigns/:campaignId/creators — List creators in a campaign.
 * Query params: reviewStatus, lifecycleStatus
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { campaignId } = await context.params;
    const membership = await getCurrentBrandMembership();

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

    const { searchParams } = new URL(request.url);
    const reviewStatus = searchParams.get("reviewStatus");
    const lifecycleStatus = searchParams.get("lifecycleStatus");

    const where: Record<string, unknown> = { campaignId };
    if (reviewStatus) where.reviewStatus = reviewStatus;
    if (lifecycleStatus) where.lifecycleStatus = lifecycleStatus;

    const creators = await prisma.campaignCreator.findMany({
      where,
      include: {
        creator: {
          include: { profiles: true },
        },
        shopifyOrder: {
          include: {
            fulfillmentEvents: {
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(creators);
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[campaigns/creators/GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch creators" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/campaigns/:campaignId/creators — Add a creator to a campaign.
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

    const body = (await request.json()) as {
      creatorId?: string;
      name?: string;
      email?: string;
      handle?: string;
      platform?: string;
      followerCount?: number;
      profileUrl?: string;
    };

    let creatorId = body.creatorId;

    if (creatorId) {
      const existingCreator = await prisma.creator.findFirst({
        where: {
          id: creatorId,
          brandId: membership.brandId,
        },
        select: {
          id: true,
          instagramHandle: true,
          validationStatus: true,
        },
      });

      if (!existingCreator) {
        return NextResponse.json(
          { error: "Creator not found" },
          { status: 404 }
        );
      }

      if (existingCreator.validationStatus === "invalid") {
        return NextResponse.json(
          { error: "Creator failed Instagram validation" },
          { status: 422 }
        );
      }
    }

    // If no existing creator ID, create one
    if (!creatorId) {
      if (!body.handle?.trim()) {
        return NextResponse.json(
          { error: "A valid Instagram handle is required" },
          { status: 400 }
        );
      }

      const [validation] = await validateInstagramCreators(
        [{ handle: body.handle }],
        {
          concurrency: 1,
          includeAvgViews: false,
        }
      );

      if (!validation || validation.status !== "valid") {
        return NextResponse.json(
          {
            error: "Instagram handle could not be validated",
            validationError: validation?.error ?? "missing_profile",
          },
          { status: 422 }
        );
      }

      const creator = await prisma.creator.create({
        data: {
          name: body.name,
          email: body.email,
          instagramHandle: body.handle.trim().replace(/^@/, ""),
          followerCount: validation.followerCount,
          validationStatus: "valid",
          lastValidatedAt: new Date(),
          lastValidationError: null,
          brandId: membership.brandId,
          profiles: {
            create: {
              platform: body.platform ?? "instagram",
              handle: body.handle.trim().replace(/^@/, ""),
              url: validation.url || body.profileUrl,
              followerCount: validation.followerCount,
            },
          },
        },
      });
      creatorId = creator.id;
    }

    // Check for duplicate
    const existing = await prisma.campaignCreator.findUnique({
      where: {
        campaignId_creatorId: { campaignId, creatorId },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Creator already in campaign" },
        { status: 409 }
      );
    }

    const campaignCreator = await prisma.campaignCreator.create({
      data: {
        campaignId,
        creatorId,
        reviewStatus: "pending",
        lifecycleStatus: "ready",
      },
      include: {
        creator: { include: { profiles: true } },
      },
    });

    await inngest.send({
      name: "creator-avg-views/requested",
      data: {
        creatorIds: [creatorId],
      },
    });

    return NextResponse.json(campaignCreator, { status: 201 });
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[campaigns/creators/POST]", error);
    return NextResponse.json(
      { error: "Failed to add creator" },
      { status: 500 }
    );
  }
}
