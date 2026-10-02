import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getOrAcceptInvitedUser } from "@/lib/invite-user";
import { findOpenCompanyInvite, isPlatformAdmin } from "@/lib/invites";

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

    const user = await getOrAcceptInvitedUser(authUser);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const membership = await prisma.brandMembership.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    });

    if (!membership) {
      const invite = await findOpenCompanyInvite(user.email);
      return NextResponse.json({
        isComplete: false,
        hasBrand: false,
        canCreateBrand: Boolean(invite) || isPlatformAdmin(user.email),
        companyName: invite?.companyName ?? null,
      });
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
