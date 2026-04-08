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
import type { OutcomeRow } from "@/lib/seeding/score-calibration";

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

  it("clamps suggestedWeightAdjustment to +/- 0.05", async () => {
    // All approved, all completed — approval avg = 0.9, completion avg = 0.9
    // But create a case where difference would exceed 0.05:
    // approved + completed => approval push = score, completion push = score
    // declined + not completed => approval push = 0, completion push = 0
    // Craft: high completion scores, low approval scores
    const outcomes: OutcomeRow[] = Array.from({ length: 10 }, (_, i) => ({
      reviewDecision: i < 2 ? "approved" : "declined",
      completedAt: i < 8 ? new Date() : null,
      fitScoreAtSeed: 0.85,
      scoreComponentsAtSeed: {
        topicalMatch: { score: 0.9 },
      },
    }));

    const report = await generateCalibrationReport(undefined, outcomes);

    const adjustment = report.componentCorrelations.topicalMatch.suggestedWeightAdjustment;
    expect(adjustment).toBeGreaterThanOrEqual(-0.05);
    expect(adjustment).toBeLessThanOrEqual(0.05);
  });

  it("filters out null fitScoreAtSeed outcomes instead of bucketing as <0.60", async () => {
    const outcomes: OutcomeRow[] = [
      {
        reviewDecision: "approved",
        completedAt: new Date(),
        fitScoreAtSeed: null,
        scoreComponentsAtSeed: { topicalMatch: { score: 0.5 } },
      },
      {
        reviewDecision: "approved",
        completedAt: new Date(),
        fitScoreAtSeed: 0.85,
        scoreComponentsAtSeed: { topicalMatch: { score: 0.9 } },
      },
    ];

    const report = await generateCalibrationReport(undefined, outcomes);

    // The null outcome should be excluded entirely
    const totalCount = report.scoreVsApprovalCurve.reduce((sum, b) => sum + b.count, 0);
    expect(totalCount).toBe(1);

    // Should NOT have a <0.60 bucket from the null outcome
    const lowBucket = report.scoreVsApprovalCurve.find((b) => b.scoreBucket === "<0.60");
    expect(lowBucket).toBeUndefined();
  });

  it("handles retrievalRelevance as raw number (shape mismatch)", async () => {
    const outcomes: OutcomeRow[] = [
      {
        reviewDecision: "approved",
        completedAt: new Date(),
        fitScoreAtSeed: 0.8,
        scoreComponentsAtSeed: {
          topicalMatch: { score: 0.9 },
          retrievalRelevance: 0.75, // raw number, not {score: 0.75}
        },
      },
      {
        reviewDecision: "approved",
        completedAt: new Date(),
        fitScoreAtSeed: 0.82,
        scoreComponentsAtSeed: {
          topicalMatch: { score: 0.85 },
          retrievalRelevance: 0.8,
        },
      },
    ];

    const report = await generateCalibrationReport(undefined, outcomes);

    // retrievalRelevance should be processed, not skipped or errored
    expect(report.componentCorrelations.retrievalRelevance).toBeDefined();
    expect(report.componentCorrelations.retrievalRelevance.correlationWithApproval).toBeGreaterThan(
      0
    );
  });

  it("skips components with non-numeric score values", async () => {
    const outcomes: OutcomeRow[] = [
      {
        reviewDecision: "approved",
        completedAt: new Date(),
        fitScoreAtSeed: 0.8,
        scoreComponentsAtSeed: {
          topicalMatch: { score: 0.9 },
          badComponent: { score: "not-a-number" },
          nullComponent: null,
        },
      },
    ];

    const report = await generateCalibrationReport(undefined, outcomes);

    expect(report.componentCorrelations.topicalMatch).toBeDefined();
    expect(report.componentCorrelations.badComponent).toBeUndefined();
    expect(report.componentCorrelations.nullComponent).toBeUndefined();
  });
});
