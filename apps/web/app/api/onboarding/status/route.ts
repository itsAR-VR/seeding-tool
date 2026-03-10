import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/onboarding/status
 *
 * Returns onboarding completion state for the user's first brand.
 * Used by the onboarding page to check if re-entry should redirect.
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

    const membership = await prisma.brandMembership.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    });

    if (!membership) {
      return NextResponse.json({ isComplete: false, hasBrand: false });
    }

    const onboarding = await prisma.brandOnboarding.findUnique({
      where: { brandId: membership.brandId },
      select: { isComplete: true },
    });

    return NextResponse.json({
      isComplete: onboarding?.isComplete ?? false,
      hasBrand: true,
    });
  } catch (error) {
    console.error("[onboarding/status]", error);
    return NextResponse.json(
      { error: "Failed to check onboarding status" },
      { status: 500 }
    );
  }
}
