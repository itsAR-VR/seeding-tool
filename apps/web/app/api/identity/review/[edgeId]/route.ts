import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  BrandAccessError,
  getCurrentBrandMembership,
} from "@/lib/integrations/brand-access";
import { getFeatureFlags } from "@/lib/feature-flags";
import { resolveIdentityEdge } from "@/lib/identity/matching";

type RouteContext = { params: Promise<{ edgeId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { edgeId } = await context.params;
    const membership = await getCurrentBrandMembership({ requireAdmin: true });
    const flags = await getFeatureFlags(membership.brandId);
    if (!flags.identityGraphEnabled) {
      return NextResponse.json(
        { error: "Identity review is disabled for this brand" },
        { status: 403 }
      );
    }
    const body = (await request.json()) as { action?: "confirm" | "reject" | "defer" };

    if (!body.action || !["confirm", "reject", "defer"].includes(body.action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const edge = await prisma.identityEdge.findUnique({
      where: { id: edgeId },
      include: {
        fromProfile: {
          include: {
            influencer: {
              include: {
                creators: {
                  where: { brandId: membership.brandId },
                  select: { id: true },
                  take: 1,
                },
              },
            },
          },
        },
        toProfile: {
          include: {
            influencer: {
              include: {
                creators: {
                  where: { brandId: membership.brandId },
                  select: { id: true },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    if (!edge) {
      return NextResponse.json({ error: "Identity edge not found" }, { status: 404 });
    }

    const brandVisible =
      edge.fromProfile.influencer.creators.length > 0 ||
      edge.toProfile.influencer.creators.length > 0;
    if (!brandVisible) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Merges reassign every profile/creator on the source identity globally.
    // Only allow review when both identities are exclusively owned by this
    // brand — no creator on either identity may belong to another tenant.
    const foreignCreatorCount = await prisma.creator.count({
      where: {
        influencerIdentityId: {
          in: [edge.fromProfile.influencerId, edge.toProfile.influencerId],
        },
        brandId: { not: membership.brandId },
      },
    });
    if (foreignCreatorCount > 0) {
      return NextResponse.json(
        { error: "Identity is shared with another brand and cannot be reviewed here" },
        { status: 403 }
      );
    }

    const updated = await resolveIdentityEdge(
      edgeId,
      body.action,
      membership.userId
    );

    return NextResponse.json({ edge: updated });
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[identity/review/[edgeId]/POST]", error);
    return NextResponse.json(
      { error: "Failed to update identity review" },
      { status: 500 }
    );
  }
}
