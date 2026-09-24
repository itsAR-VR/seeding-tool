/**
 * Integration tests: Send Pipeline
 *
 * Tests the full sendOutreachBatch() flow with mocked Gmail API,
 * suppression list, daily limits, idempotency, and cross-brand alias checks.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mocks ────────────────────────────────────────────

const mocks = vi.hoisted(() => {
  const prisma = {
    emailAlias: { findFirst: vi.fn(), findUnique: vi.fn() },
    campaignCreator: { findUnique: vi.fn(), update: vi.fn() },
    conversationThread: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    message: { findFirst: vi.fn(), create: vi.fn() },
    sendingMetric: { findUnique: vi.fn(), upsert: vi.fn() },
    activityLog: { create: vi.fn() },
    creator: { findFirst: vi.fn() },
    emailSuppression: { findUnique: vi.fn() },
  };

  return {
    prisma,
    sendEmail: vi.fn(),
    recordOutcomeEvent: vi.fn(),
    getUnipileClient: vi.fn(),
    sendInstagramDM: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));

vi.mock("@/lib/gmail/send", () => ({
  sendEmail: mocks.sendEmail,
  buildUnsubscribeUrl: vi.fn().mockReturnValue("https://example.com/unsubscribe?token=test"),
}));

vi.mock("@/lib/seeding/outcome-recorder", () => ({
  recordOutcomeEvent: mocks.recordOutcomeEvent,
}));

vi.mock("@/lib/unipile/client", () => ({
  getUnipileClient: mocks.getUnipileClient,
}));

vi.mock("@/lib/unipile/send-dm", () => ({
  sendInstagramDM: mocks.sendInstagramDM,
}));

import { sendOutreachBatch, type DraftToSend } from "@/lib/outreach/send-pipeline";
import { DailyLimitExceededError } from "@/lib/outreach/errors";

// ── Helpers ──────────────────────────────────────────────────

function makeDraft(overrides: Partial<DraftToSend> = {}): DraftToSend {
  return {
    campaignCreatorId: "cc-1",
    creatorId: "creator-1",
    channel: "email",
    subject: "Collab opportunity",
    body: "Hey, let's work together!",
    ...overrides,
  };
}

function setupCampaignCreator(overrides: Record<string, unknown> = {}) {
  mocks.prisma.campaignCreator.findUnique.mockResolvedValue({
    id: "cc-1",
    creatorId: "creator-1",
    campaign: { senderAlias: null },
    creator: {
      id: "creator-1",
      email: "creator@example.com",
      instagramHandle: "creator_ig",
      name: "Test Creator",
    },
    conversationThread: null,
    ...overrides,
  });
}

function setupEmailAlias() {
  mocks.prisma.emailAlias.findFirst.mockResolvedValue({
    id: "alias-1",
    address: "outreach@brand.com",
    displayName: "Brand Outreach",
    brandId: "brand-1",
    isPrimary: true,
    isPaused: false,
    dailyLimit: 100,
    isWarmedUp: true,
    warmupStartedAt: new Date("2025-01-01"),
  });
}

function setupSuccessfulEmailSend() {
  mocks.sendEmail.mockResolvedValue({
    gmailMessageId: "gmail-msg-1",
    gmailThreadId: "gmail-thread-1",
  });
}

// ── Lifecycle ────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();

  // Default: all prisma creates/updates resolve
  mocks.prisma.conversationThread.create.mockResolvedValue({
    id: "thread-1",
    brandId: "brand-1",
    campaignCreatorId: "cc-1",
    channel: "email",
    status: "open",
  });
  mocks.prisma.conversationThread.update.mockResolvedValue({});
  mocks.prisma.message.create.mockResolvedValue({});
  mocks.prisma.campaignCreator.update.mockResolvedValue({});
  mocks.prisma.activityLog.create.mockResolvedValue({});
  mocks.recordOutcomeEvent.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

// ── Tests ────────────────────────────────────────────────────

describe("sendOutreachBatch — integration", () => {
  describe("successful email send", () => {
    it("creates ConversationThread + Message and updates lifecycle", async () => {
      setupCampaignCreator();
      setupEmailAlias();
      setupSuccessfulEmailSend();

      const drafts = [makeDraft()];
      const results = await sendOutreachBatch(drafts, "brand-1");

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe("sent");

      // Thread created
      expect(mocks.prisma.conversationThread.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            brandId: "brand-1",
            campaignCreatorId: "cc-1",
            channel: "email",
          }),
        })
      );

      // Email sent via sendEmail
      expect(mocks.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          aliasId: "alias-1",
          to: "creator@example.com",
          subject: "Collab opportunity",
          body: "Hey, let's work together!",
        })
      );

      // Message persisted
      expect(mocks.prisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            threadId: "thread-1",
            direction: "outbound",
            channel: "email",
          }),
        })
      );

      // Lifecycle updated
      expect(mocks.prisma.campaignCreator.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "cc-1" },
          data: expect.objectContaining({
            lifecycleStatus: "outreach_sent",
          }),
        })
      );

      // Outcome event recorded
      expect(mocks.recordOutcomeEvent).toHaveBeenCalledWith({
        campaignCreatorId: "cc-1",
        event: { type: "outreach_sent", method: "email" },
      });
    });
  });

  describe("suppressed recipient", () => {
    it("is blocked before reaching Gmail", async () => {
      // Suppression is checked inside sendEmail, which throws SuppressedRecipientError.
      // The send-pipeline catches errors from sendEmail and marks as failed.
      setupCampaignCreator();
      setupEmailAlias();

      const { SuppressedRecipientError } = await import(
        "@/lib/compliance/suppression"
      );
      mocks.sendEmail.mockRejectedValue(
        new SuppressedRecipientError("creator@example.com")
      );

      const results = await sendOutreachBatch([makeDraft()], "brand-1");

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe("failed");
      expect(results[0].error).toContain("suppressed");

      // Thread is created before sendEmail (pipeline design), but that's expected
      // since the idempotency guard exists for the retry path.
    });
  });

  describe("daily limit hit mid-batch", () => {
    it("marks remaining drafts as daily_limit_reached", async () => {
      setupEmailAlias();

      // Two drafts: first succeeds, second hits daily limit
      const draft1 = makeDraft({ campaignCreatorId: "cc-1", creatorId: "creator-1" });
      const draft2 = makeDraft({ campaignCreatorId: "cc-2", creatorId: "creator-2" });

      // CC lookups for both
      mocks.prisma.campaignCreator.findUnique
        .mockResolvedValueOnce({
          id: "cc-1",
          creatorId: "creator-1",
          campaign: { senderAlias: null },
          creator: {
            id: "creator-1",
            email: "first@example.com",
            instagramHandle: null,
            name: "First",
          },
          conversationThread: null,
        })
        .mockResolvedValueOnce({
          id: "cc-2",
          creatorId: "creator-2",
          campaign: { senderAlias: null },
          creator: {
            id: "creator-2",
            email: "second@example.com",
            instagramHandle: null,
            name: "Second",
          },
          conversationThread: null,
        });

      // First send succeeds, second throws DailyLimitExceededError
      mocks.sendEmail
        .mockResolvedValueOnce({
          gmailMessageId: "msg-1",
          gmailThreadId: "thread-1",
        })
        .mockRejectedValueOnce(
          new DailyLimitExceededError("alias-1", 100, 100)
        );

      // Advance timers so the 1s delay between sends resolves
      const promise = sendOutreachBatch([draft1, draft2], "brand-1");
      await vi.advanceTimersByTimeAsync(2000);
      const results = await promise;

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe("sent");
      expect(results[1].status).toBe("daily_limit_reached");
    });
  });

  describe("idempotency — thread + outbound message = skip", () => {
    it("skips if ConversationThread already has an outbound message", async () => {
      setupEmailAlias();

      // Campaign creator already has a thread
      mocks.prisma.campaignCreator.findUnique.mockResolvedValue({
        id: "cc-1",
        creatorId: "creator-1",
        campaign: { senderAlias: null },
        creator: {
          id: "creator-1",
          email: "creator@example.com",
          instagramHandle: null,
          name: "Test Creator",
        },
        conversationThread: {
          id: "existing-thread-1",
          channel: "email",
          unipileChatId: null,
        },
      });

      // Thread has an outbound message
      mocks.prisma.message.findFirst.mockResolvedValue({
        id: "msg-existing",
      });

      const results = await sendOutreachBatch([makeDraft()], "brand-1");

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe("skipped");
      expect(results[0].error).toContain("Already messaged");

      // sendEmail should NOT have been called
      expect(mocks.sendEmail).not.toHaveBeenCalled();
    });
  });

  describe("idempotency — thread + NO outbound message = delete empty thread + retry", () => {
    it("deletes empty thread and retries the send", async () => {
      setupEmailAlias();
      setupSuccessfulEmailSend();

      // Campaign creator has a thread but no outbound message
      mocks.prisma.campaignCreator.findUnique.mockResolvedValue({
        id: "cc-1",
        creatorId: "creator-1",
        campaign: { senderAlias: null },
        creator: {
          id: "creator-1",
          email: "creator@example.com",
          instagramHandle: null,
          name: "Test Creator",
        },
        conversationThread: {
          id: "empty-thread-1",
          channel: "email",
          status: "preparing",
          unipileChatId: null,
        },
      });

      // No outbound message in existing thread
      mocks.prisma.message.findFirst.mockResolvedValue(null);
      mocks.prisma.conversationThread.delete.mockResolvedValue({});

      const results = await sendOutreachBatch([makeDraft()], "brand-1");

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe("sent");

      // Empty thread was deleted
      expect(mocks.prisma.conversationThread.delete).toHaveBeenCalledWith({
        where: { id: "empty-thread-1" },
      });

      // New thread was created (the retry)
      expect(mocks.prisma.conversationThread.create).toHaveBeenCalled();
      expect(mocks.sendEmail).toHaveBeenCalled();
    });
  });

  describe("cross-brand alias rejection", () => {
    it("fails when sendEmail throws CrossBrandAliasError", async () => {
      setupCampaignCreator();
      setupEmailAlias();

      const { CrossBrandAliasError } = await import("@/lib/outreach/errors");
      mocks.sendEmail.mockRejectedValue(
        new CrossBrandAliasError("alias-1", "brand-other", "brand-1")
      );

      const results = await sendOutreachBatch([makeDraft()], "brand-1");

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe("failed");
      expect(results[0].error).toContain("brand");
    });
  });

  describe("paused alias rejection", () => {
    it("fails when sendEmail throws AliasPausedError", async () => {
      setupCampaignCreator();
      setupEmailAlias();

      const { AliasPausedError } = await import("@/lib/outreach/errors");
      mocks.sendEmail.mockRejectedValue(new AliasPausedError("alias-1"));

      const results = await sendOutreachBatch([makeDraft()], "brand-1");

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe("failed");
      expect(results[0].error).toContain("paused");
    });
  });

  describe("creatorId mismatch", () => {
    it("rejects when draft.creatorId does not match CampaignCreator.creatorId", async () => {
      setupEmailAlias();

      mocks.prisma.campaignCreator.findUnique.mockResolvedValue({
        id: "cc-1",
        creatorId: "creator-REAL",
        campaign: { senderAlias: null },
        creator: {
          id: "creator-REAL",
          email: "real@example.com",
          instagramHandle: null,
          name: "Real Creator",
        },
        conversationThread: null,
      });

      // Draft has mismatched creatorId
      const results = await sendOutreachBatch(
        [makeDraft({ creatorId: "creator-FAKE" })],
        "brand-1"
      );

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe("failed");
      expect(results[0].error).toContain("Identity mismatch");

      expect(mocks.sendEmail).not.toHaveBeenCalled();
    });
  });

  describe("inter-send delay", () => {
    it("delays 1 second between sends", async () => {
      setupEmailAlias();
      setupSuccessfulEmailSend();

      const cc1 = {
        id: "cc-1",
        creatorId: "creator-1",
        campaign: { senderAlias: null },
        creator: {
          id: "creator-1",
          email: "a@example.com",
          instagramHandle: null,
          name: "A",
        },
        conversationThread: null,
      };
      const cc2 = {
        id: "cc-2",
        creatorId: "creator-2",
        campaign: { senderAlias: null },
        creator: {
          id: "creator-2",
          email: "b@example.com",
          instagramHandle: null,
          name: "B",
        },
        conversationThread: null,
      };

      mocks.prisma.campaignCreator.findUnique
        .mockResolvedValueOnce(cc1)
        .mockResolvedValueOnce(cc2);

      const draft1 = makeDraft({ campaignCreatorId: "cc-1", creatorId: "creator-1" });
      const draft2 = makeDraft({ campaignCreatorId: "cc-2", creatorId: "creator-2" });

      const promise = sendOutreachBatch([draft1, draft2], "brand-1");

      // First send happens immediately (no delay for i=0)
      await vi.advanceTimersByTimeAsync(0);

      // After 1s the second send fires
      await vi.advanceTimersByTimeAsync(1100);

      const results = await promise;
      expect(results).toHaveLength(2);
      expect(results[0].status).toBe("sent");
      expect(results[1].status).toBe("sent");
    });
  });

  describe("no email alias configured", () => {
    it("returns failed with helpful error message", async () => {
      setupCampaignCreator();

      // No alias found
      mocks.prisma.emailAlias.findFirst.mockResolvedValue(null);

      const results = await sendOutreachBatch([makeDraft()], "brand-1");

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe("failed");
      expect(results[0].error).toContain("No email alias");
    });
  });

  describe("creator without email", () => {
    it("returns no_contact_info", async () => {
      setupEmailAlias();

      mocks.prisma.campaignCreator.findUnique.mockResolvedValue({
        id: "cc-1",
        creatorId: "creator-1",
        campaign: { senderAlias: null },
        creator: {
          id: "creator-1",
          email: null,
          instagramHandle: "creator_ig",
          name: "No Email Creator",
        },
        conversationThread: null,
      });

      const results = await sendOutreachBatch([makeDraft()], "brand-1");

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe("no_contact_info");
    });
  });

  describe("CampaignCreator not found", () => {
    it("returns failed", async () => {
      setupEmailAlias();

      mocks.prisma.campaignCreator.findUnique.mockResolvedValue(null);

      const results = await sendOutreachBatch([makeDraft()], "brand-1");

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe("failed");
      expect(results[0].error).toContain("CampaignCreator not found");
    });
  });
  describe("per-campaign sender", () => {
    it("sends from the campaign's chosen inbox instead of the primary", async () => {
      setupCampaignCreator({
        campaign: {
          senderAlias: {
            id: "alias-2",
            address: "kam@gmail.com",
            brandId: "brand-1",
            isPaused: false,
          },
        },
      });
      setupEmailAlias();
      setupSuccessfulEmailSend();

      const results = await sendOutreachBatch([makeDraft()], "brand-1");

      expect(results[0].status).toBe("sent");
      expect(mocks.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ aliasId: "alias-2" })
      );
    });

    it("fails rather than falling back when the campaign's inbox is paused", async () => {
      setupCampaignCreator({
        campaign: {
          senderAlias: {
            id: "alias-2",
            address: "kam@gmail.com",
            brandId: "brand-1",
            isPaused: true,
          },
        },
      });
      setupEmailAlias();

      const results = await sendOutreachBatch([makeDraft()], "brand-1");

      expect(results[0].status).toBe("failed");
      expect(results[0].error).toContain("kam@gmail.com");
      expect(mocks.sendEmail).not.toHaveBeenCalled();
    });
  });
});
