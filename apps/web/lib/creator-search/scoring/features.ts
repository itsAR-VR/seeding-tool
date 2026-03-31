import type { ContactPoint, InfluencerMetricsDaily } from "@prisma/client";
import type { DiscoveryClassification } from "@/lib/creator-search/classification";
import { assessAuthenticity } from "@/lib/metrics/authenticity";

function normalizeTokens(values: Array<string | null | undefined>) {
  return values
    .flatMap((value) =>
      (value ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .split(" ")
        .filter(Boolean)
    );
}

function overlapScore(left: string[], right: string[]) {
  if (left.length === 0 || right.length === 0) {
    return 0;
  }

  const leftSet = new Set(left);
  const rightSet = new Set(right);
  let shared = 0;
  for (const token of leftSet) {
    if (rightSet.has(token)) {
      shared += 1;
    }
  }

  return shared / Math.max(leftSet.size, rightSet.size);
}

export function computeTopicalMatch(input: {
  creatorBio: string | null;
  creatorCategories: string[];
  campaignKeywords: string[];
  campaignCategories: string[];
  briefText?: string | null;
}) {
  const creatorTokens = normalizeTokens([
    input.creatorBio,
    ...input.creatorCategories,
  ]);
  const campaignTokens = normalizeTokens([
    ...input.campaignKeywords,
    ...input.campaignCategories,
    input.briefText,
  ]);
  const score = overlapScore(creatorTokens, campaignTokens);
  return {
    score,
    signals: input.campaignKeywords.filter((keyword) =>
      creatorTokens.includes(keyword.toLowerCase())
    ),
  };
}

export function computeCategoryConfidence(input: {
  classification: DiscoveryClassification | null;
  campaignCategories: string[];
}) {
  const confidenceWeight =
    input.classification?.confidence === "high"
      ? 1
      : input.classification?.confidence === "medium"
        ? 0.7
        : 0.35;
  const matchesCampaign =
    input.classification?.canonicalCategory &&
    input.campaignCategories.includes(input.classification.canonicalCategory)
      ? 1
      : input.campaignCategories.length === 0
        ? 0.8
        : 0;

  return {
    score: Math.max(confidenceWeight * matchesCampaign, input.campaignCategories.length === 0 ? confidenceWeight : 0),
    signals: input.classification?.matchedKeywords ?? [],
  };
}

export function computeEngagementQuality(input: {
  followerCount: number | null;
  avgViews: number | null;
  engagementRate: number | null;
  recentEngagementTrend?: "improving" | "stable" | "declining";
  viewToFollowerRatio?: number;
  snapshotCount?: number;
}) {
  const engagementRateScore =
    input.engagementRate == null
      ? 0.4
      : Math.min(1, input.engagementRate / 0.06);
  const viewRatio =
    input.viewToFollowerRatio ??
    (input.avgViews && input.followerCount
      ? input.avgViews / Math.max(1, input.followerCount)
      : 0);
  const viewRatioScore = Math.min(1, viewRatio / 0.6);
  const trendScore =
    input.recentEngagementTrend === "improving"
      ? 1
      : input.recentEngagementTrend === "declining"
        ? 0.35
        : 0.7;

  return {
    score:
      engagementRateScore * 0.5 +
      viewRatioScore * 0.35 +
      trendScore * 0.15,
    signals: [
      input.engagementRate != null
        ? `engagement:${input.engagementRate.toFixed(4)}`
        : "engagement:unknown",
      input.avgViews != null ? `avgViews:${input.avgViews}` : "avgViews:unknown",
      input.snapshotCount ? `snapshots:${input.snapshotCount}` : "snapshots:0",
    ],
  };
}

export function computeAuthenticity(input: {
  validationStatus: string;
  sourceConfidence: number;
  isVerified: boolean;
  followerCount: number | null;
  followingCount?: number | null;
  postCount?: number | null;
  engagementRate?: number | null;
  growthAnomalyScore?: number;
  botRiskScore?: number;
  engagementQualityScore?: number;
  snapshotCount?: number;
  snapshots?: InfluencerMetricsDaily[];
  bioText?: string | null;
  profileImageUrl?: string | null;
  websiteUrl?: string | null;
}) {
  const assessed =
    input.snapshots != null
      ? assessAuthenticity({
          snapshots: input.snapshots,
          validationStatus: input.validationStatus,
          sourceConfidence: input.sourceConfidence,
          isVerified: input.isVerified,
          followerCount: input.followerCount,
          followingCount: input.followingCount ?? null,
          postCount: input.postCount ?? null,
          engagementRate: input.engagementRate ?? null,
          bioText: input.bioText,
          profileImageUrl: input.profileImageUrl,
          websiteUrl: input.websiteUrl,
        })
      : null;

  const score =
    assessed?.authScore ??
    Math.max(
      0,
      Math.min(
        1,
        (input.validationStatus === "valid" ? 0.45 : input.validationStatus === "unknown" ? 0.3 : 0.1) +
          input.sourceConfidence * 0.35 +
          (input.isVerified ? 0.2 : 0)
      )
    );

  return {
    score,
    signals: [
      `validation:${input.validationStatus}`,
      `sourceConfidence:${input.sourceConfidence.toFixed(2)}`,
      assessed ? `botRisk:${assessed.botRiskScore.toFixed(2)}` : "botRisk:heuristic",
    ],
  };
}

export function computeScaleFit(input: {
  followerCount: number | null;
  avgViews: number | null;
  minFollowers?: number | null;
  maxFollowers?: number | null;
  minAvgViews?: number | null;
}) {
  let followerScore = 0.7;
  if (input.followerCount == null) {
    followerScore = 0.35;
  } else if (input.minFollowers != null && input.followerCount < input.minFollowers) {
    followerScore = 0;
  } else if (input.maxFollowers != null && input.followerCount > input.maxFollowers) {
    followerScore = 0;
  }

  const viewsScore =
    input.minAvgViews == null
      ? 0.7
      : input.avgViews == null
        ? 0.35
        : input.avgViews >= input.minAvgViews
          ? 1
          : input.avgViews / Math.max(1, input.minAvgViews);

  return {
    score: followerScore * 0.7 + viewsScore * 0.3,
    signals: [
      input.followerCount != null ? `followers:${input.followerCount}` : "followers:unknown",
      input.avgViews != null ? `avgViews:${input.avgViews}` : "avgViews:unknown",
    ],
  };
}

export function computeIdentityConfidence(input: {
  identityEdgeCount: number;
  bestEdgeScore: number | null;
  crossPlatformProfileCount: number;
  sourceCount: number;
  sourceConfidence: number;
}) {
  const edgeScore = input.bestEdgeScore ?? 0;
  const platformScore = Math.min(1, input.crossPlatformProfileCount / 3);
  const corroborationScore = Math.min(1, input.sourceCount / 3);
  return {
    score:
      edgeScore * 0.45 +
      platformScore * 0.25 +
      corroborationScore * 0.15 +
      input.sourceConfidence * 0.15,
    signals: [
      `edgeCount:${input.identityEdgeCount}`,
      `bestEdge:${edgeScore.toFixed(2)}`,
      `platforms:${input.crossPlatformProfileCount}`,
    ],
  };
}

export function computeContactability(input: {
  contactPoints: Array<Pick<ContactPoint, "contactType" | "confidence" | "isStale">>;
  hasPublicEmail: boolean;
}) {
  if (input.contactPoints.length === 0) {
    return {
      score: input.hasPublicEmail ? 0.45 : 0.15,
      signals: ["contacts:0"],
    };
  }

  const strongest = input.contactPoints.reduce(
    (max, point) => Math.max(max, point.confidence),
    0
  );
  const stalePenalty = input.contactPoints.some((point) => point.isStale) ? 0.15 : 0;
  return {
    score: Math.max(0, strongest - stalePenalty),
    signals: input.contactPoints.map(
      (point) => `${point.contactType}:${point.confidence.toFixed(2)}`
    ),
  };
}
