import type { ValidationResult } from "@/lib/validation/types";

/**
 * Per-platform metrics extracted from validation results.
 */
export interface PlatformMetrics {
  platform: string;
  followerCount: number | null;
  avgViews: number | null;
  engagementRate: number | null;
}

/**
 * Best-of metrics across multiple platforms for a single creator.
 */
export interface BestPlatformMetrics {
  primaryPlatform: string;
  followerCount: number | null;
  avgViews: number | null;
  engagementRate: number | null;
  platformCount: number;
}

/**
 * Given validation results from multiple platforms for the same creator,
 * select the best metrics for scoring:
 * - Highest follower count across platforms (for computeScaleFit)
 * - Highest engagement rate across platforms (for computeEngagementQuality)
 * - Highest avg views across platforms
 * - Primary platform = the one with the highest follower count
 */
export function selectBestPlatformMetrics(
  results: readonly PlatformMetrics[]
): BestPlatformMetrics {
  if (results.length === 0) {
    return {
      primaryPlatform: "instagram",
      followerCount: null,
      avgViews: null,
      engagementRate: null,
      platformCount: 0,
    };
  }

  const validResults = results.filter(
    (result) => result.followerCount != null && result.followerCount > 0
  );

  if (validResults.length === 0) {
    return {
      primaryPlatform: results[0]!.platform,
      followerCount: null,
      avgViews: null,
      engagementRate: null,
      platformCount: results.length,
    };
  }

  const bestFollowers = validResults.reduce(
    (best, current) =>
      (current.followerCount ?? 0) > (best.followerCount ?? 0)
        ? current
        : best,
    validResults[0]!
  );

  const bestEngagement = validResults.reduce<number | null>(
    (best, current) => {
      if (current.engagementRate == null) return best;
      if (best == null) return current.engagementRate;
      return Math.max(best, current.engagementRate);
    },
    null
  );

  const bestAvgViews = validResults.reduce<number | null>((best, current) => {
    if (current.avgViews == null) return best;
    if (best == null) return current.avgViews;
    return Math.max(best, current.avgViews);
  }, null);

  return {
    primaryPlatform: bestFollowers.platform,
    followerCount: bestFollowers.followerCount,
    avgViews: bestAvgViews,
    engagementRate: bestEngagement,
    platformCount: validResults.length,
  };
}

/**
 * Convert a ValidationResult into PlatformMetrics for multi-platform scoring.
 */
export function toPlatformMetrics(
  platform: string,
  result: ValidationResult
): PlatformMetrics {
  return {
    platform,
    followerCount: result.followerCount,
    avgViews: result.avgViews,
    engagementRate: result.engagementRate,
  };
}
