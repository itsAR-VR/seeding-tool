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

export async function generateCalibrationReport(campaignId?: string): Promise<CalibrationReport> {
  const outcomes = await prisma.campaignOutcome.findMany({
    where: campaignId ? { campaignId } : undefined,
    select: {
      reviewDecision: true,
      completedAt: true,
      fitScoreAtSeed: true,
      scoreComponentsAtSeed: true,
    },
  });

  const buckets = new Map<string, { approved: number; total: number }>();
  const components = new Map<string, { approval: number[]; completion: number[] }>();

  for (const outcome of outcomes) {
    const score = outcome.fitScoreAtSeed ?? 0;
    const bucket = bucketForScore(score);
    const bucketState = buckets.get(bucket) ?? { approved: 0, total: 0 };
    bucketState.total += 1;
    if (outcome.reviewDecision === "approved") {
      bucketState.approved += 1;
    }
    buckets.set(bucket, bucketState);

    const scoreComponents =
      outcome.scoreComponentsAtSeed &&
      typeof outcome.scoreComponentsAtSeed === "object" &&
      !Array.isArray(outcome.scoreComponentsAtSeed)
        ? (outcome.scoreComponentsAtSeed as Record<string, { score?: number }>)
        : {};

    for (const [key, value] of Object.entries(scoreComponents)) {
      const entry = components.get(key) ?? { approval: [], completion: [] };
      entry.approval.push(outcome.reviewDecision === "approved" ? value?.score ?? 0 : 0);
      entry.completion.push(outcome.completedAt ? value?.score ?? 0 : 0);
      components.set(key, entry);
    }
  }

  const componentCorrelations = Object.fromEntries(
    [...components.entries()].map(([key, value]) => {
      const avgApproval =
        value.approval.reduce((sum, item) => sum + item, 0) / Math.max(1, value.approval.length);
      const avgCompletion =
        value.completion.reduce((sum, item) => sum + item, 0) / Math.max(1, value.completion.length);
      const suggestedWeightAdjustment = avgCompletion - avgApproval;
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
