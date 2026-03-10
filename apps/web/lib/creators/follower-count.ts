const CREATOR_MARKETPLACE_PLACEHOLDER_FOLLOWER_COUNT = 1_500_000;

export function isPlaceholderFollowerCount(
  discoverySource: string | null | undefined,
  followerCount: number | null | undefined
) {
  return (
    discoverySource?.toLowerCase() === "creator_marketplace" &&
    followerCount === CREATOR_MARKETPLACE_PLACEHOLDER_FOLLOWER_COUNT
  );
}

export function sanitizeFollowerCount(
  discoverySource: string | null | undefined,
  followerCount: number | null | undefined
) {
  if (followerCount == null) {
    return followerCount;
  }

  if (isPlaceholderFollowerCount(discoverySource, followerCount)) {
    return null;
  }

  return followerCount;
}
