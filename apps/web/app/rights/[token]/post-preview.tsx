"use client";

import { useState } from "react";

/**
 * The creator's post on the rights page. Instagram links expire, so when the
 * picture won't load, show a calm tile instead of a broken image.
 */
export function PostPreview({ src }: { src: string | null }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="mt-6 flex aspect-square w-full items-center justify-center rounded-3xl bg-muted p-6 text-center">
        <p className="text-sm text-muted-foreground">Preview not available</p>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="Your post"
      className="mt-6 aspect-square w-full rounded-3xl object-cover"
      onError={() => setFailed(true)}
    />
  );
}
