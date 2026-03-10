import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/onboarding/complete
 *
 * Marks the user's first brand's onboarding as complete.
 * Idempotent — safe to call multiple times.
 */
export async function POST() {
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

    // Get the user's first brand membership (same pattern as dashboard)
    const membership = await prisma.brandMembership.findFirst({
      where: { userId: user.id },
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[onboarding/complete]", error);
    return NextResponse.json(
      { error: "Failed to complete onboarding" },
      { status: 500 }
    );
  }
}
