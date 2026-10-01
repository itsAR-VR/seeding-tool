import { NextResponse } from "next/server";
import {
  getCurrentBrandMembership,
  BrandAccessError,
} from "@/lib/integrations/brand-access";
import { syncContentForBrand } from "@/lib/content/sync";

export const maxDuration = 60;

/**
 * POST /api/content/sync — pull posts that tag the brand on Instagram into
 * the content library.
 */
export async function POST() {
  try {
    const membership = await getCurrentBrandMembership();
    const result = await syncContentForBrand(membership.brandId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[content/sync]", error);
    return NextResponse.json({ error: "Could not check for new posts" }, { status: 500 });
  }
}
