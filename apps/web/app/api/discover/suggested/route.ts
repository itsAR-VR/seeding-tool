import { spawn } from "child_process";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getCurrentBrandMembership,
  BrandAccessError,
} from "@/lib/integrations/brand-access";
import { runDemoDiscovery } from "@/lib/suggested-discovery/demo";
import { normalizeIgHandle } from "@/lib/suggested-discovery/parse";
import { createRun, listRuns } from "@/lib/suggested-discovery/store";
import {
  DEFAULT_MAX_PROFILES,
  HARD_MAX_PROFILES,
} from "@/lib/suggested-discovery/types";

export const runtime = "nodejs";

const startRunSchema = z.object({
  seedHandle: z.string().min(1),
  niche: z.string().min(3).max(500),
  maxProfiles: z.number().int().min(1).max(HARD_MAX_PROFILES).optional(),
  mode: z.enum(["live", "demo"]).default("demo"),
});

/**
 * GET /api/discover/suggested — recent discovery runs, newest first.
 */
export async function GET() {
  try {
    await getCurrentBrandMembership();
    return NextResponse.json({ runs: listRuns() });
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to list runs" }, { status: 500 });
  }
}

/**
 * POST /api/discover/suggested — start a suggested-profile discovery run.
 *
 * Demo mode runs inline (fixtures, no browser). Live mode creates the
 * run then spawns the CLI as a detached child so playwright stays out
 * of the server bundle and the request returns immediately; the client
 * polls GET /api/discover/suggested/[runId] for progress.
 */
export async function POST(request: NextRequest) {
  try {
    const membership = await getCurrentBrandMembership();

    const body = startRunSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) {
      return NextResponse.json(
        { error: "Invalid request", issues: body.error.issues },
        { status: 400 }
      );
    }

    const seedHandle = normalizeIgHandle(body.data.seedHandle);
    if (!seedHandle) {
      return NextResponse.json(
        { error: "Invalid Instagram handle" },
        { status: 400 }
      );
    }

    const maxProfiles = body.data.maxProfiles ?? DEFAULT_MAX_PROFILES;
    const niche = body.data.niche.trim();

    if (body.data.mode === "demo") {
      const run = runDemoDiscovery({
        seedHandle,
        niche,
        maxProfiles,
        brandId: membership.brandId,
      });
      return NextResponse.json({ run }, { status: 201 });
    }

    const run = createRun({
      seedHandle,
      niche,
      mode: "live",
      maxProfiles,
      brandId: membership.brandId,
    });

    const child = spawn(
      "npx",
      [
        "tsx",
        "scripts/suggested-discovery.ts",
        "--seed",
        seedHandle,
        "--niche",
        niche,
        "--max",
        String(maxProfiles),
        "--run-id",
        run.id,
        "--brand",
        membership.brandId,
      ],
      {
        cwd: process.cwd(),
        detached: true,
        stdio: "ignore",
        env: process.env,
      }
    );
    child.unref();

    return NextResponse.json({ run }, { status: 202 });
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to start run" }, { status: 500 });
  }
}
