import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mocks ──────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  campaignCreatorFindUnique: vi.fn(),
  addressFindFirst: vi.fn(),
  campaignProductFindFirst: vi.fn(),
  shopifyOrderCreate: vi.fn(),
  shopifyOrderUpdate: vi.fn(),
  shopifyOrderDelete: vi.fn(),
  campaignCreatorUpdate: vi.fn(),
  getShopifyClient: vi.fn(),
  clientFetch: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    campaignCreator: {
      findUnique: mocks.campaignCreatorFindUnique,
      update: mocks.campaignCreatorUpdate,
    },
    shippingAddressSnapshot: {
      findFirst: mocks.addressFindFirst,
    },
    campaignProduct: {
      findFirst: mocks.campaignProductFindFirst,
    },
    shopifyOrder: {
      create: mocks.shopifyOrderCreate,
      update: mocks.shopifyOrderUpdate,
      delete: mocks.shopifyOrderDelete,
    },
  },
}));

vi.mock("@/lib/shopify/client", () => ({
  getShopifyClient: mocks.getShopifyClient,
}));

// ── Helpers ────────────────────────────────────────────────

function setupHappyPath() {
  mocks.campaignCreatorFindUnique.mockResolvedValue({
    id: "cc-1",
    shopifyOrder: null,
    creator: { name: "Jane Creator", email: "jane@example.com" },
  });

  mocks.addressFindFirst.mockResolvedValue({
    id: "snap-1",
    fullName: "Jane Creator",
    line1: "123 Main St",
    line2: "Apt 4",
    city: "New York",
    state: "NY",
    postalCode: "10001",
    country: "US",
    phone: "555-1234",
    isActive: true,
    confirmedAt: new Date(),
  });

  mocks.campaignProductFindFirst.mockResolvedValue({
    product: {
      id: "prod-1",
      shopifyVariantId: "12345678",
    },
  });

  // Draft order creation response
  mocks.clientFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      draft_order: { id: 999, order_id: null, name: "#D001" },
    }),
  });

  // Draft order completion response
  mocks.clientFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      draft_order: {
        id: 999,
        order_id: 5001,
        name: "#1001",
        status: "completed",
      },
    }),
  });

  mocks.getShopifyClient.mockResolvedValue({
    storeDomain: "test-store.myshopify.com",
    accessToken: "shpat_xxx",
    fetch: mocks.clientFetch,
  });

  // Claim-first flow: create = pending claim row, update = real Shopify ids
  mocks.shopifyOrderCreate.mockResolvedValue({ id: "order-db-1" });
  mocks.shopifyOrderUpdate.mockResolvedValue({ id: "order-db-1" });
  mocks.campaignCreatorUpdate.mockResolvedValue({});
}

// ── Tests ──────────────────────────────────────────────────

describe("createDraftOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a draft order with 100% discount and completes it", async () => {
    setupHappyPath();

    const { createDraftOrder } = await import("@/lib/shopify/orders");
    const result = await createDraftOrder("brand-1", "creator-1", "camp-1");

    expect(result.shopifyOrderId).toBe("5001");
    expect(result.orderId).toBe("order-db-1");

    // Verify draft order POST payload includes 100% discount
    const draftCallArgs = mocks.clientFetch.mock.calls[0];
    expect(draftCallArgs[0]).toBe("/draft_orders.json");
    expect(draftCallArgs[1].method).toBe("POST");

    const body = JSON.parse(draftCallArgs[1].body);
    expect(body.draft_order.applied_discount.value).toBe("100.0");
    expect(body.draft_order.applied_discount.value_type).toBe("percentage");
  });

  it("completes the draft order via PUT", async () => {
    setupHappyPath();

    const { createDraftOrder } = await import("@/lib/shopify/orders");
    await createDraftOrder("brand-1", "creator-1", "camp-1");

    // Second fetch call is the completion
    const completeCallArgs = mocks.clientFetch.mock.calls[1];
    expect(completeCallArgs[0]).toBe("/draft_orders/999/complete.json");
    expect(completeCallArgs[1].method).toBe("PUT");
  });

  it("persists ShopifyOrder record with correct data", async () => {
    setupHappyPath();

    const { createDraftOrder } = await import("@/lib/shopify/orders");
    await createDraftOrder("brand-1", "creator-1", "camp-1");

    // Claim row is created pending with the atomic idempotency key
    expect(mocks.shopifyOrderCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: "pending",
        campaignCreatorId: "cc-1",
      }),
      select: { id: true },
    });
    expect(
      mocks.shopifyOrderCreate.mock.calls[0][0].data.shopifyOrderId
    ).toMatch(/^pending:/);

    // Claim row is then updated with the real Shopify ids
    expect(mocks.shopifyOrderUpdate).toHaveBeenCalledWith({
      where: { id: "order-db-1" },
      data: {
        shopifyOrderId: "5001",
        shopifyOrderNumber: "#1001",
        status: "created",
        totalPrice: 0,
        currency: "USD",
      },
    });
  });

  it("updates lifecycle status to order_created", async () => {
    setupHappyPath();

    const { createDraftOrder } = await import("@/lib/shopify/orders");
    await createDraftOrder("brand-1", "creator-1", "camp-1");

    expect(mocks.campaignCreatorUpdate).toHaveBeenCalledWith({
      where: { id: "cc-1" },
      data: { lifecycleStatus: "order_created" },
    });
  });

  it("throws when CampaignCreator not found", async () => {
    mocks.campaignCreatorFindUnique.mockResolvedValue(null);

    const { createDraftOrder } = await import("@/lib/shopify/orders");

    await expect(
      createDraftOrder("brand-1", "creator-1", "camp-1"),
    ).rejects.toThrow("CampaignCreator not found");
  });

  it("throws when order already exists (one-order-per-campaign-creator guard)", async () => {
    mocks.campaignCreatorFindUnique.mockResolvedValue({
      id: "cc-1",
      shopifyOrder: { shopifyOrderId: "existing-order-123" },
      creator: { name: "Jane" },
    });

    const { createDraftOrder } = await import("@/lib/shopify/orders");

    await expect(
      createDraftOrder("brand-1", "creator-1", "camp-1"),
    ).rejects.toThrow("Order already exists");
  });

  it("throws when no confirmed shipping address exists", async () => {
    mocks.campaignCreatorFindUnique.mockResolvedValue({
      id: "cc-1",
      shopifyOrder: null,
      creator: { name: "Jane" },
    });
    mocks.addressFindFirst.mockResolvedValue(null);

    const { createDraftOrder } = await import("@/lib/shopify/orders");

    await expect(
      createDraftOrder("brand-1", "creator-1", "camp-1"),
    ).rejects.toThrow("No confirmed shipping address");
  });

  it("throws when no product configured for campaign", async () => {
    mocks.campaignCreatorFindUnique.mockResolvedValue({
      id: "cc-1",
      shopifyOrder: null,
      creator: { name: "Jane" },
    });
    mocks.addressFindFirst.mockResolvedValue({
      id: "snap-1",
      fullName: "Jane",
      line1: "123 Main",
      city: "NYC",
      state: "NY",
      postalCode: "10001",
      country: "US",
    });
    mocks.campaignProductFindFirst.mockResolvedValue(null);

    const { createDraftOrder } = await import("@/lib/shopify/orders");

    await expect(
      createDraftOrder("brand-1", "creator-1", "camp-1"),
    ).rejects.toThrow("No product configured");
  });

  it("throws when product has no Shopify variant ID", async () => {
    mocks.campaignCreatorFindUnique.mockResolvedValue({
      id: "cc-1",
      shopifyOrder: null,
      creator: { name: "Jane" },
    });
    mocks.addressFindFirst.mockResolvedValue({
      id: "snap-1",
      fullName: "Jane",
      line1: "123 Main",
      city: "NYC",
      state: "NY",
      postalCode: "10001",
      country: "US",
    });
    mocks.campaignProductFindFirst.mockResolvedValue({
      product: { id: "prod-1", shopifyVariantId: null },
    });

    const { createDraftOrder } = await import("@/lib/shopify/orders");

    await expect(
      createDraftOrder("brand-1", "creator-1", "camp-1"),
    ).rejects.toThrow("no Shopify variant ID");
  });

  it("throws when Shopify draft order creation fails", async () => {
    mocks.campaignCreatorFindUnique.mockResolvedValue({
      id: "cc-1",
      shopifyOrder: null,
      creator: { name: "Jane" },
    });
    mocks.addressFindFirst.mockResolvedValue({
      id: "snap-1",
      fullName: "Jane Creator",
      line1: "123 Main",
      city: "NYC",
      state: "NY",
      postalCode: "10001",
      country: "US",
    });
    mocks.campaignProductFindFirst.mockResolvedValue({
      product: { id: "prod-1", shopifyVariantId: "12345" },
    });
    mocks.shopifyOrderCreate.mockResolvedValue({ id: "claim-1" });
    mocks.getShopifyClient.mockResolvedValue({
      fetch: vi.fn().mockResolvedValue({
        ok: false,
        text: async () => "Shopify rate limit",
      }),
    });

    const { createDraftOrder } = await import("@/lib/shopify/orders");

    await expect(
      createDraftOrder("brand-1", "creator-1", "camp-1"),
    ).rejects.toThrow("draft order creation failed");
  });

  it("throws when Shopify draft order completion fails", async () => {
    mocks.campaignCreatorFindUnique.mockResolvedValue({
      id: "cc-1",
      shopifyOrder: null,
      creator: { name: "Jane" },
    });
    mocks.addressFindFirst.mockResolvedValue({
      id: "snap-1",
      fullName: "Jane Creator",
      line1: "123 Main",
      city: "NYC",
      state: "NY",
      postalCode: "10001",
      country: "US",
    });
    mocks.campaignProductFindFirst.mockResolvedValue({
      product: { id: "prod-1", shopifyVariantId: "12345" },
    });
    mocks.shopifyOrderCreate.mockResolvedValue({ id: "claim-1" });

    const clientFetch = vi.fn();
    // Draft creation succeeds
    clientFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        draft_order: { id: 999, order_id: null, name: "#D001" },
      }),
    });
    // Completion fails
    clientFetch.mockResolvedValueOnce({
      ok: false,
      text: async () => "Internal server error",
    });

    mocks.getShopifyClient.mockResolvedValue({ fetch: clientFetch });

    const { createDraftOrder } = await import("@/lib/shopify/orders");

    await expect(
      createDraftOrder("brand-1", "creator-1", "camp-1"),
    ).rejects.toThrow("draft order completion failed");
  });

  it("maps shipping address fields correctly to Shopify payload", async () => {
    setupHappyPath();

    const { createDraftOrder } = await import("@/lib/shopify/orders");
    await createDraftOrder("brand-1", "creator-1", "camp-1");

    const body = JSON.parse(mocks.clientFetch.mock.calls[0][1].body);
    const addr = body.draft_order.shipping_address;

    expect(addr.first_name).toBe("Jane");
    expect(addr.last_name).toBe("Creator");
    expect(addr.address1).toBe("123 Main St");
    expect(addr.address2).toBe("Apt 4");
    expect(addr.city).toBe("New York");
    expect(addr.province).toBe("NY");
    expect(addr.zip).toBe("10001");
    expect(addr.country).toBe("US");
    expect(addr.phone).toBe("555-1234");
  });
});
