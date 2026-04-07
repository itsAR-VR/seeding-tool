import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  attributeMention,
  createAndAttributeMention,
} from "@/lib/mentions/attribution";
import {
  getCurrentBrandMembership,
  requireWriteAccess,
  BrandAccessError,
} from "@/lib/integrations/brand-access";

/**
 * GET /api/mentions?campaignId=xxx
 *
 * List mentions for a campaign.
 */
export async function GET(request: NextRequest) {
  try {
    const membership = await getCurrentBrandMembership();

    const campaignId = request.nextUrl.searchParams.get("campaignId");

    const where: Record<string, unknown> = {};

    if (campaignId) {
      const campaignCreators = await prisma.campaignCreator.findMany({
        where: {
          campaignId,
          campaign: { brandId: membership.brandId },
        },
        select: { id: true },
      });

      where.campaignCreatorId = {
        in: campaignCreators.map((cc) => cc.id),
      };
    }

    const mentions = await prisma.mentionAsset.findMany({
      where,
      include: {
        campaignCreator: {
          include: {
            creator: {
              select: { name: true, email: true },
            },
            campaign: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(mentions);
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[mentions/GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch mentions" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/mentions
 *
 * Manual mention attribution or creation.
 */
export async function POST(request: NextRequest) {
  try {
    const membership = await getCurrentBrandMembership();
    requireWriteAccess(membership);

    const body = (await request.json()) as Record<string, unknown>;

    // Option 1: Attribute existing mention
    if (body.mentionAssetId && body.campaignCreatorId) {
      await attributeMention(
        body.mentionAssetId as string,
        body.campaignCreatorId as string
      );
      return NextResponse.json({ success: true, action: "attributed" });
    }

    // Option 2: Create and attribute
    if (body.platform && body.mediaUrl && body.campaignCreatorId) {
      const mentionId = await createAndAttributeMention({
        platform: body.platform as string,
        mediaUrl: body.mediaUrl as string,
        type: (body.type as string) || undefined,
        caption: (body.caption as string) || undefined,
        likes: body.likes ? Number(body.likes) : undefined,
        comments: body.comments ? Number(body.comments) : undefined,
        views: body.views ? Number(body.views) : undefined,
        postedAt: body.postedAt ? new Date(body.postedAt as string) : undefined,
        campaignCreatorId: body.campaignCreatorId as string,
      });

      return NextResponse.json({
        success: true,
        action: "created",
        mentionId,
      });
    }

    return NextResponse.json(
      {
        error:
          "Invalid request. Provide { mentionAssetId, campaignCreatorId } or { platform, mediaUrl, campaignCreatorId }",
      },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message =
      error instanceof Error ? error.message : "Failed to process mention";
    console.error("[mentions/POST]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
