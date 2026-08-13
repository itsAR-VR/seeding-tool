import { spawn } from "child_process";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getCurrentBrandMembership,
  requireWriteAccess,
  BrandAccessError,
} from "@/lib/integrations/brand-access";
import { runDemoDiscovery } from "@/lib/suggested-discovery/demo";
import { normalizeIgHandle } from "@/lib/suggested-discovery/parse";
import { createRun, listRuns, patchRun, readRun } from "@/lib/suggested-discovery/store";
import {
  DEFAULT_MAX_PROFILES,
  HARD_MAX_PROFILES,
} from "@/lib/suggested-discovery/types";

export const runtime = "nodejs";

const startRunSchema = z.object({
  seedHandle: z.string().min(1),
  niche: z.string().trim().min(3).max(500),
  maxProfiles: z.number().int().min(1).max(HARD_MAX_PROFILES).optional(),
  mode: z.enum(["live", "demo"]).default("demo"),
});

/**
 * GET /api/discover/suggested — recent discovery runs for the caller's
 * brand, newest first. Unowned (CLI-created, brandId null) runs are
 * local-artifact only and never exposed over HTTP.
 */
export async function GET() {
  try {
    const membership = await getCurrentBrandMembership();
    return NextResponse.json({ runs: listRuns(20, membership.brandId) });
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
    requireWriteAccess(membership);

    // The whole API persists runs on the local filesystem (and live mode
    // needs a local browser + IG session). On serverless that storage is
    // unavailable, so fail loudly for both modes instead of 500ing on the
    // write. Durable storage + worker dispatch is a follow-up phase.
    if (process.env.VERCEL) {
      return NextResponse.json(
        {
          error:
            "Suggested discovery is local-only in this phase. Run it via `npm run discover:suggested -- --seed <handle> --niche \"...\" [--demo]` on an operator machine.",
        },
        { status: 400 }
      );
    }

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

    // Spawn failures (missing npx, tsx error before the first store write)
    // surface asynchronously — without handlers the process can crash or
    // the run would sit "queued" forever while the UI polls it.
    child.on("error", (error) => {
      patchRun(run.id, {
        status: "failed",
        error: `Failed to start discovery worker: ${error.message}`,
        finishedAt: new Date().toISOString(),
      });
    });
    child.on("exit", (code) => {
      const current = readRun(run.id);
      if (current && current.status === "queued") {
        patchRun(run.id, {
          status: "failed",
          error: `Discovery worker exited (code ${code}) before starting the run`,
          finishedAt: new Date().toISOString(),
        });
      }
    });
    child.unref();

    return NextResponse.json({ run }, { status: 202 });
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to start run" }, { status: 500 });
  }
}
