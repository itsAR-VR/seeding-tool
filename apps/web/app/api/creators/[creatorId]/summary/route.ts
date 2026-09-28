import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentBrandMembership, BrandAccessError } from "@/lib/integrations/brand-access";

type RouteContext = { params: Promise<{ creatorId: string }> };

/**
 * GET /api/creators/:creatorId/summary
 * Basic creator profile plus every campaign they're in, with links to act.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { creatorId } = await context.params;
    const membership = await getCurrentBrandMembership();

    const creator = await prisma.creator.findFirst({
      where: { id: creatorId, brandId: membership.brandId },
      select: {
        id: true,
        name: true,
        email: true,
        instagramHandle: true,
        followerCount: true,
        bio: true,
        optedOut: true,
        campaignCreators: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            reviewStatus: true,
            lifecycleStatus: true,
            replyDecision: true,
            campaign: { select: { id: true, name: true } },
            conversationThread: { select: { id: true } },
          },
        },
      },
    });
    if (!creator) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }
    return NextResponse.json(creator);
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[creators/summary]", error);
    return NextResponse.json({ error: "Failed to load creator" }, { status: 500 });
  }
}
