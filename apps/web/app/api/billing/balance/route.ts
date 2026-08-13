import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCurrentBrandMembership,
  BrandAccessError,
} from "@/lib/integrations/brand-access";

/**
 * GET /api/billing/balance — Return the brand's current credit balance.
 */
export async function GET() {
  try {
    const membership = await getCurrentBrandMembership();

    const balance = await prisma.brandCreditBalance.findUnique({
      where: { brandId: membership.brandId },
    });

    return NextResponse.json({ credits: balance?.credits ?? 0 });
  } catch (error) {
    if (error instanceof BrandAccessError) {
      // If no brand found, return 0 credits (backward compat)
      if (error.status === 404) {
        return NextResponse.json({ credits: 0 });
      }
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[billing/balance/GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch balance" },
      { status: 500 }
    );
  }
}
