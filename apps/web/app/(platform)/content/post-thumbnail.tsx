"use client";

import { useState } from "react";

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

/**
 * Instagram media links expire, so a saved thumbnail can stop loading.
 * When it does, show a calm labeled tile instead of an empty grey box.
 */
export function PostThumbnail({
  src,
  mediaType,
  source,
}: {
  src: string | null;
  mediaType: string | null;
  source: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <span className="flex h-full flex-col items-center justify-center gap-1 p-3 text-center">
        <span className="font-medium">{mediaTypeLabel(mediaType, source)}</span>
        <span className="text-sm text-muted-foreground">Preview not available</span>
      </span>
    );
  }

  if (/\.(mp4|mov|webm)$/i.test(src)) {
    return (
      <video
        src={src}
        className="h-full w-full object-cover"
        muted
        playsInline
        preload="metadata"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className="h-full w-full object-cover"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
