"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { EAGER_TILES, HIGH_PRIORITY_TILES, isVideoFile } from "./post-media";

const MEDIA_TYPE_LABELS: Record<string, string> = {
  IMAGE: "Photo",
  VIDEO: "Video",
  CAROUSEL_ALBUM: "Carousel",
  REELS: "Reel",
  STORY: "Story",
};

function mediaTypeLabel(mediaType: string | null, source: string): string {
  if (source === "story") return "Story";
  return (mediaType && MEDIA_TYPE_LABELS[mediaType]) ?? "Post";
}

/** A `#t=` hint makes browsers (Safari especially) paint a first frame with preload="metadata". */
function withFirstFrame(url: string): string {
  return url.includes("#") ? url : `${url}#t=0.1`;
}

/**
 * The picture on a post tile. Shows the photo or cover, else a frame of the
 * video, else (Instagram links expire) a tile with the caption and handle so
 * it never reads as an empty grey box. The first tiles load right away.
 */
export function PostThumbnail({
  image,
  video,
  mediaType,
  source,
  caption,
  handle,
  index,
}: {
  image: string | null;
  video: string | null;
  mediaType: string | null;
  source: string;
  caption: string | null;
  handle: string | null;
  /** Position in the grid; the first ones load eagerly. */
  index: number;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const isVideo = mediaType === "VIDEO" || Boolean(video);
  const eager = index < EAGER_TILES;

  if (image && !imageFailed && !isVideoFile(image)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt=""
        className="h-full w-full object-cover"
        loading={eager ? "eager" : "lazy"}
        fetchPriority={index < HIGH_PRIORITY_TILES ? "high" : "auto"}
        decoding="async"
        onError={() => setImageFailed(true)}
      />
    );
  }

  const videoSrc = video ?? (image && isVideoFile(image) ? image : null);
  if (videoSrc && !videoFailed) {
    return (
      <video
        src={withFirstFrame(videoSrc)}
        className="h-full w-full object-cover"
        muted
        playsInline
        preload="metadata"
        aria-hidden="true"
        tabIndex={-1}
        onError={() => setVideoFailed(true)}
      />
    );
  }

  const snippet = caption?.trim().replace(/\s+/g, " ");
  return (
    <span className="flex h-full flex-col justify-between gap-2 bg-muted p-3 text-left">
      <span className="flex items-center gap-1.5 text-sm font-medium">
        {isVideo && (
          <span className="flex size-6 items-center justify-center rounded-full bg-foreground text-background">
            <Play aria-hidden="true" className="size-3 fill-current" />
          </span>
        )}
        {mediaTypeLabel(mediaType, source)}
      </span>
      {snippet ? (
        <span className="line-clamp-4 text-sm text-foreground/80">{snippet}</span>
      ) : (
        <span className="text-sm text-muted-foreground">Preview not available</span>
      )}
      {handle && <span className="truncate text-sm font-medium">@{handle}</span>}
    </span>
  );
}
