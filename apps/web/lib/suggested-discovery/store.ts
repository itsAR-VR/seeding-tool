/**
 * Suggested Discovery — artifact run store.
 *
 * Runs persist as plain JSON under artifacts/suggested-discovery/<runId>/
 * (gitignored). This keeps the demo zero-migration while the schema is
 * being refactored elsewhere; a later phase can promote runs to Prisma.
 *
 * All writes go through a tmp-file + rename so a crashed run never
 * leaves a half-written run.json for the API to parse.
 */

import * as fs from "fs";
import * as path from "path";
import { randomBytes } from "crypto";
import {
  recomputeCounts,
  type DiscoveryCandidate,
  type DiscoveryRun,
  type DiscoveryRunMode,
} from "./types";

const RUN_ID_PATTERN = /^run_[a-z0-9]+_[a-z0-9]+$/;
const SCREENSHOT_NAME_PATTERN = /^[a-z0-9._]{1,30}\.png$/;

export function getRunsDir(): string {
  return (
    process.env.SUGGESTED_DISCOVERY_DIR ??
    path.join(process.cwd(), "artifacts", "suggested-discovery")
  );
}

export function getSessionDir(): string {
  return (
    process.env.IG_SESSION_DIR ?? path.join(process.cwd(), ".auth", "instagram")
  );
}

function runDir(runId: string): string {
  if (!RUN_ID_PATTERN.test(runId)) {
    throw new Error(`Invalid run id: ${runId}`);
  }
  return path.join(getRunsDir(), runId);
}

function runFile(runId: string): string {
  return path.join(runDir(runId), "run.json");
}

function writeJsonAtomic(filePath: string, value: unknown): void {
  const tmpPath = `${filePath}.tmp-${randomBytes(4).toString("hex")}`;
  fs.writeFileSync(tmpPath, JSON.stringify(value, null, 2));
  fs.renameSync(tmpPath, filePath);
}

export function createRun(input: {
  seedHandle: string;
  niche: string;
  mode: DiscoveryRunMode;
  maxProfiles: number;
  brandId?: string | null;
  runId?: string;
}): DiscoveryRun {
  const now = new Date().toISOString();
  const id =
    input.runId ??
    `run_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
  if (!RUN_ID_PATTERN.test(id)) {
    throw new Error(`Invalid run id: ${id}`);
  }

  const run: DiscoveryRun = {
    id,
    seedHandle: input.seedHandle,
    niche: input.niche,
    mode: input.mode,
    status: "queued",
    maxProfiles: input.maxProfiles,
    brandId: input.brandId ?? null,
    createdAt: now,
    updatedAt: now,
    counts: { discovered: 0, matched: 0, rejected: 0, errors: 0 },
    candidates: [],
  };

  fs.mkdirSync(runDir(id), { recursive: true });
  writeJsonAtomic(runFile(id), run);
  return run;
}

export function readRun(runId: string): DiscoveryRun | null {
  try {
    const raw = fs.readFileSync(runFile(runId), "utf8");
    return JSON.parse(raw) as DiscoveryRun;
  } catch {
    return null;
  }
}

export function writeRun(run: DiscoveryRun): DiscoveryRun {
  const next: DiscoveryRun = {
    ...run,
    counts: recomputeCounts(run),
    updatedAt: new Date().toISOString(),
  };
  writeJsonAtomic(runFile(next.id), next);
  return next;
}

export function patchRun(
  runId: string,
  patch: Partial<Pick<DiscoveryRun, "status" | "startedAt" | "finishedAt" | "error">>
): DiscoveryRun | null {
  const run = readRun(runId);
  if (!run) return null;
  return writeRun({ ...run, ...patch });
}

export function upsertCandidate(
  runId: string,
  candidate: DiscoveryCandidate
): DiscoveryRun | null {
  const run = readRun(runId);
  if (!run) return null;

  const index = run.candidates.findIndex(
    (existing) => existing.profile.handle === candidate.profile.handle
  );
  const candidates =
    index === -1
      ? [...run.candidates, candidate]
      : run.candidates.map((existing, i) => (i === index ? candidate : existing));

  return writeRun({ ...run, candidates });
}

export function listRuns(limit = 20, brandId?: string | null): DiscoveryRun[] {
  const dir = getRunsDir();
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const runs: DiscoveryRun[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !RUN_ID_PATTERN.test(entry.name)) continue;
    const run = readRun(entry.name);
    if (run) runs.push(run);
  }

  // Scope BEFORE the limit: truncating the global list first would let
  // other tenants' newer runs push this brand's valid runs out of view.
  // brandId provided → only that brand's runs (unowned CLI runs are
  // never exposed over HTTP). No brandId → full local list (CLI use).
  return runs
    .filter((run) => brandId === undefined || run.brandId === brandId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export function saveScreenshot(
  runId: string,
  handle: string,
  png: Buffer
): string {
  const fileName = `${handle}.png`;
  if (!SCREENSHOT_NAME_PATTERN.test(fileName)) {
    throw new Error(`Invalid screenshot name: ${fileName}`);
  }
  fs.mkdirSync(runDir(runId), { recursive: true });
  fs.writeFileSync(path.join(runDir(runId), fileName), png);
  return fileName;
}

export function readScreenshot(runId: string, handle: string): Buffer | null {
  const fileName = `${handle}.png`;
  if (!RUN_ID_PATTERN.test(runId) || !SCREENSHOT_NAME_PATTERN.test(fileName)) {
    return null;
  }
  try {
    return fs.readFileSync(path.join(runDir(runId), fileName));
  } catch {
    return null;
  }
}
