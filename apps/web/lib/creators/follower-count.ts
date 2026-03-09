const CREATOR_MARKETPLACE_PLACEHOLDER_FOLLOWER_COUNT = 1_500_000;

export function sanitizeFollowerCount(
  discoverySource: string | null | undefined,
  followerCount: number | null | undefined
) {
  if (followerCount == null) {
    return followerCount;
  }

  if (
    discoverySource?.toLowerCase() === "creator_marketplace" &&
    followerCount === CREATOR_MARKETPLACE_PLACEHOLDER_FOLLOWER_COUNT
  ) {
    return null;
  }

  return followerCount;
}
