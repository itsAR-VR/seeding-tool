import { ApifyClient } from "apify-client";
import type { UnifiedDiscoverySource } from "@/lib/creator-search/contracts";

const apifyClient = new ApifyClient({
  token: process.env.APIFY_API_TOKEN,
});

const APIFY_PROFILE_ACTOR_ID = "apify/instagram-profile-scraper";
const APIFY_SEARCH_ACTOR_ID = "apify/instagram-search-scraper";
const APIFY_FOLLOWING_ACTOR_ID = "datadoping/instagram-following-scraper";
const APIFY_KEYWORD_EMAIL_ACTOR_ID = "scraper-mind/instagram-email-scraper";
const APIFY_LEGACY_HASHTAG_ACTOR_ID = "apify/instagram-hashtag-scraper";

export type ApifyActorRunRef = {
  datasetId: string;
  runId: string;
};

export type ApifyInstagramProfile = {
  username?: string;
  fullName?: string;
  biography?: string;
  businessCategoryName?: string;
  followersCount?: number;
  followsCount?: number;
  postsCount?: number;
  profilePicUrl?: string;
  profilePicUrlHD?: string;
  url?: string;
  isVerified?: boolean;
  engagementRate?: number;
  igtvVideoCount?: number;
  externalUrl?: string;
  [key: string]: unknown;
};

export type InstagramSearchScraperInput = {
  search: string | string[];
  searchType: "place" | "user" | "hashtag";
  searchLimit?: number;
  enhanceUserSearchWithFacebookPage?: boolean;
};

export type ApifyInstagramSearchResult = {
  username?: string;
  userName?: string;
  fullName?: string;
  biography?: string;
  businessCategoryName?: string;
  category?: string;
  followersCount?: number;
  profilePicUrl?: string;
  profilePicUrlHD?: string;
  url?: string;
  isVerified?: boolean;
  email?: string;
  [key: string]: unknown;
};

export type InstagramFollowingScraperInput = {
  usernames: string[];
  maxCount: number;
};

export type ApifyInstagramFollowingResult = {
  username?: string;
  userName?: string;
  fullName?: string;
  profileUrl?: string;
  url?: string;
  [key: string]: unknown;
};

export type InstagramKeywordEmailScraperInput = {
  keywords: string[];
  location?: string;
  platform?: "Instagram";
  customDomains?: string[];
  maxEmails?: number;
  engine?: "cost-effective" | "legacy";
  proxyConfiguration?: Record<string, unknown>;
};

export type ApifyInstagramKeywordEmailResult = {
  username?: string;
  handle?: string;
  email?: string;
  emails?: string[];
  [key: string]: unknown;
};

type LegacyApifyHashtagResult = {
  ownerUsername?: string;
  ownerFullName?: string;
  likesCount?: number;
  commentsCount?: number;
  displayUrl?: string;
  caption?: string;
  url?: string;
  [key: string]: unknown;
};

/**
 * Mapped creator data from Apify results, ready for Creator/CreatorSearchResult models.
 */
export type MappedCreatorData = {
  handle: string;
  name: string | null;
  bio: string | null;
  bioCategory: string | null;
  rawSourceCategory: string | null;
  followerCount: number | null;
  engagementRate: number | null;
  profileUrl: string | null;
  imageUrl: string | null;
  isVerified: boolean;
  source: UnifiedDiscoverySource;
  primarySource: UnifiedDiscoverySource;
  sources: UnifiedDiscoverySource[];
  email: string | null;
  seedCreatorId: string | null;
  metadata: Record<string, unknown>;
};

type ApifyActorCallResult = {
  id: string;
  defaultDatasetId: string;
};

function normalizeHandle(value: string | null | undefined) {
  return value?.trim().replace(/^@/, "") || null;
}

function normalizeSearchTerms(search: string | string[]) {
  if (Array.isArray(search)) {
    return search
      .map((value) => value.trim())
      .filter(Boolean)
      .join(", ");
  }

  return search.trim();
}

async function callActor<TInput extends Record<string, unknown>>(
  actorId: string,
  input: TInput
): Promise<ApifyActorRunRef> {
  const run = (await apifyClient.actor(actorId).call(input)) as ApifyActorCallResult;

  return {
    datasetId: run.defaultDatasetId,
    runId: run.id,
  };
}

export async function runInstagramProfileScraper(
  usernames: string[]
): Promise<ApifyActorRunRef> {
  return callActor(APIFY_PROFILE_ACTOR_ID, {
    usernames,
  });
}

export async function runInstagramSearchScraper(
  input: InstagramSearchScraperInput
): Promise<ApifyActorRunRef> {
  return callActor(APIFY_SEARCH_ACTOR_ID, {
    search: normalizeSearchTerms(input.search),
    searchType: input.searchType,
    ...(input.searchLimit ? { searchLimit: input.searchLimit } : {}),
    ...(typeof input.enhanceUserSearchWithFacebookPage === "boolean"
      ? {
          enhanceUserSearchWithFacebookPage:
            input.enhanceUserSearchWithFacebookPage,
        }
      : {}),
  });
}

export async function runInstagramFollowingScraper(
  input: InstagramFollowingScraperInput
): Promise<ApifyActorRunRef> {
  return callActor(APIFY_FOLLOWING_ACTOR_ID, {
    usernames: input.usernames,
    max_count: input.maxCount,
  });
}

export async function runInstagramKeywordEmailScraper(
  input: InstagramKeywordEmailScraperInput
): Promise<ApifyActorRunRef> {
  return callActor(APIFY_KEYWORD_EMAIL_ACTOR_ID, {
    keywords: input.keywords,
    platform: input.platform ?? "Instagram",
    ...(input.location ? { location: input.location } : {}),
    ...(input.customDomains?.length
      ? { customDomains: input.customDomains }
      : {}),
    ...(input.maxEmails ? { maxEmails: input.maxEmails } : {}),
    ...(input.engine ? { engine: input.engine } : {}),
    ...(input.proxyConfiguration
      ? { proxyConfiguration: input.proxyConfiguration }
      : {}),
  });
}

/**
 * @deprecated Phase 15 migrates hashtag discovery to instagram-search-scraper.
 * Keep this wrapper until the old /creators UI is replaced.
 */
export async function runInstagramHashtagScraper(
  hashtag: string,
  limit: number = 50
): Promise<ApifyActorRunRef> {
  return callActor(APIFY_LEGACY_HASHTAG_ACTOR_ID, {
    hashtags: [hashtag.replace(/^#/, "")],
    resultsLimit: limit,
  });
}

export async function getDatasetItems<T = Record<string, unknown>>(
  datasetId: string
): Promise<T[]> {
  const dataset = apifyClient.dataset(datasetId);
  const { items } = await dataset.listItems();
  return items as T[];
}

export function mapProfileToCreator(
  profile: ApifyInstagramProfile
): MappedCreatorData | null {
  const handle = normalizeHandle(profile.username);
  if (!handle) return null;

  const rawSourceCategory = profile.businessCategoryName || null;

  return {
    handle,
    name: profile.fullName || null,
    bio: profile.biography || null,
    bioCategory: rawSourceCategory,
    rawSourceCategory,
    followerCount: profile.followersCount ?? null,
    engagementRate: profile.engagementRate ?? null,
    profileUrl: profile.url || `https://instagram.com/${handle}`,
    imageUrl: profile.profilePicUrlHD || profile.profilePicUrl || null,
    isVerified: profile.isVerified ?? false,
    source: "apify_search",
    primarySource: "apify_search",
    sources: ["apify_search"],
    email: null,
    seedCreatorId: null,
    metadata: {
      followsCount: profile.followsCount ?? null,
      postsCount: profile.postsCount ?? null,
      igtvVideoCount: profile.igtvVideoCount ?? null,
      businessCategoryName: rawSourceCategory,
      externalUrl: profile.externalUrl ?? null,
    },
  };
}

export function mapInstagramSearchUserToCreator(
  result: ApifyInstagramSearchResult
): MappedCreatorData | null {
  const handle = normalizeHandle(result.username || result.userName);
  if (!handle) return null;

  const rawSourceCategory =
    (typeof result.businessCategoryName === "string"
      ? result.businessCategoryName
      : null) ||
    (typeof result.category === "string" ? result.category : null);

  return {
    handle,
    name: result.fullName || null,
    bio: result.biography || null,
    bioCategory: rawSourceCategory,
    rawSourceCategory,
    followerCount:
      typeof result.followersCount === "number" ? result.followersCount : null,
    engagementRate: null,
    profileUrl: result.url || `https://instagram.com/${handle}`,
    imageUrl: result.profilePicUrlHD || result.profilePicUrl || null,
    isVerified: Boolean(result.isVerified),
    source: "apify_search",
    primarySource: "apify_search",
    sources: ["apify_search"],
    email: typeof result.email === "string" ? result.email : null,
    seedCreatorId: null,
    metadata: {
      rawResult: result,
    },
  };
}

export function mapHashtagPostToCreator(
  post: LegacyApifyHashtagResult
): MappedCreatorData | null {
  const handle = normalizeHandle(post.ownerUsername);
  if (!handle) return null;

  return {
    handle,
    name: post.ownerFullName || null,
    bio: null,
    bioCategory: null,
    rawSourceCategory: null,
    followerCount: null,
    engagementRate: null,
    profileUrl: `https://instagram.com/${handle}`,
    imageUrl: post.displayUrl || null,
    isVerified: false,
    source: "apify_search",
    primarySource: "apify_search",
    sources: ["apify_search"],
    email: null,
    seedCreatorId: null,
    metadata: {
      likesCount: post.likesCount ?? null,
      commentsCount: post.commentsCount ?? null,
      caption: post.caption ?? null,
      postUrl: post.url ?? null,
    },
  };
}
