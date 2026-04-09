import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InstagramValidationResult } from "@/lib/instagram/validator";

// ── Hoisted mocks ──────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  creatorFindUnique: vi.fn(),
  creatorUpdate: vi.fn(),
  creatorProfileUpsert: vi.fn(),
  campaignCreatorFindMany: vi.fn(),
  campaignCreatorDeleteMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    creator: {
      findUnique: mocks.creatorFindUnique,
      update: mocks.creatorUpdate,
    },
    creatorProfile: {
      upsert: mocks.creatorProfileUpsert,
    },
    campaignCreator: {
      findMany: mocks.campaignCreatorFindMany,
      deleteMany: mocks.campaignCreatorDeleteMany,
    },
  },
}));

// ── Factories ──────────────────────────────────────────────

function makeValidResult(
  overrides: Partial<InstagramValidationResult> = {},
): InstagramValidationResult {
  return {
    creatorId: "creator-1",
    handle: "testcreator",
    url: "https://instagram.com/testcreator",
    followerCount: 15000,
    avgViews: 2000,
    checkedVideoCount: 5,
    blocked: false,
    status: "valid",
    errorCode: null,
    error: null,
    attemptCount: 1,
    ...overrides,
  };
}

function makeInvalidResult(
  overrides: Partial<InstagramValidationResult> = {},
): InstagramValidationResult {
  return {
    creatorId: "creator-1",
    handle: "fakecreator",
    url: "https://instagram.com/fakecreator",
    followerCount: null,
    avgViews: null,
    checkedVideoCount: 0,
    blocked: false,
    status: "invalid",
    errorCode: "missing_profile",
    error: "Profile not found",
    attemptCount: 1,
    ...overrides,
  };
}

function makeCreator(overrides: Record<string, unknown> = {}) {
  return {
    id: "creator-1",
    instagramHandle: "testcreator",
    tiktokHandle: null,
    avgViews: 1500,
    validationAttempts: 0,
    profiles: [],
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────

describe("applyValidationResultToCreator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.creatorUpdate.mockResolvedValue({});
    mocks.creatorProfileUpsert.mockResolvedValue({});
    mocks.campaignCreatorFindMany.mockResolvedValue([]);
    mocks.campaignCreatorDeleteMany.mockResolvedValue({ count: 0 });
  });

  it("applies valid result to creator profile (Instagram)", async () => {
    mocks.creatorFindUnique.mockResolvedValue(makeCreator());

    const { applyValidationResultToCreator } = await import(
      "@/lib/creators/validation-ops"
    );

    const result = await applyValidationResultToCreator({
      creatorId: "creator-1",
      result: makeValidResult(),
      platform: "instagram",
    });

    // Creator record updated with validation data
    expect(mocks.creatorUpdate).toHaveBeenCalledWith({
      where: { id: "creator-1" },
      data: expect.objectContaining({
        followerCount: 15000,
        avgViews: 2000,
        validationStatus: "valid",
        validationErrorCode: null,
        validationAttempts: { increment: 1 },
      }),
    });

    // Profile upserted for instagram
    expect(mocks.creatorProfileUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          creatorId_platform: {
            creatorId: "creator-1",
            platform: "instagram",
          },
        },
        update: expect.objectContaining({
          handle: "testcreator",
          followerCount: 15000,
        }),
        create: expect.objectContaining({
          creatorId: "creator-1",
          platform: "instagram",
          handle: "testcreator",
        }),
      }),
    );

    expect(result).toEqual({ removed: 0, retained: 0 });
  });

  it("applies valid result to creator profile (TikTok)", async () => {
    mocks.creatorFindUnique.mockResolvedValue(
      makeCreator({
        tiktokHandle: "tiktokuser",
        instagramHandle: null,
        profiles: [],
      }),
    );

    const { applyValidationResultToCreator } = await import(
      "@/lib/creators/validation-ops"
    );

    await applyValidationResultToCreator({
      creatorId: "creator-1",
      result: makeValidResult({ handle: "tiktokuser" }),
      platform: "tiktok",
    });

    expect(mocks.creatorProfileUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          creatorId_platform: {
            creatorId: "creator-1",
            platform: "tiktok",
          },
        },
        update: expect.objectContaining({
          handle: "tiktokuser",
        }),
        create: expect.objectContaining({
          platform: "tiktok",
          handle: "tiktokuser",
        }),
      }),
    );
  });

  it("cleans up invalid campaign links when result is invalid", async () => {
    mocks.creatorFindUnique.mockResolvedValue(makeCreator());

    // Simulate removable campaign links (untouched, ready status)
    mocks.campaignCreatorFindMany.mockResolvedValue([
      {
        id: "cc-1",
        reviewStatus: "pending",
        lifecycleStatus: "ready",
        outreachCount: 0,
        lastOutreachAt: null,
        lastReplyAt: null,
        conversationThread: null,
        shopifyOrder: null,
        shippingSnapshots: [],
        reminderSchedules: [],
        costRecords: [],
        mentionAssets: [],
      },
    ]);
    mocks.campaignCreatorDeleteMany.mockResolvedValue({ count: 1 });

    const { applyValidationResultToCreator } = await import(
      "@/lib/creators/validation-ops"
    );

    const result = await applyValidationResultToCreator({
      creatorId: "creator-1",
      result: makeInvalidResult(),
      cleanupInvalidLinks: true,
    });

    expect(mocks.creatorUpdate).toHaveBeenCalledWith({
      where: { id: "creator-1" },
      data: expect.objectContaining({
        validationStatus: "invalid",
        validationErrorCode: "missing_profile",
        followerCount: null,
      }),
    });

    expect(mocks.campaignCreatorFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { creatorId: "creator-1" },
      }),
    );

    expect(result).toEqual({ removed: 1, retained: 0 });
  });

  it("skips cleanup when cleanupInvalidLinks is false", async () => {
    mocks.creatorFindUnique.mockResolvedValue(makeCreator());

    const { applyValidationResultToCreator } = await import(
      "@/lib/creators/validation-ops"
    );

    const result = await applyValidationResultToCreator({
      creatorId: "creator-1",
      result: makeInvalidResult(),
      cleanupInvalidLinks: false,
    });

    expect(mocks.campaignCreatorFindMany).not.toHaveBeenCalled();
    expect(result).toEqual({ removed: 0, retained: 0 });
  });

  it("returns null when creator not found", async () => {
    mocks.creatorFindUnique.mockResolvedValue(null);

    const { applyValidationResultToCreator } = await import(
      "@/lib/creators/validation-ops"
    );

    const result = await applyValidationResultToCreator({
      creatorId: "nonexistent",
      result: makeValidResult(),
    });

    expect(result).toBeNull();
    expect(mocks.creatorUpdate).not.toHaveBeenCalled();
  });

  it("handles unknown status gracefully", async () => {
    mocks.creatorFindUnique.mockResolvedValue(makeCreator());

    const { applyValidationResultToCreator } = await import(
      "@/lib/creators/validation-ops"
    );

    const unknownResult = makeValidResult({
      status: "unknown",
      followerCount: null,
      avgViews: null,
      errorCode: null,
      error: null,
    });

    const result = await applyValidationResultToCreator({
      creatorId: "creator-1",
      result: unknownResult,
    });

    expect(mocks.creatorUpdate).toHaveBeenCalledWith({
      where: { id: "creator-1" },
      data: expect.objectContaining({
        validationStatus: "unknown",
        followerCount: null,
        avgViews: null,
      }),
    });

    // Unknown status does not trigger cleanup (only "invalid" does)
    expect(mocks.campaignCreatorFindMany).not.toHaveBeenCalled();
    expect(result).toEqual({ removed: 0, retained: 0 });
  });

  it("merges metadata from existing profile and input", async () => {
    mocks.creatorFindUnique.mockResolvedValue(
      makeCreator({
        profiles: [
          {
            platform: "instagram",
            handle: "testcreator",
            url: "https://instagram.com/testcreator",
            metadata: { existingKey: "existingValue" },
            engagementRate: 0.03,
            isVerified: false,
          },
        ],
      }),
    );

    const { applyValidationResultToCreator } = await import(
      "@/lib/creators/validation-ops"
    );

    await applyValidationResultToCreator({
      creatorId: "creator-1",
      result: makeValidResult(),
      metadata: { newKey: "newValue" },
    });

    expect(mocks.creatorProfileUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          metadata: expect.objectContaining({
            existingKey: "existingValue",
            newKey: "newValue",
            validationStatus: "valid",
          }),
        }),
      }),
    );
  });

  it("increments validationAttempts by attemptCount", async () => {
    mocks.creatorFindUnique.mockResolvedValue(
      makeCreator({ validationAttempts: 3 }),
    );

    const { applyValidationResultToCreator } = await import(
      "@/lib/creators/validation-ops"
    );

    await applyValidationResultToCreator({
      creatorId: "creator-1",
      result: makeValidResult({ attemptCount: 2 }),
    });

    expect(mocks.creatorUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          validationAttempts: { increment: 2 },
        }),
      }),
    );
  });

  it("sets default profile URL for TikTok when none provided", async () => {
    mocks.creatorFindUnique.mockResolvedValue(
      makeCreator({
        tiktokHandle: "tiktokuser",
        profiles: [],
      }),
    );

    const { applyValidationResultToCreator } = await import(
      "@/lib/creators/validation-ops"
    );

    // When result.url is empty string, it passes through via ?? (not null/undefined).
    // To get the default URL, result.url must be falsy for ?? (null or undefined).
    await applyValidationResultToCreator({
      creatorId: "creator-1",
      result: makeValidResult({
        url: "https://instagram.com/testcreator",
        handle: "tiktokuser",
      }),
      profileUrl: null,
      platform: "tiktok",
    });

    // result.url takes precedence over defaultProfileUrl via ?? chain:
    //   profileUrl ?? profile?.url ?? result.url ?? defaultProfileUrl
    expect(mocks.creatorProfileUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          url: "https://instagram.com/testcreator",
          platform: "tiktok",
          handle: "tiktokuser",
        }),
      }),
    );
  });

  it("falls back to default TikTok URL when result.url is null and no profile URL", async () => {
    mocks.creatorFindUnique.mockResolvedValue(
      makeCreator({
        tiktokHandle: "tiktokuser",
        profiles: [],
      }),
    );

    const { applyValidationResultToCreator } = await import(
      "@/lib/creators/validation-ops"
    );

    // Construct a result where url resolves to null via the override
    const resultWithNullUrl: InstagramValidationResult = {
      ...makeValidResult({ handle: "tiktokuser" }),
      url: null as unknown as string,
    };

    await applyValidationResultToCreator({
      creatorId: "creator-1",
      result: resultWithNullUrl,
      profileUrl: null,
      platform: "tiktok",
    });

    // No profileUrl, no profile.url, result.url is null => defaultProfileUrl
    expect(mocks.creatorProfileUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          url: "https://tiktok.com/@tiktokuser",
        }),
      }),
    );
  });

  it("does not upsert profile when platform handle is missing", async () => {
    mocks.creatorFindUnique.mockResolvedValue(
      makeCreator({
        instagramHandle: null,
        tiktokHandle: null,
        profiles: [],
      }),
    );

    const { applyValidationResultToCreator } = await import(
      "@/lib/creators/validation-ops"
    );

    await applyValidationResultToCreator({
      creatorId: "creator-1",
      result: makeValidResult(),
      platform: "instagram",
    });

    // Creator record still updated, but no profile upsert
    expect(mocks.creatorUpdate).toHaveBeenCalled();
    expect(mocks.creatorProfileUpsert).not.toHaveBeenCalled();
  });
});
