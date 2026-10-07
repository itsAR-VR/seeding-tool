import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getCurrentBrandMembership: vi.fn(),
  requireWriteAccess: vi.fn((m: unknown) => m),
  getFeatureFlags: vi.fn(),
  completeDraftOrder: vi.fn(),
  recordOutcomeEvent: vi.fn(),
  prisma: {
    campaign: { findUnique: vi.fn() },
    campaignCreator: { findUnique: vi.fn() },
    interventionCase: { create: vi.fn() },
  },
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

vi.mock("@/lib/feature-flags", () => ({
  getFeatureFlags: mocks.getFeatureFlags,
}));

vi.mock("@/lib/shopify/orders", () => ({
  completeDraftOrder: mocks.completeDraftOrder,
}));

vi.mock("@/lib/seeding/outcome-recorder", () => ({
  recordOutcomeEvent: mocks.recordOutcomeEvent,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

import { POST } from "@/app/api/campaigns/[campaignId]/creators/[creatorId]/order/route";

function makeContext(campaignId = "camp-1", creatorId = "creator-1") {
  return { params: Promise.resolve({ campaignId, creatorId }) };
}

describe("POST /api/campaigns/[campaignId]/creators/[creatorId]/order", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentBrandMembership.mockResolvedValue({
      id: "mem-1",
      role: "owner",
      userId: "user-1",
      brandId: "brand-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mocks.getFeatureFlags.mockResolvedValue({ shopifyOrderEnabled: true });
    mocks.prisma.campaign.findUnique.mockResolvedValue({
      id: "camp-1",
      brandId: "brand-1",
    });
    mocks.completeDraftOrder.mockResolvedValue({
      shopifyOrderId: "5001",
      orderId: "order-db-1",
      campaignCreatorId: "cc-1",
    });
    mocks.recordOutcomeEvent.mockResolvedValue({});
  });

  it("completes a reviewed draft and records order_created after completion", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/test", { method: "POST" }),
      makeContext()
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      success: true,
      shopifyOrderId: "5001",
      orderId: "order-db-1",
    });
    expect(mocks.completeDraftOrder).toHaveBeenCalledWith(
      "brand-1",
      "creator-1",
      "camp-1"
    );
    expect(mocks.recordOutcomeEvent).toHaveBeenCalledWith({
      campaignCreatorId: "cc-1",
      event: { type: "order_created" },
    });
  });

  it("does not complete drafts when Shopify order creation is disabled", async () => {
    mocks.getFeatureFlags.mockResolvedValue({ shopifyOrderEnabled: false });

    const res = await POST(
      new NextRequest("http://localhost/api/test", { method: "POST" }),
      makeContext()
    );

    expect(res.status).toBe(403);
    expect(mocks.completeDraftOrder).not.toHaveBeenCalled();
    expect(mocks.recordOutcomeEvent).not.toHaveBeenCalled();
  });
});
