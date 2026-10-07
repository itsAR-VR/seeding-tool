import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";
import { setFeatureFlag } from "@/lib/feature-flags";
import {
  findBrandInSetup,
  getActiveMembership,
  setActiveBrandCookie,
} from "@/lib/onboarding/setup-state";

/**
 * POST /api/onboarding/complete
 *
 * Marks setup finished for the company being set up. Body: { brandId? }.
 * The brandId must be a company this person owns or edits; without one it
 * finishes the company they're setting up (else the active one).
 * Idempotent: safe to call twice.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: "Your session ended. Sign in again to keep going." }, { status: 401 });
    }

    const user = await getUserBySupabaseId(authUser.id);
    if (!user) {
      return NextResponse.json({ error: "No account for this email yet." }, { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as { brandId?: unknown };
    const requestedBrandId = typeof body.brandId === "string" && body.brandId ? body.brandId : null;

    const membership = requestedBrandId
      ? await prisma.brandMembership.findUnique({
          where: { userId_brandId: { userId: user.id, brandId: requestedBrandId } },
        })
      : await findBrandInSetup(user.id).then((inSetup) =>
          inSetup
            ? prisma.brandMembership.findUnique({
                where: { userId_brandId: { userId: user.id, brandId: inSetup.id } },
              })
            : getActiveMembership(user.id)
        );

    // Same answer whether the brand doesn't exist or belongs to someone else.
    if (!membership) {
      return NextResponse.json(
        { error: "We couldn't find your brand. Go back to the first step and save it again." },
        { status: 404 }
      );
    }
    if (membership.role !== "owner" && membership.role !== "editor") {
      return NextResponse.json(
        { error: "Only the owner or an editor can finish setup for this brand." },
        { status: 403 }
      );
    }

    const brandId = membership.brandId;

    // Upsert: set isComplete = true (creates record if missing)
    await prisma.brandOnboarding.upsert({
      where: { brandId },
      update: {
        isComplete: true,
        currentStep: 4,
        completedSteps: JSON.stringify([1, 2, 3, 4]),
      },
      create: {
        brandId,
        isComplete: true,
        currentStep: 4,
        completedSteps: JSON.stringify([1, 2, 3, 4]),
      },
    });

    // New companies start with the same safe defaults Kalm runs on: a creator's
    // claim form makes a Shopify draft order (never completed automatically).
    const settings = await prisma.brandSettings.findUnique({ where: { brandId }, select: { metadata: true } });
    const flags = (settings?.metadata as { featureFlags?: Record<string, boolean> } | null)?.featureFlags;
    if (settings && flags?.claimAutoDraftEnabled === undefined) {
      await setFeatureFlag(brandId, "claimAutoDraftEnabled", true).catch((error) =>
        console.warn("[onboarding/complete] couldn't set default flags", error),
      );
    }

    // Home shows the company that was just finished.
    await setActiveBrandCookie(brandId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[onboarding/complete]", error);
    return NextResponse.json(
      { error: "Couldn't finish setup. Try again." },
      { status: 500 }
    );
  }
}
