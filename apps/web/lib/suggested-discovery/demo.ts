/**
 * Suggested Discovery — demo-mode run.
 *
 * Runs the fixture profiles through the real text classification path
 * (no browser, no network) so the UI is demoable without IG creds.
 * This module is import-safe for the Next.js bundle: no playwright.
 */

import { textFallbackVerdict } from "./engine";
import { FIXTURE_PROFILES } from "./fixtures";
import { createRun, patchRun, upsertCandidate } from "./store";
import { HARD_MAX_PROFILES, type DiscoveryRun } from "./types";

export function runDemoDiscovery(input: {
  seedHandle: string;
  niche: string;
  maxProfiles: number;
  brandId?: string | null;
}): DiscoveryRun {
  // Clamp like the live path — slice(0, -1) on a negative limit would
  // silently process every fixture except the last.
  const maxProfiles = Math.min(
    Math.max(1, Math.floor(input.maxProfiles) || 1),
    HARD_MAX_PROFILES
  );
  const run = createRun({ ...input, maxProfiles, mode: "demo" });
  patchRun(run.id, { status: "running", startedAt: new Date().toISOString() });

  for (const fixture of FIXTURE_PROFILES.slice(0, maxProfiles)) {
    const profile = { ...fixture, discoveredFrom: input.seedHandle };
    const verdict = { ...textFallbackVerdict(profile, input.niche), source: "fixture" as const };
    upsertCandidate(run.id, {
      profile,
      verdict,
      status: verdict.match ? "match" : "rejected",
    });
  }

  patchRun(run.id, {
    status: "completed",
    finishedAt: new Date().toISOString(),
  });

  const finished = patchRun(run.id, {});
  return finished ?? run;
}
