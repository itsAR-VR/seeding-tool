import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildCreatorFacets } from "@/lib/creators/facets";
import {
  getCurrentBrandMembership,
  BrandAccessError,
} from "@/lib/integrations/brand-access";

export async function GET() {
  try {
    const membership = await getCurrentBrandMembership();

    const facetRows = await prisma.creator.findMany({
      where: {
        brandId: membership.brandId,
        validationStatus: { not: "invalid" },
      },
      select: {
        bio: true,
        bioCategory: true,
        instagramHandle: true,
        discoveryTouches: {
          select: {
            metadata: true,
          },
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });

    return NextResponse.json(buildCreatorFacets(facetRows));
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[creators/facets/GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch creator facets" },
      { status: 500 }
    );
  }
}
