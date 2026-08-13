import type { InfluencerMetricsDaily } from "@prisma/client";
import { analyzeGrowth } from "@/lib/metrics/anomaly-detection";

export type AuthenticityInput = {
  snapshots: InfluencerMetricsDaily[];
  validationStatus: string;
  sourceConfidence: number;
  isVerified: boolean;
  followerCount: number | null;
  followingCount: number | null;
  postCount: number | null;
  engagementRate: number | null;
  bioText?: string | null;
  profileImageUrl?: string | null;
  websiteUrl?: string | null;
};

export type AuthenticityResult = {
  authScore: number;
  botRiskScore: number;
  growthAnomalyScore: number;
  engagementQualityScore: number;
  modelVersion: string;
  notes: Array<{ label: string; value: number | string }>;
};

export function assessAuthenticity(input: AuthenticityInput): AuthenticityResult {
  const growth = analyzeGrowth(input.snapshots);
  const followingRatio =
    input.followingCount && input.followerCount
      ? input.followingCount / Math.max(1, input.followerCount)
      : 0;
  const profileIncomplete =
    !input.bioText || !input.profileImageUrl || !input.websiteUrl ? 1 : 0;

  const botRiskScore = Math.min(
    1,
    0.3 * Math.min(1, followingRatio / 2) +
      0.25 * (input.postCount != null && input.postCount < 5 ? 0.8 : 0) +
      0.2 * profileIncomplete +
      0.25 * growth.anomalyScore
  );

  const expectedEr =
    input.followerCount == null
      ? 0.03
      : input.followerCount < 10_000
        ? 0.05
        : input.followerCount < 50_000
          ? 0.04
          : input.followerCount < 500_000
            ? 0.025
            : 0.015;
  const engagementRate = input.engagementRate ?? 0;
  const engagementQualityScore = Math.max(
    0,
    Math.min(1, 1 - Math.abs(engagementRate - expectedEr) / Math.max(expectedEr, 0.001))
  );

  const authScore = Math.max(
    0,
    Math.min(
      1,
      (1 - botRiskScore) * 0.35 +
        (1 - growth.anomalyScore) * 0.35 +
        engagementQualityScore * 0.2 +
        (input.isVerified ? 0.1 : input.sourceConfidence * 0.1)
    )
  );

  return {
    authScore,
    botRiskScore,
    growthAnomalyScore: growth.anomalyScore,
    engagementQualityScore,
    modelVersion: "phase20-auth-v1",
    notes: [
      { label: "validationStatus", value: input.validationStatus },
      { label: "accelerationTrend", value: growth.accelerationTrend },
      { label: "anomalySignals", value: growth.anomalySignals.length },
    ],
  };
}
