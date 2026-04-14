import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UnifiedDiscoveryQuery } from "@/lib/creator-search/contracts";

const mocks = vi.hoisted(() => ({
  creatorFindMany: vi.fn(),
  getDatasetItems: vi.fn(),
  mapInstagramSearchUserToCreator: vi.fn(),
  mapProfileToCreator: vi.fn(),
  runInstagramProfileScraper: vi.fn(),
  runInstagramSearchScraper: vi.fn(),
  runInstagramFollowingScraper: vi.fn(),
  runInstagramKeywordEmailScraper: vi.fn(),
  classifyBatchWithLLM: vi.fn(),
  classifyDiscoveryText: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    creator: {
      findMany: mocks.creatorFindMany,
    },
  },
}));

vi.mock("@/lib/apify/client", () => ({
  getDatasetItems: mocks.getDatasetItems,
  mapInstagramSearchUserToCreator: mocks.mapInstagramSearchUserToCreator,
  mapProfileToCreator: mocks.mapProfileToCreator,
  runInstagramProfileScraper: mocks.runInstagramProfileScraper,
  runInstagramSearchScraper: mocks.runInstagramSearchScraper,
  runInstagramFollowingScraper: mocks.runInstagramFollowingScraper,
  runInstagramKeywordEmailScraper: mocks.runInstagramKeywordEmailScraper,
}));

vi.mock("@/lib/creator-search/classification-llm", () => ({
  classifyBatchWithLLM: mocks.classifyBatchWithLLM,
}));

vi.mock("@/lib/creator-search/classification", () => ({
  classifyDiscoveryText: mocks.classifyDiscoveryText,
}));

function makeQuery(
  overrides: Partial<UnifiedDiscoveryQuery> = {},
): UnifiedDiscoveryQuery {
  return {
    sources: ["apify_search"],
    keywords: ["beauty"],
    canonicalCategories: ["Beauty"],
    platform: "instagram",
    limit: 10,
    location: undefined,
    emailPrefetch: false,
    usernames: [],
    seedExpansion: {
      enabled: false,
      maxSeedsPerRun: 5,
      maxFollowingPerSeed: 50,
    },
    filters: {
      excludeExistingCreators: false,
      requireCategory: false,
      minFollowers: undefined,
      maxFollowers: undefined,
      minAvgViews: undefined,
    },
    ...overrides,
  };
}

function makeMappedCreator(
  overrides: Record<string, unknown> = {},
) {
  return {
    handle: "creator_handle",
    name: "Creator",
    bio: "Beauty creator",
    rawSourceCategory: "Beauty",
    followerCount: 12000,
    engagementRate: 0.05,
    profileUrl: "https://instagram.com/creator_handle",
    imageUrl: "https://cdn.example.com/avatar.jpg",
    isVerified: false,
    email: null,
    seedCreatorId: null,
    source: "apify_search",
    primarySource: "apify_search",
    sources: ["apify_search"],
    metadata: {},
    ...overrides,
  };
}

function makeHighClassification(overrides: Record<string, unknown> = {}) {
  return {
    canonicalCategory: "Beauty",
    rawSourceCategory: "Beauty",
    confidence: "high",
    matchedKeywords: ["beauty"],
    expandedCategories: [],
    languageDetected: "en",
    topicSignals: [],
    ...overrides,
  };
}

function makeStoredCreator(overrides: Record<string, unknown> = {}) {
  return {
    id: "creator-1",
    instagramHandle: "storedcreator",
    discoverySource: "collabstr",
    name: "Stored Creator",
    bio: "Beauty tips",
    bioCategory: "Beauty",
    followerCount: 5000,
    avgViews: 800,
    validationStatus: "valid",
    lastValidatedAt: new Date("2026-04-10T00:00:00.000Z"),
    email: "stored@example.com",
    imageUrl: "https://cdn.example.com/stored.jpg",
    profiles: [
      {
        platform: "instagram",
        engagementRate: 0.04,
        url: "https://instagram.com/storedcreator",
        isVerified: false,
      },
    ],
    discoveryTouches: [],
    ...overrides,
  };
}

describe("orchestrateUnifiedDiscovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mocks.creatorFindMany.mockResolvedValue([]);
    mocks.runInstagramSearchScraper.mockResolvedValue({ datasetId: "search-ds" });
    mocks.runInstagramProfileScraper.mockResolvedValue({ datasetId: "profile-ds" });
    mocks.classifyBatchWithLLM.mockResolvedValue([]);
    mocks.classifyDiscoveryText.mockReturnValue(makeHighClassification());
  });

  it("deduplicates duplicate handles and enriches missing profile fields", async () => {
    mocks.getDatasetItems
      .mockResolvedValueOnce([{ id: "search-1" }, { id: "search-2" }])
      .mockResolvedValueOnce([{ id: "profile-1" }]);

    mocks.mapInstagramSearchUserToCreator
      .mockReturnValueOnce(
        makeMappedCreator({
          handle: "dup_handle",
          bio: null,
          followerCount: null,
          imageUrl: null,
        }),
      )
      .mockReturnValueOnce(
        makeMappedCreator({
          handle: "dup_handle",
          followerCount: null,
          imageUrl: null,
          email: "dup@example.com",
        }),
      );
    mocks.mapProfileToCreator.mockReturnValue(
      makeMappedCreator({
        handle: "dup_handle",
        bio: "Refined profile bio",
        followerCount: 22000,
        imageUrl: "https://cdn.example.com/enriched.jpg",
        email: "dup@example.com",
      }),
    );

    const { orchestrateUnifiedDiscovery } = await import(
      "@/lib/creator-search/orchestrator"
    );

    const results = await orchestrateUnifiedDiscovery({
      brandId: "brand-1",
      query: makeQuery(),
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      handle: "dup_handle",
      bio: "Refined profile bio",
      followerCount: 22000,
      imageUrl: "https://cdn.example.com/enriched.jpg",
      email: "dup@example.com",
    });
    expect(mocks.runInstagramProfileScraper).toHaveBeenCalledWith(["dup_handle"]);
  });

  it("reclassifies low-confidence bios with the LLM fallback", async () => {
    mocks.getDatasetItems.mockResolvedValueOnce([{ id: "search-1" }]);
    mocks.mapInstagramSearchUserToCreator.mockReturnValue(
      makeMappedCreator({
        handle: "low_conf",
        bio: "Builder making tools for product teams",
        rawSourceCategory: null,
      }),
    );
    mocks.classifyDiscoveryText.mockReturnValue(
      makeHighClassification({
        canonicalCategory: "Other",
        rawSourceCategory: null,
        confidence: "low",
        matchedKeywords: [],
      }),
    );
    mocks.classifyBatchWithLLM.mockResolvedValue([
      {
        canonicalCategory: "Tech",
        rawSourceCategory: null,
        confidence: "high",
        matchedKeywords: ["llm:Tech"],
        expandedCategories: ["SaaS"],
        languageDetected: "en",
        topicSignals: ["tools"],
      },
    ]);

    const { orchestrateUnifiedDiscovery } = await import(
      "@/lib/creator-search/orchestrator"
    );

    const results = await orchestrateUnifiedDiscovery({
      brandId: "brand-1",
      query: makeQuery(),
    });

    expect(mocks.classifyBatchWithLLM).toHaveBeenCalledWith(
      ["Builder making tools for product teams"],
      [
        expect.objectContaining({
          canonicalCategory: "Other",
          confidence: "low",
        }),
      ],
    );
    expect(results[0]).toMatchObject({
      canonicalCategory: "Tech",
      classificationConfidence: "high",
      matchedCategorySignals: ["llm:Tech"],
    });
  });

  it("returns other lane results when one lane fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.creatorFindMany.mockResolvedValueOnce([makeStoredCreator()]);
    mocks.runInstagramSearchScraper.mockRejectedValueOnce(new Error("lane boom"));

    const { orchestrateUnifiedDiscovery } = await import(
      "@/lib/creator-search/orchestrator"
    );

    const results = await orchestrateUnifiedDiscovery({
      brandId: "brand-1",
      query: makeQuery({
        sources: ["collabstr", "apify_search"],
      }),
    });

    expect(results).toHaveLength(1);
    expect(results[0].handle).toBe("storedcreator");
    expect(warnSpy).toHaveBeenCalledWith(
      "[creator-search] lane failed",
      expect.any(Error),
    );

    warnSpy.mockRestore();
  });
});
