/**
 * Suggested Discovery — live run orchestration (CLI only).
 *
 * Walks the seed's suggested rail, classifies each profile as it lands
 * (vision → text fallback), and persists incrementally so the UI polls
 * real progress. Never import from Next.js routes — spawns via CLI.
 */

import { decideCandidate } from "./engine";
import { normalizeIgHandle } from "./parse";
import {
  createRun,
  patchRun,
  readRun,
  saveScreenshot,
  upsertCandidate,
} from "./store";
import { NeedsLoginError, walkSuggestedProfiles } from "./walker";
import {
  DEFAULT_MAX_PROFILES,
  HARD_MAX_PROFILES,
  type DiscoveryRun,
} from "./types";

export interface LiveRunInput {
  seedHandle: string;
  niche: string;
  maxProfiles: number;
  brandId?: string | null;
  /** Resume/attach to a pre-created run (API creates it before spawning). */
  runId?: string;
  headless?: boolean;
  log?: (message: string) => void;
}

export async function runLiveDiscovery(input: LiveRunInput): Promise<DiscoveryRun> {
  const log = input.log ?? console.log;
  const seed = normalizeIgHandle(input.seedHandle);
  if (!seed) throw new Error(`Invalid seed handle: ${input.seedHandle}`);

  // Normalize before persisting: one effective integer limit used for both
  // the stored run record and the walk itself.
  const requested =
    Number.isFinite(input.maxProfiles) && input.maxProfiles > 0
      ? Math.floor(input.maxProfiles)
      : DEFAULT_MAX_PROFILES;
  const maxProfiles = Math.min(Math.max(1, requested), HARD_MAX_PROFILES);

  const run = input.runId
    ? readRun(input.runId)
    : createRun({
        seedHandle: seed,
        niche: input.niche,
        mode: "live",
        maxProfiles,
        brandId: input.brandId,
      });
  if (!run) throw new Error(`Run not found: ${input.runId}`);

  // Attaching to a pre-created run (the API path): the stored record owns
  // the audit trail, so the execution inputs must match it exactly —
  // otherwise candidates would be scraped/classified with one seed and
  // niche while run.json claims another.
  if (input.runId) {
    if (
      run.seedHandle !== seed ||
      run.niche !== input.niche ||
      run.mode !== "live" ||
      run.maxProfiles !== maxProfiles
    ) {
      // Fail the run record too — leaving it queued would strand the UI
      // polling a run that can never progress.
      patchRun(run.id, {
        status: "failed",
        error: "Attach mismatch: supplied seed/niche/limit do not match the stored run",
        finishedAt: new Date().toISOString(),
      });
      throw new Error(
        `Run ${input.runId} does not match the supplied seed/niche/limit — refusing to attach`
      );
    }
  }

  patchRun(run.id, { status: "running", startedAt: new Date().toISOString() });

  try {
    await walkSuggestedProfiles(
      { seedHandle: seed, maxProfiles, headless: input.headless ?? true },
      {
        log,
        onProfile: async (profile, screenshot) => {
          let screenshotFile: string | null = null;
          if (screenshot) {
            screenshotFile = saveScreenshot(run.id, profile.handle, screenshot);
          }
          const candidate = await decideCandidate(
            { ...profile, screenshotFile },
            input.niche,
            screenshot
          );
          upsertCandidate(run.id, candidate);
        },
        onProfileError: async (handle, error) => {
          log(`Error on @${handle}: ${error.message}`);
          upsertCandidate(run.id, {
            profile: {
              handle,
              displayName: null,
              bio: null,
              category: null,
              followers: null,
              following: null,
              posts: null,
              externalUrl: null,
              isVerified: false,
              profileUrl: `https://www.instagram.com/${handle}/`,
              discoveredFrom: seed,
              screenshotFile: null,
            },
            verdict: null,
            status: "error",
            error: error.message,
          });
        },
      }
    );

    patchRun(run.id, { status: "completed", finishedAt: new Date().toISOString() });
  } catch (error) {
    if (error instanceof NeedsLoginError) {
      patchRun(run.id, { status: "needs_login", error: error.message });
    } else {
      patchRun(run.id, {
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        finishedAt: new Date().toISOString(),
      });
    }
  }

  const finished = readRun(run.id);
  return finished ?? run;
}
