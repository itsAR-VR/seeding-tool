import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  updateMany: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  deleteMany: vi.fn(),
  createResult: vi.fn(),
  createIntervention: vi.fn(),
  orchestrate: vi.fn(),
}));

vi.mock("@/lib/inngest/client", () => ({
  inngest: {
    send: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    creatorSearchJob: {
      findFirst: mocks.findFirst,
      updateMany: mocks.updateMany,
      findUnique: mocks.findUnique,
      update: mocks.update,
    },
    creatorSearchResult: {
      deleteMany: mocks.deleteMany,
      create: mocks.createResult,
    },
    interventionCase: {
      create: mocks.createIntervention,
    },
    creator: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    creatorProfile: {
      upsert: vi.fn(),
    },
    campaignCreator: {
      upsert: vi.fn(),
    },
  },
}));

vi.mock("@/lib/creator-search/contracts", () => ({
  normalizeUnifiedDiscoveryQuery: vi.fn(() => ({
    sources: ["collabstr", "apify_search"],
    keywords: [],
    canonicalCategories: [],
    platform: "instagram",
    limit: 25,
    location: null,
    emailPrefetch: false,
    usernames: [],
    seedExpansion: {
      enabled: false,
      maxSeedsPerRun: 5,
      maxFollowingPerSeed: 100,
    },
    filters: {
      excludeExistingCreators: true,
      requireCategory: false,
      minFollowers: null,
      maxFollowers: null,
      minAvgViews: null,
    },
  })),
}));

vi.mock("@/lib/creator-search/orchestrator", () => ({
  orchestrateUnifiedDiscovery: mocks.orchestrate,
}));

vi.mock("@/lib/creator-search/provenance", () => ({
  recordCreatorDiscoveryTouch: vi.fn(),
}));

vi.mock("@/lib/creators/validation-ops", () => ({
  applyValidationResultToCreator: vi.fn(),
}));

vi.mock("@/lib/instagram/validator", () => ({
  validateInstagramCreators: vi.fn(),
}));

import { runCreatorSearchJob } from "@/lib/creator-search/job-runner";

describe("runCreatorSearchJob", () => {
  beforeEach(() => {
    mocks.findFirst.mockReset();
    mocks.updateMany.mockReset();
    mocks.findUnique.mockReset();
    mocks.update.mockReset();
    mocks.deleteMany.mockReset();
    mocks.createResult.mockReset();
    mocks.createIntervention.mockReset();
    mocks.orchestrate.mockReset();
  });

  it("returns a failed result instead of rethrowing once the job is marked failed", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "job_123",
      status: "pending",
      query: {},
      campaignId: null,
    });
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.orchestrate.mockRejectedValue(new Error("boom"));
    mocks.update.mockResolvedValue({});
    mocks.createIntervention.mockResolvedValue({});

    await expect(
      runCreatorSearchJob({
        jobId: "job_123",
        brandId: "brand_123",
      })
    ).resolves.toMatchObject({
      jobId: "job_123",
      status: "failed",
      error: "boom",
    });

    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "job_123" },
        data: expect.objectContaining({
          status: "failed",
          error: "boom",
        }),
      })
    );
    expect(mocks.createIntervention).toHaveBeenCalledTimes(1);
  });
});
