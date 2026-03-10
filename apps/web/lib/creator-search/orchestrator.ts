import { prisma } from "@/lib/prisma";
import type {
  ApifyInstagramFollowingResult,
  ApifyInstagramKeywordEmailResult,
  MappedCreatorData,
} from "@/lib/apify/client";
import {
  classifyDiscoveryText,
} from "@/lib/creator-search/classification";
import { shouldUseStoredCreatorAsCached } from "@/lib/creator-search/cache-policy";
import { mergeDiscoveryCandidates } from "@/lib/creator-search/candidate-merge";
import type {
  UnifiedDiscoveryQuery,
  UnifiedDiscoverySource,
} from "@/lib/creator-search/contracts";
import type { UnifiedDiscoveryCandidate } from "@/lib/creator-search/orchestrator-types";

type OrchestratorContext = {
  brandId: string;
  campaignId?: string | null;
  query: UnifiedDiscoveryQuery;
};

type LaneCandidate = UnifiedDiscoveryCandidate;

const LANE_TIMEOUT_MS = {
  collabstr: 5_000,
  apify_search: 120_000,
  profile_enrichment: 180_000,
  approved_seed_following: 180_000,
  apify_keyword_email: 120_000,
} as const;

async function withLaneTimeout<T>(
  lane: keyof typeof LANE_TIMEOUT_MS,
  task: Promise<T>
): Promise<T> {
  return await Promise.race([
    task,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${lane}_timeout`));
      }, LANE_TIMEOUT_MS[lane]);
    }),
  ]);
}

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
    creatorId: null,
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
    isCached: false,
    existingValidationStatus: null,
    lastValidatedAt: null,
    primarySource: mapped.primarySource,
    sources: mapped.sources,
    sourceMetadata: mapped.metadata,
    relevanceScore: 0,
  };
}

function mapLegacyDiscoverySource(
  discoverySource: string | null | undefined
): UnifiedDiscoverySource | null {
  switch (discoverySource) {
    case "apify":
      return "apify_search";
    case "collabstr":
    case "creator_marketplace":
      return "collabstr";
    default:
      return null;
  }
}

function isUnifiedDiscoverySource(value: string): value is UnifiedDiscoverySource {
  return (
    value === "collabstr" ||
    value === "apify_search" ||
    value === "approved_seed_following" ||
    value === "apify_keyword_email"
  );
}

async function collectStoredCreatorLane(
  context: OrchestratorContext,
  rawLimit: number
): Promise<LaneCandidate[]> {
  const creators = await prisma.creator.findMany({
    where: {
      brandId: context.brandId,
      instagramHandle: { not: null },
    },
    include: {
      profiles: true,
      discoveryTouches: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
    take: rawLimit * 3,
  });

  return creators
    .map((creator) => {
      if (!creator.instagramHandle) {
        return null;
      }

      const relevantTouches = creator.discoveryTouches.filter((touch) =>
        isUnifiedDiscoverySource(touch.source) &&
        context.query.sources.includes(touch.source)
      );
      const latestTouch = relevantTouches[0] ?? creator.discoveryTouches[0] ?? null;
      const fallbackSource = mapLegacyDiscoverySource(creator.discoverySource);
      const primarySource =
        (latestTouch && isUnifiedDiscoverySource(latestTouch.source)
          ? latestTouch.source
          : null) ??
        fallbackSource;

      if (!primarySource) {
        return null;
      }

      const metadata =
        latestTouch?.metadata &&
        typeof latestTouch.metadata === "object" &&
        !Array.isArray(latestTouch.metadata)
          ? (latestTouch.metadata as Record<string, unknown>)
          : {};
      const instagramProfile = creator.profiles.find(
        (profile) => profile.platform === "instagram"
      );
      const classification = classifyDiscoveryText({
        rawSourceCategory: latestTouch?.rawSourceCategory ?? creator.bioCategory,
        bio: creator.bio,
        name: creator.name,
        profileDump:
          typeof metadata.profileDump === "string" ? metadata.profileDump : null,
      });

      const sources = Array.from(
        new Set(
          [
            primarySource,
            ...relevantTouches
              .map((touch) => touch.source)
              .filter(isUnifiedDiscoverySource),
          ].filter(Boolean)
        )
      );

      const candidate: UnifiedDiscoveryCandidate = {
        creatorId: creator.id,
        handle: normalizeHandle(creator.instagramHandle),
        name: creator.name,
        bio: creator.bio,
        profileDump:
          typeof metadata.profileDump === "string" ? metadata.profileDump : null,
        rawSourceCategory:
          latestTouch?.rawSourceCategory ?? creator.bioCategory,
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
        isCached: shouldUseStoredCreatorAsCached({
          validationStatus: creator.validationStatus,
          lastValidatedAt: creator.lastValidatedAt,
          primarySource,
          followerCount: creator.followerCount,
          bio: creator.bio,
          profileUrl: instagramProfile?.url,
          imageUrl: creator.imageUrl,
        }),
        existingValidationStatus: creator.validationStatus,
        lastValidatedAt: creator.lastValidatedAt?.toISOString() ?? null,
        primarySource,
        sources,
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
  const {
    getDatasetItems,
    mapInstagramSearchUserToCreator,
    mapProfileToCreator,
    runInstagramProfileScraper,
    runInstagramSearchScraper,
  } = await import("@/lib/apify/client");
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
  const {
    getDatasetItems,
    mapProfileToCreator,
    runInstagramFollowingScraper,
    runInstagramProfileScraper,
  } = await import("@/lib/apify/client");
  if (!context.query.seedExpansion.enabled || !context.campaignId) {
    return [];
  }

  const approvedCreators = await prisma.creator.findMany({
    where: {
      brandId: context.brandId,
      instagramHandle: { not: null },
      campaignCreators: {
        some: {
          reviewStatus: "approved",
          campaignId: context.campaignId,
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
  const { getDatasetItems, runInstagramKeywordEmailScraper } =
    await import("@/lib/apify/client");
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
        creatorId: null,
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
        isCached: false,
        existingValidationStatus: null,
        lastValidatedAt: null,
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
  const { getDatasetItems, mapProfileToCreator, runInstagramProfileScraper } =
    await import("@/lib/apify/client");
  const handles = candidates
    .filter(
      (candidate) =>
        !candidate.followerCount || !candidate.bio || !candidate.imageUrl
    )
    .map((candidate) => candidate.handle);

  if (handles.length === 0) {
    return candidates;
  }

  const run = await withLaneTimeout(
    "profile_enrichment",
    runInstagramProfileScraper(Array.from(new Set(handles)))
  );
  const items = await withLaneTimeout(
    "profile_enrichment",
    getDatasetItems(run.datasetId)
  );
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

  return candidates.filter(
    (candidate) =>
      candidate.isCached || !existingHandles.has(candidate.handle)
  );
}

export async function orchestrateUnifiedDiscovery(
  context: OrchestratorContext
) {
  const rawLimit = Math.max(context.query.limit, context.query.limit * 3);
  const lanePromises: Array<
    Promise<{ lane: string; candidates: LaneCandidate[] }>
  > = [];

  lanePromises.push(
    withLaneTimeout("collabstr", collectStoredCreatorLane(context, rawLimit))
      .then((candidates) => ({ lane: "stored", candidates }))
  );

  if (context.query.sources.includes("apify_search")) {
    lanePromises.push(
      withLaneTimeout(
        "apify_search",
        collectApifySearchLane(context, rawLimit)
      ).then((candidates) => ({ lane: "apify_search", candidates }))
    );
  }

  if (context.query.sources.includes("approved_seed_following")) {
    lanePromises.push(
      withLaneTimeout(
        "approved_seed_following",
        collectApprovedSeedFollowingLane(context, rawLimit)
      ).then((candidates) => ({
        lane: "approved_seed_following",
        candidates,
      }))
    );
  }

  if (context.query.sources.includes("apify_keyword_email")) {
    lanePromises.push(
      withLaneTimeout(
        "apify_keyword_email",
        collectKeywordEmailLane(context, rawLimit)
      ).then((candidates) => ({
        lane: "apify_keyword_email",
        candidates,
      }))
    );
  }

  const laneResults = await Promise.allSettled(lanePromises);
  const mergedByHandle = new Map<string, UnifiedDiscoveryCandidate>();

  for (const laneResult of laneResults) {
    if (laneResult.status !== "fulfilled") {
      console.warn("[creator-search] lane failed", laneResult.reason);
      continue;
    }

    for (const candidate of laneResult.value.candidates) {
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

  const cached = filtered
    .filter((candidate) => candidate.isCached)
    .sort((left, right) => right.relevanceScore - left.relevanceScore);
  const fresh = filtered
    .filter((candidate) => !candidate.isCached)
    .sort((left, right) => right.relevanceScore - left.relevanceScore);

  return [...cached, ...fresh].slice(0, rawLimit);
}
