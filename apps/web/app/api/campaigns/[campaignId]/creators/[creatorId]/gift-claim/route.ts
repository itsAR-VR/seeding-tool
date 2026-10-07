import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCurrentBrandMembership,
  requireWriteAccess,
  BrandAccessError,
} from "@/lib/integrations/brand-access";
import {
  buildClaimUrl,
  createClaimToken,
  hashClaimToken,
} from "@/lib/gift-claims/tokens";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ campaignId: string; creatorId: string }>;
};

const CLAIM_LINK_TTL_DAYS = 14;
const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
};

/**
 * POST /api/campaigns/[campaignId]/creators/[creatorId]/gift-claim
 *
 * Generates a private one-time gift claim link for an approved creator.
 * The raw token is returned once for operator copy/paste; only a hash is stored.
 */
export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { campaignId, creatorId } = await context.params;
    const membership = await getCurrentBrandMembership();
    requireWriteAccess(membership);

    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, brandId: membership.brandId },
      include: {
        campaignProducts: {
          include: { product: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    const campaignProduct = campaign.campaignProducts[0];
    if (!campaignProduct) {
      return NextResponse.json(
        { error: "Add a campaign product before generating a claim link" },
        { status: 422, headers: NO_STORE_HEADERS }
      );
    }

    const campaignCreator = await prisma.campaignCreator.findUnique({
      where: {
        campaignId_creatorId: { campaignId, creatorId },
      },
    });

    if (!campaignCreator) {
      return NextResponse.json(
        { error: "Campaign creator not found" },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    if (campaignCreator.reviewStatus !== "approved") {
      return NextResponse.json(
        { error: "Approve this creator before generating a gift claim link" },
        { status: 409, headers: NO_STORE_HEADERS }
      );
    }

    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + CLAIM_LINK_TTL_DAYS);

    const token = createClaimToken();
    const tokenHash = hashClaimToken(token);

    await prisma.$transaction([
      prisma.creatorGiftClaim.updateMany({
        where: {
          campaignCreatorId: campaignCreator.id,
          claimedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { revokedAt: now },
      }),
      prisma.creatorGiftClaim.create({
        data: {
          tokenHash,
          expiresAt,
          createdBy: membership.userId,
          campaignCreatorId: campaignCreator.id,
          campaignProductId: campaignProduct.id,
        },
      }),
    ]);

    return NextResponse.json(
      {
        claimUrl: buildClaimUrl(token),
        expiresAt: expiresAt.toISOString(),
        productName: campaignProduct.product.name,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: NO_STORE_HEADERS }
      );
    }

    console.error("[gift-claim/POST]", error);
    return NextResponse.json(
      { error: "Failed to generate gift claim link" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
