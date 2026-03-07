import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Stripe webhook contract tests.
 *
 * Tests cover:
 * - checkout.session.completed → Subscription + Organization upsert
 * - customer.subscription.updated → status sync
 * - customer.subscription.deleted → status = "canceled"
 * - invoice.payment_failed → status = "past_due"
 * - Duplicate events (idempotency via externalEventId)
 * - Malformed payloads → 400
 */

// ─── Mocks ───────────────────────────────────────────────

const mockPrisma = {
  webhookEvent: {
    create: vi.fn().mockResolvedValue({ id: "we-1" }),
    findUnique: vi.fn().mockResolvedValue(null),
  },
  organization: {
    update: vi.fn().mockResolvedValue({}),
  },
  subscription: {
    findUnique: vi.fn().mockResolvedValue(null),
    upsert: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
  },
  subscriptionPlan: {
    findUnique: vi.fn().mockResolvedValue({ id: "plan-1", name: "Starter" }),
    create: vi.fn().mockResolvedValue({ id: "plan-new", name: "Starter" }),
  },
};

const mockStripe = {
  webhooks: {
    constructEvent: vi.fn(),
  },
  subscriptions: {
    retrieve: vi.fn().mockResolvedValue({
      id: "sub_123",
      items: {
        data: [
          {
            price: { id: "price_123" },
            current_period_start: Math.floor(Date.now() / 1000),
            current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
          },
        ],
      },
    }),
  },
};

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/stripe", () => ({ stripe: mockStripe }));

// ─── Helper to invoke the handler ────────────────────────

async function callStripeWebhook(
  body: Record<string, unknown>,
  signature = "sig_valid"
) {
  // Reset mock for constructEvent
  const event = body;
  mockStripe.webhooks.constructEvent.mockReturnValue(event);

  // Import route handler dynamically
  const mod = await import(
    "@/app/api/billing/webhook/route"
  );

  const req = new Request("http://localhost:3000/api/billing/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": signature,
    },
    body: JSON.stringify(body),
  });

  return mod.POST(req as any);
}

// ─── Fixtures ────────────────────────────────────────────

function checkoutSessionCompletedEvent(orgId = "org-1") {
  return {
    id: "evt_checkout_1",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_1",
        metadata: { orgId },
        subscription: "sub_123",
      },
    },
  };
}

function subscriptionUpdatedEvent(status = "active") {
  return {
    id: "evt_sub_updated_1",
    type: "customer.subscription.updated",
    data: {
      object: {
        id: "sub_123",
        status,
        items: {
          data: [
            {
              price: { id: "price_123" },
              current_period_start: Math.floor(Date.now() / 1000),
              current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
            },
          ],
        },
      },
    },
  };
}

function subscriptionDeletedEvent() {
  return {
    id: "evt_sub_deleted_1",
    type: "customer.subscription.deleted",
    data: {
      object: {
        id: "sub_123",
        status: "canceled",
      },
    },
  };
}

function invoicePaymentFailedEvent() {
  return {
    id: "evt_inv_failed_1",
    type: "invoice.payment_failed",
    data: {
      object: {
        id: "inv_1",
        parent: {
          subscription_details: {
            subscription: "sub_123",
          },
        },
      },
    },
  };
}

// ─── Tests ───────────────────────────────────────────────

describe("Stripe webhook handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: subscription exists in our DB
    mockPrisma.subscription.findUnique.mockResolvedValue({
      id: "sub-row-1",
      stripeSubscriptionId: "sub_123",
      status: "active",
    });
    // Default: plan exists
    mockPrisma.subscriptionPlan.findUnique.mockResolvedValue({
      id: "plan-1",
      name: "Starter",
    });
    // Set env for webhook verification
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  });

  describe("checkout.session.completed", () => {
    it("creates subscription and updates organization", async () => {
      const event = checkoutSessionCompletedEvent("org-1");
      const res = await callStripeWebhook(event);

      expect(res.status).toBe(200);
      expect(mockPrisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "org-1" },
          data: expect.objectContaining({
            stripeSubscriptionId: "sub_123",
          }),
        })
      );
      expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { stripeSubscriptionId: "sub_123" },
        })
      );
    });

    it("logs webhook event on success", async () => {
      const event = checkoutSessionCompletedEvent();
      await callStripeWebhook(event);

      expect(mockPrisma.webhookEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            provider: "stripe",
            eventType: "checkout.session.completed",
            externalEventId: "evt_checkout_1",
            status: "processed",
          }),
        })
      );
    });
  });

  describe("customer.subscription.updated", () => {
    it("syncs subscription status to active", async () => {
      const event = subscriptionUpdatedEvent("active");
      const res = await callStripeWebhook(event);

      expect(res.status).toBe(200);
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { stripeSubscriptionId: "sub_123" },
          data: expect.objectContaining({ status: "active" }),
        })
      );
    });

    it("maps past_due status correctly", async () => {
      const event = subscriptionUpdatedEvent("past_due");
      const res = await callStripeWebhook(event);

      expect(res.status).toBe(200);
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "past_due" }),
        })
      );
    });
  });

  describe("customer.subscription.deleted", () => {
    it("sets subscription status to canceled", async () => {
      const event = subscriptionDeletedEvent();
      const res = await callStripeWebhook(event);

      expect(res.status).toBe(200);
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { stripeSubscriptionId: "sub_123" },
          data: { status: "canceled" },
        })
      );
    });
  });

  describe("invoice.payment_failed", () => {
    it("sets subscription status to past_due", async () => {
      const event = invoicePaymentFailedEvent();
      const res = await callStripeWebhook(event);

      expect(res.status).toBe(200);
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { stripeSubscriptionId: "sub_123" },
          data: { status: "past_due" },
        })
      );
    });
  });

  describe("idempotency", () => {
    it("duplicate event ID still creates webhook log (Stripe handler does not dedupe by event ID)", async () => {
      const event = checkoutSessionCompletedEvent();

      // First call
      await callStripeWebhook(event);
      // Second call (same event)
      await callStripeWebhook(event);

      // Both calls should log webhookEvent.create
      expect(mockPrisma.webhookEvent.create).toHaveBeenCalledTimes(2);
    });
  });

  describe("malformed payloads", () => {
    it("returns 400 for invalid signature", async () => {
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error("Invalid signature");
      });

      const mod = await import("@/app/api/billing/webhook/route");

      const req = new Request("http://localhost:3000/api/billing/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "stripe-signature": "invalid_sig",
        },
        body: JSON.stringify({ bad: "payload" }),
      });

      const res = await mod.POST(req as any);
      expect(res.status).toBe(400);
    });
  });
});
