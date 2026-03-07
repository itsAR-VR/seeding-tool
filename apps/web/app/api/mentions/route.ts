import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";
import {
  attributeMention,
  createAndAttributeMention,
} from "@/lib/mentions/attribution";

/**
 * GET /api/mentions?campaignId=xxx
 *
 * List mentions for a campaign.
 */
export async function GET(request: NextRequest) {
  try {
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
    });

    if (!membership) {
      return NextResponse.json({ error: "No brand found" }, { status: 404 });
    }

    const campaignId = request.nextUrl.searchParams.get("campaignId");

    const where: Record<string, unknown> = {};

    if (campaignId) {
      // Get all campaign creators for this campaign
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
 *
 * Body options:
 * 1. { mentionAssetId, campaignCreatorId } — attribute existing mention
 * 2. { platform, mediaUrl, type?, caption?, campaignCreatorId } — create + attribute
 */
export async function POST(request: NextRequest) {
  try {
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
    const message =
      error instanceof Error ? error.message : "Failed to process mention";
    console.error("[mentions/POST]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
