import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Billing webhook invoice.paid → mint() tests.
 *
 * Covers:
 * - invoice.paid mints credits to all brands under the subscription's org
 * - invoice.paid with unknown subscription is a no-op
 * - invoice.paid with plan not in CREDITS_PER_PLAN is a no-op
 * - Credit amount matches the plan name
 */

// ─── Mocks ───────────────────────────────────────────────

const mockMint = vi.fn().mockResolvedValue(100);

const mockPrisma = {
  webhookEvent: {
    create: vi.fn().mockResolvedValue({ id: "we-1" }),
    findUnique: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue({}),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  },
  subscription: {
    findUnique: vi.fn(),
    upsert: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
  },
  organization: {
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
vi.mock("@/lib/credits", () => ({
  mint: (...args: unknown[]) => mockMint(...args),
  CREDITS_PER_PLAN: {
    Starter: 100,
    Growth: 500,
    Enterprise: 2000,
  },
}));

// ─── Fixtures ────────────────────────────────────────────

function invoicePaidEvent(subscriptionId = "sub_123") {
  return {
    id: "evt_inv_paid_1",
    type: "invoice.paid",
    data: {
      object: {
        id: "inv_paid_1",
        parent: {
          subscription_details: {
            subscription: subscriptionId,
          },
        },
      },
    },
  };
}

async function callWebhook(body: Record<string, unknown>) {
  mockStripe.webhooks.constructEvent.mockReturnValue(body);

  const mod = await import("@/app/api/billing/webhook/route");
  const req = new NextRequest("http://localhost:3000/api/billing/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": "sig_valid",
    },
    body: JSON.stringify(body),
  });

  return mod.POST(req);
}

// ─── Tests ───────────────────────────────────────────────

describe("Billing webhook: invoice.paid → mint credits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  });

  it("mints credits to all brands under the subscription org", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      id: "sub-row-1",
      stripeSubscriptionId: "sub_123",
      plan: { name: "Starter" },
      organization: {
        id: "org-1",
        clients: [
          {
            brands: [{ id: "brand-1" }, { id: "brand-2" }],
          },
        ],
      },
    });

    const res = await callWebhook(invoicePaidEvent());
    expect(res.status).toBe(200);

    // Should mint to both brands, with the invoice idempotency key
    expect(mockMint).toHaveBeenCalledTimes(2);
    expect(mockMint).toHaveBeenCalledWith(
      "brand-1",
      100,
      expect.stringContaining("invoice.paid"),
      expect.objectContaining({ stripeInvoiceId: "inv_paid_1" }),
      { stripeInvoiceId: "inv_paid_1" }
    );
    expect(mockMint).toHaveBeenCalledWith(
      "brand-2",
      100,
      expect.stringContaining("invoice.paid"),
      expect.objectContaining({ stripeInvoiceId: "inv_paid_1" }),
      { stripeInvoiceId: "inv_paid_1" }
    );
  });

  it("is a no-op when subscription is not found", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(null);

    const res = await callWebhook(invoicePaidEvent("sub_unknown"));
    expect(res.status).toBe(200);
    expect(mockMint).not.toHaveBeenCalled();
  });

  it("is a no-op when plan has no credit allocation", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      id: "sub-row-1",
      plan: { name: "Free" }, // Not in CREDITS_PER_PLAN
      organization: {
        id: "org-1",
        clients: [{ brands: [{ id: "brand-1" }] }],
      },
    });

    const res = await callWebhook(invoicePaidEvent());
    expect(res.status).toBe(200);
    expect(mockMint).not.toHaveBeenCalled();
  });
});
