import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";
import { setFeatureFlag } from "@/lib/feature-flags";

/**
 * POST /api/onboarding/complete
 *
 * Marks the user's first brand's onboarding as complete.
 * Idempotent — safe to call multiple times.
 */
export async function POST(request: Request) {
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

    // The brand being set up (sent by the wizard), else the user's first one.
    const body = (await request.json().catch(() => ({}))) as { brandId?: unknown };
    const requestedBrandId = typeof body.brandId === "string" ? body.brandId : null;
    const membership = await prisma.brandMembership.findFirst({
      where: { userId: user.id, ...(requestedBrandId ? { brandId: requestedBrandId } : {}) },
      orderBy: { createdAt: "asc" },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "No brand found. Complete the brand step first." },
        { status: 400 }
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[onboarding/complete]", error);
    return NextResponse.json(
      { error: "Failed to complete onboarding" },
      { status: 500 }
    );
  }
}
