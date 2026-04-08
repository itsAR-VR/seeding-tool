import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// ----------------------------------------------------------------
// 1. Contracts: Zod schema accepts "tiktok"
// ----------------------------------------------------------------
describe("UnifiedDiscoveryPlatform Zod schema", () => {
  it("accepts 'instagram' and defaults to it", async () => {
    const { unifiedDiscoveryQuerySchema } = await import(
      "@/lib/creator-search/contracts"
    );
    const result = unifiedDiscoveryQuerySchema.parse({});
    expect(result.platform).toBe("instagram");
  });

  it("accepts 'tiktok' as a valid platform", async () => {
    const { unifiedDiscoveryQuerySchema } = await import(
      "@/lib/creator-search/contracts"
    );
    const result = unifiedDiscoveryQuerySchema.parse({ platform: "tiktok" });
    expect(result.platform).toBe("tiktok");
  });

  it("rejects invalid platform values", async () => {
    const { unifiedDiscoveryQuerySchema } = await import(
      "@/lib/creator-search/contracts"
    );
    expect(() =>
      unifiedDiscoveryQuerySchema.parse({ platform: "youtube" })
    ).toThrow();
  });
});

// ----------------------------------------------------------------
// 2. Instagram validator adapter: pass-through works via interface
// ----------------------------------------------------------------
describe("InstagramValidator adapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("wraps validateInstagramCreators and returns platform-agnostic results", async () => {
    const mockResults = [
      {
        creatorId: "c1",
        handle: "testcreator",
        url: "https://instagram.com/testcreator/",
        followerCount: 12000,
        avgViews: 500,
        checkedVideoCount: 3,
        blocked: false,
        status: "valid" as const,
        errorCode: null,
        error: null,
        attemptCount: 1,
      },
    ];

    vi.doMock("@/lib/instagram/validator", () => ({
      validateInstagramCreators: vi.fn().mockResolvedValue(mockResults),
    }));

    const { InstagramValidator } = await import(
      "@/lib/validation/instagram-validator"
    );
    const validator = new InstagramValidator();

    expect(validator.platform).toBe("instagram");

    const results = await validator.validateBatch([
      { handle: "testcreator", creatorId: "c1" },
    ]);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      handle: "testcreator",
      creatorId: "c1",
      status: "valid",
      followerCount: 12000,
      avgViews: 500,
      metadata: {
        checkedVideoCount: 3,
        blocked: false,
      },
    });
  });

  it("returns empty array for empty targets", async () => {
    const { InstagramValidator } = await import(
      "@/lib/validation/instagram-validator"
    );
    const validator = new InstagramValidator();

    const results = await validator.validateBatch([]);
    expect(results).toHaveLength(0);
  });
});

// ----------------------------------------------------------------
// 3. TikTok validator: returns follower count from Apify response
// ----------------------------------------------------------------
describe("TikTokValidator", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("returns follower count from Apify TikTok profile response", async () => {
    const mockProfiles = [
      {
        uniqueId: "tiktokcreator",
        nickname: "TikTok Creator",
        followerCount: 50000,
        heartCount: 1200000,
        videoCount: 150,
        verified: true,
      },
    ];

    vi.doMock("@/lib/apify/client", () => ({
      runTikTokProfileScraper: vi
        .fn()
        .mockResolvedValue({ datasetId: "ds1", runId: "r1" }),
      getDatasetItems: vi.fn().mockResolvedValue(mockProfiles),
    }));

    const { TikTokValidator } = await import(
      "@/lib/validation/tiktok-validator"
    );
    const validator = new TikTokValidator();

    expect(validator.platform).toBe("tiktok");

    const results = await validator.validateBatch([
      { handle: "tiktokcreator", creatorId: "c2" },
    ]);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      handle: "tiktokcreator",
      creatorId: "c2",
      status: "valid",
      followerCount: 50000,
      isVerified: true,
      url: "https://tiktok.com/@tiktokcreator",
    });
    // Engagement rate should be heartCount / followerCount
    expect(results[0]!.engagementRate).toBeCloseTo(1200000 / 50000);
    // Avg views estimated as heartCount / videoCount
    expect(results[0]!.avgViews).toBe(Math.round(1200000 / 150));
  });

  // ----------------------------------------------------------------
  // 4. TikTok validator: handles Apify actor failure gracefully
  // ----------------------------------------------------------------
  it("handles Apify actor failure gracefully with retry status", async () => {
    vi.doMock("@/lib/apify/client", () => ({
      runTikTokProfileScraper: vi
        .fn()
        .mockRejectedValue(new Error("Actor timeout")),
      getDatasetItems: vi.fn(),
    }));

    const { TikTokValidator } = await import(
      "@/lib/validation/tiktok-validator"
    );
    const validator = new TikTokValidator();

    const results = await validator.validateBatch([
      { handle: "failing_creator", creatorId: "c3" },
    ]);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      handle: "failing_creator",
      status: "retry",
      errorCode: "apify_actor_failure",
      error: "Actor timeout",
      followerCount: null,
    });
  });

  it("handles profiles not found in Apify response", async () => {
    vi.doMock("@/lib/apify/client", () => ({
      runTikTokProfileScraper: vi
        .fn()
        .mockResolvedValue({ datasetId: "ds2", runId: "r2" }),
      getDatasetItems: vi.fn().mockResolvedValue([]),
    }));

    const { TikTokValidator } = await import(
      "@/lib/validation/tiktok-validator"
    );
    const validator = new TikTokValidator();

    const results = await validator.validateBatch([
      { handle: "ghost_creator", creatorId: "c4" },
    ]);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      handle: "ghost_creator",
      status: "unknown",
      errorCode: "no_data_returned",
    });
  });
});

// ----------------------------------------------------------------
// 5. Platform registry dispatches to correct validator
// ----------------------------------------------------------------
describe("Platform validator registry", () => {
  it("returns Instagram validator for 'instagram'", async () => {
    const { getValidator } = await import("@/lib/validation/registry");
    const validator = getValidator("instagram");
    expect(validator).toBeDefined();
    expect(validator!.platform).toBe("instagram");
  });

  it("returns TikTok validator for 'tiktok'", async () => {
    const { getValidator } = await import("@/lib/validation/registry");
    const validator = getValidator("tiktok");
    expect(validator).toBeDefined();
    expect(validator!.platform).toBe("tiktok");
  });

  it("registerValidator adds a new platform", async () => {
    const { registerValidator, getValidator } = await import(
      "@/lib/validation/registry"
    );
    const mockValidator = {
      platform: "tiktok" as const,
      validateBatch: vi.fn().mockResolvedValue([]),
    };
    registerValidator(mockValidator);
    expect(getValidator("tiktok")).toBe(mockValidator);
  });

  it("getRegisteredPlatforms includes both defaults", async () => {
    const { getRegisteredPlatforms } = await import(
      "@/lib/validation/registry"
    );
    const platforms = getRegisteredPlatforms();
    expect(platforms).toContain("instagram");
    expect(platforms).toContain("tiktok");
  });
});

// ----------------------------------------------------------------
// 6. Multi-platform scoring: best platform metrics
// ----------------------------------------------------------------
describe("selectBestPlatformMetrics", () => {
  it("selects highest follower count and highest engagement rate across platforms", async () => {
    const { selectBestPlatformMetrics } = await import(
      "@/lib/validation/multi-platform"
    );

    const metrics = selectBestPlatformMetrics([
      {
        platform: "instagram",
        followerCount: 10000,
        avgViews: 800,
        engagementRate: 0.04,
      },
      {
        platform: "tiktok",
        followerCount: 50000,
        avgViews: 3000,
        engagementRate: 0.02,
      },
    ]);

    expect(metrics).toMatchObject({
      primaryPlatform: "tiktok", // Highest followers
      followerCount: 50000,
      avgViews: 3000, // Highest avg views
      engagementRate: 0.04, // Highest engagement rate
      platformCount: 2,
    });
  });

  it("handles empty results", async () => {
    const { selectBestPlatformMetrics } = await import(
      "@/lib/validation/multi-platform"
    );

    const metrics = selectBestPlatformMetrics([]);
    expect(metrics).toMatchObject({
      primaryPlatform: "instagram",
      followerCount: null,
      avgViews: null,
      engagementRate: null,
      platformCount: 0,
    });
  });

  it("handles single platform results", async () => {
    const { selectBestPlatformMetrics } = await import(
      "@/lib/validation/multi-platform"
    );

    const metrics = selectBestPlatformMetrics([
      {
        platform: "instagram",
        followerCount: 25000,
        avgViews: 1200,
        engagementRate: 0.05,
      },
    ]);

    expect(metrics).toMatchObject({
      primaryPlatform: "instagram",
      followerCount: 25000,
      avgViews: 1200,
      engagementRate: 0.05,
      platformCount: 1,
    });
  });
});

// ----------------------------------------------------------------
// 7. toPlatformMetrics conversion
// ----------------------------------------------------------------
describe("toPlatformMetrics", () => {
  it("converts a ValidationResult into PlatformMetrics", async () => {
    const { toPlatformMetrics } = await import(
      "@/lib/validation/multi-platform"
    );

    const result = {
      handle: "creator",
      creatorId: "c1",
      url: "https://instagram.com/creator",
      status: "valid" as const,
      followerCount: 15000,
      avgViews: 900,
      engagementRate: 0.06,
      isVerified: false,
      errorCode: null,
      error: null,
      attemptCount: 1,
      metadata: {},
    };

    const metrics = toPlatformMetrics("instagram", result);
    expect(metrics).toEqual({
      platform: "instagram",
      followerCount: 15000,
      avgViews: 900,
      engagementRate: 0.06,
    });
  });
});

// ----------------------------------------------------------------
// 8. Existing Instagram-only creators unaffected
// ----------------------------------------------------------------
describe("backward compatibility", () => {
  it("existing Instagram queries still default correctly", async () => {
    const { normalizeUnifiedDiscoveryQuery } = await import(
      "@/lib/creator-search/contracts"
    );

    const query = normalizeUnifiedDiscoveryQuery({
      keywords: ["beauty"],
    });

    expect(query.platform).toBe("instagram");
    expect(query.sources).toContain("collabstr");
  });

  it("buildUnifiedDiscoveryQueryFromManualSearch defaults to instagram", async () => {
    const { buildUnifiedDiscoveryQueryFromManualSearch } = await import(
      "@/lib/creator-search/contracts"
    );

    const query = buildUnifiedDiscoveryQueryFromManualSearch({
      searchMode: "profile",
      usernames: ["creator1"],
    });

    expect(query.platform).toBe("instagram");
  });

  it("apify_tiktok is a valid discovery source", async () => {
    const { UNIFIED_DISCOVERY_SOURCES } = await import(
      "@/lib/creator-search/contracts"
    );

    expect(UNIFIED_DISCOVERY_SOURCES).toContain("apify_tiktok");
    // Original sources still present
    expect(UNIFIED_DISCOVERY_SOURCES).toContain("collabstr");
    expect(UNIFIED_DISCOVERY_SOURCES).toContain("apify_search");
    expect(UNIFIED_DISCOVERY_SOURCES).toContain("approved_seed_following");
    expect(UNIFIED_DISCOVERY_SOURCES).toContain("apify_keyword_email");
  });
});

// ----------------------------------------------------------------
// 9. Apify TikTok mapper — tested in tiktok-mapper.test.ts
//    (separate file to avoid mock contamination from apify/client mocks)
// ----------------------------------------------------------------

// ----------------------------------------------------------------
// 10. Validation types interface check
// ----------------------------------------------------------------
describe("PlatformValidator interface", () => {
  it("InstagramValidator implements PlatformValidator correctly", async () => {
    const { InstagramValidator } = await import(
      "@/lib/validation/instagram-validator"
    );

    const validator = new InstagramValidator();
    expect(validator.platform).toBe("instagram");
    expect(typeof validator.validateBatch).toBe("function");
  });

  it("TikTokValidator implements PlatformValidator correctly", async () => {
    const { TikTokValidator } = await import(
      "@/lib/validation/tiktok-validator"
    );

    const validator = new TikTokValidator();
    expect(validator.platform).toBe("tiktok");
    expect(typeof validator.validateBatch).toBe("function");
  });
});
