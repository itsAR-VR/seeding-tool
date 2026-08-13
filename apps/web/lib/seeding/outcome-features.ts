import { prisma } from "@/lib/prisma";

export type CreatorOutcomeFeatures = {
  totalCampaignsOffered: number;
  approvalRate: number;
  responseRate: number;
  avgResponseTimeHours: number;
  acceptanceRate: number;
  completionRate: number;
  avgContentQuality: number;
  avgContentReach: number;
  avgCostPerEngagement: number;
  lastCampaignOutcomeAt: Date | null;
  daysSinceLastOutcome: number;
};

function contentQualityToNumber(value: string | null): number {
  switch (value) {
    case "excellent":
      return 1;
    case "good":
      return 0.8;
    case "acceptable":
      return 0.6;
    case "poor":
      return 0.2;
    default:
      return 0;
  }
}

export async function computeOutcomeFeatures(identityId: string): Promise<CreatorOutcomeFeatures> {
  const outcomes = await prisma.campaignOutcome.findMany({
    where: { identityId },
    orderBy: { updatedAt: "desc" },
  });

  const totalCampaignsOffered = outcomes.length;
  const approvals = outcomes.filter((outcome) => outcome.reviewDecision === "approved").length;
  const declined = outcomes.filter((outcome) => outcome.reviewDecision === "declined").length;
  const replies = outcomes.filter((outcome) => outcome.repliedAt != null).length;
  const outreaches = outcomes.filter((outcome) => outcome.outreachSentAt != null).length;
  const accepted = outcomes.filter((outcome) => outcome.acceptedAt != null).length;
  const completed = outcomes.filter((outcome) => outcome.completedAt != null).length;
  const responseTimes = outcomes
    .map((outcome) => outcome.responseTimeHours)
    .filter((value): value is number => value != null);
  const contentQualities = outcomes.map((outcome) => contentQualityToNumber(outcome.contentQuality));
  const contentReaches = outcomes
    .map((outcome) => outcome.contentReach)
    .filter((value): value is number => value != null);
  const costPerEngagements = outcomes
    .map((outcome) => outcome.costPerEngagement)
    .filter((value): value is number => value != null);
  const lastCampaignOutcomeAt = outcomes[0]?.updatedAt ?? null;

  return {
    totalCampaignsOffered,
    approvalRate: approvals / Math.max(1, approvals + declined),
    responseRate: replies / Math.max(1, outreaches),
    avgResponseTimeHours:
      responseTimes.reduce((sum, value) => sum + value, 0) / Math.max(1, responseTimes.length),
    acceptanceRate: accepted / Math.max(1, replies),
    completionRate: completed / Math.max(1, accepted),
    avgContentQuality:
      contentQualities.reduce((sum, value) => sum + value, 0) / Math.max(1, contentQualities.length),
    avgContentReach:
      contentReaches.reduce((sum, value) => sum + value, 0) / Math.max(1, contentReaches.length),
    avgCostPerEngagement:
      costPerEngagements.reduce((sum, value) => sum + value, 0) / Math.max(1, costPerEngagements.length),
    lastCampaignOutcomeAt,
    daysSinceLastOutcome:
      lastCampaignOutcomeAt == null
        ? Number.POSITIVE_INFINITY
        : Math.floor((Date.now() - lastCampaignOutcomeAt.getTime()) / (1000 * 60 * 60 * 24)),
  };
}
