import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createRun,
  listRuns,
  readRun,
  readScreenshot,
  saveScreenshot,
  upsertCandidate,
} from "@/lib/suggested-discovery/store";
import type { DiscoveryCandidate } from "@/lib/suggested-discovery/types";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "suggested-discovery-"));
  process.env.SUGGESTED_DISCOVERY_DIR = dir;
});

afterEach(() => {
  delete process.env.SUGGESTED_DISCOVERY_DIR;
  rmSync(dir, { recursive: true, force: true });
});

function candidate(handle: string, status: DiscoveryCandidate["status"]): DiscoveryCandidate {
  return {
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
      discoveredFrom: "seed",
      screenshotFile: null,
    },
    verdict: null,
    status,
  };
}

describe("run store", () => {
  it("creates and reads a run", () => {
    const run = createRun({ seedHandle: "seed", niche: "skincare", mode: "demo", maxProfiles: 12 });
    expect(run.status).toBe("queued");
    const read = readRun(run.id);
    expect(read?.seedHandle).toBe("seed");
  });

  it("upserts candidates and recomputes counts", () => {
    const run = createRun({ seedHandle: "seed", niche: "skincare", mode: "demo", maxProfiles: 12 });
    upsertCandidate(run.id, candidate("a", "match"));
    upsertCandidate(run.id, candidate("b", "rejected"));
    upsertCandidate(run.id, candidate("c", "error"));
    upsertCandidate(run.id, candidate("a", "match")); // dedupe by handle

    const read = readRun(run.id);
    expect(read?.candidates).toHaveLength(3);
    expect(read?.counts).toEqual({ discovered: 3, matched: 1, rejected: 1, errors: 1 });
  });

  it("lists runs newest first", () => {
    const older = createRun({ seedHandle: "a", niche: "x", mode: "demo", maxProfiles: 1 });
    const newer = createRun({ seedHandle: "b", niche: "x", mode: "demo", maxProfiles: 1 });
    // Force distinct timestamps so ordering is deterministic.
    upsertCandidate(newer.id, candidate("x", "match"));
    const runs = listRuns();
    expect(runs.map((r) => r.id)).toContain(older.id);
    expect(runs.map((r) => r.id)).toContain(newer.id);
  });

  it("rejects path-traversal run ids", () => {
    expect(readRun("../../etc/passwd")).toBeNull();
    expect(readRun("run_nonexistent_abc")).toBeNull();
    expect(() => saveScreenshot("../../x", "a", Buffer.alloc(1))).toThrow();
  });

  it("round-trips screenshots", () => {
    const run = createRun({ seedHandle: "seed", niche: "x", mode: "demo", maxProfiles: 1 });
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    saveScreenshot(run.id, "trail.kate", png);
    expect(readScreenshot(run.id, "trail.kate")).toEqual(png);
    expect(readScreenshot(run.id, "missing")).toBeNull();
  });
});
