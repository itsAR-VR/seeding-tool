import { describe, expect, it } from "vitest";
import {
  mapInstagramSearchUserToCreator,
  mapProfileToCreator,
} from "@/lib/apify/client";

describe("apify client mapping", () => {
  it("maps profile scraper output into the shared creator shape", () => {
    const mapped = mapProfileToCreator({
      username: "creator_handle",
      fullName: "Creator Name",
      biography: "Beauty creator",
      businessCategoryName: "Beauty",
      followersCount: 42000,
      engagementRate: 0.043,
      isVerified: true,
      profilePicUrlHD: "https://cdn.example.com/avatar.jpg",
      url: "https://instagram.com/creator_handle",
    });

    expect(mapped).toMatchObject({
      handle: "creator_handle",
      source: "apify_search",
      primarySource: "apify_search",
      rawSourceCategory: "Beauty",
      bioCategory: "Beauty",
      followerCount: 42000,
      isVerified: true,
    });
  });

  it("maps search actor results into the shared creator shape", () => {
    const mapped = mapInstagramSearchUserToCreator({
      username: "sleepwell_creator",
      fullName: "Sleepwell Creator",
      biography: "Home and sleep tips",
      category: "Home & Garden",
      followersCount: 9500,
      email: "sleepwell@example.com",
    });

    expect(mapped).toMatchObject({
      handle: "sleepwell_creator",
      source: "apify_search",
      sources: ["apify_search"],
      email: "sleepwell@example.com",
      rawSourceCategory: "Home & Garden",
    });
  });
});
