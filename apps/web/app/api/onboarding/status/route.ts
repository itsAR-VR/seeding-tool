import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getOrAcceptInvitedUser } from "@/lib/invite-user";
import { findOpenCompanyInvite, isPlatformAdmin } from "@/lib/invites";
import { findBrandInSetup, setActiveBrandCookie } from "@/lib/onboarding/setup-state";

/**
 * GET /api/onboarding/status
 *
 * What the setup wizard should show for this person:
 * - a company they're still setting up: resume it (brandId, name, website)
 * - an accepted company invite with no company yet: start a new one
 * - nothing left to set up: isComplete, so the wizard sends them Home
 *
 * The brand being set up always comes from here, never from the URL, so a
 * brandId in the address bar can't point the wizard at someone else's company.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: "Your session ended. Sign in again to keep going." }, { status: 401 });
    }

    const user = await getOrAcceptInvitedUser(authUser);
    if (!user) {
      return NextResponse.json({ error: "No account for this email yet." }, { status: 404 });
    }

    const inSetup = await findBrandInSetup(user.id);
    if (inSetup) {
      // The brand kit and connection steps follow the active-brand cookie; make
      // sure it points at this company (new device, or switched in another tab).
      await setActiveBrandCookie(inSetup.id);
      return NextResponse.json({
        isComplete: false,
        hasBrand: true,
        brandId: inSetup.id,
        brandName: inSetup.name,
        websiteUrl: inSetup.websiteUrl,
      });
    }

    const [membership, invite] = await Promise.all([
      prisma.brandMembership.findFirst({ where: { userId: user.id }, select: { id: true } }),
      findOpenCompanyInvite(user.email),
    ]);

    // An accepted invite for a new company (first or second one) starts setup.
    if (!membership || invite) {
      return NextResponse.json({
        isComplete: false,
        hasBrand: false,
        canCreateBrand: Boolean(invite) || (!membership && isPlatformAdmin(user.email)),
        companyName: invite?.companyName ?? null,
      });
    }

    return NextResponse.json({ isComplete: true, hasBrand: true });
  } catch (error) {
    console.error("[onboarding/status]", error);
    return NextResponse.json({ error: "Couldn't check your setup. Refresh the page." }, { status: 500 });
  }
}
