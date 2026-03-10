import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";
import { getGroupedCategories } from "@/lib/categories/catalog";
import { suggestCategorySelectionFromBrandProfile } from "@/lib/categories/suggestions";
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
      include: {
        brand: {
          include: {
            settings: {
              select: {
                brandProfile: true,
              },
            },
          },
        },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: "No brand found" }, { status: 404 });
    }

    const brandProfile =
      (membership.brand.settings?.brandProfile as BrandProfileSnapshot | null) ??
      null;
    const suggestions = suggestCategorySelectionFromBrandProfile(brandProfile);

    return NextResponse.json({
      categories: getGroupedCategories(),
      suggestedCategories: suggestions.selection,
      suggestedLabels: suggestions.matchedLabels,
      profileSummary: {
        domain: brandProfile?.domain ?? null,
        title: brandProfile?.title ?? null,
      },
    });
  } catch (error) {
    console.error("[onboarding/discovery-defaults]", error);
    return NextResponse.json(
      { error: "Failed to load onboarding discovery defaults" },
      { status: 500 }
    );
  }
}
