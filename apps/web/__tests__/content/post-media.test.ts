import { describe, expect, it } from "vitest";
import { pickPostMedia } from "@/app/(platform)/content/post-media";

const stored = (url: string | null) => Boolean(url?.startsWith("https://store/"));

describe("pickPostMedia", () => {
  it("uses the stored copy of a photo over Instagram's link", () => {
    expect(
      pickPostMedia({ mediaType: "IMAGE", mediaUrl: "https://ig/a.jpg", thumbnailUrl: "https://store/a.jpg" }, stored),
    ).toEqual({ image: "https://store/a.jpg", video: null });
  });

  it("uses a video's cover and keeps the video file as a fallback", () => {
    expect(
      pickPostMedia({ mediaType: "VIDEO", mediaUrl: "https://ig/v.mp4", thumbnailUrl: "https://ig/v.jpg" }, stored),
    ).toEqual({ image: "https://ig/v.jpg", video: "https://ig/v.mp4" });
  });

  it("falls back to the video file when a video has no cover", () => {
    expect(pickPostMedia({ mediaType: "VIDEO", mediaUrl: "https://ig/v.mp4", thumbnailUrl: null }, stored)).toEqual({
      image: null,
      video: "https://ig/v.mp4",
    });
  });

  it("treats a video file stored as a photo as a video", () => {
    expect(pickPostMedia({ mediaType: null, mediaUrl: "https://store/v.mov", thumbnailUrl: null }, stored)).toEqual({
      image: null,
      video: "https://store/v.mov",
    });
  });

  it("returns nothing when there's no media", () => {
    expect(pickPostMedia({ mediaType: "IMAGE", mediaUrl: null, thumbnailUrl: null }, stored)).toEqual({
      image: null,
      video: null,
    });
  });
});
