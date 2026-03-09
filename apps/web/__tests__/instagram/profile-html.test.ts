import { describe, expect, it } from "vitest";
import {
  extractInstagramFollowerCountFromHtml,
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
