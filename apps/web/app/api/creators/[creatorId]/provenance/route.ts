import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  BrandAccessError,
  getCurrentBrandMembership,
} from "@/lib/integrations/brand-access";
import { getFeatureFlags } from "@/lib/feature-flags";
import { analyzeGrowth } from "@/lib/metrics/anomaly-detection";

type RouteContext = { params: Promise<{ creatorId: string }> };

function confidenceBand(score: number | null | undefined) {
  if ((score ?? 0) >= 0.8) return "high";
  if ((score ?? 0) >= 0.65) return "moderate";
  return "low";
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { creatorId } = await context.params;
    const membership = await getCurrentBrandMembership();
    const flags = await getFeatureFlags(membership.brandId);
    if (
      !flags.identityGraphEnabled &&
      !flags.decisionEngineScoringEnabled &&
      !flags.outcomeLearningEnabled
    ) {
      return NextResponse.json(
        { error: "Creator provenance is disabled for this brand" },
        { status: 403 }
      );
    }

    const creator = await prisma.creator.findFirst({
      where: { id: creatorId, brandId: membership.brandId },
      include: {
        discoveryTouches: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        influencerIdentity: {
          include: {
            profiles: {
              include: {
                contactPoints: true,
                metricsDaily: {
                  orderBy: { date: "desc" },
                  take: 14,
                },
                authenticityAssessments: {
                  orderBy: { computedAt: "desc" },
                  take: 1,
                },
              },
            },
          },
        },
        outcomes: {
          orderBy: { updatedAt: "desc" },
          take: 10,
        },
      },
    });

    if (!creator) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    const latestSearchResult = creator.instagramHandle
      ? await prisma.creatorSearchResult.findFirst({
          where: {
            handle: creator.instagramHandle,
            searchJob: { brandId: membership.brandId },
          },
          orderBy: { createdAt: "desc" },
        })
      : null;

    const allSnapshots =
      creator.influencerIdentity?.profiles.flatMap((profile) => profile.metricsDaily) ?? [];
    const growthAnalysis =
      allSnapshots.length > 1 ? analyzeGrowth(allSnapshots) : null;
    const latestAssessment =
      creator.influencerIdentity?.profiles
        .flatMap((profile) => profile.authenticityAssessments)
        .sort((left, right) => right.computedAt.getTime() - left.computedAt.getTime())[0] ??
      null;

    const metadata = asRecord(latestSearchResult?.metadata);
    const riskFlags: string[] = [];
    if (latestSearchResult?.validationStatus === "unknown" || latestSearchResult?.validationStatus === "retry") {
      riskFlags.push(`Validation status ${latestSearchResult.validationStatus}`);
    }
    if (((latestSearchResult?.sources as unknown[])?.length ?? 0) <= 1) {
      riskFlags.push("Single source only");
    }
    if ((latestAssessment?.authScore ?? 1) < 0.55) {
      riskFlags.push("Low authenticity score");
    }
    if (
      creator.influencerIdentity?.profiles.some((profile) =>
        profile.contactPoints.some((point) => point.isStale)
      )
    ) {
      riskFlags.push("Contact point may be stale");
    }

    return NextResponse.json({
      creator: {
        id: creator.id,
        name: creator.name,
        instagramHandle: creator.instagramHandle,
        email: creator.email,
        validationStatus: creator.validationStatus,
      },
      discoveryTouches: creator.discoveryTouches,
      scoreDecomposition: latestSearchResult?.scoreComponents ?? null,
      confidenceBand: confidenceBand(latestSearchResult?.fitScore),
      riskFlags,
      portfolioRole:
        typeof metadata.contactabilityBand === "string"
          ? `Selected for ${metadata.contactabilityBand} contactability`
          : null,
      outcomeHistory: creator.outcomes,
      authenticityAssessment: latestAssessment,
      growthAnalysis,
      identity: creator.influencerIdentity
        ? {
            id: creator.influencerIdentity.id,
            displayName: creator.influencerIdentity.displayName,
            profiles: creator.influencerIdentity.profiles.map((profile) => ({
              id: profile.id,
              platform: profile.platform,
              handle: profile.handle,
              profileUrl: profile.profileUrl,
              contactPoints: profile.contactPoints,
            })),
          }
        : null,
    });
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[creators/[creatorId]/provenance/GET]", error);
    return NextResponse.json(
      { error: "Failed to load creator provenance" },
      { status: 500 }
    );
  }
}
