import { describe, expect, it } from "vitest";
import { classifyDiscoveryText } from "@/lib/creator-search/classification";
import { mergeDiscoveryCandidates } from "@/lib/creator-search/candidate-merge";

describe("creator discovery classification", () => {
  it("maps collabstr-like beauty text to a canonical category", () => {
    const result = classifyDiscoveryText({
      rawSourceCategory: "Skincare",
      bio: "Beauty and skincare creator",
      name: "Glow Guru",
      profileDump: null,
    });

    expect(result).toMatchObject({
      canonicalCategory: "Beauty",
      confidence: "high",
    });
  });

  it("falls back to Other when rule matching is weak", () => {
    const result = classifyDiscoveryText({
      rawSourceCategory: "Supplements",
      bio: "Sleep support creator",
      name: "Calm Nights",
      profileDump: null,
    });

    expect(result.canonicalCategory).toBe("Other");
    expect(result.confidence).toBe("low");
  });
});

describe("creator discovery merge", () => {
  it("merges duplicate handles while preserving all sources", () => {
    const merged = mergeDiscoveryCandidates(
      {
        handle: "creator_handle",
        name: "Creator",
        bio: null,
        profileDump: null,
        rawSourceCategory: "Beauty",
        canonicalCategory: "Beauty",
        classificationConfidence: "high",
        matchedCategorySignals: ["beauty"],
        followerCount: null,
        avgViews: null,
        engagementRate: null,
        profileUrl: "https://instagram.com/creator_handle",
        imageUrl: null,
        isVerified: false,
        email: null,
        seedCreatorId: null,
        primarySource: "collabstr",
        sources: ["collabstr"],
        sourceMetadata: { origin: "collabstr" },
        relevanceScore: 12,
      },
      {
        handle: "creator_handle",
        name: "Creator",
        bio: "Beauty creator",
        profileDump: null,
        rawSourceCategory: "Beauty",
        canonicalCategory: "Beauty",
        classificationConfidence: "high",
        matchedCategorySignals: ["beauty", "skincare"],
        followerCount: 12000,
        avgViews: null,
        engagementRate: 0.05,
        profileUrl: "https://instagram.com/creator_handle",
        imageUrl: "https://cdn.example.com/avatar.jpg",
        isVerified: true,
        email: "creator@example.com",
        seedCreatorId: null,
        primarySource: "apify_search",
        sources: ["apify_search"],
        sourceMetadata: { origin: "apify" },
        relevanceScore: 28,
      }
    );

    expect(merged).toMatchObject({
      followerCount: 12000,
      isVerified: true,
      email: "creator@example.com",
      sources: ["collabstr", "apify_search"],
      relevanceScore: 28,
    });
  });
});
