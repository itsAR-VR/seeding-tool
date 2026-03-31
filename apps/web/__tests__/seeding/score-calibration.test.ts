import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    campaignOutcome: {
      findMany: mocks.findMany,
    },
  },
}));

import { generateCalibrationReport } from "@/lib/seeding/score-calibration";

describe("generateCalibrationReport", () => {
  beforeEach(() => {
    mocks.findMany.mockReset();
  });

  it("builds score buckets and component suggestions from seed outcomes", async () => {
    mocks.findMany.mockResolvedValue([
      {
        reviewDecision: "approved",
        completedAt: new Date("2026-03-29T12:00:00.000Z"),
        fitScoreAtSeed: 0.92,
        scoreComponentsAtSeed: {
          topicalMatch: { score: 0.9 },
          authenticity: { score: 0.8 },
        },
      },
      {
        reviewDecision: "approved",
        completedAt: null,
        fitScoreAtSeed: 0.91,
        scoreComponentsAtSeed: {
          topicalMatch: { score: 0.85 },
          authenticity: { score: 0.75 },
        },
      },
      {
        reviewDecision: "declined",
        completedAt: null,
        fitScoreAtSeed: 0.91,
        scoreComponentsAtSeed: {
          topicalMatch: { score: 0.1 },
          authenticity: { score: 0.2 },
        },
      },
    ]);

    const report = await generateCalibrationReport("campaign-1");

    expect(report.scoreVsApprovalCurve).toContainEqual(
      expect.objectContaining({
        scoreBucket: "0.90-1.00",
        count: 3,
      })
    );
    expect(report.componentCorrelations.topicalMatch.correlationWithApproval).toBeGreaterThan(0);
    expect(report.suggestions[0]).toContain("0.90-1.00");
  });
});
