import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  brandFindMany: vi.fn(),
  outcomeFindMany: vi.fn(),
  snapshotCreate: vi.fn(),
  getFeatureFlags: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    brand: { findMany: mocks.brandFindMany },
    campaignOutcome: { findMany: mocks.outcomeFindMany },
    calibrationSnapshot: { create: mocks.snapshotCreate },
  },
}));

vi.mock("@/lib/feature-flags", () => ({
  getFeatureFlags: mocks.getFeatureFlags,
}));

vi.mock("@/lib/logger", () => ({
  log: vi.fn(),
}));

vi.mock("@/lib/inngest/client", () => ({
  inngest: {
    createFunction: (
      _config: unknown,
      _trigger: unknown,
      handler: () => Promise<unknown>
    ) => handler,
  },
}));

import { weeklyCalibration } from "@/lib/inngest/functions/weekly-calibration";

function makeOutcome(overrides: {
  reviewDecision?: string;
  completedAt?: Date | null;
  fitScoreAtSeed?: number | null;
  scoreComponentsAtSeed?: unknown;
}) {
  return {
    reviewDecision: overrides.reviewDecision ?? "approved",
    completedAt: overrides.completedAt ?? new Date(),
    fitScoreAtSeed: overrides.fitScoreAtSeed ?? 0.85,
    scoreComponentsAtSeed: overrides.scoreComponentsAtSeed ?? {
      topicalMatch: { score: 0.8 },
      engagementQuality: { score: 0.7 },
    },
  };
}

describe("weeklyCalibration", () => {
  beforeEach(() => {
    mocks.brandFindMany.mockReset();
    mocks.outcomeFindMany.mockReset();
    mocks.snapshotCreate.mockReset();
    mocks.getFeatureFlags.mockReset();
  });

  it("skips brands without outcomeLearningEnabled", async () => {
    mocks.brandFindMany.mockResolvedValue([
      { id: "brand-enabled" },
      { id: "brand-disabled" },
    ]);
    mocks.getFeatureFlags
      .mockResolvedValueOnce({ outcomeLearningEnabled: true })
      .mockResolvedValueOnce({ outcomeLearningEnabled: false });
    mocks.outcomeFindMany.mockResolvedValue([]);

    const handler = weeklyCalibration as unknown as () => Promise<{
      results: Array<{ brandId: string; status: string }>;
    }>;
    const result = await handler();

    // Only brand-enabled should be processed
    expect(result.results).toHaveLength(1);
    expect(result.results[0].brandId).toBe("brand-enabled");
  });

  it("does not create snapshot when < 50 outcomes", async () => {
    mocks.brandFindMany.mockResolvedValue([{ id: "brand-1" }]);
    mocks.getFeatureFlags.mockResolvedValue({ outcomeLearningEnabled: true });
    mocks.outcomeFindMany.mockResolvedValue(
      Array.from({ length: 10 }, () => makeOutcome({}))
    );

    const handler = weeklyCalibration as unknown as () => Promise<{
      results: Array<{ brandId: string; status: string }>;
    }>;
    const result = await handler();

    expect(result.results[0].status).toBe("skipped_insufficient");
    expect(mocks.snapshotCreate).not.toHaveBeenCalled();
  });

  it("creates snapshot when >= 50 outcomes with clamped adjustments", async () => {
    mocks.brandFindMany.mockResolvedValue([{ id: "brand-1" }]);
    mocks.getFeatureFlags.mockResolvedValue({ outcomeLearningEnabled: true });
    mocks.outcomeFindMany.mockResolvedValue(
      Array.from({ length: 55 }, () => makeOutcome({}))
    );
    mocks.snapshotCreate.mockResolvedValue({ id: "snap-1" });

    const handler = weeklyCalibration as unknown as () => Promise<{
      results: Array<{ brandId: string; status: string; outcomeCount?: number }>;
    }>;
    const result = await handler();

    expect(result.results[0].status).toBe("snapshot_created");
    expect(result.results[0].outcomeCount).toBe(55);
    expect(mocks.snapshotCreate).toHaveBeenCalledTimes(1);

    const createArgs = mocks.snapshotCreate.mock.calls[0][0];
    const suggested = createArgs.data.suggestedWeights;
    // Suggested weights must sum to ~1.0 (normalized)
    const sum = Object.values(suggested as Record<string, number>).reduce(
      (a: number, b: number) => a + b,
      0
    );
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it("normalizes suggested weights to sum to 1.0 after adjustment", async () => {
    mocks.brandFindMany.mockResolvedValue([{ id: "brand-1" }]);
    mocks.getFeatureFlags.mockResolvedValue({ outcomeLearningEnabled: true });

    // Create outcomes with varied components to trigger adjustments
    const outcomes = Array.from({ length: 60 }, (_, i) => {
      const approved = i % 3 === 0;
      const completed = i % 2 === 0;
      return makeOutcome({
        reviewDecision: approved ? "approved" : "declined",
        completedAt: completed ? new Date() : null,
        fitScoreAtSeed: 0.75 + (i % 10) * 0.02,
        scoreComponentsAtSeed: {
          topicalMatch: { score: approved ? 0.9 : 0.3 },
          engagementQuality: { score: completed ? 0.85 : 0.4 },
          authenticity: { score: 0.7 },
          scaleFit: { score: 0.6 },
          categoryConfidence: { score: 0.5 },
          identityConfidence: { score: 0.8 },
          contactability: { score: 0.4 },
        },
      });
    });

    mocks.outcomeFindMany.mockResolvedValue(outcomes);
    mocks.snapshotCreate.mockResolvedValue({ id: "snap-2" });

    const handler = weeklyCalibration as unknown as () => Promise<{
      results: Array<{ brandId: string; status: string }>;
    }>;
    await handler();

    const createArgs = mocks.snapshotCreate.mock.calls[0][0];
    const suggested = createArgs.data.suggestedWeights as Record<string, number>;
    const sum = Object.values(suggested).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });
});
