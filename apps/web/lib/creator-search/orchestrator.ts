import { prisma } from "@/lib/prisma";
import {
  getDatasetItems,
  mapInstagramSearchUserToCreator,
  mapProfileToCreator,
  runInstagramFollowingScraper,
  runInstagramKeywordEmailScraper,
  runInstagramProfileScraper,
  runInstagramSearchScraper,
  type ApifyInstagramFollowingResult,
  type ApifyInstagramKeywordEmailResult,
  type MappedCreatorData,
} from "@/lib/apify/client";
import {
  classifyDiscoveryText,
} from "@/lib/creator-search/classification";
import { mergeDiscoveryCandidates } from "@/lib/creator-search/candidate-merge";
import type { UnifiedDiscoveryQuery } from "@/lib/creator-search/contracts";
import type { UnifiedDiscoveryCandidate } from "@/lib/creator-search/orchestrator-types";

type OrchestratorContext = {
  brandId: string;
  campaignId?: string | null;
  query: UnifiedDiscoveryQuery;
};

type LaneCandidate = UnifiedDiscoveryCandidate;

function normalizeHandle(handle: string | null | undefined) {
  return handle?.trim().replace(/^@/, "").toLowerCase() ?? "";
}

function combinedKeywordHaystack(candidate: UnifiedDiscoveryCandidate) {
  return [
    candidate.handle,
    candidate.name,
    candidate.bio,
    candidate.rawSourceCategory,
    candidate.profileDump,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function computeRelevanceScore(
  candidate: UnifiedDiscoveryCandidate,
  query: UnifiedDiscoveryQuery
) {
  const haystack = combinedKeywordHaystack(candidate);
  const keywordMatches = query.keywords.filter((keyword) =>
    haystack.includes(keyword.toLowerCase())
  ).length;
  const categoryMatch =
    candidate.canonicalCategory &&
    query.canonicalCategories.includes(candidate.canonicalCategory)
      ? 1
      : 0;
  const sourceAgreement = Math.max(0, candidate.sources.length - 1);
  const completeness =
    (candidate.followerCount ? 1 : 0) +
    (candidate.bio ? 1 : 0) +
    (candidate.profileUrl ? 1 : 0) +
    (candidate.email ? 1 : 0);

  return keywordMatches * 10 + categoryMatch * 8 + sourceAgreement * 4 + completeness;
}

function candidateFromMappedCreator(
  mapped: MappedCreatorData,
  profileDump: string | null = null
): UnifiedDiscoveryCandidate {
  const classification = classifyDiscoveryText({
    rawSourceCategory: mapped.rawSourceCategory,
    bio: mapped.bio,
    name: mapped.name,
    profileDump,
  });

  return {
    handle: normalizeHandle(mapped.handle),
    name: mapped.name,
    bio: mapped.bio,
    profileDump,
    rawSourceCategory: mapped.rawSourceCategory,
    canonicalCategory: classification.canonicalCategory,
    classificationConfidence: classification.confidence,
    matchedCategorySignals: classification.matchedKeywords,
    followerCount: mapped.followerCount,
    avgViews: null,
    engagementRate: mapped.engagementRate,
    profileUrl: mapped.profileUrl,
    imageUrl: mapped.imageUrl,
    isVerified: mapped.isVerified,
    email: mapped.email,
    seedCreatorId: mapped.seedCreatorId,
    primarySource: mapped.primarySource,
    sources: mapped.sources,
    sourceMetadata: mapped.metadata,
    relevanceScore: 0,
  };
}

async function collectCollabstrLane(
  context: OrchestratorContext,
  rawLimit: number
): Promise<LaneCandidate[]> {
  const creators = await prisma.creator.findMany({
    where: {
      brandId: context.brandId,
      discoverySource: "collabstr",
    },
    include: {
      profiles: true,
      discoveryTouches: {
        where: { source: "collabstr" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    take: rawLimit * 3,
  });

  return creators
    .map((creator) => {
      const metadata =
        creator.discoveryTouches[0]?.metadata &&
        typeof creator.discoveryTouches[0]?.metadata === "object" &&
        !Array.isArray(creator.discoveryTouches[0]?.metadata)
          ? (creator.discoveryTouches[0]?.metadata as Record<string, unknown>)
          : {};
      const instagramProfile = creator.profiles.find(
        (profile) => profile.platform === "instagram"
      );
      const classification = classifyDiscoveryText({
        rawSourceCategory: creator.discoveryTouches[0]?.rawSourceCategory ?? creator.bioCategory,
        bio: creator.bio,
        name: creator.name,
        profileDump:
          typeof metadata.profileDump === "string" ? metadata.profileDump : null,
      });

      const candidate: UnifiedDiscoveryCandidate = {
        handle: normalizeHandle(creator.instagramHandle),
        name: creator.name,
        bio: creator.bio,
        profileDump:
          typeof metadata.profileDump === "string" ? metadata.profileDump : null,
        rawSourceCategory:
          creator.discoveryTouches[0]?.rawSourceCategory ?? creator.bioCategory,
        canonicalCategory: classification.canonicalCategory,
        classificationConfidence: classification.confidence,
        matchedCategorySignals: classification.matchedKeywords,
        followerCount: creator.followerCount,
        avgViews: creator.avgViews,
        engagementRate: instagramProfile?.engagementRate ?? null,
        profileUrl:
          instagramProfile?.url ??
          (creator.instagramHandle
            ? `https://instagram.com/${creator.instagramHandle}`
            : null),
        imageUrl: creator.imageUrl,
        isVerified: instagramProfile?.isVerified ?? false,
        email: creator.email,
        seedCreatorId: null,
        primarySource: "collabstr",
        sources: ["collabstr"],
        sourceMetadata: metadata,
        relevanceScore: 0,
      };

      candidate.relevanceScore = computeRelevanceScore(candidate, context.query);
      return candidate.handle ? candidate : null;
    })
    .filter((candidate): candidate is UnifiedDiscoveryCandidate => candidate !== null);
}

async function collectApifySearchLane(
  context: OrchestratorContext,
  rawLimit: number
): Promise<LaneCandidate[]> {
  const handles = context.query.usernames;

  if (handles.length > 0) {
    const run = await runInstagramProfileScraper(handles);
    const items = await getDatasetItems(run.datasetId);

    return items
      .map((item) => mapProfileToCreator(item as Record<string, unknown>))
      .filter((candidate): candidate is MappedCreatorData => candidate !== null)
      .map((candidate) => {
        const mapped = candidateFromMappedCreator(candidate);
        mapped.relevanceScore = computeRelevanceScore(mapped, context.query);
        return mapped;
      });
  }

  const searchTerms = [
    ...context.query.keywords,
    ...context.query.canonicalCategories,
  ];

  if (searchTerms.length === 0) {
    return [];
  }

  const run = await runInstagramSearchScraper({
    search: searchTerms,
    searchType: "user",
    searchLimit: rawLimit,
  });
  const items = await getDatasetItems(run.datasetId);

  return items
    .map((item) =>
      mapInstagramSearchUserToCreator(item as Record<string, unknown>)
    )
    .filter((candidate): candidate is MappedCreatorData => candidate !== null)
    .map((candidate) => {
      const mapped = candidateFromMappedCreator(candidate);
      mapped.relevanceScore = computeRelevanceScore(mapped, context.query);
      return mapped;
    });
}

async function collectApprovedSeedFollowingLane(
  context: OrchestratorContext,
  rawLimit: number
): Promise<LaneCandidate[]> {
  if (!context.query.seedExpansion.enabled) {
    return [];
  }

  const approvedCreators = await prisma.creator.findMany({
    where: {
      brandId: context.brandId,
      instagramHandle: { not: null },
      campaignCreators: {
        some: {
          reviewStatus: "approved",
          ...(context.campaignId ? { campaignId: context.campaignId } : {}),
        },
      },
    },
    take: context.query.seedExpansion.maxSeedsPerRun,
  });

  if (approvedCreators.length === 0) {
    return [];
  }

  const run = await runInstagramFollowingScraper({
    usernames: approvedCreators
      .map((creator) => creator.instagramHandle)
      .filter((value): value is string => Boolean(value)),
    maxCount: context.query.seedExpansion.maxFollowingPerSeed,
  });
  const items = await getDatasetItems(run.datasetId);

  const handles = Array.from(
    new Set(
      items
        .map((item) => item as ApifyInstagramFollowingResult)
        .map((item) => normalizeHandle(item.username || item.userName))
        .filter(Boolean)
    )
  ).slice(0, rawLimit);

  if (handles.length === 0) {
    return [];
  }

  const profileRun = await runInstagramProfileScraper(handles);
  const profiles = await getDatasetItems(profileRun.datasetId);

  return profiles
    .map((item) => mapProfileToCreator(item as Record<string, unknown>))
    .filter((candidate): candidate is MappedCreatorData => candidate !== null)
    .map((candidate) => {
      const mapped = candidateFromMappedCreator({
        ...candidate,
        source: "approved_seed_following",
        primarySource: "approved_seed_following",
        sources: ["approved_seed_following"],
        seedCreatorId: null,
      });
      mapped.relevanceScore = computeRelevanceScore(mapped, context.query);
      return mapped;
    });
}

async function collectKeywordEmailLane(
  context: OrchestratorContext,
  rawLimit: number
): Promise<LaneCandidate[]> {
  if (!context.query.emailPrefetch || context.query.keywords.length === 0) {
    return [];
  }

  const run = await runInstagramKeywordEmailScraper({
    keywords: context.query.keywords,
    location: context.query.location,
    maxEmails: rawLimit,
  });
  const items = await getDatasetItems(run.datasetId);

  return items
    .map((item) => item as ApifyInstagramKeywordEmailResult)
    .map((item) => {
      const handle = normalizeHandle(item.username || item.handle);
      if (!handle) {
        return null;
      }

      const mapped: UnifiedDiscoveryCandidate = {
        handle,
        name: null,
        bio: null,
        profileDump: null,
        rawSourceCategory: null,
        canonicalCategory: null,
        classificationConfidence: null,
        matchedCategorySignals: [],
        followerCount: null,
        avgViews: null,
        engagementRate: null,
        profileUrl: `https://instagram.com/${handle}`,
        imageUrl: null,
        isVerified: false,
        email:
          item.email ||
          (Array.isArray(item.emails) && typeof item.emails[0] === "string"
            ? item.emails[0]
            : null),
        seedCreatorId: null,
        primarySource: "apify_keyword_email",
        sources: ["apify_keyword_email"],
        sourceMetadata: item,
        relevanceScore: 0,
      };

      mapped.relevanceScore = computeRelevanceScore(mapped, context.query);
      return mapped;
    })
    .filter((candidate): candidate is UnifiedDiscoveryCandidate => candidate !== null);
}

async function enrichCandidateProfiles(
  candidates: UnifiedDiscoveryCandidate[]
): Promise<UnifiedDiscoveryCandidate[]> {
  const handles = candidates
    .filter(
      (candidate) =>
        !candidate.followerCount || !candidate.bio || !candidate.imageUrl
    )
    .map((candidate) => candidate.handle);

  if (handles.length === 0) {
    return candidates;
  }

  const run = await runInstagramProfileScraper(Array.from(new Set(handles)));
  const items = await getDatasetItems(run.datasetId);
  const enrichedByHandle = new Map(
    items
      .map((item) => mapProfileToCreator(item as Record<string, unknown>))
      .filter((candidate): candidate is MappedCreatorData => candidate !== null)
      .map((candidate) => [candidate.handle, candidateFromMappedCreator(candidate)])
  );

  return candidates.map((candidate) => {
    const enriched = enrichedByHandle.get(candidate.handle);
    return enriched ? mergeDiscoveryCandidates(candidate, enriched) : candidate;
  });
}

function applyCandidateFilters(
  candidates: UnifiedDiscoveryCandidate[],
  context: OrchestratorContext
) {
  return candidates.filter((candidate) => {
    const { filters, canonicalCategories } = context.query;

    if (
      filters.minFollowers != null &&
      (candidate.followerCount ?? 0) < filters.minFollowers
    ) {
      return false;
    }

    if (
      filters.maxFollowers != null &&
      (candidate.followerCount ?? 0) > filters.maxFollowers
    ) {
      return false;
    }

    if (
      filters.minAvgViews != null &&
      (candidate.avgViews ?? 0) < filters.minAvgViews
    ) {
      return false;
    }

    if (
      filters.requireCategory &&
      (!candidate.canonicalCategory ||
        (canonicalCategories.length > 0 &&
          !canonicalCategories.includes(candidate.canonicalCategory)))
    ) {
      return false;
    }

    return true;
  });
}

async function excludeExistingCreators(
  candidates: UnifiedDiscoveryCandidate[],
  context: OrchestratorContext
) {
  if (!context.query.filters.excludeExistingCreators || candidates.length === 0) {
    return candidates;
  }

  const existingHandles = new Set(
    (
      await prisma.creator.findMany({
        where: {
          brandId: context.brandId,
          instagramHandle: {
            in: candidates.map((candidate) => candidate.handle),
          },
        },
        select: {
          instagramHandle: true,
        },
      })
    )
      .map((creator) => normalizeHandle(creator.instagramHandle))
      .filter(Boolean)
  );

  return candidates.filter((candidate) => !existingHandles.has(candidate.handle));
}

export async function orchestrateUnifiedDiscovery(
  context: OrchestratorContext
) {
  const rawLimit = Math.max(context.query.limit, context.query.limit * 3);
  const lanePromises: Array<Promise<LaneCandidate[]>> = [];

  if (context.query.sources.includes("collabstr")) {
    lanePromises.push(collectCollabstrLane(context, rawLimit));
  }

  if (context.query.sources.includes("apify_search")) {
    lanePromises.push(collectApifySearchLane(context, rawLimit));
  }

  if (context.query.sources.includes("approved_seed_following")) {
    lanePromises.push(collectApprovedSeedFollowingLane(context, rawLimit));
  }

  if (context.query.sources.includes("apify_keyword_email")) {
    lanePromises.push(collectKeywordEmailLane(context, rawLimit));
  }

  const laneResults = await Promise.all(lanePromises);
  const mergedByHandle = new Map<string, UnifiedDiscoveryCandidate>();

  for (const lane of laneResults) {
    for (const candidate of lane) {
      const handle = normalizeHandle(candidate.handle);
      if (!handle) {
        continue;
      }

      const existing = mergedByHandle.get(handle);
      if (existing) {
        mergedByHandle.set(handle, mergeDiscoveryCandidates(existing, candidate));
      } else {
        mergedByHandle.set(handle, candidate);
      }
    }
  }

  const enriched = await enrichCandidateProfiles(Array.from(mergedByHandle.values()));
  const filtered = await excludeExistingCreators(
    applyCandidateFilters(
      enriched.map((candidate) => ({
        ...candidate,
        relevanceScore: computeRelevanceScore(candidate, context.query),
      })),
      context
    ),
    context
  );

  return filtered
    .sort((left, right) => right.relevanceScore - left.relevanceScore)
    .slice(0, context.query.limit);
}
