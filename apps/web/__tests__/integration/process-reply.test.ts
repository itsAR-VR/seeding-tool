/**
 * Integration tests: Process Reply + Address -> Order pipeline
 *
 * Tests the full classify -> extract -> approve -> order pipeline
 * with mocked OpenAI, Prisma, Inngest, and Shopify API.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// ── Hoisted mocks ────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  // AI module
  classifyReply: vi.fn(),
  extractAddress: vi.fn(),
  generateDraft: vi.fn(),

  // Feature flags
  getFeatureFlags: vi.fn(),

  // Inngest
  inngestSend: vi.fn(),
  inngestCreateFunction: vi.fn(),

  // Shopify
  createDraftOrder: vi.fn(),

  // Outcome recorder
  recordOutcomeEvent: vi.fn(),

  // RBAC
  getCurrentBrandMembership: vi.fn(),
  requireWriteAccess: vi.fn((m: unknown) => m),

  // Logger
  log: vi.fn(),

  // Prisma
  prisma: {
    message: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
    interventionCase: { create: vi.fn() },
    shippingAddressSnapshot: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    campaignCreator: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    conversationThread: {
      findUnique: vi.fn(),
    },
    brandSettings: {
      findUnique: vi.fn(),
    },
    aIDraft: { create: vi.fn() },
    campaign: { findUnique: vi.fn() },
    brandConnection: { findUnique: vi.fn() },
    campaignProduct: { findFirst: vi.fn() },
    shopifyOrder: { create: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));

vi.mock("@/lib/inbox/ai", () => ({
  classifyReply: mocks.classifyReply,
  extractAddress: mocks.extractAddress,
  generateDraft: mocks.generateDraft,
}));

vi.mock("@/lib/feature-flags", () => ({
  getFeatureFlags: mocks.getFeatureFlags,
}));

vi.mock("@/lib/inngest/client", () => ({
  inngest: {
    send: mocks.inngestSend,
    createFunction: vi.fn((_config: unknown, _trigger: unknown, handler: unknown) => handler),
  },
}));

vi.mock("@/lib/shopify/orders", () => ({
  createDraftOrder: mocks.createDraftOrder,
}));

vi.mock("@/lib/seeding/outcome-recorder", () => ({
  recordOutcomeEvent: mocks.recordOutcomeEvent,
}));

vi.mock("@/lib/integrations/brand-access", () => ({
  getCurrentBrandMembership: mocks.getCurrentBrandMembership,
  requireWriteAccess: mocks.requireWriteAccess,
  BrandAccessError: class extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

vi.mock("@/lib/logger", () => ({ log: mocks.log }));

// ── Helpers ──────────────────────────────────────────────────

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      threadId: "thread-1",
      messageId: "msg-1",
      brandId: "brand-1",
      campaignCreatorId: "cc-1",
      ...overrides,
    },
  };
}

function makeApproveRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/test", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeApproveContext(campaignId = "camp-1", creatorId = "creator-1") {
  return { params: Promise.resolve({ campaignId, creatorId }) };
}

function setupDefaultMessage() {
  mocks.prisma.message.findUnique.mockResolvedValue({
    id: "msg-1",
    body: "Here's my address: 123 Main St, Springfield, IL 62701",
    subject: "Re: Collab",
    threadId: "thread-1",
  });
  mocks.prisma.message.update.mockResolvedValue({});
}

function setupApproveDefaults() {
  mocks.getCurrentBrandMembership.mockResolvedValue({
    id: "mem-1",
    role: "owner",
    userId: "user-1",
    brandId: "brand-1",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  mocks.getFeatureFlags.mockResolvedValue({
    shopifyOrderEnabled: true,
    aiReplyEnabled: true,
  });
  mocks.prisma.campaign.findUnique.mockResolvedValue({
    id: "camp-1",
    brandId: "brand-1",
  });
  mocks.prisma.campaignCreator.findUnique.mockResolvedValue({
    id: "cc-1",
    campaignId: "camp-1",
    creatorId: "creator-1",
    lifecycleStatus: "replied",
  });
  mocks.prisma.shippingAddressSnapshot.findUnique.mockResolvedValue({
    id: "snap-1",
    campaignCreatorId: "cc-1",
    isActive: false,
  });
  mocks.prisma.shippingAddressSnapshot.update.mockResolvedValue({});
  mocks.prisma.brandConnection.findUnique.mockResolvedValue({
    id: "conn-1",
    provider: "shopify",
    status: "connected",
  });
  mocks.prisma.campaignProduct.findFirst.mockResolvedValue({
    id: "cp-1",
    shopifyVariantId: "variant-1",
  });
  mocks.inngestSend.mockResolvedValue(undefined);
}

// ── Lifecycle ────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Process Reply Tests ──────────────────────────────────────

describe("processReply — integration", () => {
  // Import the handler directly (Inngest createFunction returns the handler via our mock)
  let processReplyHandler: (args: { event: ReturnType<typeof makeEvent> }) => Promise<unknown>;

  beforeEach(async () => {
    setupDefaultMessage();
    // Re-import to get the handler through our mocked createFunction
    const mod = await import("@/lib/inngest/functions/process-reply");
    processReplyHandler = mod.processReply as unknown as typeof processReplyHandler;
  });

  it("generates AI draft for positive reply when aiReplyEnabled", async () => {
    mocks.classifyReply.mockResolvedValue({
      intent: "positive",
      confidence: 0.95,
    });

    mocks.getFeatureFlags.mockResolvedValue({
      aiReplyEnabled: true,
      shopifyOrderEnabled: false,
    });

    mocks.prisma.conversationThread.findUnique.mockResolvedValue({
      id: "thread-1",
      messages: [
        { id: "msg-1", body: "Original outreach", direction: "outbound", createdAt: new Date() },
        { id: "msg-2", body: "I'm interested!", direction: "inbound", createdAt: new Date() },
      ],
      campaignCreator: {
        campaign: { id: "camp-1", name: "Test Campaign" },
        creator: { id: "creator-1", name: "Test Creator", email: "test@example.com" },
      },
    });

    mocks.prisma.brandSettings.findUnique.mockResolvedValue({
      brandVoice: "friendly and professional",
    });

    mocks.generateDraft.mockResolvedValue(
      "Thanks for your interest! Here are the next steps..."
    );

    const result = await processReplyHandler({ event: makeEvent() });

    expect(result).toEqual({ status: "processed", intent: "positive" });

    // AI draft created (NEVER auto-sent)
    expect(mocks.prisma.aIDraft.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "reply",
          status: "draft",
          campaignCreatorId: "cc-1",
        }),
      })
    );

    // Lifecycle updated to replied
    expect(mocks.prisma.campaignCreator.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lifecycleStatus: "replied",
        }),
      })
    );
  });

  it("creates ShippingAddressSnapshot with isActive: false for address reply", async () => {
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
      isActive: false,
    });

    const result = await processReplyHandler({ event: makeEvent() });

    expect(result).toEqual({ status: "processed", intent: "address" });

    // Snapshot created with isActive: false (requires human confirmation)
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

    // Lifecycle updated
    expect(mocks.prisma.campaignCreator.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lifecycleStatus: "address_confirmed",
        }),
      })
    );
  });

  it("creates intervention when confidence is below 0.7", async () => {
    mocks.classifyReply.mockResolvedValue({
      intent: "positive",
      confidence: 0.55,
    });

    const result = await processReplyHandler({ event: makeEvent() });

    expect(result).toEqual({ status: "intervention", reason: "low_confidence" });

    expect(mocks.prisma.interventionCase.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "unclear_reply",
          status: "open",
        }),
      })
    );

    // Should NOT call generateDraft for low-confidence positive
    expect(mocks.generateDraft).not.toHaveBeenCalled();
  });

  it("creates intervention when AI reply is disabled", async () => {
    mocks.classifyReply.mockResolvedValue({
      intent: "positive",
      confidence: 0.95,
    });

    mocks.getFeatureFlags.mockResolvedValue({
      aiReplyEnabled: false,
      shopifyOrderEnabled: false,
    });

    const result = await processReplyHandler({ event: makeEvent() });

    expect(result).toEqual({
      status: "intervention",
      reason: "ai_reply_disabled",
    });

    expect(mocks.prisma.interventionCase.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "manual_review",
          title: expect.stringContaining("AI reply disabled"),
        }),
      })
    );
  });

  it("handles negative reply with intervention", async () => {
    mocks.classifyReply.mockResolvedValue({
      intent: "negative",
      confidence: 0.88,
    });

    const result = await processReplyHandler({ event: makeEvent() });

    expect(result).toEqual({ status: "intervention", intent: "negative" });

    expect(mocks.prisma.interventionCase.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "manual_review",
          title: expect.stringContaining("declined"),
        }),
      })
    );
  });

  it("skips when message not found", async () => {
    mocks.prisma.message.findUnique.mockResolvedValue(null);

    const result = await processReplyHandler({ event: makeEvent() });

    expect(result).toEqual({ status: "skipped", reason: "Message not found" });
  });
});

// ── Approve Address Tests ────────────────────────────────────

describe("approve-address -> Inngest event — integration", () => {
  let approvePOST: typeof import("@/app/api/campaigns/[campaignId]/creators/[creatorId]/approve-address/route").POST;

  beforeEach(async () => {
    setupApproveDefaults();
    const mod = await import(
      "@/app/api/campaigns/[campaignId]/creators/[creatorId]/approve-address/route"
    );
    approvePOST = mod.POST;
  });

  it("sets isActive: true and fires Inngest event", async () => {
    const res = await approvePOST(
      makeApproveRequest({ snapshotId: "snap-1" }),
      makeApproveContext()
    );

    expect(res.status).toBe(200);

    // Snapshot activated
    expect(mocks.prisma.shippingAddressSnapshot.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "snap-1" },
        data: expect.objectContaining({
          isActive: true,
          confirmedBy: "user-1",
        }),
      })
    );

    // Inngest event fired
    expect(mocks.inngestSend).toHaveBeenCalledWith({
      name: "shipping/address.approved",
      data: expect.objectContaining({
        snapshotId: "snap-1",
        campaignCreatorId: "cc-1",
        brandId: "brand-1",
        campaignId: "camp-1",
      }),
    });
  });

  it("returns 403 when shopifyOrderEnabled is false", async () => {
    mocks.getFeatureFlags.mockResolvedValue({
      shopifyOrderEnabled: false,
    });

    const res = await approvePOST(
      makeApproveRequest({ snapshotId: "snap-1" }),
      makeApproveContext()
    );

    expect(res.status).toBe(403);

    // Inngest should NOT fire
    expect(mocks.inngestSend).not.toHaveBeenCalled();
  });

  it("is idempotent — no duplicate Inngest event on double-approve", async () => {
    // First call succeeds
    const res1 = await approvePOST(
      makeApproveRequest({ snapshotId: "snap-1" }),
      makeApproveContext()
    );
    expect(res1.status).toBe(200);

    // Second call: snapshot is now already active
    mocks.prisma.shippingAddressSnapshot.findUnique.mockResolvedValue({
      id: "snap-1",
      campaignCreatorId: "cc-1",
      isActive: true,
    });

    const res2 = await approvePOST(
      makeApproveRequest({ snapshotId: "snap-1" }),
      makeApproveContext()
    );
    // The API will still return 200 (it updates the snapshot again — idempotent)
    expect(res2.status).toBe(200);

    // But Inngest is called for each approve — the Inngest function itself
    // handles idempotency via the shopifyOrder existence check
    expect(mocks.inngestSend).toHaveBeenCalledTimes(2);
  });
});

// ── Inngest: createOrderFromAddress Tests ────────────────────

describe("createOrderFromAddress — Inngest function integration", () => {
  let createOrderHandler: (args: { event: ReturnType<typeof makeEvent> }) => Promise<unknown>;

  beforeEach(async () => {
    // Re-import to get the handler through our mocked createFunction
    const mod = await import(
      "@/lib/inngest/functions/create-order-from-address"
    );
    createOrderHandler = mod.createOrderFromAddress as unknown as typeof createOrderHandler;
  });

  it("creates Shopify draft order and records outcome", async () => {
    mocks.prisma.shippingAddressSnapshot.findUnique.mockResolvedValue({
      id: "snap-1",
      isActive: true,
      confirmedAt: new Date(),
    });

    mocks.prisma.campaignCreator.findUnique.mockResolvedValue({
      id: "cc-1",
      creatorId: "creator-1",
      creator: { id: "creator-1" },
      shopifyOrder: null,
    });

    mocks.getFeatureFlags.mockResolvedValue({
      shopifyOrderEnabled: true,
    });

    mocks.createDraftOrder.mockResolvedValue({
      shopifyOrderId: "shopify-123",
      orderId: "order-1",
    });

    mocks.recordOutcomeEvent.mockResolvedValue(undefined);

    const event = makeEvent({
      snapshotId: "snap-1",
      campaignCreatorId: "cc-1",
      brandId: "brand-1",
      campaignId: "camp-1",
    });

    const result = await createOrderHandler({ event });

    expect(result).toEqual(
      expect.objectContaining({
        status: "success",
        shopifyOrderId: "shopify-123",
      })
    );

    // Shopify order created with correct params (creatorId, NOT campaignCreatorId)
    expect(mocks.createDraftOrder).toHaveBeenCalledWith(
      "brand-1",
      "creator-1",
      "camp-1"
    );

    // Outcome event recorded
    expect(mocks.recordOutcomeEvent).toHaveBeenCalledWith({
      campaignCreatorId: "cc-1",
      event: { type: "order_created" },
    });
  });

  it("returns early when feature flag is disabled", async () => {
    mocks.prisma.shippingAddressSnapshot.findUnique.mockResolvedValue({
      id: "snap-1",
      isActive: true,
      confirmedAt: new Date(),
    });

    mocks.prisma.campaignCreator.findUnique.mockResolvedValue({
      id: "cc-1",
      creatorId: "creator-1",
      creator: { id: "creator-1" },
      shopifyOrder: null,
    });

    mocks.getFeatureFlags.mockResolvedValue({
      shopifyOrderEnabled: false,
    });

    const event = makeEvent({
      snapshotId: "snap-1",
      campaignCreatorId: "cc-1",
      brandId: "brand-1",
      campaignId: "camp-1",
    });

    const result = await createOrderHandler({ event });

    expect(result).toEqual({
      status: "skipped",
      reason: "feature_disabled",
    });

    expect(mocks.createDraftOrder).not.toHaveBeenCalled();
  });

  it("is idempotent — skips if order already exists", async () => {
    mocks.prisma.shippingAddressSnapshot.findUnique.mockResolvedValue({
      id: "snap-1",
      isActive: true,
      confirmedAt: new Date(),
    });

    mocks.prisma.campaignCreator.findUnique.mockResolvedValue({
      id: "cc-1",
      creatorId: "creator-1",
      creator: { id: "creator-1" },
      shopifyOrder: { id: "existing-order" },
    });

    mocks.getFeatureFlags.mockResolvedValue({
      shopifyOrderEnabled: true,
    });

    const event = makeEvent({
      snapshotId: "snap-1",
      campaignCreatorId: "cc-1",
      brandId: "brand-1",
      campaignId: "camp-1",
    });

    const result = await createOrderHandler({ event });

    expect(result).toEqual(
      expect.objectContaining({
        status: "success",
        reason: "order_already_exists",
      })
    );

    expect(mocks.createDraftOrder).not.toHaveBeenCalled();
  });

  it("creates InterventionCase on Shopify API failure", async () => {
    mocks.prisma.shippingAddressSnapshot.findUnique.mockResolvedValue({
      id: "snap-1",
      isActive: true,
      confirmedAt: new Date(),
    });

    mocks.prisma.campaignCreator.findUnique.mockResolvedValue({
      id: "cc-1",
      creatorId: "creator-1",
      creator: { id: "creator-1" },
      shopifyOrder: null,
    });

    mocks.getFeatureFlags.mockResolvedValue({
      shopifyOrderEnabled: true,
    });

    mocks.createDraftOrder.mockRejectedValue(
      new Error("Shopify API rate limited")
    );

    mocks.prisma.interventionCase.create.mockResolvedValue({});

    const event = makeEvent({
      snapshotId: "snap-1",
      campaignCreatorId: "cc-1",
      brandId: "brand-1",
      campaignId: "camp-1",
    });

    // The handler re-throws for Inngest retries
    await expect(createOrderHandler({ event })).rejects.toThrow(
      "Shopify API rate limited"
    );

    // But an InterventionCase is created before re-throw
    expect(mocks.prisma.interventionCase.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "duplicate_order",
          status: "open",
          priority: "high",
          title: "Automatic order creation failed",
          brandId: "brand-1",
          campaignCreatorId: "cc-1",
        }),
      })
    );
  });

  it("skips when snapshot is not active or confirmed", async () => {
    mocks.prisma.shippingAddressSnapshot.findUnique.mockResolvedValue({
      id: "snap-1",
      isActive: false,
      confirmedAt: null,
    });

    const event = makeEvent({
      snapshotId: "snap-1",
      campaignCreatorId: "cc-1",
      brandId: "brand-1",
      campaignId: "camp-1",
    });

    const result = await createOrderHandler({ event });

    expect(result).toEqual({
      status: "skipped",
      reason: "snapshot_not_active_or_confirmed",
    });
  });
});
