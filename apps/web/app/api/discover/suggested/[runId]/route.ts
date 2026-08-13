import { NextResponse } from "next/server";
import {
  getCurrentBrandMembership,
  BrandAccessError,
} from "@/lib/integrations/brand-access";
import { readRun } from "@/lib/suggested-discovery/store";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ runId: string }> };

/**
 * GET /api/discover/suggested/[runId] — run status + candidates.
 */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const membership = await getCurrentBrandMembership();
    const { runId } = await context.params;

    const run = readRun(runId);
    // Cross-brand runs are other tenants' data — hide their existence.
    if (!run || (run.brandId !== null && run.brandId !== membership.brandId)) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }
    return NextResponse.json({ run });
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to load run" }, { status: 500 });
  }
}
