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

import { computeOutcomeFeatures } from "@/lib/seeding/outcome-features";

describe("computeOutcomeFeatures", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-30T12:00:00.000Z"));
    mocks.findMany.mockReset();
  });

  it("returns safe defaults when no outcomes exist", async () => {
    mocks.findMany.mockResolvedValue([]);

    const result = await computeOutcomeFeatures("identity-1");

    expect(result).toMatchObject({
      totalCampaignsOffered: 0,
      approvalRate: 0,
      responseRate: 0,
      acceptanceRate: 0,
      completionRate: 0,
      avgContentQuality: 0,
    });
    expect(result.daysSinceLastOutcome).toBe(Number.POSITIVE_INFINITY);
  });

  it("derives approval and response metrics from historical outcomes", async () => {
    mocks.findMany.mockResolvedValue([
      {
        reviewDecision: "approved",
        repliedAt: new Date("2026-03-25T12:00:00.000Z"),
        outreachSentAt: new Date("2026-03-24T12:00:00.000Z"),
        responseTimeHours: 24,
        acceptedAt: new Date("2026-03-26T12:00:00.000Z"),
        completedAt: new Date("2026-03-29T12:00:00.000Z"),
        contentQuality: "excellent",
        contentReach: 50_000,
        costPerEngagement: 0.12,
        updatedAt: new Date("2026-03-29T12:00:00.000Z"),
      },
      {
        reviewDecision: "declined",
        repliedAt: null,
        outreachSentAt: new Date("2026-03-20T12:00:00.000Z"),
        responseTimeHours: null,
        acceptedAt: null,
        completedAt: null,
        contentQuality: null,
        contentReach: null,
        costPerEngagement: null,
        updatedAt: new Date("2026-03-20T12:00:00.000Z"),
      },
    ]);

    const result = await computeOutcomeFeatures("identity-1");

    expect(result.approvalRate).toBe(0.5);
    expect(result.responseRate).toBe(0.5);
    expect(result.acceptanceRate).toBe(1);
    expect(result.completionRate).toBe(1);
    expect(result.avgResponseTimeHours).toBe(24);
    expect(result.avgContentQuality).toBe(0.5);
    expect(result.avgContentReach).toBe(50_000);
  });
});
