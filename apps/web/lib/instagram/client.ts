/**
 * Instagram Graph API Client
 *
 * Authenticated client for the Instagram Graph API (graph.instagram.com / graph.facebook.com).
 * Handles rate limiting (200 req/hr), retry with exponential backoff, and error parsing.
 */

const GRAPH_BASE = "https://graph.instagram.com";
const FACEBOOK_GRAPH_BASE = "https://graph.facebook.com/v21.0";

// Instagram Graph API rate limit: 200 calls per user per hour
const MAX_RETRIES = 3;
const INITIAL_RETRY_MS = 1000;

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface InstagramMedia {
  id: string;
  caption?: string;
  media_type?: string; // IMAGE | VIDEO | CAROUSEL_ALBUM
  media_url?: string;
  permalink?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
}

export interface InstagramInsight {
  name: string;
  period: string;
  values: Array<{ value: number }>;
  title: string;
  description: string;
  id: string;
}

export interface InstagramPagingCursor {
  before?: string;
  after?: string;
}

export interface InstagramPaginatedResponse<T> {
  data: T[];
  paging?: {
    cursors?: InstagramPagingCursor;
    next?: string;
    previous?: string;
  };
}

export interface InstagramGraphError {
  message: string;
  type: string;
  code: number;
  error_subcode?: number;
  fbtrace_id?: string;
}

// ──────────────────────────────────────────────
// Error handling
// ──────────────────────────────────────────────

export class InstagramApiError extends Error {
  constructor(
    message: string,
    public readonly code: number,
    public readonly type: string,
    public readonly statusCode: number,
    public readonly errorSubcode?: number
  ) {
    super(message);
    this.name = "InstagramApiError";
  }

  /** True when the API signals we've hit the rate limit */
  get isRateLimited(): boolean {
    return this.code === 4 || this.code === 32 || this.statusCode === 429;
  }

  /** True for expired or invalid tokens */
  get isAuthError(): boolean {
    return this.code === 190 || this.statusCode === 401;
  }
}

// ──────────────────────────────────────────────
// Internal fetch with retry & backoff
// ──────────────────────────────────────────────

async function graphFetch<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options?.headers,
        },
      });

      const body = await response.json();

      if (!response.ok || body.error) {
        const graphError = body.error as InstagramGraphError | undefined;
        const apiError = new InstagramApiError(
          graphError?.message ?? `HTTP ${response.status}`,
          graphError?.code ?? response.status,
          graphError?.type ?? "Unknown",
          response.status,
          graphError?.error_subcode
        );

        // Don't retry auth errors — they won't resolve with retries
        if (apiError.isAuthError) {
          throw apiError;
        }

        // Retry on rate limit or server errors
        if (apiError.isRateLimited || response.status >= 500) {
          lastError = apiError;
          const delay = INITIAL_RETRY_MS * Math.pow(2, attempt);
          const jitter = Math.random() * delay * 0.1;
          await sleep(delay + jitter);
          continue;
        }

        throw apiError;
      }

      return body as T;
    } catch (error) {
      if (error instanceof InstagramApiError) {
        throw error;
      }
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < MAX_RETRIES) {
        const delay = INITIAL_RETRY_MS * Math.pow(2, attempt);
        await sleep(delay);
        continue;
      }
    }
  }

  throw lastError ?? new Error("Instagram API request failed after retries");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ──────────────────────────────────────────────
// Public API functions
// ──────────────────────────────────────────────

/**
 * Get media the user has been tagged in.
 * GET /{ig-user-id}/tags
 */
export async function getTaggedMedia(
  igUserId: string,
  accessToken: string,
  fields = "id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count"
): Promise<InstagramPaginatedResponse<InstagramMedia>> {
  const params = new URLSearchParams({
    fields,
    access_token: accessToken,
  });

  return graphFetch<InstagramPaginatedResponse<InstagramMedia>>(
    `${GRAPH_BASE}/${igUserId}/tags?${params}`
  );
}

/**
 * Get media where the user is mentioned (requires media_id from a webhook or tag).
 * GET /{ig-user-id}/mentioned_media
 */
export async function getMentionedMedia(
  igUserId: string,
  mediaId: string,
  accessToken: string,
  fields = "id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count"
): Promise<InstagramMedia> {
  const params = new URLSearchParams({
    fields,
    media_id: mediaId,
    access_token: accessToken,
  });

  return graphFetch<InstagramMedia>(
    `${GRAPH_BASE}/${igUserId}/mentioned_media?${params}`
  );
}

/**
 * Get insights for a specific media object.
 * GET /{media-id}/insights
 *
 * Valid metrics vary by media type:
 * - IMAGE/CAROUSEL: impressions, reach, engagement
 * - VIDEO/REEL: impressions, reach, video_views
 */
export async function getMediaInsights(
  mediaId: string,
  accessToken: string,
  metrics = "impressions,reach,engagement"
): Promise<InstagramPaginatedResponse<InstagramInsight>> {
  const params = new URLSearchParams({
    metric: metrics,
    access_token: accessToken,
  });

  return graphFetch<InstagramPaginatedResponse<InstagramInsight>>(
    `${GRAPH_BASE}/${mediaId}/insights?${params}`
  );
}

/**
 * Get details for a specific media object.
 * GET /{media-id}?fields=...
 */
export async function getMediaDetails(
  mediaId: string,
  accessToken: string,
  fields = "id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count"
): Promise<InstagramMedia> {
  const params = new URLSearchParams({
    fields,
    access_token: accessToken,
  });

  return graphFetch<InstagramMedia>(
    `${GRAPH_BASE}/${mediaId}?${params}`
  );
}

/**
 * Get the Instagram user profile.
 * GET /{ig-user-id}?fields=...
 */
export async function getUserProfile(
  igUserId: string,
  accessToken: string
): Promise<{
  id: string;
  username?: string;
  name?: string;
  profile_picture_url?: string;
  followers_count?: number;
  media_count?: number;
}> {
  const params = new URLSearchParams({
    fields: "id,username,name,profile_picture_url,followers_count,media_count",
    access_token: accessToken,
  });

  return graphFetch(
    `${GRAPH_BASE}/${igUserId}?${params}`
  );
}

/**
 * Refresh a long-lived token.
 * GET /refresh_access_token?grant_type=ig_refresh_token&access_token=...
 *
 * Long-lived tokens are valid for 60 days. Refresh before expiry.
 */
export async function refreshLongLivedToken(accessToken: string): Promise<{
  access_token: string;
  token_type: string;
  expires_in: number;
}> {
  const params = new URLSearchParams({
    grant_type: "ig_refresh_token",
    access_token: accessToken,
  });

  return graphFetch(
    `${GRAPH_BASE}/refresh_access_token?${params}`
  );
}

/**
 * Exchange a short-lived token for a long-lived token.
 * Uses the Facebook Graph API endpoint.
 */
export async function exchangeForLongLivedToken(
  shortLivedToken: string,
  appId: string,
  appSecret: string
): Promise<{
  access_token: string;
  token_type: string;
  expires_in: number;
}> {
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortLivedToken,
  });

  return graphFetch(
    `${FACEBOOK_GRAPH_BASE}/oauth/access_token?${params}`
  );
}

/**
 * Get Instagram Business Account ID connected to a Facebook Page.
 * Used during OAuth to discover the IG account from a page token.
 */
export async function getInstagramAccountFromPage(
  pageId: string,
  accessToken: string
): Promise<{ id: string } | null> {
  const params = new URLSearchParams({
    fields: "instagram_business_account",
    access_token: accessToken,
  });

  const result = await graphFetch<{
    instagram_business_account?: { id: string };
  }>(`${FACEBOOK_GRAPH_BASE}/${pageId}?${params}`);

  return result.instagram_business_account ?? null;
}

/**
 * Get all Facebook Pages the user manages (used during OAuth to find linked IG accounts).
 */
export async function getUserPages(
  accessToken: string
): Promise<
  InstagramPaginatedResponse<{
    id: string;
    name: string;
    access_token: string;
  }>
> {
  const params = new URLSearchParams({
    fields: "id,name,access_token",
    access_token: accessToken,
  });

  return graphFetch(
    `${FACEBOOK_GRAPH_BASE}/me/accounts?${params}`
  );
}
