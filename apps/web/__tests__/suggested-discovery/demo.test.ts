import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runDemoDiscovery } from "@/lib/suggested-discovery/demo";
import { readRun } from "@/lib/suggested-discovery/store";
import { isCanonicalDiscoveryCategory } from "@/lib/categories/catalog";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "suggested-discovery-demo-"));
  process.env.SUGGESTED_DISCOVERY_DIR = dir;
});

afterEach(() => {
  delete process.env.SUGGESTED_DISCOVERY_DIR;
  rmSync(dir, { recursive: true, force: true });
});

describe("demo discovery run", () => {
  it("completes with classified candidates and consistent counts", () => {
    const run = runDemoDiscovery({
      seedHandle: "seeding.brand",
      niche: "skincare",
      maxProfiles: 12,
    });

    expect(run.status).toBe("completed");
    expect(run.mode).toBe("demo");
    expect(run.candidates.length).toBeGreaterThan(0);
    expect(run.counts.discovered).toBe(run.candidates.length);
    expect(run.counts.matched + run.counts.rejected + run.counts.errors).toBe(
      run.counts.discovered
    );
  });

  it("matches niche-relevant fixtures and rejects the rest", () => {
    const run = runDemoDiscovery({
      seedHandle: "seeding.brand",
      niche: "skincare beauty",
      maxProfiles: 12,
    });

    const skincare = run.candidates.find((c) => c.profile.handle === "nora.glowskin");
    const outdoors = run.candidates.find((c) => c.profile.handle === "trail.kate");

    expect(skincare?.status).toBe("match");
    expect(skincare?.verdict?.source).toBe("fixture");
    expect(outdoors?.status).toBe("rejected");

    for (const candidate of run.candidates) {
      for (const tag of candidate.verdict?.tags ?? []) {
        expect(isCanonicalDiscoveryCategory(tag)).toBe(true);
      }
    }
  });

  it("persists the run for the API to read", () => {
    const run = runDemoDiscovery({
      seedHandle: "seeding.brand",
      niche: "outdoor gear",
      maxProfiles: 12,
    });
    const persisted = readRun(run.id);
    expect(persisted?.status).toBe("completed");
    expect(persisted?.counts).toEqual(run.counts);
  });

  it("respects maxProfiles", () => {
    const run = runDemoDiscovery({
      seedHandle: "seeding.brand",
      niche: "skincare",
      maxProfiles: 2,
    });
    expect(run.candidates).toHaveLength(2);
  });

  it("clamps invalid maxProfiles instead of mis-slicing fixtures", () => {
    const run = runDemoDiscovery({
      seedHandle: "seeding.brand",
      niche: "skincare",
      maxProfiles: -1,
    });
    expect(run.candidates).toHaveLength(1);
  });
});
