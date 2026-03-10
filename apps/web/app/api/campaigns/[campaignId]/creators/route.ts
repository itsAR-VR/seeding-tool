import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";
import { validateInstagramCreators } from "@/lib/instagram/validator";

type RouteContext = { params: Promise<{ campaignId: string }> };

/**
 * GET /api/campaigns/:campaignId/creators — List creators in a campaign.
 * Query params: reviewStatus, lifecycleStatus
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { campaignId } = await context.params;
    const { searchParams } = new URL(request.url);
    const reviewStatus = searchParams.get("reviewStatus");
    const lifecycleStatus = searchParams.get("lifecycleStatus");

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

    const body = (await request.json()) as {
      creatorId?: string;
      // Or create a new creator inline
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

    return NextResponse.json(campaignCreator, { status: 201 });
  } catch (error) {
    console.error("[campaigns/creators/POST]", error);
    return NextResponse.json(
      { error: "Failed to add creator" },
      { status: 500 }
    );
  }
}
