import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGroupedCategories } from "@/lib/categories/catalog";
import type { BrandProfileSnapshot } from "@/lib/brands/profile";
import {
  getCurrentBrandMembership,
  BrandAccessError,
} from "@/lib/integrations/brand-access";

export async function GET() {
  try {
    const membership = await getCurrentBrandMembership();

    let brandKeywords: string[] = [];
    try {
      const settings = await prisma.brandSettings.findFirst({
        where: { brandId: membership.brandId },
        select: { brandProfile: true },
      });
      if (settings?.brandProfile && typeof settings.brandProfile === "object" && !Array.isArray(settings.brandProfile)) {
        const profile = settings.brandProfile as unknown as BrandProfileSnapshot;
        brandKeywords =
          profile.businessDna?.keywords ??
          profile.keywords ??
          [];
      }
    } catch {
      // non-fatal — return categories without brand keywords
    }

    return NextResponse.json({
      ...getGroupedCategories(),
      brandKeywords,
    });
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[categories/GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}
