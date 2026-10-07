const VIDEO_FILE = /\.(mp4|mov|webm|m4v)(\?|#|$)/i;

export function isVideoFile(url: string | null | undefined): boolean {
  return Boolean(url && VIDEO_FILE.test(url));
}

export type PostMedia = {
  /** A still image to show (photo, or a video's cover). */
  image: string | null;
  /** A video file to show a frame from when there's no still image. */
  video: string | null;
};

/**
 * What to show on a content tile. Prefers our stored copy over Instagram's
 * expiring links, and for videos falls back to the video file itself so a
 * frame shows instead of a blank tile.
 */
export function pickPostMedia(
  post: { mediaType: string | null; mediaUrl: string | null; thumbnailUrl: string | null },
  isStoredCopy: (url: string | null) => boolean,
): PostMedia {
  const { mediaUrl, thumbnailUrl } = post;
  const mediaIsVideo = post.mediaType === "VIDEO" || isVideoFile(mediaUrl);

  if (mediaIsVideo) {
    const video = mediaUrl;
    const image = thumbnailUrl && !isVideoFile(thumbnailUrl) ? thumbnailUrl : null;
    return { image, video };
  }

  // Photos and carousels: the photo itself, or its thumbnail. Stored copy first.
  const candidates = [mediaUrl, thumbnailUrl].filter((u): u is string => Boolean(u));
  const stored = candidates.find((u) => isStoredCopy(u));
  const image = stored ?? candidates[0] ?? null;
  return isVideoFile(image) ? { image: null, video: image } : { image, video: null };
}

/** Images above the fold load first; the rest wait until they're scrolled to. */
export const EAGER_TILES = 8;
export const HIGH_PRIORITY_TILES = 4;
