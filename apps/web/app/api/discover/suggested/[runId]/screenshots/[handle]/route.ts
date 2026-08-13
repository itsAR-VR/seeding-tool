import { NextResponse } from "next/server";
import {
  getCurrentBrandMembership,
  BrandAccessError,
} from "@/lib/integrations/brand-access";
import { readRun, readScreenshot } from "@/lib/suggested-discovery/store";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ runId: string; handle: string }> };

/**
 * GET /api/discover/suggested/[runId]/screenshots/[handle] — profile
 * header screenshot captured during the run (PNG).
 */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const membership = await getCurrentBrandMembership();
    const { runId, handle } = await context.params;

    const run = readRun(runId);
    if (!run || (run.brandId !== null && run.brandId !== membership.brandId)) {
      return NextResponse.json({ error: "Screenshot not found" }, { status: 404 });
    }

    const png = readScreenshot(runId, handle);
    if (!png) {
      return NextResponse.json({ error: "Screenshot not found" }, { status: 404 });
    }
    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to load screenshot" }, { status: 500 });
  }
}
