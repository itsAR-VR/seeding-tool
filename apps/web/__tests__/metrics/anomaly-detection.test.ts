import { describe, expect, it } from "vitest";
import { analyzeGrowth } from "@/lib/metrics/anomaly-detection";

function snapshot(input: {
  date: string;
  followers: number;
  following?: number;
  engagementRate?: number;
}) {
  return {
    id: input.date,
    profileId: "profile-1",
    date: new Date(input.date),
    followers: input.followers,
    following: input.following ?? 200,
    posts: 20,
    avgViews: 5_000,
    engagementRate: input.engagementRate ?? 0.04,
    likes: null,
    comments: null,
    source: "instagram_validated",
    sourceConfidence: 0.85,
    createdAt: new Date(input.date),
    updatedAt: new Date(input.date),
  };
}

describe("analyzeGrowth", () => {
  it("detects repeated spikes and staircase patterns", () => {
    const result = analyzeGrowth([
      snapshot({ date: "2026-03-01T00:00:00.000Z", followers: 1_000 }),
      snapshot({ date: "2026-03-02T00:00:00.000Z", followers: 1_300 }),
      snapshot({ date: "2026-03-03T00:00:00.000Z", followers: 1_600 }),
      snapshot({ date: "2026-03-04T00:00:00.000Z", followers: 1_900 }),
    ]);

    expect(result.anomalySignals.map((signal) => signal.type)).toEqual(
      expect.arrayContaining(["spike", "staircase"])
    );
    expect(result.anomalyScore).toBeGreaterThan(0.5);
  });

  it("flags sharp drops and suspicious following ratios", () => {
    const result = analyzeGrowth([
      snapshot({ date: "2026-03-01T00:00:00.000Z", followers: 10_000, following: 1_000 }),
      snapshot({ date: "2026-03-02T00:00:00.000Z", followers: 8_000, following: 18_000, engagementRate: 0.0008 }),
    ]);

    expect(result.anomalySignals.map((signal) => signal.type)).toEqual(
      expect.arrayContaining(["drop", "suspicious_ratio", "engagement_divergence"])
    );
  });
});
