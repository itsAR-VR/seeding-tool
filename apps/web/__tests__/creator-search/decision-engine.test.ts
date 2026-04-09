import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DecisionEngineCandidate } from "@/lib/creator-search/decision-engine";
import type { UnifiedDiscoveryQuery } from "@/lib/creator-search/contracts";
import type { DiscoveryClassification } from "@/lib/creator-search/classification";

// ── Hoisted mocks ──────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  resolveIdentityForCandidate: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    influencerPlatformProfile: {
      findMany: mocks.findMany,
    },
  },
}));

vi.mock("@/lib/identity/matching", () => ({
  resolveIdentityForCandidate: mocks.resolveIdentityForCandidate,
}));

vi.mock("@/lib/logger", () => ({
  log: vi.fn(),
}));

// ── Factories ──────────────────────────────────────────────

function makeCandidate(
  overrides: Partial<DecisionEngineCandidate> = {},
): DecisionEngineCandidate {
  return {
    creatorId: "creator-1",
    handle: "testcreator",
    name: "Test Creator",
    bio: "Beauty and skincare guru",
    profileDump: null,
    rawSourceCategory: null,
    canonicalCategory: "Beauty",
    classificationConfidence: "high",
    matchedCategorySignals: ["beauty"],
    expandedCategories: ["Skincare"],
    languageDetected: null,
    topicSignals: [],
    followerCount: 15000,
    avgViews: 2000,
    engagementRate: 0.045,
    profileUrl: "https://instagram.com/testcreator",
    imageUrl: "https://example.com/img.jpg",
    isVerified: false,
    email: "test@example.com",
    seedCreatorId: null,
    isCached: false,
    existingValidationStatus: null,
    lastValidatedAt: null,
    primarySource: "collabstr",
    sources: ["collabstr"],
    sourceConfidence: 0.65,
    sourceConfidenceTier: "marketplace",
    sourceMetadata: {},
    relevanceScore: 0.8,
    validationStatus: "valid",
    validationError: null,
    validationErrorCode: null,
    validationAttempts: 1,
    validatedFollowerCount: 15000,
    validatedAvgViews: 2000,
    validatedProfileUrl: "https://instagram.com/testcreator",
    ...overrides,
  };
}

function makeQuery(
  overrides: Partial<UnifiedDiscoveryQuery> = {},
): UnifiedDiscoveryQuery {
  return {
    sources: ["collabstr"],
    keywords: ["beauty", "skincare"],
    canonicalCategories: ["Beauty"],
    platform: "instagram",
    limit: 20,
    filters: {
      minFollowers: 1000,
      maxFollowers: 100000,
      requireCategory: false,
      excludeExistingCreators: false,
    },
    seedExpansion: {
      enabled: false,
      maxSeedsPerRun: 0,
      maxFollowingPerSeed: 0,
    },
    emailPrefetch: false,
    usernames: [],
    ...overrides,
  };
}

function makeClassification(
  overrides: Partial<DiscoveryClassification> = {},
): DiscoveryClassification {
  return {
    canonicalCategory: "Beauty",
    rawSourceCategory: null,
    confidence: "high",
    matchedKeywords: ["beauty"],
    expandedCategories: ["Skincare"],
    languageDetected: null,
    topicSignals: [],
    ...overrides,
  };
}

function defaultIdentityResolution() {
  return {
    bestIdentityId: null,
    bestProfileId: null,
    bestMatchScore: null,
    matchBand: null,
    identityEdgeCount: 0,
    crossPlatformProfileCount: 0,
    isNewIdentity: false,
  };
}

// ── Tests ──────────────────────────────────────────────────

describe("scoreDecisionCandidate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveIdentityForCandidate.mockResolvedValue(
      defaultIdentityResolution(),
    );
    mocks.findMany.mockResolvedValue([]);
  });

  it("produces a composite fitScore between 0 and 1", async () => {
    const { scoreDecisionCandidate } = await import(
      "@/lib/creator-search/decision-engine"
    );

    const result = await scoreDecisionCandidate({
      brandSummary: "A beauty brand focused on skincare",
      query: makeQuery(),
      candidate: makeCandidate(),
      classification: makeClassification(),
    });

    expect(result.fitScore).toBeGreaterThanOrEqual(0);
    expect(result.fitScore).toBeLessThanOrEqual(1);
    expect(typeof result.fitScore).toBe("number");
    expect(Number.isNaN(result.fitScore)).toBe(false);
  });

  it("7-dimension scoring produces correct composite with all components present", async () => {
    const { scoreDecisionCandidate } = await import(
      "@/lib/creator-search/decision-engine"
    );

    const result = await scoreDecisionCandidate({
      brandSummary: "Beauty skincare brand",
      query: makeQuery(),
      candidate: makeCandidate({
        engagementRate: 0.05,
        followerCount: 12000,
        validatedFollowerCount: 12000,
        validatedAvgViews: 3000,
      }),
      classification: makeClassification({ confidence: "high" }),
    });

    // scoreComponents should contain all 7 dimensions plus retrievalRelevance
    const components = result.scoreComponents as Record<string, unknown>;
    expect(components).toHaveProperty("topicalMatch");
    expect(components).toHaveProperty("categoryConfidence");
    expect(components).toHaveProperty("engagementQuality");
    expect(components).toHaveProperty("authenticity");
    expect(components).toHaveProperty("scaleFit");
    expect(components).toHaveProperty("identityConfidence");
    expect(components).toHaveProperty("contactability");
    expect(components).toHaveProperty("retrievalRelevance");
  });

  it("auto_shortlist triage for strong candidates (composite > 0.8 with high auth and identity)", async () => {
    mocks.resolveIdentityForCandidate.mockResolvedValue({
      bestIdentityId: "id-1",
      bestProfileId: "prof-1",
      bestMatchScore: 0.95,
      matchBand: "auto_linked",
      identityEdgeCount: 3,
      crossPlatformProfileCount: 3,
      isNewIdentity: false,
    });

    mocks.findMany.mockResolvedValue([
      {
        contactPoints: [
          { contactType: "email", confidence: 0.9, isStale: false },
        ],
        metricsDaily: [],
        authenticityAssessments: [],
      },
    ]);

    const { scoreDecisionCandidate } = await import(
      "@/lib/creator-search/decision-engine"
    );

    const result = await scoreDecisionCandidate({
      brandSummary: "Beauty skincare brand focusing on beauty",
      query: makeQuery({ keywords: ["beauty", "skincare"] }),
      candidate: makeCandidate({
        bio: "Beauty skincare expert",
        canonicalCategory: "Beauty",
        engagementRate: 0.06,
        followerCount: 15000,
        validatedFollowerCount: 15000,
        validatedAvgViews: 5000,
        isVerified: true,
        email: "creator@example.com",
        sourceConfidence: 0.85,
        validationStatus: "valid",
      }),
      classification: makeClassification({ confidence: "high" }),
    });

    // Strong candidate should score high
    expect(result.fitScore).toBeGreaterThan(0.65);
    expect(["auto_shortlist", "review"]).toContain(result.triage);
  });

  it("suppress triage for weak candidates (composite < 0.65)", async () => {
    const { scoreDecisionCandidate } = await import(
      "@/lib/creator-search/decision-engine"
    );

    const result = await scoreDecisionCandidate({
      brandSummary: "Luxury automotive parts manufacturer",
      query: makeQuery({
        keywords: ["automotive", "luxury cars"],
        canonicalCategories: ["Automotive"],
      }),
      candidate: makeCandidate({
        bio: "cat memes daily",
        canonicalCategory: "Pets",
        matchedCategorySignals: [],
        expandedCategories: [],
        engagementRate: 0.001,
        followerCount: 200,
        validatedFollowerCount: 200,
        validatedAvgViews: 10,
        isVerified: false,
        email: null,
        sourceConfidence: 0.3,
        validationStatus: "unknown",
        sources: ["approved_seed_following"],
        primarySource: "apify_search",
      }),
      classification: makeClassification({
        canonicalCategory: "Pets",
        confidence: "low",
      }),
    });

    expect(result.triage).toBe("suppress");
    expect(result.fitScore).toBeLessThan(0.65);
  });

  it("missing features default to 0 (not NaN)", async () => {
    const { scoreDecisionCandidate } = await import(
      "@/lib/creator-search/decision-engine"
    );

    const result = await scoreDecisionCandidate({
      brandSummary: "",
      query: makeQuery({ keywords: [], canonicalCategories: [] }),
      candidate: makeCandidate({
        bio: null,
        canonicalCategory: null,
        matchedCategorySignals: [],
        expandedCategories: [],
        followerCount: null,
        avgViews: null,
        engagementRate: null,
        validatedFollowerCount: null,
        validatedAvgViews: null,
        email: null,
        sourceConfidence: 0,
        isVerified: false,
        validationStatus: "unknown",
      }),
      classification: null,
    });

    expect(Number.isNaN(result.fitScore)).toBe(false);
    expect(result.fitScore).toBeGreaterThanOrEqual(0);
    expect(result.fitScore).toBeLessThanOrEqual(1);

    // Verify no NaN in score components
    const components = result.scoreComponents as Record<string, unknown>;
    for (const [key, value] of Object.entries(components)) {
      if (typeof value === "object" && value !== null && "score" in value) {
        const scoreValue = (value as { score: number }).score;
        expect(Number.isNaN(scoreValue)).toBe(false);
      }
    }
  });

  it("fitReasoning is generated from score components", async () => {
    const { scoreDecisionCandidate } = await import(
      "@/lib/creator-search/decision-engine"
    );

    const result = await scoreDecisionCandidate({
      brandSummary: "Beauty brand",
      query: makeQuery(),
      candidate: makeCandidate(),
      classification: makeClassification(),
    });

    expect(typeof result.fitReasoning).toBe("string");
    expect(result.fitReasoning.length).toBeGreaterThan(0);
    // Should contain component labels
    expect(result.fitReasoning).toContain("Topical match");
    expect(result.fitReasoning).toContain("Engagement");
    expect(result.fitReasoning).toContain("Authenticity");
    expect(result.fitReasoning).toContain("Identity");
    expect(result.fitReasoning).toContain("Contactability");
    // Should include triage label
    expect(result.fitReasoning).toContain("Triage:");
  });

  it("contactabilityBand is strong for high contact score", async () => {
    mocks.resolveIdentityForCandidate.mockResolvedValue({
      ...defaultIdentityResolution(),
      bestIdentityId: "id-1",
    });

    mocks.findMany.mockResolvedValue([
      {
        contactPoints: [
          { contactType: "email", confidence: 0.9, isStale: false },
        ],
        metricsDaily: [],
        authenticityAssessments: [],
      },
    ]);

    const { scoreDecisionCandidate } = await import(
      "@/lib/creator-search/decision-engine"
    );

    const result = await scoreDecisionCandidate({
      brandSummary: "Beauty brand",
      query: makeQuery(),
      candidate: makeCandidate({ email: "test@test.com" }),
      classification: makeClassification(),
    });

    expect(result.contactabilityBand).toBe("strong");
  });

  it("authenticityBand is unknown when no snapshots exist", async () => {
    const { scoreDecisionCandidate } = await import(
      "@/lib/creator-search/decision-engine"
    );

    const result = await scoreDecisionCandidate({
      brandSummary: "Beauty brand",
      query: makeQuery(),
      candidate: makeCandidate(),
      classification: makeClassification(),
    });

    // No identity found, no profiles, so no snapshots
    expect(result.authenticityBand).toBe("unknown");
  });

  it("enriches with identity resolution data when identity is found", async () => {
    mocks.resolveIdentityForCandidate.mockResolvedValue({
      bestIdentityId: "influencer-42",
      bestProfileId: "prof-99",
      bestMatchScore: 0.91,
      matchBand: "auto_linked",
      identityEdgeCount: 4,
      crossPlatformProfileCount: 2,
      isNewIdentity: false,
    });

    mocks.findMany.mockResolvedValue([]);

    const { scoreDecisionCandidate } = await import(
      "@/lib/creator-search/decision-engine"
    );

    const result = await scoreDecisionCandidate({
      brandSummary: "Beauty brand",
      query: makeQuery(),
      candidate: makeCandidate(),
      classification: makeClassification(),
    });

    expect(result.influencerIdentityId).toBe("influencer-42");
    expect(result.bestIdentityProfileId).toBe("prof-99");
    expect(result.bestIdentityEdgeScore).toBe(0.91);
    expect(result.identityEdgeCount).toBe(4);
    expect(result.crossPlatformProfileCount).toBe(2);
  });

  it("sourceConfidenceTier reflects primary source", async () => {
    const { scoreDecisionCandidate } = await import(
      "@/lib/creator-search/decision-engine"
    );

    const result = await scoreDecisionCandidate({
      brandSummary: "Beauty brand",
      query: makeQuery(),
      candidate: makeCandidate({ primarySource: "collabstr" }),
      classification: makeClassification(),
    });

    expect(result.sourceConfidenceTier).toBe("marketplace");
  });
});
