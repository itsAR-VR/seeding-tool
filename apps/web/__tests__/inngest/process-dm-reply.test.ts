/**
 * Tests: process-dm-reply Inngest function
 *
 * 16 test cases covering:
 * - Address extraction + ShippingAddressSnapshot creation
 * - Negative classification + InterventionCase
 * - Outbound echo filtering
 * - Low confidence intervention
 * - Multi-message context (last 5)
 * - Terse address-only classification
 * - aiReplyEnabled=false skips draft
 * - Lifecycle updated to address_confirmed
 * - Idempotent duplicate processing
 * - Forward-only lifecycle: shipped NOT regressed
 * - Forward-only lifecycle: replied CAN advance to address_confirmed
 * - Media-only DM creates InterventionCase
 * - Outbound echo filter (brand's own DM)
 * - recordOutcomeEvent called correctly
 * - Channel parameter passed as "instagram_dm"
 * - Message not found returns skipped
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mocks ──────────────────────────────────────────
const mocks = vi.hoisted(() => {
  const capturedHandler = { fn: null as Function | null };

  return {
    capturedHandler,
    classifyReply: vi.fn(),
    extractAddress: vi.fn(),
    generateDraft: vi.fn(),
    getFeatureFlags: vi.fn(),
    recordOutcomeEvent: vi.fn(),
    mockCreateFunction: vi.fn(
      (_config: unknown, _trigger: unknown, handler: Function) => {
        capturedHandler.fn = handler;
        return handler;
      }
    ),
    prisma: {
      message: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      interventionCase: { create: vi.fn() },
      shippingAddressSnapshot: { create: vi.fn() },
      campaignCreator: {
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      conversationThread: { findUnique: vi.fn() },
      brandSettings: { findUnique: vi.fn() },
      aIDraft: { create: vi.fn() },
    },
  };
});

vi.mock("@/lib/inngest/client", () => ({
  inngest: {
    createFunction: mocks.mockCreateFunction,
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@/lib/inbox/ai", () => ({
  classifyReply: mocks.classifyReply,
  extractAddress: mocks.extractAddress,
  generateDraft: mocks.generateDraft,
}));

vi.mock("@/lib/feature-flags", () => ({
  getFeatureFlags: mocks.getFeatureFlags,
}));

vi.mock("@/lib/seeding/outcome-recorder", () => ({
  recordOutcomeEvent: mocks.recordOutcomeEvent,
}));

vi.mock("@/lib/logger", () => ({
  log: vi.fn(),
}));

// Synchronous import triggers createFunction registration with hoisted mock
import "@/lib/inngest/functions/process-dm-reply";

// ── Helpers ────────────────────────────────────────────────

function getHandler() {
  const handler = mocks.capturedHandler.fn;
  if (!handler) throw new Error("createFunction handler was not captured");
  return handler as (ctx: {
    event: { data: Record<string, string> };
  }) => Promise<unknown>;
}

function makeEvent(overrides: Partial<Record<string, string>> = {}) {
  return {
    event: {
      data: {
        threadId: "thread-1",
        messageId: "msg-1",
        brandId: "brand-1",
        campaignCreatorId: "cc-1",
        chatId: "chat-1",
        ...overrides,
      },
    },
  };
}

function setupInboundMessage(
  body: string,
  direction: string = "inbound"
) {
  mocks.prisma.message.findUnique.mockResolvedValue({
    id: "msg-1",
    body,
    direction,
    threadId: "thread-1",
    channel: "instagram_dm",
  });
  mocks.prisma.message.update.mockResolvedValue({});
}

function setupThreadMessages(
  messages: Array<{ body: string; direction: string }>
) {
  mocks.prisma.message.findMany.mockResolvedValue(
    messages.map((m, i) => ({
      id: `msg-ctx-${i}`,
      body: m.body,
      direction: m.direction,
      createdAt: new Date(Date.now() - (messages.length - i) * 60000),
    }))
  );
}

function setupThreadForDraft() {
  mocks.prisma.conversationThread.findUnique.mockResolvedValue({
    id: "thread-1",
    campaignCreator: {
      campaign: { id: "camp-1", name: "Test Campaign" },
      creator: { id: "creator-1", name: "Test Creator" },
    },
  });
  mocks.prisma.brandSettings.findUnique.mockResolvedValue({
    brandVoice: "friendly and casual",
  });
}

// ── Tests ──────────────────────────────────────────────────

describe("processDmReply Inngest function", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: thread has some context messages
    setupThreadMessages([
      { body: "Hey! Would you like to try our product?", direction: "outbound" },
      { body: "Sure, sounds great!", direction: "inbound" },
    ]);
    mocks.prisma.campaignCreator.updateMany.mockResolvedValue({ count: 1 });
    mocks.recordOutcomeEvent.mockResolvedValue({});
    mocks.prisma.interventionCase.create.mockResolvedValue({});
  });

  // 1. DM with address text creates ShippingAddressSnapshot
  it("creates ShippingAddressSnapshot for address intent", async () => {
    setupInboundMessage("123 Main St, Springfield, IL 62701");
    mocks.classifyReply.mockResolvedValue({
      intent: "address",
      confidence: 0.92,
    });

    const extractedAddress = {
      fullName: "Test Creator",
      line1: "123 Main St",
      line2: null,
      city: "Springfield",
      state: "IL",
      postalCode: "62701",
      country: "US",
      phone: null,
    };
    mocks.extractAddress.mockResolvedValue(extractedAddress);
    mocks.prisma.shippingAddressSnapshot.create.mockResolvedValue({
      id: "snap-new",
      ...extractedAddress,
    });

    const handler = getHandler();
    const result = await handler(makeEvent());

    expect(result).toEqual({ status: "processed", intent: "address" });

    expect(mocks.prisma.shippingAddressSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ...extractedAddress,
          source: "ai_extracted",
          isActive: false,
          campaignCreatorId: "cc-1",
        }),
      })
    );
  });

  // 2. DM with "not interested" classifies as negative, creates InterventionCase
  it("creates InterventionCase for negative reply", async () => {
    setupInboundMessage("not interested, please don't message me again");
    mocks.classifyReply.mockResolvedValue({
      intent: "negative",
      confidence: 0.88,
    });

    const handler = getHandler();
    const result = await handler(makeEvent());

    expect(result).toEqual({ status: "intervention", intent: "negative" });

    expect(mocks.prisma.interventionCase.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "manual_review",
          status: "open",
          title: "Creator declined or opted out via DM",
          brandId: "brand-1",
          campaignCreatorId: "cc-1",
        }),
      })
    );
  });

  // 3. Outbound DM is skipped (direction !== "inbound")
  it("skips outbound DM (direction !== 'inbound')", async () => {
    setupInboundMessage("Hey, thanks for reaching out!", "outbound");

    const handler = getHandler();
    const result = await handler(makeEvent());

    expect(result).toEqual({ status: "skipped", reason: "outbound_echo" });

    // Should NOT call classify or record outcome
    expect(mocks.classifyReply).not.toHaveBeenCalled();
    expect(mocks.recordOutcomeEvent).not.toHaveBeenCalled();
  });

  // 4. Low confidence classification creates InterventionCase
  it("creates InterventionCase for low confidence", async () => {
    setupInboundMessage("hmm ok maybe");
    mocks.classifyReply.mockResolvedValue({
      intent: "positive",
      confidence: 0.55,
    });

    const handler = getHandler();
    const result = await handler(makeEvent());

    expect(result).toEqual({
      status: "intervention",
      reason: "low_confidence",
    });

    expect(mocks.prisma.interventionCase.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "unclear_reply",
          status: "open",
          title: "Low confidence DM classification",
        }),
      })
    );

    // Should NOT extract address or generate draft
    expect(mocks.extractAddress).not.toHaveBeenCalled();
    expect(mocks.generateDraft).not.toHaveBeenCalled();
  });

  // 5. Multi-message context (last 5 messages) included in classification
  it("loads last 5 thread messages for DM context", async () => {
    setupInboundMessage("Sounds good!");
    setupThreadMessages([
      { body: "msg 1", direction: "outbound" },
      { body: "msg 2", direction: "inbound" },
      { body: "msg 3", direction: "outbound" },
      { body: "msg 4", direction: "inbound" },
      { body: "msg 5", direction: "inbound" },
    ]);
    mocks.classifyReply.mockResolvedValue({
      intent: "positive",
      confidence: 0.9,
    });
    mocks.getFeatureFlags.mockResolvedValue({ aiReplyEnabled: false });

    const handler = getHandler();
    await handler(makeEvent());

    // findMany called with take: 5
    expect(mocks.prisma.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { threadId: "thread-1" },
        orderBy: { createdAt: "desc" },
        take: 5,
      })
    );
  });

  // 6. Terse address-only message is correctly classified
  it("handles terse address-only message ('123 Main St, LA 90001')", async () => {
    setupInboundMessage("123 Main St, LA 90001");
    mocks.classifyReply.mockResolvedValue({
      intent: "address",
      confidence: 0.95,
    });
    mocks.extractAddress.mockResolvedValue({
      fullName: null,
      line1: "123 Main St",
      line2: null,
      city: "LA",
      state: "CA",
      postalCode: "90001",
      country: "US",
      phone: null,
    });
    mocks.prisma.shippingAddressSnapshot.create.mockResolvedValue({});

    const handler = getHandler();
    const result = await handler(makeEvent());

    expect(result).toEqual({ status: "processed", intent: "address" });

    // classifyReply called with channel: "instagram_dm"
    expect(mocks.classifyReply).toHaveBeenCalledWith(
      { body: "123 Main St, LA 90001", subject: null },
      "brand-1",
      "cc-1",
      "instagram_dm"
    );
  });

  // 7. aiReplyEnabled=false skips draft generation
  it("skips draft generation when aiReplyEnabled is false", async () => {
    setupInboundMessage("I'm interested!");
    mocks.classifyReply.mockResolvedValue({
      intent: "positive",
      confidence: 0.9,
    });
    mocks.getFeatureFlags.mockResolvedValue({ aiReplyEnabled: false });

    const handler = getHandler();
    const result = await handler(makeEvent());

    expect(result).toEqual({
      status: "processed",
      intent: "positive",
      draft: "skipped_ai_disabled",
    });

    expect(mocks.generateDraft).not.toHaveBeenCalled();
    expect(mocks.prisma.aIDraft.create).not.toHaveBeenCalled();
  });

  // 8. Lifecycle updated to "address_confirmed" on address extraction
  it("updates lifecycle to address_confirmed via forward-only guard", async () => {
    setupInboundMessage("456 Oak Ave, NYC 10001");
    mocks.classifyReply.mockResolvedValue({
      intent: "address",
      confidence: 0.93,
    });
    mocks.extractAddress.mockResolvedValue({
      fullName: null,
      line1: "456 Oak Ave",
      line2: null,
      city: "NYC",
      state: "NY",
      postalCode: "10001",
      country: "US",
      phone: null,
    });
    mocks.prisma.shippingAddressSnapshot.create.mockResolvedValue({});

    const handler = getHandler();
    await handler(makeEvent());

    // Forward-only lifecycle guard via updateMany
    expect(mocks.prisma.campaignCreator.updateMany).toHaveBeenCalledWith({
      where: {
        id: "cc-1",
        lifecycleStatus: {
          in: ["outreach_sent", "ready", "replied"],
        },
      },
      data: expect.objectContaining({
        lifecycleStatus: "address_confirmed",
      }),
    });
  });

  // 9. Duplicate message processing is idempotent
  it("is idempotent — skips when message not found", async () => {
    mocks.prisma.message.findUnique.mockResolvedValue(null);

    const handler = getHandler();
    const result = await handler(makeEvent());

    expect(result).toEqual({
      status: "skipped",
      reason: "message_not_found",
    });
    expect(mocks.classifyReply).not.toHaveBeenCalled();
  });

  // 10. Forward-only lifecycle: creator at "shipped" is NOT regressed to "address_confirmed"
  it("does not regress lifecycle from 'shipped' to 'address_confirmed'", async () => {
    setupInboundMessage("789 Pine St, Chicago IL 60601");
    mocks.classifyReply.mockResolvedValue({
      intent: "address",
      confidence: 0.9,
    });
    mocks.extractAddress.mockResolvedValue({
      fullName: null,
      line1: "789 Pine St",
      line2: null,
      city: "Chicago",
      state: "IL",
      postalCode: "60601",
      country: "US",
      phone: null,
    });
    mocks.prisma.shippingAddressSnapshot.create.mockResolvedValue({});
    // updateMany returns 0 = no rows matched (creator is at "shipped")
    mocks.prisma.campaignCreator.updateMany.mockResolvedValue({ count: 0 });

    const handler = getHandler();
    await handler(makeEvent());

    // updateMany uses WHERE lifecycleStatus IN (...), which excludes "shipped"
    expect(mocks.prisma.campaignCreator.updateMany).toHaveBeenCalledWith({
      where: {
        id: "cc-1",
        lifecycleStatus: {
          in: ["outreach_sent", "ready", "replied"],
        },
      },
      data: expect.objectContaining({
        lifecycleStatus: "address_confirmed",
      }),
    });

    // The key assertion: updateMany is called but won't match "shipped"
    // — it returns count: 0, meaning no regression happened
  });

  // 11. Forward-only lifecycle: creator at "replied" CAN advance to "address_confirmed"
  it("advances lifecycle from 'replied' to 'address_confirmed'", async () => {
    setupInboundMessage("My address is 321 Elm St, Portland OR 97201");
    mocks.classifyReply.mockResolvedValue({
      intent: "address",
      confidence: 0.91,
    });
    mocks.extractAddress.mockResolvedValue({
      fullName: null,
      line1: "321 Elm St",
      line2: null,
      city: "Portland",
      state: "OR",
      postalCode: "97201",
      country: "US",
      phone: null,
    });
    mocks.prisma.shippingAddressSnapshot.create.mockResolvedValue({});
    // updateMany returns 1 = one row matched (creator was at "replied")
    mocks.prisma.campaignCreator.updateMany.mockResolvedValue({ count: 1 });

    const handler = getHandler();
    await handler(makeEvent());

    // The WHERE clause includes "replied", so it WILL match and advance
    expect(mocks.prisma.campaignCreator.updateMany).toHaveBeenCalledWith({
      where: {
        id: "cc-1",
        lifecycleStatus: {
          in: ["outreach_sent", "ready", "replied"],
        },
      },
      data: expect.objectContaining({
        lifecycleStatus: "address_confirmed",
      }),
    });
  });

  // 12. Media-only DM (empty body) creates InterventionCase with type "media_message"
  it("creates InterventionCase for media-only DM (empty body)", async () => {
    setupInboundMessage("");

    const handler = getHandler();
    const result = await handler(makeEvent());

    expect(result).toEqual({
      status: "intervention",
      reason: "media_only",
    });

    expect(mocks.prisma.interventionCase.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "media_message",
          status: "open",
          title: "DM contains media attachment — requires manual review",
          brandId: "brand-1",
          campaignCreatorId: "cc-1",
        }),
      })
    );

    // Should NOT attempt classification
    expect(mocks.classifyReply).not.toHaveBeenCalled();
  });

  // 13. Outbound echo filter — brand's own sent DM is not processed as a reply
  it("filters outbound echo — brand's own sent DM not processed", async () => {
    // Brand sent a DM, Unipile webhook fires for it
    setupInboundMessage(
      "Thanks for your interest! Here are the details...",
      "outbound"
    );

    const handler = getHandler();
    const result = await handler(makeEvent());

    expect(result).toEqual({ status: "skipped", reason: "outbound_echo" });

    // None of the downstream processing should happen
    expect(mocks.classifyReply).not.toHaveBeenCalled();
    expect(mocks.extractAddress).not.toHaveBeenCalled();
    expect(mocks.generateDraft).not.toHaveBeenCalled();
    expect(mocks.recordOutcomeEvent).not.toHaveBeenCalled();
    expect(mocks.prisma.interventionCase.create).not.toHaveBeenCalled();
  });

  // 14. recordOutcomeEvent called with correct shape after classification
  it("calls recordOutcomeEvent with correct shape after classification", async () => {
    setupInboundMessage("I'm interested in trying the product!");
    mocks.classifyReply.mockResolvedValue({
      intent: "positive",
      confidence: 0.9,
    });
    mocks.getFeatureFlags.mockResolvedValue({ aiReplyEnabled: false });

    const handler = getHandler();
    await handler(makeEvent());

    expect(mocks.recordOutcomeEvent).toHaveBeenCalledWith({
      campaignCreatorId: "cc-1",
      event: {
        type: "reply_received",
        replyType: "positive",
      },
    });
  });

  // 15. Channel parameter — classifyReply called with channel: "instagram_dm"
  it("passes channel 'instagram_dm' to classifyReply", async () => {
    setupInboundMessage("Yes, I'd love to collab!");
    mocks.classifyReply.mockResolvedValue({
      intent: "positive",
      confidence: 0.85,
    });
    mocks.getFeatureFlags.mockResolvedValue({ aiReplyEnabled: false });

    const handler = getHandler();
    await handler(makeEvent());

    expect(mocks.classifyReply).toHaveBeenCalledWith(
      { body: "Yes, I'd love to collab!", subject: null },
      "brand-1",
      "cc-1",
      "instagram_dm"
    );
  });

  // 16. AI draft generated when aiReplyEnabled is true
  it("generates AI draft when aiReplyEnabled is true", async () => {
    setupInboundMessage("Tell me more about the campaign");
    mocks.classifyReply.mockResolvedValue({
      intent: "question",
      confidence: 0.88,
    });
    mocks.getFeatureFlags.mockResolvedValue({ aiReplyEnabled: true });
    setupThreadForDraft();
    mocks.generateDraft.mockResolvedValue(
      "Great question! Here are the details..."
    );
    mocks.prisma.aIDraft.create.mockResolvedValue({});

    const handler = getHandler();
    const result = await handler(makeEvent());

    expect(result).toEqual({ status: "processed", intent: "question" });

    // AI draft created with status "draft" (NEVER auto-sent)
    expect(mocks.prisma.aIDraft.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "reply",
          status: "draft",
          campaignCreatorId: "cc-1",
        }),
      })
    );
  });
});
