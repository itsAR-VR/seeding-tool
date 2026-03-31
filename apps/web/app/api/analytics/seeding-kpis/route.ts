import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  BrandAccessError,
  getCurrentBrandMembership,
} from "@/lib/integrations/brand-access";
import { getFeatureFlags } from "@/lib/feature-flags";

export async function GET() {
  try {
    const membership = await getCurrentBrandMembership();
    const flags = await getFeatureFlags(membership.brandId);
    if (!flags.outcomeLearningEnabled) {
      return NextResponse.json(
        { error: "Seeding KPIs are disabled for this brand" },
        { status: 403 }
      );
    }

    const [outcomes, searchJobs, searchResults, identityEdges] = await Promise.all([
      prisma.campaignOutcome.findMany({
        where: { campaign: { brandId: membership.brandId } },
      }),
      prisma.creatorSearchJob.findMany({
        where: {
          brandId: membership.brandId,
          status: { in: ["completed", "completed_with_shortfall"] },
        },
      }),
      prisma.creatorSearchResult.findMany({
        where: { searchJob: { brandId: membership.brandId } },
        orderBy: { fitScore: "desc" },
        take: 20,
      }),
      prisma.identityEdge.findMany({
        where: {
          matchBand: "auto_linked",
          OR: [
            {
              fromProfile: {
                influencer: { creators: { some: { brandId: membership.brandId } } },
              },
            },
            {
              toProfile: {
                influencer: { creators: { some: { brandId: membership.brandId } } },
              },
            },
          ],
        },
      }),
    ]);

    const approvedTop20 = searchResults.filter((result) => (result.fitScore ?? 0) > 0).length;
    const mergedResolved = identityEdges.filter((edge) => edge.reviewOutcome === "confirmed").length;
    const mergedRejected = identityEdges.filter((edge) => edge.reviewOutcome === "rejected").length;
    const approvedOutcomes = outcomes.filter((outcome) => outcome.reviewDecision === "approved").length;
    const outreachSent = outcomes.filter((outcome) => outcome.outreachSentAt != null).length;
    const replies = outcomes.filter((outcome) => outcome.repliedAt != null).length;
    const delivered = outcomes.filter((outcome) => outcome.deliveredAt != null).length;
    const costValues = outcomes
      .map((outcome) => outcome.costPerCreator)
      .filter((value): value is number => value != null);
    const totalCost = costValues.reduce((sum, value) => sum + value, 0);
    const unknownValidation = searchResults.filter((result) =>
      ["unknown", "retry"].includes(result.validationStatus)
    ).length;
    const completedDurations = searchJobs
      .filter((job) => job.startedAt && job.finishedAt)
      .map((job) => job.finishedAt!.getTime() - job.startedAt!.getTime());

    return NextResponse.json({
      precisionTop20: approvedOutcomes / Math.max(1, approvedTop20),
      mergePrecision: mergedResolved / Math.max(1, mergedResolved + mergedRejected),
      shortlistApprovalRate: approvedOutcomes / Math.max(1, outcomes.length),
      outreachReplyRate: replies / Math.max(1, outreachSent),
      costPerApprovedCreator: totalCost / Math.max(1, approvedOutcomes),
      costPerDeliveredCreator: totalCost / Math.max(1, delivered),
      validationUnknownRate: unknownValidation / Math.max(1, searchResults.length),
      timeToUsableSeedList:
        completedDurations.reduce((sum, value) => sum + value, 0) /
        Math.max(1, completedDurations.length) /
        1000,
    });
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[analytics/seeding-kpis/GET]", error);
    return NextResponse.json(
      { error: "Failed to load seeding KPIs" },
      { status: 500 }
    );
  }
}
