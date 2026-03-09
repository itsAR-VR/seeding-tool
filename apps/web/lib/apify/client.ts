import { ApifyClient } from "apify-client";

const apifyClient = new ApifyClient({
  token: process.env.APIFY_API_TOKEN,
});

// ──────────────────────────────────────────────
// Actor run types
// ──────────────────────────────────────────────

type ApifyInstagramProfile = {
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

type ApifyHashtagResult = {
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
  followerCount: number | null;
  engagementRate: number | null;
  profileUrl: string | null;
  imageUrl: string | null;
  isVerified: boolean;
  metadata: Record<string, string | number | boolean | null | undefined>;
};

// ──────────────────────────────────────────────
// Actor runners
// ──────────────────────────────────────────────

/**
 * Run the Instagram Profile Scraper actor for a list of usernames.
 *
 * @returns Dataset ID to retrieve results from.
 */
export async function runInstagramProfileScraper(
  usernames: string[]
): Promise<{ datasetId: string; runId: string }> {
  const run = await apifyClient
    .actor("apify/instagram-profile-scraper")
    .call({
      usernames,
      resultsLimit: usernames.length,
    });

  return {
    datasetId: run.defaultDatasetId,
    runId: run.id,
  };
}

/**
 * Run an Instagram hashtag scraper actor.
 *
 * @returns Dataset ID to retrieve results from.
 */
export async function runInstagramHashtagScraper(
  hashtag: string,
  limit: number = 50
): Promise<{ datasetId: string; runId: string }> {
  const run = await apifyClient
    .actor("apify/instagram-hashtag-scraper")
    .call({
      hashtags: [hashtag.replace(/^#/, "")],
      resultsLimit: limit,
    });

  return {
    datasetId: run.defaultDatasetId,
    runId: run.id,
  };
}

// ──────────────────────────────────────────────
// Dataset retrieval
// ──────────────────────────────────────────────

/**
 * Retrieve items from a completed Apify actor run dataset.
 */
export async function getDatasetItems<T = Record<string, unknown>>(
  datasetId: string
): Promise<T[]> {
  const dataset = apifyClient.dataset(datasetId);
  const { items } = await dataset.listItems();
  return items as T[];
}

// ──────────────────────────────────────────────
// Mapping helpers
// ──────────────────────────────────────────────

/**
 * Map Apify Instagram profile data to our Creator model fields.
 */
export function mapProfileToCreator(
  profile: ApifyInstagramProfile
): MappedCreatorData | null {
  const handle = profile.username?.trim();
  if (!handle) return null;

  return {
    handle,
    name: profile.fullName || null,
    bio: profile.biography || null,
    bioCategory: profile.businessCategoryName || null,
    followerCount: profile.followersCount ?? null,
    engagementRate: profile.engagementRate ?? null,
    profileUrl: profile.url || `https://instagram.com/${handle}`,
    imageUrl: profile.profilePicUrlHD || profile.profilePicUrl || null,
    isVerified: profile.isVerified ?? false,
    metadata: {
      followsCount: profile.followsCount ?? null,
      postsCount: profile.postsCount ?? null,
      igtvVideoCount: profile.igtvVideoCount ?? null,
      businessCategoryName: profile.businessCategoryName ?? null,
      externalUrl: profile.externalUrl ?? null,
    },
  };
}

/**
 * Map Apify hashtag post data to a partial creator result.
 *
 * Hashtag results give post-level data with ownerUsername,
 * so we aggregate later.
 */
export function mapHashtagPostToCreator(
  post: ApifyHashtagResult
): MappedCreatorData | null {
  const handle = post.ownerUsername?.trim();
  if (!handle) return null;

  return {
    handle,
    name: post.ownerFullName || null,
    bio: null,
    bioCategory: null,
    followerCount: null,
    engagementRate: null,
    profileUrl: `https://instagram.com/${handle}`,
    imageUrl: post.displayUrl || null,
    isVerified: false,
    metadata: {
      likesCount: post.likesCount ?? null,
      commentsCount: post.commentsCount ?? null,
      caption: post.caption ?? null,
      postUrl: post.url ?? null,
    },
  };
}
