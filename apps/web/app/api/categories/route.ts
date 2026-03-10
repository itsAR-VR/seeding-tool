import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";
import { getGroupedCategories } from "@/lib/categories/catalog";
import type { BrandProfileSnapshot } from "@/lib/brands/profile";

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
    console.error("[categories/GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}
