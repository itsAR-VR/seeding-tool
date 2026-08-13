import { NextRequest, NextResponse } from "next/server";
import {
  getCurrentBrandMembership,
  requireOwnerAccess,
  BrandAccessError,
} from "@/lib/integrations/brand-access";
import {
  getFeatureFlags,
  setFeatureFlag,
  VALID_FLAG_NAMES,
  type FeatureFlags,
} from "@/lib/feature-flags";

/**
 * GET /api/settings/feature-flags — returns current flags for brand
 */
export async function GET() {
  try {
    const membership = await getCurrentBrandMembership();
    requireOwnerAccess(membership);

    const flags = await getFeatureFlags(membership.brandId);
    return NextResponse.json({ flags });
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[feature-flags] GET error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * PATCH /api/settings/feature-flags — update a single flag
 * Body: { flag: string, value: boolean }
 */
export async function PATCH(request: NextRequest) {
  try {
    const membership = await getCurrentBrandMembership();
    requireOwnerAccess(membership);

    const body = (await request.json()) as { flag?: string; value?: boolean };

    if (!body.flag || typeof body.value !== "boolean") {
      return NextResponse.json(
        { error: "Missing flag or value" },
        { status: 400 }
      );
    }

    if (!VALID_FLAG_NAMES.includes(body.flag as keyof FeatureFlags)) {
      return NextResponse.json(
        { error: `Invalid flag: ${body.flag}` },
        { status: 400 }
      );
    }

    await setFeatureFlag(
      membership.brandId,
      body.flag as keyof FeatureFlags,
      body.value
    );

    const flags = await getFeatureFlags(membership.brandId);
    return NextResponse.json({ flags });
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[feature-flags] PATCH error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
