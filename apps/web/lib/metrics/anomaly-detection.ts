import type { InfluencerMetricsDaily } from "@prisma/client";

export type GrowthAnalysis = {
  velocityDaily: number;
  velocityWeekly: number;
  accelerationTrend: "accelerating" | "steady" | "decelerating" | "insufficient_data";
  anomalyScore: number;
  anomalySignals: Array<{
    type: "spike" | "staircase" | "drop" | "engagement_divergence" | "suspicious_ratio";
    severity: "low" | "medium" | "high";
    description: string;
    detectedAt: Date;
    value: number;
  }>;
};

export function analyzeGrowth(snapshots: InfluencerMetricsDaily[]): GrowthAnalysis {
  const ordered = [...snapshots]
    .filter((snapshot) => snapshot.followers != null)
    .sort((left, right) => left.date.getTime() - right.date.getTime());

  if (ordered.length < 2) {
    return {
      velocityDaily: 0,
      velocityWeekly: 0,
      accelerationTrend: "insufficient_data",
      anomalyScore: 0,
      anomalySignals: [],
    };
  }

  const dailyDiffs = ordered.slice(1).map((snapshot, index) => {
    const previous = ordered[index];
    return (snapshot.followers ?? 0) - (previous.followers ?? 0);
  });
  const velocityDaily =
    dailyDiffs.reduce((sum, value) => sum + value, 0) / dailyDiffs.length;
  const velocityWeekly = velocityDaily * 7;

  const anomalySignals: GrowthAnalysis["anomalySignals"] = [];

  ordered.slice(1).forEach((snapshot, index) => {
    const previous = ordered[index];
    const prevFollowers = previous.followers ?? 0;
    const nextFollowers = snapshot.followers ?? 0;
    const delta = nextFollowers - prevFollowers;
    const ratio = prevFollowers > 0 ? delta / prevFollowers : 0;

    if (ratio > 0.1) {
      anomalySignals.push({
        type: "spike",
        severity: ratio > 0.25 ? "high" : "medium",
        description: "Follower growth spike exceeded expected daily variance.",
        detectedAt: snapshot.date,
        value: ratio,
      });
    }

    if (ratio < -0.05) {
      anomalySignals.push({
        type: "drop",
        severity: ratio < -0.15 ? "high" : "medium",
        description: "Follower loss exceeded the expected daily range.",
        detectedAt: snapshot.date,
        value: ratio,
      });
    }

    const following = snapshot.following ?? 0;
    if (nextFollowers > 0 && following / nextFollowers > 2) {
      anomalySignals.push({
        type: "suspicious_ratio",
        severity: "medium",
        description: "Following-to-follower ratio is unusually high.",
        detectedAt: snapshot.date,
        value: following / nextFollowers,
      });
    }

    const engagementRate = snapshot.engagementRate ?? 0;
    if (engagementRate > 0.15 || (engagementRate > 0 && engagementRate < 0.001)) {
      anomalySignals.push({
        type: "engagement_divergence",
        severity: engagementRate > 0.15 ? "high" : "low",
        description: "Engagement rate sits outside the expected range for creator tiers.",
        detectedAt: snapshot.date,
        value: engagementRate,
      });
    }
  });

  let staircaseMatches = 0;
  for (let index = 2; index < dailyDiffs.length; index += 1) {
    if (
      dailyDiffs[index] !== 0 &&
      dailyDiffs[index] === dailyDiffs[index - 1] &&
      dailyDiffs[index - 1] === dailyDiffs[index - 2]
    ) {
      staircaseMatches += 1;
    }
  }
  if (staircaseMatches > 0) {
    anomalySignals.push({
      type: "staircase",
      severity: staircaseMatches > 1 ? "high" : "medium",
      description: "Repeated identical follower jumps suggest non-organic growth.",
      detectedAt: ordered[ordered.length - 1].date,
      value: staircaseMatches,
    });
  }

  const head = dailyDiffs.slice(0, Math.ceil(dailyDiffs.length / 2));
  const tail = dailyDiffs.slice(Math.ceil(dailyDiffs.length / 2));
  const headAvg = head.reduce((sum, value) => sum + value, 0) / Math.max(1, head.length);
  const tailAvg = tail.reduce((sum, value) => sum + value, 0) / Math.max(1, tail.length);
  const accelerationTrend =
    tailAvg > headAvg * 1.15
      ? "accelerating"
      : tailAvg < headAvg * 0.85
        ? "decelerating"
        : "steady";

  const anomalyScore = Math.min(
    1,
    anomalySignals.reduce((sum, signal) => {
      if (signal.severity === "high") return sum + 0.35;
      if (signal.severity === "medium") return sum + 0.2;
      return sum + 0.1;
    }, 0)
  );

  return {
    velocityDaily,
    velocityWeekly,
    accelerationTrend,
    anomalyScore,
    anomalySignals,
  };
}
