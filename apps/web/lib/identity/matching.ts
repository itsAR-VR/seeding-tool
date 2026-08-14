import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { extractContactPoints } from "@/lib/identity/contact-extraction";
import {
  computeBioSimilaritySignal,
  computeEmailDomainSignal,
  computeHandleMatchSignal,
  computeLocationSignal,
  computeNameSimilaritySignal,
  computeWebsiteOverlapSignal,
  type IdentitySignal,
} from "@/lib/identity/signals";

export const IDENTITY_THRESHOLDS = {
  AUTO_LINK: 0.82,
  POSSIBLE_MATCH: 0.55,
} as const;

export type IdentityMatchBand =
  | "auto_linked"
  | "possible_match"
  | "rejected"
  | "human_confirmed";

export type IdentityResolutionResult = {
  bestIdentityId: string | null;
  bestProfileId: string | null;
  bestMatchScore: number | null;
  matchBand: IdentityMatchBand | null;
  identityEdgeCount: number;
  crossPlatformProfileCount: number;
  signals: IdentitySignal[];
};

type CandidateIdentityInput = {
  platform: string;
  handle: string;
  name: string | null;
  bioText: string | null;
  websiteUrl: string | null;
  email: string | null;
  region: string | null;
};

function normalizeHandle(handle: string) {
  return handle.trim().replace(/^@/, "").toLowerCase();
}

function weightedScore(signals: IdentitySignal[]) {
  return signals.reduce((sum, signal) => sum + signal.value * signal.weight, 0);
}

function determineMatchBand(score: number): IdentityMatchBand {
  if (score >= IDENTITY_THRESHOLDS.AUTO_LINK) {
    return "auto_linked";
  }
  if (score >= IDENTITY_THRESHOLDS.POSSIBLE_MATCH) {
    return "possible_match";
  }
  return "rejected";
}

async function loadCandidateProfiles(input: CandidateIdentityInput) {
  const normalized = normalizeHandle(input.handle);
  const emailDomain = input.email?.split("@")[1]?.toLowerCase() ?? null;
  const websiteHost = input.websiteUrl?.toLowerCase() ?? null;
  const orFilters: Prisma.InfluencerPlatformProfileWhereInput[] = [
    { normalizedHandle: normalized },
  ];

  if (emailDomain) {
    orFilters.push({ email: { endsWith: emailDomain } });
  }

  if (websiteHost) {
    orFilters.push({
      websiteUrl: {
        contains: websiteHost,
        mode: "insensitive",
      },
    });
  }

  const profiles = await prisma.influencerPlatformProfile.findMany({
    where: {
      OR: orFilters,
    },
    include: {
      influencer: {
        include: {
          profiles: {
            select: { platform: true },
          },
        },
      },
    },
    take: 12,
  });

  return profiles;
}

function scoreProfileCandidate(
  input: CandidateIdentityInput,
  profile: Awaited<ReturnType<typeof loadCandidateProfiles>>[number]
) {
  const signals: IdentitySignal[] = [
    computeHandleMatchSignal(
      input.handle,
      profile.handle,
      input.platform,
      profile.platform
    ),
    computeNameSimilaritySignal(input.name, profile.influencer.displayName),
    computeBioSimilaritySignal(input.bioText, profile.bioText),
    computeWebsiteOverlapSignal(input.websiteUrl, profile.websiteUrl),
    computeEmailDomainSignal(input.email, profile.email),
    computeLocationSignal(input.region, profile.region),
  ];
  return {
    profileId: profile.id,
    influencerId: profile.influencerId,
    matchScore: weightedScore(signals),
    crossPlatformProfileCount: new Set(
      profile.influencer.profiles.map((item) => item.platform)
    ).size,
    signals,
  };
}

export async function resolveIdentityForCandidate(
  input: CandidateIdentityInput
): Promise<IdentityResolutionResult> {
  const profiles = await loadCandidateProfiles(input);
  if (profiles.length === 0) {
    return {
      bestIdentityId: null,
      bestProfileId: null,
      bestMatchScore: null,
      matchBand: null,
      identityEdgeCount: 0,
      crossPlatformProfileCount: 0,
      signals: [],
    };
  }

  const scored = profiles
    .map((profile) => scoreProfileCandidate(input, profile))
    .sort((left, right) => right.matchScore - left.matchScore);
  const best = scored[0];

  return {
    bestIdentityId: best.influencerId,
    bestProfileId: best.profileId,
    bestMatchScore: best.matchScore,
    matchBand: determineMatchBand(best.matchScore),
    identityEdgeCount: scored.filter(
      (item) => item.matchScore >= IDENTITY_THRESHOLDS.POSSIBLE_MATCH
    ).length,
    crossPlatformProfileCount: best.crossPlatformProfileCount,
    signals: best.signals,
  };
}

function buildEvidenceJson(signals: IdentitySignal[], score: number): Prisma.InputJsonValue {
  return {
    matchScore: score,
    signals,
    version: "phase20-v1",
  } as Prisma.InputJsonValue;
}

export async function syncIdentityForCreator(input: {
  creatorId: string;
  displayName: string | null;
  platform: string;
  handle: string;
  profileUrl: string | null;
  profileImageUrl: string | null;
  websiteUrl: string | null;
  bioText: string | null;
  email: string | null;
  region?: string | null;
  isVerified?: boolean;
  sources: string[];
  autoLinkEnabled: boolean;
}) {
  const creator = await prisma.creator.findUnique({
    where: { id: input.creatorId },
    select: { influencerIdentityId: true },
  });
  if (!creator) {
    throw new Error(`creator_not_found:${input.creatorId}`);
  }

  const normalizedHandle = normalizeHandle(input.handle);
  const existingProfile = await prisma.influencerPlatformProfile.findUnique({
    where: {
      platform_normalizedHandle: {
        platform: input.platform,
        normalizedHandle,
      },
    },
  });

  const resolution = await resolveIdentityForCandidate({
    platform: input.platform,
    handle: input.handle,
    name: input.displayName,
    bioText: input.bioText,
    websiteUrl: input.websiteUrl,
    email: input.email,
    region: input.region ?? null,
  });

  const exactIdentityId = existingProfile?.influencerId ?? null;
  let influencerIdentityId =
    creator.influencerIdentityId ??
    exactIdentityId ??
    null;

  if (!influencerIdentityId) {
    if (
      resolution.bestIdentityId &&
      input.autoLinkEnabled &&
      resolution.matchBand === "auto_linked"
    ) {
      influencerIdentityId = resolution.bestIdentityId;
    } else {
      const identity = await prisma.influencerIdentity.create({
        data: {
          displayName: input.displayName,
        },
      });
      influencerIdentityId = identity.id;
    }
  }

  const profile = await prisma.influencerPlatformProfile.upsert({
    where: {
      platform_normalizedHandle: {
        platform: input.platform,
        normalizedHandle,
      },
    },
    update: {
      influencerId: influencerIdentityId,
      handle: input.handle,
      profileUrl: input.profileUrl,
      profileImageUrl: input.profileImageUrl,
      websiteUrl: input.websiteUrl,
      bioText: input.bioText,
      email: input.email,
      region: input.region ?? null,
      isVerified: input.isVerified ?? false,
      metadata: {
        sources: input.sources,
      } as Prisma.InputJsonValue,
      lastFetchedAt: new Date(),
    },
    create: {
      influencerId: influencerIdentityId,
      platform: input.platform,
      handle: input.handle,
      normalizedHandle,
      profileUrl: input.profileUrl,
      profileImageUrl: input.profileImageUrl,
      websiteUrl: input.websiteUrl,
      bioText: input.bioText,
      email: input.email,
      region: input.region ?? null,
      isVerified: input.isVerified ?? false,
      metadata: {
        sources: input.sources,
      } as Prisma.InputJsonValue,
      lastFetchedAt: new Date(),
    },
  });

  await prisma.creator.update({
    where: { id: input.creatorId },
    data: {
      influencerIdentityId,
    },
  });

  if (
    resolution.bestProfileId &&
    resolution.bestProfileId !== profile.id &&
    resolution.bestMatchScore != null
  ) {
    await prisma.identityEdge.upsert({
      where: {
        fromProfileId_toProfileId: {
          fromProfileId: profile.id,
          toProfileId: resolution.bestProfileId,
        },
      },
      update: {
        matchScore: resolution.bestMatchScore,
        matchBand:
          input.autoLinkEnabled && resolution.matchBand === "auto_linked"
            ? "auto_linked"
            : resolution.matchBand === "rejected"
              ? "rejected"
              : "possible_match",
        evidenceJson: buildEvidenceJson(
          resolution.signals,
          resolution.bestMatchScore
        ),
      },
      create: {
        fromProfileId: profile.id,
        toProfileId: resolution.bestProfileId,
        matchScore: resolution.bestMatchScore,
        matchBand:
          input.autoLinkEnabled && resolution.matchBand === "auto_linked"
            ? "auto_linked"
            : resolution.matchBand === "rejected"
              ? "rejected"
              : "possible_match",
        evidenceJson: buildEvidenceJson(
          resolution.signals,
          resolution.bestMatchScore
        ),
      },
    });
  }

  const contactPoints = extractContactPoints({
    profile: {
      email: input.email,
      websiteUrl: input.websiteUrl,
      platform: input.platform,
    },
    sources: input.sources,
  });

  if (contactPoints.length > 0) {
    await prisma.contactPoint.deleteMany({
      where: {
        profileId: profile.id,
        source: { in: contactPoints.map((point) => point.source) },
      },
    });
    await prisma.contactPoint.createMany({
      data: contactPoints.map((point) => ({
        profileId: profile.id,
        contactType: point.contactType,
        contactValue: point.contactValue,
        confidence: point.confidence,
        source: point.source,
        isStale: point.isStale,
      })),
      skipDuplicates: true,
    });
  }

  return {
    influencerIdentityId,
    profileId: profile.id,
    resolution,
  };
}

export async function resolveIdentityEdge(
  edgeId: string,
  action: "confirm" | "reject" | "defer",
  reviewedBy: string
) {
  const edge = await prisma.identityEdge.findUnique({
    where: { id: edgeId },
    include: {
      fromProfile: true,
      toProfile: true,
    },
  });

  if (!edge) {
    throw new Error("identity_edge_not_found");
  }

  // The merge + edge update run in ONE transaction: a failure between
  // the profile/creator moves and the edge update would otherwise leave
  // a partially merged identity graph with an unresolved edge.
  return prisma.$transaction(async (tx) => {
    if (action === "confirm") {
      const targetIdentityId = edge.toProfile.influencerId;
      const sourceIdentityId = edge.fromProfile.influencerId;

      if (sourceIdentityId !== targetIdentityId) {
        await tx.influencerPlatformProfile.updateMany({
          where: { influencerId: sourceIdentityId },
          data: { influencerId: targetIdentityId },
        });
        await tx.creator.updateMany({
          where: { influencerIdentityId: sourceIdentityId },
          data: { influencerIdentityId: targetIdentityId },
        });
        await tx.influencerIdentity.update({
          where: { id: sourceIdentityId },
          data: { mergedIntoId: targetIdentityId },
        });
      }
    }

    return tx.identityEdge.update({
      where: { id: edgeId },
      data: {
        matchBand: action === "confirm" ? "human_confirmed" : edge.matchBand,
        reviewOutcome:
          action === "confirm"
            ? "confirmed"
            : action === "reject"
              ? "rejected"
              : "deferred",
        reviewedAt: new Date(),
        reviewedBy,
      },
    });
  });
}
