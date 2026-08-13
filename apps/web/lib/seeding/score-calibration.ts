import { prisma } from "@/lib/prisma";

type ScoreBucket = {
  scoreBucket: string;
  approvalRate: number;
  count: number;
};

export type CalibrationReport = {
  componentCorrelations: Record<
    string,
    {
      correlationWithApproval: number;
      correlationWithCompletion: number;
      suggestedWeightAdjustment: number;
    }
  >;
  scoreVsApprovalCurve: ScoreBucket[];
  suggestions: string[];
};

function bucketForScore(score: number) {
  if (score >= 0.9) return "0.90-1.00";
  if (score >= 0.8) return "0.80-0.89";
  if (score >= 0.7) return "0.70-0.79";
  if (score >= 0.6) return "0.60-0.69";
  return "<0.60";
}

/** Clamp a value to +/- 0.05 */
function clampAdjustment(value: number): number {
  return Math.max(-0.05, Math.min(0.05, value));
}

/**
 * Extract numeric score from a component value that may be a raw number
 * or an object with a `score` property (handles retrievalRelevance shape mismatch).
 */
function extractComponentScore(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "score" in value) {
    const score = (value as { score?: unknown }).score;
    return typeof score === "number" ? score : null;
  }
  return null;
}

export type OutcomeRow = {
  reviewDecision: string | null;
  completedAt: Date | null;
  fitScoreAtSeed: number | null;
  scoreComponentsAtSeed: unknown;
};

export async function generateCalibrationReport(
  campaignId?: string,
  preloadedOutcomes?: OutcomeRow[]
): Promise<CalibrationReport> {
  const outcomes =
    preloadedOutcomes ??
    (await prisma.campaignOutcome.findMany({
      where: campaignId ? { campaignId } : undefined,
      select: {
        reviewDecision: true,
        completedAt: true,
        fitScoreAtSeed: true,
        scoreComponentsAtSeed: true,
      },
    }));

  const buckets = new Map<string, { approved: number; total: number }>();
  const components = new Map<string, { approval: number[]; completion: number[] }>();

  for (const outcome of outcomes) {
    // FIX: Filter out null fitScoreAtSeed — don't bucket as <0.60
    if (outcome.fitScoreAtSeed == null) continue;

    const score = outcome.fitScoreAtSeed;
    const bucket = bucketForScore(score);
    const existing = buckets.get(bucket) ?? { approved: 0, total: 0 };
    const updated = {
      approved: existing.approved + (outcome.reviewDecision === "approved" ? 1 : 0),
      total: existing.total + 1,
    };
    buckets.set(bucket, updated);

    const raw = outcome.scoreComponentsAtSeed;
    const scoreComponents =
      raw && typeof raw === "object" && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : {};

    for (const [key, value] of Object.entries(scoreComponents)) {
      // FIX: Handle shape mismatch — extractComponentScore handles both
      // raw numbers (retrievalRelevance) and {score} objects
      const numericScore = extractComponentScore(value);
      if (numericScore == null) continue;

      const entry = components.get(key) ?? { approval: [], completion: [] };
      const approvalScore = outcome.reviewDecision === "approved" ? numericScore : 0;
      const completionScore = outcome.completedAt ? numericScore : 0;
      components.set(key, {
        approval: [...entry.approval, approvalScore],
        completion: [...entry.completion, completionScore],
      });
    }
  }

  const componentCorrelations = Object.fromEntries(
    [...components.entries()].map(([key, value]) => {
      const avgApproval =
        value.approval.reduce((sum, item) => sum + item, 0) / Math.max(1, value.approval.length);
      const avgCompletion =
        value.completion.reduce((sum, item) => sum + item, 0) /
        Math.max(1, value.completion.length);
      // FIX: Clamp suggestedWeightAdjustment to +/- 0.05
      const suggestedWeightAdjustment = clampAdjustment(avgCompletion - avgApproval);
      return [
        key,
        {
          correlationWithApproval: avgApproval,
          correlationWithCompletion: avgCompletion,
          suggestedWeightAdjustment,
        },
      ];
    })
  );

  const scoreVsApprovalCurve = [...buckets.entries()].map(([scoreBucket, state]) => ({
    scoreBucket,
    approvalRate: state.approved / Math.max(1, state.total),
    count: state.total,
  }));

  const suggestions = scoreVsApprovalCurve
    .filter((bucket) => bucket.count >= 3)
    .map(
      (bucket) =>
        `${bucket.scoreBucket} approval rate ${(bucket.approvalRate * 100).toFixed(0)}% across ${bucket.count} outcomes`
    );

  return {
    componentCorrelations,
    scoreVsApprovalCurve,
    suggestions,
  };
}
