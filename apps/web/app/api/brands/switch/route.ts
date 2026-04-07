import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";

const BRAND_COOKIE_NAME = "seed-active-brand";

/**
 * POST /api/brands/switch
 *
 * Switch the active brand for the current user.
 * Sets a cookie so RSC pages and API routes resolve the correct brand.
 *
 * Body: { brandId: string }
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

    const body = (await request.json()) as { brandId?: string };

    if (!body.brandId || typeof body.brandId !== "string") {
      return NextResponse.json(
        { error: "brandId is required" },
        { status: 400 }
      );
    }

    // Verify the user is a member of the requested brand
    const membership = await prisma.brandMembership.findUnique({
      where: {
        userId_brandId: { userId: user.id, brandId: body.brandId },
      },
      include: {
        brand: { select: { id: true, name: true } },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Not a member of this brand" },
        { status: 403 }
      );
    }

    // Set the cookie
    const cookieStore = await cookies();
    cookieStore.set(BRAND_COOKIE_NAME, body.brandId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });

    return NextResponse.json({
      activeBrandId: membership.brandId,
      brandName: membership.brand.name,
      role: membership.role,
    });
  } catch (error) {
    console.error("[brands/switch/POST]", error);
    return NextResponse.json(
      { error: "Failed to switch brand" },
      { status: 500 }
    );
  }
}
