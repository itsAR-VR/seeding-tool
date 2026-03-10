import type { Prisma } from "@prisma/client";

type CreatorSearchJobRecord = {
  id: string;
  status: string;
  campaignId: string | null;
  requestedCount: number;
  candidateCount: number;
  validatedCount: number;
  invalidCount: number;
  cachedCount: number;
  progressPercent: number;
  etaSeconds: number | null;
  resultCount: number;
  error: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  query?: Prisma.JsonValue;
};

type CreatorSearchResultRecord = {
  id: string;
  handle: string;
  source: string;
  primarySource: string | null;
  sources: Prisma.JsonValue | null;
  name: string | null;
  followerCount: number | null;
  engagementRate: number | null;
  profileUrl: string | null;
  imageUrl: string | null;
  bio: string | null;
  email: string | null;
  bioCategory: string | null;
  rawSourceCategory: string | null;
  seedCreatorId: string | null;
  metadata: Prisma.JsonValue | null;
  platform: string;
  fitScore: number | null;
  fitReasoning: string | null;
  validationStatus: string;
  validationError: string | null;
  validatedFollowerCount: number | null;
  validatedAvgViews: number | null;
};

function clampProgressPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function extractQueryObject(query: Prisma.JsonValue | undefined) {
  if (!query || Array.isArray(query) || typeof query !== "object") {
    return null;
  }

  return query as Record<string, Prisma.JsonValue>;
}

export function extractCampaignIdFromJobQuery(query: Prisma.JsonValue | undefined) {
  const queryObject = extractQueryObject(query);
  const campaignId = queryObject?.campaignId;
  return typeof campaignId === "string" && campaignId.length > 0
    ? campaignId
    : null;
}

export function isTerminalCreatorSearchStatus(status: string) {
  return (
    status === "completed" ||
    status === "completed_with_shortfall" ||
    status === "failed"
  );
}

export function serializeCreatorSearchResult(result: CreatorSearchResultRecord) {
  const sources =
    Array.isArray(result.sources) &&
    result.sources.every((value) => typeof value === "string")
      ? result.sources
      : [result.primarySource ?? result.source];

  return {
    id: result.id,
    handle: result.handle,
    source: result.source,
    primarySource: result.primarySource ?? result.source,
    sources,
    name: result.name,
    followerCount: result.validatedFollowerCount ?? result.followerCount,
    avgViews: result.validatedAvgViews,
    engagementRate: result.engagementRate,
    profileUrl: result.profileUrl,
    imageUrl: result.imageUrl,
    bio: result.bio,
    bioCategory: result.bioCategory,
    rawSourceCategory: result.rawSourceCategory,
    email: result.email,
    seedCreatorId: result.seedCreatorId,
    metadata: result.metadata,
    platform: result.platform,
    fitScore: result.fitScore,
    fitReasoning: result.fitReasoning,
    validationStatus: result.validationStatus,
    validationError: result.validationError,
    validatedFollowerCount: result.validatedFollowerCount,
    validatedAvgViews: result.validatedAvgViews,
  };
}

export function selectSelectableCreatorSearchResults<T extends CreatorSearchResultRecord>(
  results: T[]
) {
  return results.filter((result) => result.validationStatus !== "invalid");
}

export function serializeCreatorSearchJob(job: CreatorSearchJobRecord) {
  return {
    jobId: job.id,
    status: job.status,
    requestedCount: job.requestedCount,
    candidateCount: job.candidateCount,
    validatedCount: job.validatedCount,
    invalidCount: job.invalidCount,
    cachedCount: job.cachedCount,
    progressPercent: clampProgressPercent(job.progressPercent),
    etaSeconds: job.etaSeconds,
    resultCount: job.resultCount,
    error: job.error,
    startedAt: job.startedAt?.toISOString() ?? null,
    finishedAt: job.finishedAt?.toISOString() ?? null,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    campaignId: job.campaignId ?? extractCampaignIdFromJobQuery(job.query),
  };
}
