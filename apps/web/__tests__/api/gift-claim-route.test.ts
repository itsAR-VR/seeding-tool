import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { hashClaimToken } from "@/lib/gift-claims/tokens";

const mocks = vi.hoisted(() => ({
  claimFindUnique: vi.fn(),
  transaction: vi.fn(),
  getFeatureFlags: vi.fn(),
  createDraftOrder: vi.fn(),
  snapshotUpdateMany: vi.fn(),
  snapshotUpdate: vi.fn(),
  campaignCreatorUpdate: vi.fn(),
  tx: {
    creatorGiftClaim: {
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    shippingAddressSnapshot: {
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    creator: {
      update: vi.fn(),
    },
    campaignCreator: {
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    creatorGiftClaim: {
      findUnique: mocks.claimFindUnique,
    },
    shippingAddressSnapshot: {
      updateMany: mocks.snapshotUpdateMany,
      update: mocks.snapshotUpdate,
    },
    campaignCreator: {
      update: mocks.campaignCreatorUpdate,
    },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/feature-flags", () => ({
  getFeatureFlags: mocks.getFeatureFlags,
}));

vi.mock("@/lib/shopify/orders", () => ({
  createDraftOrder: mocks.createDraftOrder,
}));

vi.mock("@/lib/logger", () => ({ log: vi.fn() }));

import { GET, POST } from "@/app/api/gift-claims/[token]/route";

function makeContext(token = "raw-token") {
  return { params: Promise.resolve({ token }) };
}

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/gift-claims/raw-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeClaim(overrides: Record<string, unknown> = {}) {
  return {
    id: "claim-1",
    tokenHash: hashClaimToken("raw-token"),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    claimedAt: null,
    revokedAt: null,
    campaignCreatorId: "cc-1",
    campaignProductId: "cp-1",
    shippingAddressSnapshotId: null,
    campaignProduct: {
      product: { name: "Kalm Mouth Tape 7 Pack" },
    },
    campaignCreator: {
      id: "cc-1",
      creatorId: "creator-1",
      campaign: {
        name: "Kalm Creator Seeding",
        brand: { name: "Kalm" },
      },
    },
    ...overrides,
  };
}

describe("public gift claim route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(async (arg) =>
      typeof arg === "function" ? arg(mocks.tx) : Promise.all(arg)
    );
    mocks.getFeatureFlags.mockResolvedValue({ claimAutoDraftEnabled: false });
    mocks.snapshotUpdateMany.mockResolvedValue({ count: 0 });
    mocks.snapshotUpdate.mockResolvedValue({});
    mocks.campaignCreatorUpdate.mockResolvedValue({});
    mocks.createDraftOrder.mockResolvedValue({ shopifyDraftOrderId: "d1", shopifyDraftOrderName: "#D1", orderId: "o1" });
    mocks.tx.creatorGiftClaim.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.shippingAddressSnapshot.updateMany.mockResolvedValue({ count: 0 });
    mocks.tx.shippingAddressSnapshot.create.mockResolvedValue({ id: "snap-1" });
    mocks.tx.creator.update.mockResolvedValue({});
    mocks.tx.creatorGiftClaim.update.mockResolvedValue({});
    mocks.tx.campaignCreator.update.mockResolvedValue({});
  });

  it("GET returns only safe display data", async () => {
    mocks.claimFindUnique.mockResolvedValue(makeClaim());

    const response = await GET(new NextRequest("http://localhost"), makeContext());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(body).toMatchObject({
      brandName: "Kalm",
      campaignName: "Kalm Creator Seeding",
      giftName: "Kalm Mouth Tape 7 Pack",
    });
    expect(JSON.stringify(body)).not.toContain("creator-1");
  });

  it("POST validates and stores a creator-provided address for review only", async () => {
    mocks.claimFindUnique.mockResolvedValue(makeClaim());

    const response = await POST(
      makeRequest({
        fullName: "Jane Creator",
        email: "jane@example.com",
        phone: "555-1234",
        line1: "123 Main St",
        line2: "Apt 4",
        city: "Miami",
        state: "fl",
        postalCode: "33131",
      }),
      makeContext()
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      status: "submitted_for_review",
    });
    expect(mocks.tx.creatorGiftClaim.updateMany).toHaveBeenCalledWith({
      where: {
        id: "claim-1",
        claimedAt: null,
        revokedAt: null,
        expiresAt: expect.any(Object),
      },
      data: { claimedAt: expect.any(Date) },
    });
    expect(mocks.tx.shippingAddressSnapshot.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        source: "creator_provided",
        isActive: false,
        isLocked: false,
        campaignCreatorId: "cc-1",
        state: "FL",
        country: "US",
      }),
      select: { id: true },
    });
    expect(mocks.tx.creator.update).not.toHaveBeenCalled();
    expect(mocks.tx.creatorGiftClaim.update).toHaveBeenCalledWith({
      where: { id: "claim-1" },
      data: {
        shippingAddressSnapshotId: "snap-1",
        contactEmail: "jane@example.com",
        contactPhone: "555-1234",
      },
    });
    expect(mocks.tx.campaignCreator.update).toHaveBeenCalledWith({
      where: { id: "cc-1" },
      data: { lifecycleStatus: "address_review" },
    });
  });

  it("POST never creates an order when auto-draft is off", async () => {
    mocks.claimFindUnique.mockResolvedValue(
      makeClaim({
        campaignCreator: {
          id: "cc-1",
          creatorId: "creator-1",
          campaign: { id: "camp-1", brandId: "brand-1", name: "Kalm", brand: { name: "Kalm" } },
        },
      })
    );

    const response = await POST(
      makeRequest({
        fullName: "Jane Creator",
        email: "jane@example.com",
        line1: "123 Main St",
        city: "Miami",
        state: "FL",
        postalCode: "33131",
      }),
      makeContext()
    );

    expect((await response.json()).status).toBe("submitted_for_review");
    expect(mocks.createDraftOrder).not.toHaveBeenCalled();
    expect(mocks.snapshotUpdate).not.toHaveBeenCalled();
  });

  it("POST creates a Shopify draft (not a completed order) when auto-draft is on", async () => {
    mocks.getFeatureFlags.mockResolvedValue({ claimAutoDraftEnabled: true });
    mocks.claimFindUnique.mockResolvedValue(
      makeClaim({
        campaignCreator: {
          id: "cc-1",
          creatorId: "creator-1",
          campaign: { id: "camp-1", brandId: "brand-1", name: "Kalm", brand: { name: "Kalm" } },
        },
      })
    );

    const response = await POST(
      makeRequest({
        fullName: "Jane Creator",
        email: "jane@example.com",
        line1: "123 Main St",
        city: "Miami",
        state: "FL",
        postalCode: "33131",
      }),
      makeContext()
    );

    expect((await response.json()).status).toBe("draft_order_created");
    expect(mocks.snapshotUpdate).toHaveBeenCalledWith({
      where: { id: "snap-1" },
      data: { isActive: true, confirmedAt: expect.any(Date) },
    });
    expect(mocks.createDraftOrder).toHaveBeenCalledWith("brand-1", "creator-1", "camp-1", {
      email: "jane@example.com",
    });
  });

  it("POST still succeeds for the creator if the Shopify draft fails", async () => {
    mocks.getFeatureFlags.mockResolvedValue({ claimAutoDraftEnabled: true });
    mocks.createDraftOrder.mockRejectedValue(new Error("shopify down"));
    mocks.claimFindUnique.mockResolvedValue(
      makeClaim({
        campaignCreator: {
          id: "cc-1",
          creatorId: "creator-1",
          campaign: { id: "camp-1", brandId: "brand-1", name: "Kalm", brand: { name: "Kalm" } },
        },
      })
    );

    const response = await POST(
      makeRequest({
        fullName: "Jane Creator",
        email: "jane@example.com",
        line1: "123 Main St",
        city: "Miami",
        state: "FL",
        postalCode: "33131",
      }),
      makeContext()
    );

    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe("submitted_for_review");
    expect(mocks.campaignCreatorUpdate).not.toHaveBeenCalled();
  });

  it("POST rejects expired or already-submitted tokens", async () => {
    mocks.claimFindUnique.mockResolvedValue(
      makeClaim({ claimedAt: new Date() })
    );

    const response = await POST(
      makeRequest({
        fullName: "Jane Creator",
        email: "jane@example.com",
        line1: "123 Main St",
        city: "Miami",
        state: "FL",
        postalCode: "33131",
      }),
      makeContext()
    );

    expect(response.status).toBe(410);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("POST rejects incomplete US addresses", async () => {
    mocks.claimFindUnique.mockResolvedValue(makeClaim());

    const response = await POST(
      makeRequest({
        fullName: "Jane Creator",
        email: "jane@example.com",
        line1: "123 Main St",
        city: "Miami",
        state: "Florida",
        postalCode: "not-a-zip",
      }),
      makeContext()
    );

    expect(response.status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
