import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  attributeMention,
  createAndAttributeMention,
  MentionAccessError,
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

    // Always scope to the caller's brand. Without a campaignId this used to
    // return every company's mentions.
    const mentions = await prisma.mentionAsset.findMany({
      where: {
        campaignCreator: {
          campaign: {
            brandId: membership.brandId,
            ...(campaignId ? { id: campaignId } : {}),
          },
        },
      },
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
      { error: "Couldn't load posts. Refresh the page to try again." },
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
        body.campaignCreatorId as string,
        membership.brandId
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
        brandId: membership.brandId,
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
          "Add the post link and pick the creator who posted it.",
      },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof MentionAccessError) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error("[mentions/POST]", error);
    return NextResponse.json(
      { error: "Couldn't save that post. Try again in a minute." },
      { status: 500 }
    );
  }
}
