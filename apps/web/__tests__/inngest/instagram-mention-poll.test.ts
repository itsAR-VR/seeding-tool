import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mocks ──────────────────────────────────────────
const mocks = vi.hoisted(() => {
  const capturedHandler = { fn: null as Function | null };

  return {
    capturedHandler,
    // Prisma mocks
    mentionAssetFindUnique: vi.fn(),
    mentionAssetCreate: vi.fn(),
    campaignCreatorFindMany: vi.fn(),
    providerCredentialFindMany: vi.fn(),
    providerCredentialUpdate: vi.fn(),
    brandConnectionUpdateMany: vi.fn(),
    reminderScheduleUpdateMany: vi.fn(),
    campaignCreatorFindUnique: vi.fn(),
    campaignCreatorUpdate: vi.fn(),
    campaignOutcomeUpsert: vi.fn(),
    // Instagram client mocks
    getTaggedMedia: vi.fn(),
    fetchNextPage: vi.fn(),
    // Attribution mock
    createAndAttributeMention: vi.fn(),
    // Feature flags mock
    getFeatureFlags: vi.fn(),
    // Inngest mocks
    inngestSend: vi.fn(),
    mockCreateFunction: vi.fn(
      (_config: unknown, _trigger: unknown, handler: Function) => {
        capturedHandler.fn = handler;
        return handler;
      }
    ),
    // Decrypt mock
    decrypt: vi.fn(),
  };
});

vi.mock("@/lib/inngest/client", () => ({
  inngest: {
    createFunction: mocks.mockCreateFunction,
    send: mocks.inngestSend,
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    providerCredential: {
      findMany: mocks.providerCredentialFindMany,
      update: mocks.providerCredentialUpdate,
    },
    mentionAsset: {
      findUnique: mocks.mentionAssetFindUnique,
      create: mocks.mentionAssetCreate,
    },
    campaignCreator: {
      findMany: mocks.campaignCreatorFindMany,
      findUnique: mocks.campaignCreatorFindUnique,
      update: mocks.campaignCreatorUpdate,
    },
    campaignOutcome: {
      upsert: mocks.campaignOutcomeUpsert,
    },
    brandConnection: {
      updateMany: mocks.brandConnectionUpdateMany,
    },
    reminderSchedule: {
      updateMany: mocks.reminderScheduleUpdateMany,
    },
  },
}));

vi.mock("@/lib/encryption", () => ({
  decrypt: mocks.decrypt,
}));

vi.mock("@/lib/instagram/client", () => ({
  getTaggedMedia: mocks.getTaggedMedia,
  fetchNextPage: mocks.fetchNextPage,
  InstagramApiError: class InstagramApiError extends Error {
    code: number;
    type: string;
    statusCode: number;
    errorSubcode?: number;
    constructor(
      message: string,
      code: number,
      type: string,
      statusCode: number,
      errorSubcode?: number
    ) {
      super(message);
      this.name = "InstagramApiError";
      this.code = code;
      this.type = type;
      this.statusCode = statusCode;
      this.errorSubcode = errorSubcode;
    }
    get isRateLimited() {
      return this.code === 4 || this.code === 32 || this.statusCode === 429;
    }
    get isAuthError() {
      return this.code === 190 || this.statusCode === 401;
    }
  },
}));

vi.mock("@/lib/mentions/attribution", () => ({
  createAndAttributeMention: mocks.createAndAttributeMention,
}));

vi.mock("@/lib/feature-flags", () => ({
  getFeatureFlags: mocks.getFeatureFlags,
}));

// Synchronous import triggers createFunction registration with hoisted mock
import "@/lib/inngest/functions/instagram-mention-poll";

// ── Helpers ────────────────────────────────────────────────

function getHandler() {
  const handler = mocks.capturedHandler.fn;
  if (!handler) throw new Error("createFunction handler was not captured");
  return handler as (ctx: { step: StepMock }) => Promise<unknown>;
}

type StepMock = {
  run: (name: string, fn: () => Promise<unknown>) => Promise<unknown>;
};

function makeStepMock(): StepMock {
  return {
    run: async (_name: string, fn: () => Promise<unknown>) => fn(),
  };
}

/**
 * Returns raw Prisma shape matching the include { brand: { include: { connections } } } query.
 * The step.run callback maps this to the serialized credential shape.
 */
function makeRawCredential(overrides: Record<string, unknown> = {}) {
  return {
    id: "cred-1",
    brandId: "brand-1",
    encryptedValue: "encrypted-value",
    expiresAt: null,
    brand: {
      connections: [
        {
          metadata: { igUserId: "ig-123", igUsername: "testbrand" },
        },
      ],
    },
    ...overrides,
  };
}

function makeMedia(overrides: Record<string, unknown> = {}) {
  return {
    id: "media-1",
    permalink: "https://instagram.com/p/abc123",
    caption: "Check out @creator1!",
    media_type: "IMAGE",
    timestamp: "2026-04-08T12:00:00Z",
    like_count: 100,
    comments_count: 10,
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────

describe("instagramMentionPoll", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.decrypt.mockReturnValue(
      JSON.stringify({ accessToken: "tok-123", igUserId: "ig-123" })
    );
    mocks.getFeatureFlags.mockResolvedValue({
      instagramMentionPollEnabled: true,
    });
    mocks.inngestSend.mockResolvedValue(undefined);
  });

  it("follows paging.next up to 5 pages", async () => {
    // Setup credential
    mocks.providerCredentialFindMany.mockResolvedValue([
      makeRawCredential(),
    ]);

    // Page 1 has media + paging.next
    const page1Media = makeMedia({ permalink: "https://instagram.com/p/page1" });
    const page2Media = makeMedia({ permalink: "https://instagram.com/p/page2" });
    const page3Media = makeMedia({ permalink: "https://instagram.com/p/page3" });
    const page4Media = makeMedia({ permalink: "https://instagram.com/p/page4" });
    const page5Media = makeMedia({ permalink: "https://instagram.com/p/page5" });

    mocks.getTaggedMedia.mockResolvedValue({
      data: [page1Media],
      paging: { next: "https://graph.instagram.com/page2" },
    });

    // Pages 2-4 each return a media item + next
    mocks.fetchNextPage
      .mockResolvedValueOnce({
        data: [page2Media],
        paging: { next: "https://graph.instagram.com/page3" },
      })
      .mockResolvedValueOnce({
        data: [page3Media],
        paging: { next: "https://graph.instagram.com/page4" },
      })
      .mockResolvedValueOnce({
        data: [page4Media],
        paging: { next: "https://graph.instagram.com/page5" },
      })
      .mockResolvedValueOnce({
        data: [page5Media],
        paging: { next: "https://graph.instagram.com/page6" },
      });

    // Nothing existing
    mocks.mentionAssetFindUnique.mockResolvedValue(null);

    // Single candidate
    mocks.campaignCreatorFindMany.mockResolvedValue([
      {
        id: "cc-1",
        createdAt: new Date(),
        creator: { id: "cr-1", instagramHandle: "creator1", name: "Creator" },
      },
    ]);

    mocks.createAndAttributeMention.mockResolvedValue("mention-1");

    const handler = getHandler();
    const result = (await handler({ step: makeStepMock() })) as {
      results: Array<{ pagesFetched: number; newMentions: number }>;
    };

    // Should have fetched 5 pages total (1 initial + 4 fetchNextPage)
    expect(mocks.fetchNextPage).toHaveBeenCalledTimes(4);
    expect(result.results[0].pagesFetched).toBe(5);
    expect(result.results[0].newMentions).toBe(5);
  });

  it("stops pagination on previously-seen mediaUrl (dedup)", async () => {
    mocks.providerCredentialFindMany.mockResolvedValue([
      makeRawCredential(),
    ]);

    const newMedia = makeMedia({ permalink: "https://instagram.com/p/new" });
    const seenMedia = makeMedia({ permalink: "https://instagram.com/p/seen" });

    mocks.getTaggedMedia.mockResolvedValue({
      data: [newMedia],
      paging: { next: "https://graph.instagram.com/page2" },
    });

    mocks.fetchNextPage.mockResolvedValueOnce({
      data: [seenMedia],
      paging: { next: "https://graph.instagram.com/page3" },
    });

    // First call: new media not found. Second call: seen media found (existing).
    mocks.mentionAssetFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "existing-mention" });

    mocks.campaignCreatorFindMany.mockResolvedValue([
      {
        id: "cc-1",
        createdAt: new Date(),
        creator: { id: "cr-1", instagramHandle: "creator1", name: "Creator" },
      },
    ]);

    mocks.createAndAttributeMention.mockResolvedValue("mention-1");

    const handler = getHandler();
    const result = (await handler({ step: makeStepMock() })) as {
      results: Array<{ pagesFetched: number; newMentions: number }>;
    };

    // Should have stopped after page 2 where seen media was found
    expect(result.results[0].pagesFetched).toBe(2);
    expect(result.results[0].newMentions).toBe(1);
    // Should NOT have fetched a third page
    expect(mocks.fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it("skips brand when feature flag is disabled", async () => {
    mocks.providerCredentialFindMany.mockResolvedValue([
      makeRawCredential(),
    ]);

    mocks.getFeatureFlags.mockResolvedValue({
      instagramMentionPollEnabled: false,
    });

    const handler = getHandler();
    const result = (await handler({ step: makeStepMock() })) as {
      results: Array<{ newMentions: number; skipped?: string }>;
    };

    expect(result.results[0].newMentions).toBe(0);
    expect(result.results[0]).toHaveProperty("skipped", "feature_disabled");
    expect(mocks.getTaggedMedia).not.toHaveBeenCalled();
  });

  it("does not include 'reminded' in lifecycle filter", async () => {
    mocks.providerCredentialFindMany.mockResolvedValue([
      makeRawCredential(),
    ]);

    mocks.getTaggedMedia.mockResolvedValue({
      data: [makeMedia()],
      paging: {},
    });

    mocks.mentionAssetFindUnique.mockResolvedValue(null);
    mocks.campaignCreatorFindMany.mockResolvedValue([
      {
        id: "cc-1",
        createdAt: new Date(),
        creator: { id: "cr-1", instagramHandle: "creator1", name: "Creator" },
      },
    ]);
    mocks.createAndAttributeMention.mockResolvedValue("mention-1");

    const handler = getHandler();
    await handler({ step: makeStepMock() });

    // Verify findMany was called with only shipped and delivered (no "reminded")
    expect(mocks.campaignCreatorFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          lifecycleStatus: {
            in: ["shipped", "delivered"],
          },
        }),
      })
    );
  });

  it("sets attributionConfidence to 'low' when multiple candidates and no handle match", async () => {
    mocks.providerCredentialFindMany.mockResolvedValue([
      makeRawCredential(),
    ]);

    const media = makeMedia({
      caption: "Love this product!", // No @handle in caption
    });

    mocks.getTaggedMedia.mockResolvedValue({
      data: [media],
      paging: {},
    });

    mocks.mentionAssetFindUnique.mockResolvedValue(null);

    // Multiple candidates, none matching handle in caption
    mocks.campaignCreatorFindMany.mockResolvedValue([
      {
        id: "cc-1",
        createdAt: new Date("2026-04-08"),
        creator: { id: "cr-1", instagramHandle: "creator1", name: "Creator 1" },
      },
      {
        id: "cc-2",
        createdAt: new Date("2026-04-07"),
        creator: { id: "cr-2", instagramHandle: "creator2", name: "Creator 2" },
      },
    ]);

    mocks.createAndAttributeMention.mockResolvedValue("mention-1");

    const handler = getHandler();
    await handler({ step: makeStepMock() });

    // Should have been called with attributionConfidence: "low"
    expect(mocks.createAndAttributeMention).toHaveBeenCalledWith(
      expect.objectContaining({
        campaignCreatorId: "cc-1",
        attributionConfidence: "low",
      })
    );
  });

  it("sets attributionConfidence to 'high' when handle matches caption", async () => {
    mocks.providerCredentialFindMany.mockResolvedValue([
      makeRawCredential(),
    ]);

    const media = makeMedia({
      caption: "Thanks @creator2 for the amazing product!",
    });

    mocks.getTaggedMedia.mockResolvedValue({
      data: [media],
      paging: {},
    });

    mocks.mentionAssetFindUnique.mockResolvedValue(null);

    // Multiple candidates, one matching handle in caption
    mocks.campaignCreatorFindMany.mockResolvedValue([
      {
        id: "cc-1",
        createdAt: new Date("2026-04-08"),
        creator: { id: "cr-1", instagramHandle: "creator1", name: "Creator 1" },
      },
      {
        id: "cc-2",
        createdAt: new Date("2026-04-07"),
        creator: { id: "cr-2", instagramHandle: "creator2", name: "Creator 2" },
      },
    ]);

    mocks.createAndAttributeMention.mockResolvedValue("mention-2");

    const handler = getHandler();
    await handler({ step: makeStepMock() });

    // Should match cc-2 via handle and set high confidence
    expect(mocks.createAndAttributeMention).toHaveBeenCalledWith(
      expect.objectContaining({
        campaignCreatorId: "cc-2",
        attributionConfidence: "high",
      })
    );
  });

  it("emits mention/attributed event after attribution", async () => {
    mocks.providerCredentialFindMany.mockResolvedValue([
      makeRawCredential(),
    ]);

    mocks.getTaggedMedia.mockResolvedValue({
      data: [makeMedia()],
      paging: {},
    });

    mocks.mentionAssetFindUnique.mockResolvedValue(null);
    mocks.campaignCreatorFindMany.mockResolvedValue([
      {
        id: "cc-1",
        createdAt: new Date(),
        creator: { id: "cr-1", instagramHandle: "creator1", name: "Creator" },
      },
    ]);
    mocks.createAndAttributeMention.mockResolvedValue("mention-1");

    const handler = getHandler();
    await handler({ step: makeStepMock() });

    // Should have sent mention/attributed event
    expect(mocks.inngestSend).toHaveBeenCalledWith({
      name: "mention/attributed",
      data: {
        mentionAssetId: "mention-1",
        campaignCreatorId: "cc-1",
        attributionConfidence: "high",
      },
    });
  });

  it("marks credential invalid and connection as error on auth error", async () => {
    mocks.providerCredentialFindMany.mockResolvedValue([
      makeRawCredential(),
    ]);

    // Import the real InstagramApiError to use in the mock
    const { InstagramApiError } = await import("@/lib/instagram/client");
    const authError = new InstagramApiError(
      "Token expired",
      190,
      "OAuthException",
      401
    );

    mocks.getFeatureFlags.mockResolvedValue({
      instagramMentionPollEnabled: true,
    });
    mocks.getTaggedMedia.mockRejectedValue(authError);
    mocks.providerCredentialUpdate.mockResolvedValue({});
    mocks.brandConnectionUpdateMany.mockResolvedValue({});

    const handler = getHandler();
    const result = (await handler({ step: makeStepMock() })) as {
      results: Array<{ error?: string }>;
    };

    expect(result.results[0].error).toContain("Token expired");

    // Credential marked invalid
    expect(mocks.providerCredentialUpdate).toHaveBeenCalledWith({
      where: { id: "cred-1" },
      data: { isValid: false },
    });

    // Connection set to error
    expect(mocks.brandConnectionUpdateMany).toHaveBeenCalledWith({
      where: {
        brandId: "brand-1",
        provider: "instagram",
      },
      data: { status: "error" },
    });
  });

  it("end-to-end: tagged media detected -> MentionAsset created -> attribution event emitted", async () => {
    mocks.providerCredentialFindMany.mockResolvedValue([
      makeRawCredential(),
    ]);

    const media = makeMedia({
      permalink: "https://instagram.com/p/e2e",
      caption: "Product review @creator1",
      media_type: "VIDEO",
      like_count: 500,
      comments_count: 50,
      timestamp: "2026-04-08T10:00:00Z",
    });

    mocks.getTaggedMedia.mockResolvedValue({
      data: [media],
      paging: {},
    });

    mocks.mentionAssetFindUnique.mockResolvedValue(null);
    mocks.campaignCreatorFindMany.mockResolvedValue([
      {
        id: "cc-1",
        createdAt: new Date(),
        creator: { id: "cr-1", instagramHandle: "creator1", name: "Creator" },
      },
    ]);

    mocks.createAndAttributeMention.mockResolvedValue("mention-e2e");

    const handler = getHandler();
    const result = (await handler({ step: makeStepMock() })) as {
      totalNewMentions: number;
      results: Array<{ newMentions: number }>;
    };

    // Verify createAndAttributeMention was called with correct data
    expect(mocks.createAndAttributeMention).toHaveBeenCalledWith({
      platform: "instagram",
      mediaUrl: "https://instagram.com/p/e2e",
      type: "reel", // VIDEO -> reel
      caption: "Product review @creator1",
      likes: 500,
      comments: 50,
      postedAt: new Date("2026-04-08T10:00:00Z"),
      campaignCreatorId: "cc-1",
      attributionConfidence: "high",
    });

    // Verify mention/media.archive event dispatched
    expect(mocks.inngestSend).toHaveBeenCalledWith({
      name: "mention/media.archive",
      data: { mentionAssetId: "mention-e2e" },
    });

    // Verify mention/attributed event dispatched
    expect(mocks.inngestSend).toHaveBeenCalledWith({
      name: "mention/attributed",
      data: {
        mentionAssetId: "mention-e2e",
        campaignCreatorId: "cc-1",
        attributionConfidence: "high",
      },
    });

    expect(result.totalNewMentions).toBe(1);
    expect(result.results[0].newMentions).toBe(1);
  });
});
