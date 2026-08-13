import { NextRequest, NextResponse } from "next/server";
import {
  getCurrentBrandMembership,
  requireAdminAccess,
  BrandAccessError,
} from "@/lib/integrations/brand-access";
import {
  applyPreset,
  FLAG_PRESETS,
  type FlagPreset,
} from "@/lib/feature-flags";

const VALID_PRESETS = Object.keys(FLAG_PRESETS) as FlagPreset[];

/**
 * POST /api/settings/feature-flags/preset
 * Body: { preset: "manual" | "assisted" | "autonomous" }
 *
 * Applies a feature flag preset atomically (single DB write).
 * Requires admin (owner or editor) access.
 */
export async function POST(request: NextRequest) {
  try {
    const membership = await getCurrentBrandMembership();
    requireAdminAccess(membership);

    const body = (await request.json()) as { preset?: string };

    if (!body.preset || !VALID_PRESETS.includes(body.preset as FlagPreset)) {
      return NextResponse.json(
        {
          error: `Invalid preset. Valid presets: ${VALID_PRESETS.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const flags = await applyPreset(
      membership.brandId,
      body.preset as FlagPreset
    );

    return NextResponse.json({ flags, preset: body.preset });
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("[feature-flags/preset] POST error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
