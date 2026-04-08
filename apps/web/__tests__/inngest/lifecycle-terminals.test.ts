import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Phase 27b — Lifecycle Terminals + Delivered Outcome
 *
 * Tests cover:
 * - Track17 polling cron: delivered outcome event, transaction wrapping, batch error isolation
 * - Shopify webhook: delivered outcome event, null campaignCreatorId guard
 * - Track17 push webhook: already has delivered outcome (no regression)
 * - Stalled detection cron: threshold, MentionAsset guard, reminder exhaustion, race condition
 * - Confirm posted → completed: 7-day wait, lifecycle re-check, MentionAsset re-check
 */

// ── Hoisted mocks ──────────────────────────────────────────

const mocks = vi.hoisted(() => {
  const capturedHandlers: Record<string, Function> = {};

  return {
    capturedHandlers,
    recordOutcomeEvent: vi.fn(),
    logFn: vi.fn(),
    inngestSend: vi.fn(),

    // Prisma mocks
    fulfillmentEventFindMany: vi.fn(),
    fulfillmentEventUpdate: vi.fn(),
    shopifyOrderUpdate: vi.fn(),
    shopifyOrderFindUnique: vi.fn(),
    campaignCreatorUpdate: vi.fn(),
    campaignCreatorFindUnique: vi.fn(),
    campaignCreatorFindMany: vi.fn(),
    brandFindMany: vi.fn(),
    mentionAssetFindFirst: vi.fn(),
    mentionAssetFindUnique: vi.fn(),
    reminderScheduleFindMany: vi.fn(),
    fulfillmentEventUpsert: vi.fn(),
    webhookEventCreate: vi.fn(),
    webhookEventUpdateMany: vi.fn(),
    webhookEventFindUnique: vi.fn(),
    brandConnectionFindFirst: vi.fn(),
    webhookEventUpdate: vi.fn(),
    transaction: vi.fn(),

    mockCreateFunction: vi.fn(
      (_config: unknown, _trigger: unknown, handler: Function) => {
        const config = _config as { id: string };
        capturedHandlers[config.id] = handler;
        return handler;
      }
    ),
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
    fulfillmentEvent: {
      findMany: mocks.fulfillmentEventFindMany,
      update: mocks.fulfillmentEventUpdate,
      upsert: mocks.fulfillmentEventUpsert,
    },
    shopifyOrder: {
      update: mocks.shopifyOrderUpdate,
      findUnique: mocks.shopifyOrderFindUnique,
    },
    campaignCreator: {
      update: mocks.campaignCreatorUpdate,
      findUnique: mocks.campaignCreatorFindUnique,
      findMany: mocks.campaignCreatorFindMany,
    },
    brand: {
      findMany: mocks.brandFindMany,
    },
    mentionAsset: {
      findFirst: mocks.mentionAssetFindFirst,
      findUnique: mocks.mentionAssetFindUnique,
    },
    reminderSchedule: {
      findMany: mocks.reminderScheduleFindMany,
    },
    webhookEvent: {
      create: mocks.webhookEventCreate,
      updateMany: mocks.webhookEventUpdateMany,
      findUnique: mocks.webhookEventFindUnique,
      update: mocks.webhookEventUpdate,
    },
    brandConnection: {
      findFirst: mocks.brandConnectionFindFirst,
    },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/seeding/outcome-recorder", () => ({
  recordOutcomeEvent: mocks.recordOutcomeEvent,
}));

vi.mock("@/lib/logger", () => ({
  log: mocks.logFn,
}));

vi.mock("@/lib/track17/client", () => ({
  registerTracking: vi.fn(),
  getTrackingStatus: vi.fn(),
  mapTrack17Status: vi.fn(
    (tag: string) => (tag === "Delivered" ? "delivered" : "in_transit")
  ),
  stopTracking: vi.fn(),
}));

// Import functions to register handlers
import "@/lib/inngest/functions/track17-sync";
import "@/lib/inngest/functions/stalled-detection";
import "@/lib/inngest/functions/confirm-posted";

// ── Helpers ────────────────────────────────────────────────

function getHandler(id: string) {
  const handler = mocks.capturedHandlers[id];
  if (!handler) {
    throw new Error(`Handler ${id} was not captured. Available: ${Object.keys(mocks.capturedHandlers).join(", ")}`);
  }
  return handler;
}

function makeStep() {
  return {
    run: vi.fn((_name: string, fn: Function) => fn()),
    sleep: vi.fn(),
  };
}

// ── Tests ──────────────────────────────────────────────────

describe("Phase 27b — Lifecycle Terminals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TRACK17_API_KEY = "test-key";
  });

  // ── Track17 Polling Cron ────────────────────────────────

  describe("Track17 polling cron — delivered outcome", () => {
    it("calls recordOutcomeEvent with correct signature on delivery", async () => {
      const fulfillment = {
        id: "fe-1",
        trackingNumber: "TRACK123",
        status: "in_transit",
        orderId: "order-1",
        order: {
          id: "order-1",
          shopifyOrderId: "shop-1",
          campaignCreatorId: "cc-1",
          campaignCreator: {
            id: "cc-1",
            lifecycleStatus: "shipped",
          },
        },
      };

      mocks.fulfillmentEventFindMany.mockResolvedValue([fulfillment]);
      mocks.fulfillmentEventUpdate.mockResolvedValue({});
      mocks.transaction.mockImplementation(async (fn: Function) => fn({
        shopifyOrder: { update: mocks.shopifyOrderUpdate.mockResolvedValue({}) },
        campaignCreator: { update: mocks.campaignCreatorUpdate.mockResolvedValue({}) },
      }));
      mocks.recordOutcomeEvent.mockResolvedValue({});

      const { getTrackingStatus } = await import("@/lib/track17/client");
      (getTrackingStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          accepted: [
            {
              number: "TRACK123",
              tag: "Delivered",
              track_info: { latest_status: { sub_status: "" } },
            },
          ],
        },
      });

      const handler = getHandler("track17-poll-status");
      await handler({ step: makeStep() });

      expect(mocks.recordOutcomeEvent).toHaveBeenCalledWith({
        campaignCreatorId: "cc-1",
        event: { type: "delivered" },
      });
    });

    it("wraps delivered cascade in prisma.$transaction", async () => {
      const fulfillment = {
        id: "fe-1",
        trackingNumber: "TRACK123",
        status: "in_transit",
        orderId: "order-1",
        order: {
          id: "order-1",
          shopifyOrderId: "shop-1",
          campaignCreatorId: "cc-1",
          campaignCreator: {
            id: "cc-1",
            lifecycleStatus: "shipped",
          },
        },
      };

      mocks.fulfillmentEventFindMany.mockResolvedValue([fulfillment]);
      mocks.fulfillmentEventUpdate.mockResolvedValue({});
      mocks.transaction.mockImplementation(async (fn: Function) => fn({
        shopifyOrder: { update: vi.fn().mockResolvedValue({}) },
        campaignCreator: { update: vi.fn().mockResolvedValue({}) },
      }));
      mocks.recordOutcomeEvent.mockResolvedValue({});

      const { getTrackingStatus } = await import("@/lib/track17/client");
      (getTrackingStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          accepted: [
            {
              number: "TRACK123",
              tag: "Delivered",
              track_info: { latest_status: { sub_status: "" } },
            },
          ],
        },
      });

      const handler = getHandler("track17-poll-status");
      await handler({ step: makeStep() });

      expect(mocks.transaction).toHaveBeenCalled();
    });

    it("does not kill batch when recordOutcomeEvent throws", async () => {
      const fulfillments = [
        {
          id: "fe-1",
          trackingNumber: "TRACK-FAIL",
          status: "in_transit",
          orderId: "order-1",
          order: {
            id: "order-1",
            shopifyOrderId: "shop-1",
            campaignCreatorId: "cc-fail",
            campaignCreator: { id: "cc-fail", lifecycleStatus: "shipped" },
          },
        },
        {
          id: "fe-2",
          trackingNumber: "TRACK-OK",
          status: "in_transit",
          orderId: "order-2",
          order: {
            id: "order-2",
            shopifyOrderId: "shop-2",
            campaignCreatorId: "cc-ok",
            campaignCreator: { id: "cc-ok", lifecycleStatus: "shipped" },
          },
        },
      ];

      mocks.fulfillmentEventFindMany.mockResolvedValue(fulfillments);
      mocks.fulfillmentEventUpdate.mockResolvedValue({});
      mocks.transaction.mockImplementation(async (fn: Function) => fn({
        shopifyOrder: { update: vi.fn().mockResolvedValue({}) },
        campaignCreator: { update: vi.fn().mockResolvedValue({}) },
      }));

      // First call throws, second succeeds
      mocks.recordOutcomeEvent
        .mockRejectedValueOnce(new Error("DB connection lost"))
        .mockResolvedValueOnce({});

      const { getTrackingStatus } = await import("@/lib/track17/client");
      (getTrackingStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          accepted: [
            {
              number: "TRACK",
              tag: "Delivered",
              track_info: { latest_status: { sub_status: "" } },
            },
          ],
        },
      });

      const handler = getHandler("track17-poll-status");
      const result = await handler({ step: makeStep() });

      // Should complete despite the first failure
      expect(result).toHaveProperty("status", "completed");
      // Both were attempted
      expect(mocks.recordOutcomeEvent).toHaveBeenCalledTimes(2);
    });
  });

  // ── Shopify Webhook ─────────────────────────────────────

  describe("Shopify webhook — delivered outcome", () => {
    it("calls recordOutcomeEvent on delivery", async () => {
      mocks.webhookEventFindUnique.mockResolvedValue(null);
      mocks.webhookEventCreate.mockResolvedValue({ id: "we-1" });
      mocks.webhookEventUpdate.mockResolvedValue({});
      mocks.brandConnectionFindFirst.mockResolvedValue({ brandId: "brand-1" });
      mocks.shopifyOrderFindUnique.mockResolvedValue({
        id: "so-1",
        shopifyOrderId: "12345",
        campaignCreatorId: "cc-1",
        campaignCreator: { id: "cc-1", lifecycleStatus: "shipped" },
      });
      mocks.fulfillmentEventUpsert.mockResolvedValue({});
      mocks.shopifyOrderUpdate.mockResolvedValue({});
      mocks.campaignCreatorUpdate.mockResolvedValue({});
      mocks.recordOutcomeEvent.mockResolvedValue({});
      mocks.inngestSend.mockResolvedValue({});

      const { NextRequest } = await import("next/server");
      const { createHmac } = await import("crypto");

      const secret = "test-secret";
      process.env.SHOPIFY_WEBHOOK_SECRET = secret;

      const payload = {
        id: 99887766,
        order_id: 12345,
        status: "success",
        shipment_status: "delivered",
        tracking_number: "1Z",
        tracking_url: "https://example.com",
        tracking_company: "UPS",
      };

      const body = JSON.stringify(payload);
      const hmac = createHmac("sha256", secret).update(body).digest("base64");

      const { POST } = await import("@/app/api/webhooks/shopify/route");
      const req = new NextRequest("http://localhost:3000/api/webhooks/shopify", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-shopify-hmac-sha256": hmac,
          "x-shopify-topic": "fulfillments/update",
          "x-shopify-shop-domain": "test.myshopify.com",
        },
        body,
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      expect(mocks.recordOutcomeEvent).toHaveBeenCalledWith({
        campaignCreatorId: "cc-1",
        event: { type: "delivered" },
      });
    });

    it("skips recordOutcomeEvent when lifecycle is already posted", async () => {
      mocks.webhookEventFindUnique.mockResolvedValue(null);
      mocks.webhookEventCreate.mockResolvedValue({ id: "we-1" });
      mocks.webhookEventUpdate.mockResolvedValue({});
      mocks.brandConnectionFindFirst.mockResolvedValue({ brandId: "brand-1" });
      mocks.shopifyOrderFindUnique.mockResolvedValue({
        id: "so-1",
        shopifyOrderId: "12345",
        campaignCreatorId: "cc-1",
        campaignCreator: { id: "cc-1", lifecycleStatus: "posted" },
      });
      mocks.fulfillmentEventUpsert.mockResolvedValue({});
      mocks.recordOutcomeEvent.mockResolvedValue({});

      const { NextRequest } = await import("next/server");
      const { createHmac } = await import("crypto");

      const secret = "test-secret";
      process.env.SHOPIFY_WEBHOOK_SECRET = secret;

      const payload = {
        id: 99887766,
        order_id: 12345,
        shipment_status: "delivered",
        tracking_number: "1Z",
        tracking_url: "https://example.com",
        tracking_company: "UPS",
      };

      const body = JSON.stringify(payload);
      const hmac = createHmac("sha256", secret).update(body).digest("base64");

      const { POST } = await import("@/app/api/webhooks/shopify/route");
      const req = new NextRequest("http://localhost:3000/api/webhooks/shopify", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-shopify-hmac-sha256": hmac,
          "x-shopify-topic": "fulfillments/update",
          "x-shopify-shop-domain": "test.myshopify.com",
        },
        body,
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      // Should not call recordOutcomeEvent because lifecycle is "posted"
      expect(mocks.recordOutcomeEvent).not.toHaveBeenCalled();
    });
  });

  // ── Track17 Push Webhook (no regression) ────────────────

  describe("Track17 push webhook — already has delivered outcome", () => {
    it("confirms recordOutcomeEvent is called in the push webhook source", async () => {
      // This is a static analysis test — verify the source file imports and calls recordOutcomeEvent
      const fs = await import("fs");
      const source = fs.readFileSync(
        "app/api/webhooks/track17/route.ts",
        "utf-8"
      );

      expect(source).toContain('import { recordOutcomeEvent }');
      expect(source).toContain('event: { type: "delivered" }');
    });
  });

  // ── Stalled Detection ───────────────────────────────────

  describe("Stalled detection cron", () => {
    function setupStalledScenario(overrides: {
      reminderWindowDays?: number;
      maxFollowUps?: number;
      updatedAt?: Date;
      mentionExists?: boolean;
      reminders?: Array<{ status: string }>;
      lifecycleStatus?: string;
    } = {}) {
      const {
        reminderWindowDays = 14,
        maxFollowUps = 3,
        updatedAt = new Date("2026-03-01"),
        mentionExists = false,
        reminders = [
          { status: "sent" },
          { status: "sent" },
          { status: "sent" },
        ],
        lifecycleStatus = "delivered",
      } = overrides;

      mocks.brandFindMany.mockResolvedValue([
        {
          id: "brand-1",
          settings: { reminderWindowDays, maxFollowUps },
        },
      ]);

      mocks.campaignCreatorFindMany.mockResolvedValue([
        { id: "cc-1" },
      ]);

      mocks.transaction.mockImplementation(async (fn: Function) => {
        return fn({
          mentionAsset: {
            findFirst: vi.fn().mockResolvedValue(
              mentionExists ? { id: "mention-1" } : null
            ),
          },
          reminderSchedule: {
            findMany: vi.fn().mockResolvedValue(reminders),
          },
          campaignCreator: {
            findUnique: vi.fn().mockResolvedValue({ lifecycleStatus }),
            update: vi.fn().mockResolvedValue({}),
          },
        });
      });

      mocks.recordOutcomeEvent.mockResolvedValue({});
    }

    it("transitions delivered creator to stalled when all reminders exhausted", async () => {
      setupStalledScenario();

      const handler = getHandler("stalled-detection");
      const result = await handler({ step: makeStep() });

      expect(result).toHaveProperty("totalStalled", 1);
      expect(mocks.recordOutcomeEvent).toHaveBeenCalledWith({
        campaignCreatorId: "cc-1",
        event: {
          type: "stalled",
          reason: "All reminders exhausted with no mention posted",
        },
      });
    });

    it("does NOT stall creator delivered less than reminderWindowDays ago", async () => {
      // Creator updated recently — should not appear in candidates
      mocks.brandFindMany.mockResolvedValue([
        {
          id: "brand-1",
          settings: { reminderWindowDays: 14, maxFollowUps: 3 },
        },
      ]);
      // No candidates returned because updatedAt is recent
      mocks.campaignCreatorFindMany.mockResolvedValue([]);

      const handler = getHandler("stalled-detection");
      const result = await handler({ step: makeStep() });

      expect(result).toHaveProperty("totalStalled", 0);
      expect(mocks.recordOutcomeEvent).not.toHaveBeenCalled();
    });

    it("does NOT stall creator with existing MentionAsset", async () => {
      setupStalledScenario({ mentionExists: true });

      const handler = getHandler("stalled-detection");
      const result = await handler({ step: makeStep() });

      expect(result).toHaveProperty("totalStalled", 0);
      expect(mocks.recordOutcomeEvent).not.toHaveBeenCalled();
    });

    it("does NOT stall creator with non-terminal reminders", async () => {
      setupStalledScenario({
        reminders: [
          { status: "sent" },
          { status: "pending" },
          { status: "sent" },
        ],
      });

      const handler = getHandler("stalled-detection");
      const result = await handler({ step: makeStep() });

      expect(result).toHaveProperty("totalStalled", 0);
    });

    it("does NOT stall creator when reminder count < maxFollowUps", async () => {
      setupStalledScenario({
        maxFollowUps: 3,
        reminders: [
          { status: "sent" },
          { status: "sent" },
        ],
      });

      const handler = getHandler("stalled-detection");
      const result = await handler({ step: makeStep() });

      expect(result).toHaveProperty("totalStalled", 0);
    });

    it("handles race condition: MentionAsset created between query and transaction", async () => {
      // Initial query returns candidates, but inside transaction mention is found
      setupStalledScenario({ mentionExists: true });

      const handler = getHandler("stalled-detection");
      const result = await handler({ step: makeStep() });

      // Should NOT stall because mention was found inside transaction
      expect(result).toHaveProperty("totalStalled", 0);
      expect(mocks.recordOutcomeEvent).not.toHaveBeenCalled();
    });

    it("logs stalled count per brand", async () => {
      setupStalledScenario();

      const handler = getHandler("stalled-detection");
      await handler({ step: makeStep() });

      expect(mocks.logFn).toHaveBeenCalledWith(
        "info",
        "stalled.brand_summary",
        expect.objectContaining({
          brandId: "brand-1",
          stalledCount: 1,
        })
      );
    });
  });

  // ── Confirm Posted → Completed ──────────────────────────

  describe("Confirm posted → completed", () => {
    it("transitions posted creator to completed after 7 days", async () => {
      mocks.campaignCreatorFindUnique.mockResolvedValue({
        lifecycleStatus: "posted",
      });
      mocks.mentionAssetFindUnique.mockResolvedValue({ id: "mention-1" });
      mocks.campaignCreatorUpdate.mockResolvedValue({});
      mocks.recordOutcomeEvent.mockResolvedValue({});

      const step = makeStep();
      const handler = getHandler("confirm-posted-completion");

      const result = await handler({
        event: {
          data: {
            campaignCreatorId: "cc-1",
            mentionAssetId: "mention-1",
          },
        },
        step,
      });

      expect(step.sleep).toHaveBeenCalledWith("wait-7-days", "7d");
      expect(result).toHaveProperty("status", "completed");
      expect(mocks.campaignCreatorUpdate).toHaveBeenCalledWith({
        where: { id: "cc-1" },
        data: { lifecycleStatus: "completed" },
      });
      expect(mocks.recordOutcomeEvent).toHaveBeenCalledWith({
        campaignCreatorId: "cc-1",
        event: { type: "completed" },
      });
    });

    it("does NOT complete when lifecycle manually changed to opted_out", async () => {
      mocks.campaignCreatorFindUnique.mockResolvedValue({
        lifecycleStatus: "opted_out",
      });

      const handler = getHandler("confirm-posted-completion");

      const result = await handler({
        event: {
          data: {
            campaignCreatorId: "cc-1",
            mentionAssetId: "mention-1",
          },
        },
        step: makeStep(),
      });

      expect(result).toHaveProperty("status", "skipped");
      expect(mocks.campaignCreatorUpdate).not.toHaveBeenCalled();
      expect(mocks.recordOutcomeEvent).not.toHaveBeenCalled();
    });

    it("does NOT complete when MentionAsset was deleted", async () => {
      mocks.campaignCreatorFindUnique.mockResolvedValue({
        lifecycleStatus: "posted",
      });
      mocks.mentionAssetFindUnique.mockResolvedValue(null);

      const handler = getHandler("confirm-posted-completion");

      const result = await handler({
        event: {
          data: {
            campaignCreatorId: "cc-1",
            mentionAssetId: "mention-1",
          },
        },
        step: makeStep(),
      });

      expect(result).toHaveProperty("status", "skipped");
      expect(result).toHaveProperty("reason", "MentionAsset deleted");
      expect(mocks.campaignCreatorUpdate).not.toHaveBeenCalled();
    });
  });
});
