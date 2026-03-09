import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/billing/balance — Return the brand's current credit balance.
 *
 * Returns { credits: number } — 0 if no balance record exists yet.
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
      return NextResponse.json({ credits: 0 });
    }

    const balance = await prisma.brandCreditBalance.findUnique({
      where: { brandId: membership.brandId },
    });

    return NextResponse.json({ credits: balance?.credits ?? 0 });
  } catch (error) {
    console.error("[billing/balance/GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch balance" },
      { status: 500 }
    );
  }
}
