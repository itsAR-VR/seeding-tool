import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mocks ──────────────────────────────────────────
const mocks = vi.hoisted(() => {
  const capturedHandler = { fn: null as Function | null };

  return {
    capturedHandler,
    snapshotFindUnique: vi.fn(),
    campaignCreatorFindUnique: vi.fn(),
    interventionCreate: vi.fn(),
    getFeatureFlags: vi.fn(),
    createDraftOrder: vi.fn(),
    recordOutcomeEvent: vi.fn(),
    mockCreateFunction: vi.fn((_config: unknown, _trigger: unknown, handler: Function) => {
      capturedHandler.fn = handler;
      return handler;
    }),
  };
});

vi.mock("@/lib/inngest/client", () => ({
  inngest: {
    createFunction: mocks.mockCreateFunction,
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    shippingAddressSnapshot: { findUnique: mocks.snapshotFindUnique },
    campaignCreator: { findUnique: mocks.campaignCreatorFindUnique },
    interventionCase: { create: mocks.interventionCreate },
  },
}));

vi.mock("@/lib/feature-flags", () => ({
  getFeatureFlags: mocks.getFeatureFlags,
}));

vi.mock("@/lib/shopify/orders", () => ({
  createDraftOrder: mocks.createDraftOrder,
}));

vi.mock("@/lib/seeding/outcome-recorder", () => ({
  recordOutcomeEvent: mocks.recordOutcomeEvent,
}));

vi.mock("@/lib/logger", () => ({
  log: vi.fn(),
}));

// Synchronous import triggers createFunction registration with hoisted mock
import "@/lib/inngest/functions/create-order-from-address";

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
        snapshotId: "snap-1",
        campaignCreatorId: "cc-1",
        brandId: "brand-1",
        campaignId: "camp-1",
        ...overrides,
      },
    },
  };
}

// ── Tests ──────────────────────────────────────────────────

describe("createOrderFromAddress Inngest function", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates order and records outcome on success", async () => {
    mocks.snapshotFindUnique.mockResolvedValue({
      id: "snap-1",
      isActive: true,
      confirmedAt: new Date(),
    });
    mocks.campaignCreatorFindUnique.mockResolvedValue({
      id: "cc-1",
      creatorId: "creator-1",
      creator: { id: "creator-1" },
      shopifyOrder: null,
    });
    mocks.getFeatureFlags.mockResolvedValue({ shopifyOrderEnabled: true });
    mocks.createDraftOrder.mockResolvedValue({
      shopifyOrderId: "so-1",
      orderId: "order-1",
    });
    mocks.recordOutcomeEvent.mockResolvedValue({});

    const handler = getHandler();
    const result = await handler(makeEvent());

    expect(result).toEqual({
      status: "success",
      shopifyOrderId: "so-1",
      orderId: "order-1",
    });

    // Verify createDraftOrder called with creatorId, NOT campaignCreatorId
    expect(mocks.createDraftOrder).toHaveBeenCalledWith(
      "brand-1",
      "creator-1",
      "camp-1"
    );

    expect(mocks.recordOutcomeEvent).toHaveBeenCalledWith({
      campaignCreatorId: "cc-1",
      event: { type: "order_created" },
    });
  });

  it("skips when feature flag is disabled", async () => {
    mocks.snapshotFindUnique.mockResolvedValue({
      id: "snap-1",
      isActive: true,
      confirmedAt: new Date(),
    });
    mocks.campaignCreatorFindUnique.mockResolvedValue({
      id: "cc-1",
      creatorId: "creator-1",
      creator: { id: "creator-1" },
      shopifyOrder: null,
    });
    mocks.getFeatureFlags.mockResolvedValue({ shopifyOrderEnabled: false });

    const handler = getHandler();
    const result = await handler(makeEvent());

    expect(result).toEqual({
      status: "skipped",
      reason: "feature_disabled",
    });
    expect(mocks.createDraftOrder).not.toHaveBeenCalled();
  });

  it("returns success without creating duplicate order", async () => {
    mocks.snapshotFindUnique.mockResolvedValue({
      id: "snap-1",
      isActive: true,
      confirmedAt: new Date(),
    });
    mocks.campaignCreatorFindUnique.mockResolvedValue({
      id: "cc-1",
      creatorId: "creator-1",
      creator: { id: "creator-1" },
      shopifyOrder: { id: "existing-order" },
    });
    mocks.getFeatureFlags.mockResolvedValue({ shopifyOrderEnabled: true });

    const handler = getHandler();
    const result = await handler(makeEvent());

    expect(result).toEqual({
      status: "success",
      reason: "order_already_exists",
    });
    expect(mocks.createDraftOrder).not.toHaveBeenCalled();
  });

  it("skips when snapshot is not active", async () => {
    mocks.snapshotFindUnique.mockResolvedValue({
      id: "snap-1",
      isActive: false,
      confirmedAt: null,
    });

    const handler = getHandler();
    const result = await handler(makeEvent());

    expect(result).toEqual({
      status: "skipped",
      reason: "snapshot_not_active_or_confirmed",
    });
    expect(mocks.campaignCreatorFindUnique).not.toHaveBeenCalled();
  });

  it("creates intervention and re-throws on Shopify error", async () => {
    mocks.snapshotFindUnique.mockResolvedValue({
      id: "snap-1",
      isActive: true,
      confirmedAt: new Date(),
    });
    mocks.campaignCreatorFindUnique.mockResolvedValue({
      id: "cc-1",
      creatorId: "creator-1",
      creator: { id: "creator-1" },
      shopifyOrder: null,
    });
    mocks.getFeatureFlags.mockResolvedValue({ shopifyOrderEnabled: true });
    mocks.createDraftOrder.mockRejectedValue(
      new Error("Shopify API rate limited")
    );
    mocks.interventionCreate.mockResolvedValue({});

    const handler = getHandler();

    await expect(handler(makeEvent())).rejects.toThrow(
      "Shopify API rate limited"
    );

    expect(mocks.interventionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "duplicate_order",
        status: "open",
        priority: "high",
        brandId: "brand-1",
        campaignCreatorId: "cc-1",
      }),
    });
  });
});
