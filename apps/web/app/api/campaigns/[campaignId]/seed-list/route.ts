import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  BrandAccessError,
  getAuthorizedCampaign,
  getCurrentBrandMembership,
  requireWriteAccess,
} from "@/lib/integrations/brand-access";
import { getFeatureFlags } from "@/lib/feature-flags";
import { generatePortfolioExplanation } from "@/lib/seeding/portfolio-explanation";
import { optimizePortfolio } from "@/lib/seeding/portfolio-optimizer";

type RouteContext = { params: Promise<{ campaignId: string }> };

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function buildSeedList(campaignId: string, configOverride?: Record<string, unknown>) {
  const campaign = await getAuthorizedCampaign(campaignId);
  const flags = await getFeatureFlags(campaign.brandId);
  if (!flags.portfolioOptimizerEnabled || !flags.decisionEngineScoringEnabled) {
    throw new BrandAccessError(
      "Portfolio preview is disabled for this brand",
      403
    );
  }
  const campaignRecord = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { portfolioConfig: true },
  });

  const config = {
    targetSize: 25,
    qualityWeight: 0.6,
    diversityWeight: 0.4,
    deduplicateByIdentity: true,
    ...(asRecord(campaignRecord?.portfolioConfig)),
    ...(configOverride ?? {}),
  };

  const latestJob = await prisma.creatorSearchJob.findFirst({
    where: {
      campaignId,
      brandId: campaign.brandId,
      status: { in: ["completed", "completed_with_shortfall"] },
    },
    include: {
      results: true,
    },
    orderBy: [{ finishedAt: "desc" }, { createdAt: "desc" }],
  });

  if (!latestJob) {
    return {
      config,
      ranked: [],
      portfolio: null,
    };
  }

  const creators = await prisma.creator.findMany({
    where: {
      brandId: campaign.brandId,
      instagramHandle: {
        in: latestJob.results.map((result) => result.handle),
      },
    },
    select: {
      instagramHandle: true,
      influencerIdentityId: true,
    },
  });
  const identityByHandle = new Map(
    creators
      .filter((creator) => creator.instagramHandle)
      .map((creator) => [creator.instagramHandle!.toLowerCase(), creator.influencerIdentityId])
  );

  const ranked = latestJob.results
    .filter((result) => result.validationStatus !== "invalid")
    .sort((left, right) => (right.fitScore ?? 0) - (left.fitScore ?? 0))
    .map((result) => {
      const metadata = asRecord(result.metadata);
      const sourceMetadata = asRecord(metadata.sourceMetadata);
      return {
        id: result.id,
        handle: result.handle,
        name: result.name,
        profileUrl: result.profileUrl,
        fitScore: result.fitScore ?? 0,
        fitReasoning: result.fitReasoning ?? "",
        triage: result.triage ?? "review",
        followerCount: result.validatedFollowerCount ?? result.followerCount,
        canonicalCategory: result.bioCategory,
        region:
          typeof sourceMetadata.location === "string"
            ? (sourceMetadata.location as string)
            : null,
        languageDetected:
          typeof metadata.languageDetected === "string"
            ? (metadata.languageDetected as string)
            : null,
        contactabilityBand:
          typeof metadata.contactabilityBand === "string"
            ? (metadata.contactabilityBand as string)
            : result.email
              ? "strong"
              : "weak",
        authenticityBand:
          typeof metadata.authenticityBand === "string"
            ? (metadata.authenticityBand as string)
            : "unknown",
        influencerIdentityId:
          identityByHandle.get(result.handle.toLowerCase()) ?? null,
        validationStatus: result.validationStatus,
      };
    });

  const portfolio = optimizePortfolio(
    ranked.map((candidate) => ({
      compositeScore: candidate.fitScore,
      ...candidate,
    })),
    {
      targetSize: Number(config.targetSize) || 25,
      qualityWeight: Number(config.qualityWeight) || 0.6,
      diversityWeight: Number(config.diversityWeight) || 0.4,
      deduplicateByIdentity: config.deduplicateByIdentity !== false,
    }
  );

  return {
    config,
    ranked,
    portfolio: {
      ...portfolio,
      explanation: generatePortfolioExplanation(portfolio),
    },
  };
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { campaignId } = await context.params;
    const payload = await buildSeedList(campaignId);
    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[campaigns/[campaignId]/seed-list/GET]", error);
    return NextResponse.json(
      { error: "Failed to build seed list preview" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { campaignId } = await context.params;
    const { brandId } = await getAuthorizedCampaign(campaignId);
    // This POST overwrites campaign.portfolioConfig — membership alone is
    // not enough, viewers must not mutate campaign configuration.
    requireWriteAccess(await getCurrentBrandMembership());
    const body = (await request.json()) as {
      targetSize?: number;
      qualityWeight?: number;
      diversityWeight?: number;
      deduplicateByIdentity?: boolean;
    };

    const config = {
      ...(body.targetSize ? { targetSize: body.targetSize } : {}),
      ...(typeof body.qualityWeight === "number"
        ? { qualityWeight: body.qualityWeight }
        : {}),
      ...(typeof body.diversityWeight === "number"
        ? { diversityWeight: body.diversityWeight }
        : {}),
      ...(typeof body.deduplicateByIdentity === "boolean"
        ? { deduplicateByIdentity: body.deduplicateByIdentity }
        : {}),
    };

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { portfolioConfig: config },
    });

    const payload = await buildSeedList(campaignId, config);
    return NextResponse.json({ ...payload, brandId });
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[campaigns/[campaignId]/seed-list/POST]", error);
    return NextResponse.json(
      { error: "Failed to save seed list configuration" },
      { status: 500 }
    );
  }
}
