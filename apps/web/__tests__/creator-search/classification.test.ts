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

  it("maps wellness and supplement categories into the shared taxonomy", () => {
    const result = classifyDiscoveryText({
      rawSourceCategory: "Supplements",
      bio: "Sleep support creator",
      name: "Calm Nights",
      profileDump: null,
    });

    expect(result.canonicalCategory).toBe("Health & Wellness");
    expect(result.confidence).toBe("high");
  });

  it("normalizes common collabstr aliases into canonical categories", () => {
    const result = classifyDiscoveryText({
      rawSourceCategory: "Home Decor",
      bio: "Apartment styling creator",
      name: "Room Reset",
      profileDump: null,
    });

    expect(result).toMatchObject({
      canonicalCategory: "Home & Garden",
      confidence: "high",
    });
  });

  it("classifies multilingual bios with accent-insensitive keyword matching", () => {
    const result = classifyDiscoveryText({
      rawSourceCategory: null,
      bio: "Consejos de belleza y maquillaje para piel sensible",
      name: "Luz",
      profileDump: null,
    });

    expect(result).toMatchObject({
      canonicalCategory: "Beauty",
      languageDetected: "es",
    });
  });
});

describe("creator discovery merge", () => {
  it("merges duplicate handles while preserving all sources", () => {
    const merged = mergeDiscoveryCandidates(
      {
        creatorId: null,
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
        isCached: true,
        lastValidatedAt: "2026-03-09T12:00:00.000Z",
        primarySource: "collabstr",
        sources: ["collabstr"],
        sourceMetadata: { origin: "collabstr" },
        existingValidationStatus: null,
        expandedCategories: [],
        languageDetected: "en",
        topicSignals: [],
        sourceConfidence: 0.8,
        sourceConfidenceTier: "official",
        relevanceScore: 12,
      },
      {
        creatorId: null,
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
        isCached: false,
        lastValidatedAt: null,
        primarySource: "apify_search",
        sources: ["apify_search"],
        sourceMetadata: { origin: "apify" },
        expandedCategories: [],
        languageDetected: "en",
        topicSignals: [],
        sourceConfidence: 0.8,
        sourceConfidenceTier: "official",
        existingValidationStatus: null,
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
