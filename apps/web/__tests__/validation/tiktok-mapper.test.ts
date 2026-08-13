import { describe, expect, it } from "vitest";
import {
  mapTikTokProfileToCreator,
  type ApifyTikTokProfile,
} from "@/lib/apify/client";

describe("mapTikTokProfileToCreator", () => {
  it("maps TikTok profile to MappedCreatorData", () => {
    const profile: ApifyTikTokProfile = {
      uniqueId: "tiktoker",
      nickname: "TikToker Pro",
      signature: "Content creator",
      verified: true,
      followerCount: 100000,
      followingCount: 500,
      heartCount: 5000000,
      videoCount: 200,
    };

    const creator = mapTikTokProfileToCreator(profile);
    expect(creator).not.toBeNull();
    expect(creator).toMatchObject({
      handle: "tiktoker",
      name: "TikToker Pro",
      bio: "Content creator",
      followerCount: 100000,
      isVerified: true,
      profileUrl: "https://tiktok.com/@tiktoker",
      source: "apify_tiktok",
      primarySource: "apify_tiktok",
      sources: ["apify_tiktok"],
      metadata: {
        followingCount: 500,
        heartCount: 5000000,
        videoCount: 200,
      },
    });
  });

  it("returns null for profile without uniqueId", () => {
    const result = mapTikTokProfileToCreator({});
    expect(result).toBeNull();
  });

  it("handles @ prefix in uniqueId", () => {
    const profile: ApifyTikTokProfile = {
      uniqueId: "@tiktoker2",
      followerCount: 5000,
    };

    const creator = mapTikTokProfileToCreator(profile);
    expect(creator).not.toBeNull();
    expect(creator!.handle).toBe("tiktoker2");
    expect(creator!.profileUrl).toBe("https://tiktok.com/@tiktoker2");
  });

  it("defaults optional fields to null/false", () => {
    const profile: ApifyTikTokProfile = {
      uniqueId: "minimal",
    };

    const creator = mapTikTokProfileToCreator(profile);
    expect(creator).not.toBeNull();
    expect(creator).toMatchObject({
      handle: "minimal",
      name: null,
      bio: null,
      followerCount: null,
      isVerified: false,
      engagementRate: null,
      email: null,
    });
  });
});
