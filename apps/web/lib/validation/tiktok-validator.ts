import {
  runTikTokProfileScraper,
  getDatasetItems,
  type ApifyTikTokProfile,
} from "@/lib/apify/client";
import type {
  PlatformValidator,
  PlatformValidationOptions,
  ValidationTarget,
  ValidationResult,
} from "@/lib/validation/types";

function normalizeHandle(handle: string): string {
  return handle.trim().replace(/^@/, "");
}

function buildProfileUrl(handle: string): string {
  return `https://tiktok.com/@${normalizeHandle(handle)}`;
}

/**
 * Map a single Apify TikTok profile result to a ValidationResult.
 */
function toValidationResult(
  target: ValidationTarget,
  profile: ApifyTikTokProfile | undefined
): ValidationResult {
  const handle = normalizeHandle(target.handle);

  if (!profile) {
    return {
      handle,
      creatorId: target.creatorId ?? null,
      url: buildProfileUrl(handle),
      status: "unknown",
      followerCount: null,
      avgViews: null,
      engagementRate: null,
      isVerified: false,
      errorCode: "no_data_returned",
      error: "Apify actor returned no data for this profile",
      attemptCount: 1,
      metadata: {},
    };
  }

  const followerCount = profile.followerCount ?? null;
  const videoCount = profile.videoCount ?? null;
  const heartCount = profile.heartCount ?? null;

  // Estimate engagement rate from heart-to-follower ratio when possible
  const engagementRate =
    followerCount != null && followerCount > 0 && heartCount != null
      ? heartCount / followerCount
      : null;

  // Estimate avg views from heart count and video count (rough heuristic)
  const avgViews =
    heartCount != null && videoCount != null && videoCount > 0
      ? Math.round(heartCount / videoCount)
      : null;

  const isValid = followerCount != null && followerCount > 0;

  return {
    handle,
    creatorId: target.creatorId ?? null,
    url: buildProfileUrl(handle),
    status: isValid ? "valid" : "invalid",
    followerCount,
    avgViews,
    engagementRate,
    isVerified: profile.verified ?? false,
    errorCode: isValid ? null : "zero_followers",
    error: isValid ? null : "zero_followers",
    attemptCount: 1,
    metadata: {
      heartCount,
      videoCount,
      followingCount: profile.followingCount ?? null,
      diggCount: profile.diggCount ?? null,
    },
  };
}

/**
 * TikTok validator using Apify's TikTok profile scraper.
 *
 * Sends all handles in a single actor run, then maps results back
 * to individual ValidationResults.
 */
export class TikTokValidator implements PlatformValidator {
  readonly platform = "tiktok" as const;

  async validateBatch(
    targets: readonly ValidationTarget[],
    _options?: PlatformValidationOptions
  ): Promise<readonly ValidationResult[]> {
    if (targets.length === 0) {
      return [];
    }

    const handles = targets.map((target) => normalizeHandle(target.handle));

    try {
      const actorRun = await runTikTokProfileScraper(handles);
      const items = await getDatasetItems<ApifyTikTokProfile>(
        actorRun.datasetId
      );

      // Index by uniqueId (lowercased) for matching
      const profileByHandle = new Map(
        items
          .filter((item) => item.uniqueId)
          .map((item) => [item.uniqueId!.toLowerCase(), item])
      );

      return targets.map((target) => {
        const normalized = normalizeHandle(target.handle).toLowerCase();
        const profile = profileByHandle.get(normalized);
        return toValidationResult(target, profile);
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // On actor failure, return "retry" for all targets
      return targets.map((target) => ({
        handle: normalizeHandle(target.handle),
        creatorId: target.creatorId ?? null,
        url: buildProfileUrl(target.handle),
        status: "retry" as const,
        followerCount: null,
        avgViews: null,
        engagementRate: null,
        isVerified: false,
        errorCode: "apify_actor_failure",
        error: errorMessage,
        attemptCount: 1,
        metadata: {},
      }));
    }
  }
}
