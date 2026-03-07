import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Gmail Pub/Sub webhook contract tests.
 *
 * Tests cover:
 * - Valid push notification → Message row created
 * - Duplicate externalId → no duplicate Message rows
 * - AI classification failure → InterventionCase created, no 500
 * - AIDraft stays in "draft" status after creation
 *
 * // INVARIANT: AI drafts never auto-sent
 * // INVARIANT: Message dedupe on externalId
 * // INVARIANT: OpenAI failures → Interventions
 */

// ─── Mocks ───────────────────────────────────────────────

const mockPersistMessage = vi.fn();
const mockNormalizeInboundMessage = vi.fn();
const mockGetOrCreateThread = vi.fn();
const mockFetchNewMessages = vi.fn();
const mockResolveThreadByExternalId = vi.fn();
const mockResolveBrandByEmail = vi.fn();
const mockClassifyReply = vi.fn();
const mockExtractAddress = vi.fn();
const mockGenerateDraft = vi.fn();
const mockInngestSend = vi.fn();

const mockPrisma = {
  webhookEvent: {
    create: vi.fn().mockResolvedValue({ id: "we-1" }),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  },
  message: {
    update: vi.fn().mockResolvedValue({}),
  },
  interventionCase: {
    create: vi.fn().mockResolvedValue({ id: "ic-1" }),
  },
  shippingAddressSnapshot: {
    create: vi.fn().mockResolvedValue({}),
  },
  campaignCreator: {
    update: vi.fn().mockResolvedValue({}),
  },
  conversationThread: {
    findUnique: vi.fn().mockResolvedValue(null),
  },
  brandSettings: {
    findUnique: vi.fn().mockResolvedValue({ brandVoice: "friendly" }),
  },
  aIDraft: {
    create: vi.fn().mockResolvedValue({ id: "draft-1", status: "draft" }),
  },
};

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/inbox/messages", () => ({
  normalizeInboundMessage: (...args: unknown[]) => mockNormalizeInboundMessage(...args),
  persistMessage: (...args: unknown[]) => mockPersistMessage(...args),
}));
vi.mock("@/lib/inbox/threads", () => ({
  getOrCreateThread: (...args: unknown[]) => mockGetOrCreateThread(...args),
}));
vi.mock("@/lib/gmail/ingest", () => ({
  fetchNewMessages: (...args: unknown[]) => mockFetchNewMessages(...args),
  resolveThreadByExternalId: (...args: unknown[]) => mockResolveThreadByExternalId(...args),
  resolveBrandByEmail: (...args: unknown[]) => mockResolveBrandByEmail(...args),
}));
vi.mock("@/lib/inbox/ai", () => ({
  classifyReply: (...args: unknown[]) => mockClassifyReply(...args),
  extractAddress: (...args: unknown[]) => mockExtractAddress(...args),
  generateDraft: (...args: unknown[]) => mockGenerateDraft(...args),
}));
vi.mock("@/lib/inngest/client", () => ({
  inngest: { send: (...args: unknown[]) => mockInngestSend(...args) },
}));
vi.mock("@/lib/feature-flags", () => ({
  getFeatureFlags: vi.fn().mockResolvedValue({
    aiReplyEnabled: true,
    unipileDmEnabled: true,
    shopifyOrderEnabled: true,
    reminderEmailEnabled: true,
  }),
}));

// ─── Helpers ─────────────────────────────────────────────

function makeGmailPubSubPayload(email = "brand@example.com", messageId = "pubsub-msg-1") {
  const data = Buffer.from(
    JSON.stringify({ emailAddress: email, historyId: 12345 })
  ).toString("base64");

  return {
    message: {
      data,
      messageId,
    },
    subscription: "projects/test/subscriptions/gmail-push",
  };
}

const rawGmailMessage = {
  id: "gmail-msg-001",
  threadId: "gmail-thread-001",
  from: "creator@example.com",
  to: "brand@example.com",
  subject: "Re: Collab Opportunity",
  body: "Yes, I would love to collaborate! Here is my address: 123 Main St, NYC, NY 10001",
  internalDate: String(Date.now()),
};

async function callGmailWebhook(payload: Record<string, unknown>) {
  const { POST } = await import("@/app/api/gmail/webhook/route");

  const req = new Request("http://localhost:3000/api/gmail/webhook", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  return POST(req as any);
}

// ─── Tests ───────────────────────────────────────────────

describe("Gmail webhook handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: brand resolves
    mockResolveBrandByEmail.mockResolvedValue({ id: "brand-1" });

    // Default: Gmail returns 1 message
    mockFetchNewMessages.mockResolvedValue([rawGmailMessage]);

    // Default: normalize returns clean payload
    mockNormalizeInboundMessage.mockReturnValue({
      externalMessageId: "gmail-msg-001",
      fromAddress: "creator@example.com",
      toAddress: "brand@example.com",
      subject: "Re: Collab Opportunity",
      body: "Yes, I would love to collaborate!",
    });

    // Default: thread resolves
    mockResolveThreadByExternalId.mockResolvedValue({
      id: "thread-1",
      campaignCreatorId: "cc-1",
      brandId: "brand-1",
    });

    // Default: message persisted (new)
    mockPersistMessage.mockResolvedValue({
      message: {
        id: "msg-1",
        body: "Yes, I would love to collaborate!",
        subject: "Re: Collab Opportunity",
      },
      created: true,
    });

    // Default: Inngest succeeds (so inline processing is skipped)
    mockInngestSend.mockResolvedValue({});
  });

  describe("valid push notification", () => {
    it("creates Message row for new Gmail message", async () => {
      const payload = makeGmailPubSubPayload();
      const res = await callGmailWebhook(payload);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.processed).toBe(1);

      expect(mockPersistMessage).toHaveBeenCalledWith(
        "thread-1",
        expect.objectContaining({
          externalMessageId: "gmail-msg-001",
          direction: "inbound",
        })
      );
    });

    it("records WebhookEvent for the push notification", async () => {
      const payload = makeGmailPubSubPayload("brand@example.com", "pubsub-123");
      await callGmailWebhook(payload);

      expect(mockPrisma.webhookEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            provider: "gmail",
            eventType: "push_notification",
            externalEventId: "pubsub-123",
          }),
        })
      );
    });
  });

  describe("// INVARIANT: Message dedupe on externalId", () => {
    it("duplicate externalId creates 0 new Message rows", async () => {
      // First call: message is new
      mockPersistMessage.mockResolvedValue({
        message: { id: "msg-1", body: "Hello", subject: "Re: Hi" },
        created: true,
      });

      const payload = makeGmailPubSubPayload();
      await callGmailWebhook(payload);

      expect(mockPersistMessage).toHaveBeenCalledTimes(1);

      // Reset call count
      mockPersistMessage.mockClear();

      // Second call: duplicate — persistMessage returns created: false
      mockPersistMessage.mockResolvedValue({
        message: { id: "msg-1", body: "Hello", subject: "Re: Hi" },
        created: false,
      });

      const res2 = await callGmailWebhook(payload);
      const json = await res2.json();

      // Message was not counted as processed
      expect(json.processed).toBe(0);
    });
  });

  describe("// INVARIANT: OpenAI failures → Interventions", () => {
    it("AI classify failure → InterventionCase created, no 500", async () => {
      // Force inline processing (Inngest fails)
      mockInngestSend.mockRejectedValue(new Error("Inngest not configured"));

      // AI classifier fails by returning low confidence
      mockClassifyReply.mockResolvedValue({
        intent: "other",
        confidence: 0,
      });

      const payload = makeGmailPubSubPayload();
      const res = await callGmailWebhook(payload);

      // Should not return 500
      expect(res.status).toBe(200);

      // Should create intervention for low confidence
      expect(mockPrisma.interventionCase.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: "unclear_reply",
            status: "open",
            brandId: "brand-1",
            campaignCreatorId: "cc-1",
          }),
        })
      );
    });
  });

  describe("// INVARIANT: AI drafts never auto-sent", () => {
    it("AIDraft.status stays 'draft' after creation from positive classification", async () => {
      // Force inline processing
      mockInngestSend.mockRejectedValue(new Error("Inngest not configured"));

      mockClassifyReply.mockResolvedValue({
        intent: "positive",
        confidence: 0.95,
      });

      mockPrisma.conversationThread.findUnique.mockResolvedValue({
        id: "thread-1",
        messages: [
          { id: "msg-1", body: "I'd love to!", subject: "Re: Collab" },
        ],
        campaignCreator: {
          id: "cc-1",
          creator: { id: "cr-1", name: "Test Creator" },
          campaign: { id: "camp-1", name: "Summer" },
        },
      });

      mockGenerateDraft.mockResolvedValue("Hi! Thanks for your interest...");

      const payload = makeGmailPubSubPayload();
      const res = await callGmailWebhook(payload);

      expect(res.status).toBe(200);

      // AIDraft should be created with status = "draft", NEVER "sent"
      expect(mockPrisma.aIDraft.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: "reply",
            status: "draft", // INVARIANT: never auto-sent
          }),
        })
      );
    });
  });

  describe("no brand resolution", () => {
    it("returns ok with processed=0 when brand not found", async () => {
      mockResolveBrandByEmail.mockResolvedValue(null);

      const payload = makeGmailPubSubPayload();
      const res = await callGmailWebhook(payload);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.processed).toBe(0);
    });
  });

  describe("missing data", () => {
    it("returns ok with processed=0 for empty Pub/Sub data", async () => {
      const payload = {
        message: { messageId: "pubsub-empty" },
        subscription: "projects/test/subscriptions/gmail-push",
      };

      const res = await callGmailWebhook(payload);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.processed).toBe(0);
    });
  });
});
