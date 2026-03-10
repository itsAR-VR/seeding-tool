import { describe, expect, it } from "vitest";
import {
  extractInstagramFollowerCountFromHtml,
  extractInstagramRecentVideoUrlsFromHtml,
  extractInstagramViewCountFromHtml,
  isInstagramProfileMissing,
  parseInstagramCountText,
} from "@/lib/instagram/profile-html";

describe("parseInstagramCountText", () => {
  it("parses whole-number follower counts", () => {
    expect(parseInstagramCountText("12,345")).toBe(12_345);
  });

  it("parses abbreviated follower counts", () => {
    expect(parseInstagramCountText("12.4K")).toBe(12_400);
    expect(parseInstagramCountText("1.5M")).toBe(1_500_000);
  });
});

describe("extractInstagramFollowerCountFromHtml", () => {
  it("extracts count from embedded JSON", () => {
    const html =
      '<script>{"edge_followed_by":{"count":42123},"username":"demo"}</script>';

    expect(extractInstagramFollowerCountFromHtml(html)).toBe(42_123);
  });

  it("extracts count from meta description", () => {
    const html =
      '<meta property="og:description" content="12.4K Followers, 210 Following, 33 Posts - See Instagram photos and videos from Demo (@demo)">';

    expect(extractInstagramFollowerCountFromHtml(html)).toBe(12_400);
  });
});

describe("extractInstagramRecentVideoUrlsFromHtml", () => {
  it("extracts reel and video shortcode urls", () => {
    const html = [
      '<a href="/reel/REEL123/"></a>',
      '<script>{"shortcode":"POST456","is_video":true}</script>',
      '<script>{"shortcode":"POST789","is_video":false}</script>',
    ].join("");

    expect(extractInstagramRecentVideoUrlsFromHtml(html)).toEqual([
      "https://www.instagram.com/p/POST456/",
      "https://www.instagram.com/reel/REEL123/",
    ]);
  });
});

describe("extractInstagramViewCountFromHtml", () => {
  it("extracts view counts from embedded JSON", () => {
    const html = '<script>{"video_view_count":18234}</script>';

    expect(extractInstagramViewCountFromHtml(html)).toBe(18_234);
  });

  it("extracts view counts from meta descriptions", () => {
    const html =
      '<meta property="og:description" content="18.2K Views, 120 comments - See Instagram photos and videos from Demo (@demo)">';

    expect(extractInstagramViewCountFromHtml(html)).toBe(18_200);
  });
});

describe("isInstagramProfileMissing", () => {
  it("detects missing profile pages", () => {
    const html =
      "<title>Page isn't available • Instagram</title><p>Sorry, this page isn't available.</p>";

    expect(isInstagramProfileMissing(html)).toBe(true);
  });
});
