import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  BrandAccessError,
  getCurrentBrandMembership,
} from "@/lib/integrations/brand-access";
import { getFeatureFlags } from "@/lib/feature-flags";

export async function GET() {
  try {
    const membership = await getCurrentBrandMembership({ requireAdmin: true });
    const flags = await getFeatureFlags(membership.brandId);
    if (!flags.identityGraphEnabled) {
      return NextResponse.json(
        { error: "Identity review is disabled for this brand" },
        { status: 403 }
      );
    }

    const edges = await prisma.identityEdge.findMany({
      where: {
        reviewOutcome: null,
        matchBand: { in: ["auto_linked", "possible_match"] },
        OR: [
          {
            fromProfile: {
              influencer: {
                creators: {
                  some: { brandId: membership.brandId },
                },
              },
            },
          },
          {
            toProfile: {
              influencer: {
                creators: {
                  some: { brandId: membership.brandId },
                },
              },
            },
          },
        ],
      },
      include: {
        fromProfile: {
          include: {
            influencer: {
              include: {
                creators: {
                  where: { brandId: membership.brandId },
                  select: { id: true, name: true, instagramHandle: true },
                },
              },
            },
            contactPoints: true,
          },
        },
        toProfile: {
          include: {
            influencer: {
              include: {
                creators: {
                  where: { brandId: membership.brandId },
                  select: { id: true, name: true, instagramHandle: true },
                },
              },
            },
            contactPoints: true,
          },
        },
      },
      orderBy: [{ matchScore: "desc" }, { createdAt: "desc" }],
      take: 100,
    });

    return NextResponse.json({
      edges: edges.map((edge) => ({
        id: edge.id,
        matchScore: edge.matchScore,
        matchBand: edge.matchBand,
        evidence: edge.evidenceJson,
        fromProfile: {
          id: edge.fromProfile.id,
          platform: edge.fromProfile.platform,
          handle: edge.fromProfile.handle,
          profileUrl: edge.fromProfile.profileUrl,
          imageUrl: edge.fromProfile.profileImageUrl,
          creators: edge.fromProfile.influencer.creators,
        },
        toProfile: {
          id: edge.toProfile.id,
          platform: edge.toProfile.platform,
          handle: edge.toProfile.handle,
          profileUrl: edge.toProfile.profileUrl,
          imageUrl: edge.toProfile.profileImageUrl,
          creators: edge.toProfile.influencer.creators,
        },
      })),
    });
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[identity/review/GET]", error);
    return NextResponse.json(
      { error: "Failed to load identity review queue" },
      { status: 500 }
    );
  }
}
