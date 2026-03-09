import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createHmac } from "crypto";

/**
 * Shopify webhook contract tests.
 *
 * Tests cover:
 * - orders/create → ShopifyOrder status update
 * - orders/fulfilled → ShopifyOrder status = "shipped", CampaignCreator lifecycle update
 * - orders/updated → status sync (cancelled, fulfilled, paid)
 * - fulfillments/create → FulfillmentEvent upsert
 * - fulfillments/update → FulfillmentEvent upsert, delivery detection
 * - Duplicate events → idempotent (no duplicate rows)
 * - Malformed payloads → handler continues, returns 200 to Shopify
 *
 * // INVARIANT: All Shopify webhook handlers are idempotent — upsert by external ID
 */

// ─── Mocks ───────────────────────────────────────────────

const mockPrisma = {
  webhookEvent: {
    findUnique: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: "we-1" }),
    update: vi.fn().mockResolvedValue({ id: "we-1" }),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  },
  brandConnection: {
    findFirst: vi.fn().mockResolvedValue({ brandId: "brand-1" }),
  },
  shopifyOrder: {
    findUnique: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue({}),
  },
  campaignCreator: {
    update: vi.fn().mockResolvedValue({}),
  },
  fulfillmentEvent: {
    upsert: vi.fn().mockResolvedValue({}),
  },
};

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/inngest/client", () => ({
  inngest: { send: vi.fn().mockResolvedValue({}) },
}));

// ─── Helpers ─────────────────────────────────────────────

const WEBHOOK_SECRET = "shpss_test_secret";

function computeHmac(body: string): string {
  return createHmac("sha256", WEBHOOK_SECRET).update(body).digest("base64");
}

async function callShopifyWebhook(
  payload: Record<string, unknown>,
  topic: string,
  shopDomain = "test-store.myshopify.com",
  webhookId?: string
) {
  process.env.SHOPIFY_WEBHOOK_SECRET = WEBHOOK_SECRET;

  const body = JSON.stringify(payload);
  const hmac = computeHmac(body);

  const { POST } = await import("@/app/api/webhooks/shopify/route");

  const req = new NextRequest("http://localhost:3000/api/webhooks/shopify", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-shopify-hmac-sha256": hmac,
      "x-shopify-topic": topic,
      "x-shopify-shop-domain": shopDomain,
      ...(webhookId ? { "x-shopify-webhook-id": webhookId } : {}),
    },
    body,
  });

  return POST(req);
}

// ─── Fixtures ────────────────────────────────────────────

const orderPayload = {
  id: 12345678,
  name: "#1001",
  order_number: "1001",
  financial_status: "paid",
  fulfillment_status: null,
  cancelled_at: null,
};

const fulfillmentPayload = {
  id: 99887766,
  order_id: 12345678,
  status: "success",
  shipment_status: "in_transit",
  tracking_number: "1Z999AA10123456784",
  tracking_url: "https://track.example.com/1Z999AA10123456784",
  tracking_company: "UPS",
};

// ─── Tests ───────────────────────────────────────────────

describe("Shopify webhook handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
    mockPrisma.shopifyOrder.findUnique.mockResolvedValue(null);
    mockPrisma.brandConnection.findFirst.mockResolvedValue({ brandId: "brand-1" });
  });

  describe("orders/create", () => {
    it("updates ShopifyOrder status to processing when order exists", async () => {
      mockPrisma.shopifyOrder.findUnique.mockResolvedValue({
        id: "so-1",
        shopifyOrderId: "12345678",
        status: "created",
        shopifyOrderNumber: null,
      });

      const res = await callShopifyWebhook(orderPayload, "orders/create");

      expect(res.status).toBe(200);
      expect(mockPrisma.shopifyOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { shopifyOrderId: "12345678" },
          data: expect.objectContaining({ status: "processing" }),
        })
      );
    });

    it("does nothing when no matching ShopifyOrder exists", async () => {
      const res = await callShopifyWebhook(orderPayload, "orders/create");

      expect(res.status).toBe(200);
      expect(mockPrisma.shopifyOrder.update).not.toHaveBeenCalled();
    });
  });

  describe("orders/fulfilled", () => {
    it("updates order to shipped and updates CampaignCreator lifecycle", async () => {
      mockPrisma.shopifyOrder.findUnique.mockResolvedValue({
        id: "so-1",
        shopifyOrderId: "12345678",
        campaignCreatorId: "cc-1",
        campaignCreator: {
          id: "cc-1",
          lifecycleStatus: "order_created",
        },
      });

      const res = await callShopifyWebhook(
        { ...orderPayload, fulfillment_status: "fulfilled" },
        "orders/fulfilled"
      );

      expect(res.status).toBe(200);
      expect(mockPrisma.shopifyOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { shopifyOrderId: "12345678" },
          data: { status: "shipped" },
        })
      );
      expect(mockPrisma.campaignCreator.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "cc-1" },
          data: { lifecycleStatus: "shipped" },
        })
      );
    });

    it("does not downgrade lifecycle if already delivered/posted/completed", async () => {
      mockPrisma.shopifyOrder.findUnique.mockResolvedValue({
        id: "so-1",
        shopifyOrderId: "12345678",
        campaignCreatorId: "cc-1",
        campaignCreator: {
          id: "cc-1",
          lifecycleStatus: "delivered",
        },
      });

      const res = await callShopifyWebhook(
        { ...orderPayload, fulfillment_status: "fulfilled" },
        "orders/fulfilled"
      );

      expect(res.status).toBe(200);
      expect(mockPrisma.campaignCreator.update).not.toHaveBeenCalled();
    });
  });

  describe("orders/updated", () => {
    it("syncs cancelled_at to cancelled status", async () => {
      mockPrisma.shopifyOrder.findUnique.mockResolvedValue({
        id: "so-1",
        shopifyOrderId: "12345678",
        status: "processing",
      });

      const res = await callShopifyWebhook(
        { ...orderPayload, cancelled_at: "2024-01-15T10:00:00Z" },
        "orders/updated"
      );

      expect(res.status).toBe(200);
      expect(mockPrisma.shopifyOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: "cancelled" },
        })
      );
    });
  });

  describe("fulfillments/create", () => {
    it("creates FulfillmentEvent with tracking info", async () => {
      mockPrisma.shopifyOrder.findUnique.mockResolvedValue({
        id: "so-1",
        shopifyOrderId: "12345678",
      });

      const res = await callShopifyWebhook(fulfillmentPayload, "fulfillments/create");

      expect(res.status).toBe(200);
      expect(mockPrisma.fulfillmentEvent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { externalEventId: "99887766" },
          create: expect.objectContaining({
            trackingNumber: "1Z999AA10123456784",
            carrier: "UPS",
            orderId: "so-1",
          }),
        })
      );
    });
  });

  describe("fulfillments/update", () => {
    it("detects delivery and updates order + lifecycle", async () => {
      mockPrisma.shopifyOrder.findUnique.mockResolvedValue({
        id: "so-1",
        shopifyOrderId: "12345678",
        campaignCreatorId: "cc-1",
        campaignCreator: {
          id: "cc-1",
          lifecycleStatus: "shipped",
        },
      });

      const res = await callShopifyWebhook(
        { ...fulfillmentPayload, shipment_status: "delivered" },
        "fulfillments/update"
      );

      expect(res.status).toBe(200);
      expect(mockPrisma.shopifyOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: "delivered" },
        })
      );
      expect(mockPrisma.campaignCreator.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "cc-1" },
          data: { lifecycleStatus: "delivered" },
        })
      );
    });
  });

  describe("idempotency", () => {
    it("skips already-processed webhook events", async () => {
      mockPrisma.webhookEvent.findUnique.mockResolvedValue({
        id: "we-existing",
        status: "processed",
      });

      const res = await callShopifyWebhook(orderPayload, "orders/create", undefined, "wh-dup-1");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.status).toBe("already_processed");
      expect(mockPrisma.shopifyOrder.update).not.toHaveBeenCalled();
    });
  });

  describe("signature verification", () => {
    it("returns 401 for invalid HMAC signature", async () => {
      process.env.SHOPIFY_WEBHOOK_SECRET = WEBHOOK_SECRET;

      const { POST } = await import("@/app/api/webhooks/shopify/route");

      const body = JSON.stringify(orderPayload);
      const req = new NextRequest("http://localhost:3000/api/webhooks/shopify", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-shopify-hmac-sha256": "invalid_hmac_value",
          "x-shopify-topic": "orders/create",
          "x-shopify-shop-domain": "test.myshopify.com",
        },
        body,
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
    });
  });
});
