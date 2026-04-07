import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCurrentBrandMembership,
  requireWriteAccess,
  BrandAccessError,
} from "@/lib/integrations/brand-access";

/**
 * GET /api/campaigns — List campaigns for the user's brand.
 */
export async function GET() {
  try {
    const membership = await getCurrentBrandMembership();

    const campaigns = await prisma.campaign.findMany({
      where: { brandId: membership.brandId },
      include: {
        _count: {
          select: { campaignCreators: true },
        },
        campaignProducts: {
          include: { product: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(campaigns);
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[campaigns/GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch campaigns" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/campaigns — Create a new campaign.
 */
export async function POST(request: NextRequest) {
  try {
    const membership = await getCurrentBrandMembership();
    requireWriteAccess(membership);

    const body = (await request.json()) as {
      name: string;
      description?: string;
      productIds?: string[];
    };

    if (!body.name || body.name.trim().length === 0) {
      return NextResponse.json(
        { error: "Campaign name is required" },
        { status: 400 }
      );
    }

    const campaign = await prisma.campaign.create({
      data: {
        name: body.name.trim(),
        description: body.description?.trim(),
        status: "draft",
        brandId: membership.brandId,
        campaignProducts: body.productIds?.length
          ? {
              create: body.productIds.map((productId) => ({
                productId,
              })),
            }
          : undefined,
      },
      include: {
        campaignProducts: {
          include: { product: { select: { name: true } } },
        },
      },
    });

    return NextResponse.json(campaign, { status: 201 });
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[campaigns/POST]", error);
    return NextResponse.json(
      { error: "Failed to create campaign" },
      { status: 500 }
    );
  }
}
