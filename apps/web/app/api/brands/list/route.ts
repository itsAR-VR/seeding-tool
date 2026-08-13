import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/brands/list
 *
 * Returns all brands the current user belongs to, with roles.
 * Used by the brand switcher UI.
 */
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

    const memberships = await prisma.brandMembership.findMany({
      where: { userId: user.id },
      include: {
        brand: {
          select: {
            id: true,
            name: true,
            websiteUrl: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      brands: memberships.map((m) => ({
        brandId: m.brand.id,
        name: m.brand.name,
        websiteUrl: m.brand.websiteUrl,
        role: m.role,
      })),
    });
  } catch (error) {
    console.error("[brands/list/GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch brands" },
      { status: 500 }
    );
  }
}
