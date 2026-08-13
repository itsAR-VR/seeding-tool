#!/usr/bin/env npx tsx
/**
 * Suggested Discovery CLI.
 *
 * Usage (from apps/web):
 *   npx tsx scripts/suggested-discovery.ts --seed <handle> --niche "clean skincare" [--max 12] [--headful]
 *   npx tsx scripts/suggested-discovery.ts --demo --seed <handle> --niche "trail running"
 *   npx tsx scripts/suggested-discovery.ts --login          # one-time manual IG login
 *
 * The API route spawns this script for live runs so playwright never
 * enters the Next.js bundle.
 */

import { runDemoDiscovery } from "../lib/suggested-discovery/demo";
import { runLiveDiscovery } from "../lib/suggested-discovery/live";
import { openLoginSession } from "../lib/suggested-discovery/walker";
import { DEFAULT_MAX_PROFILES } from "../lib/suggested-discovery/types";

interface CliArgs {
  seed: string | null;
  niche: string;
  max: number;
  demo: boolean;
  login: boolean;
  headful: boolean;
  runId: string | null;
  brandId: string | null;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    seed: null,
    niche: "",
    max: DEFAULT_MAX_PROFILES,
    demo: false,
    login: false,
    headful: false,
    runId: null,
    brandId: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--demo") args.demo = true;
    else if (arg === "--login") args.login = true;
    else if (arg === "--headful") args.headful = true;
    else if (arg === "--seed") args.seed = argv[++i] ?? null;
    else if (arg === "--niche") args.niche = argv[++i] ?? "";
    else if (arg === "--max") args.max = Number(argv[++i]) || DEFAULT_MAX_PROFILES;
    else if (arg === "--run-id") args.runId = argv[++i] ?? null;
    else if (arg === "--brand") args.brandId = argv[++i] ?? null;
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.login) {
    await openLoginSession();
    return;
  }

  if (!args.seed) {
    console.error("Missing --seed <handle>");
    process.exit(1);
  }
  if (!args.niche) {
    console.error('Missing --niche "description of who you are looking for"');
    process.exit(1);
  }

  const run = args.demo
    ? runDemoDiscovery({
        seedHandle: args.seed,
        niche: args.niche,
        maxProfiles: args.max,
        brandId: args.brandId,
      })
    : await runLiveDiscovery({
        seedHandle: args.seed,
        niche: args.niche,
        maxProfiles: args.max,
        brandId: args.brandId,
        runId: args.runId ?? undefined,
        headless: !args.headful,
      });

  console.log(
    JSON.stringify({
      runId: run.id,
      status: run.status,
      counts: run.counts,
      error: run.error ?? null,
    })
  );
  if (run.status === "failed" || run.status === "needs_login") {
    process.exit(2);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
