import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";
import { buildCreatorFacets } from "@/lib/creators/facets";

export async function GET() {
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
      orderBy: { createdAt: "asc" },
      select: { brandId: true },
    });

    if (!membership) {
      return NextResponse.json({ error: "No brand found" }, { status: 404 });
    }

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
    console.error("[creators/facets/GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch creator facets" },
      { status: 500 }
    );
  }
}
