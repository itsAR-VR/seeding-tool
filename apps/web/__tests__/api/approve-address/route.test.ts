import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// ── Hoisted mocks ──────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  getCurrentBrandMembership: vi.fn(),
  requireWriteAccess: vi.fn((m: unknown) => m),
  getFeatureFlags: vi.fn(),
  inngestSend: vi.fn(),
  prisma: {
    campaign: { findUnique: vi.fn() },
    campaignCreator: { findUnique: vi.fn() },
    shippingAddressSnapshot: { findUnique: vi.fn(), update: vi.fn() },
    brandConnection: { findUnique: vi.fn() },
    campaignProduct: { findFirst: vi.fn() },
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

vi.mock("@/lib/inngest/client", () => ({
  inngest: { send: mocks.inngestSend },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@/lib/logger", () => ({
  log: vi.fn(),
}));

import { POST } from "@/app/api/campaigns/[campaignId]/creators/[creatorId]/approve-address/route";

// ── Helpers ────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/test", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeContext(campaignId = "camp-1", creatorId = "creator-1") {
  return { params: Promise.resolve({ campaignId, creatorId }) };
}

function setupValidDefaults() {
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
  mocks.prisma.campaignCreator.findUnique.mockResolvedValue({
    id: "cc-1",
    campaignId: "camp-1",
    creatorId: "creator-1",
    lifecycleStatus: "replied",
  });
  mocks.prisma.shippingAddressSnapshot.findUnique.mockResolvedValue({
    id: "snap-1",
    campaignCreatorId: "cc-1",
    isActive: false,
  });
  mocks.prisma.shippingAddressSnapshot.update.mockResolvedValue({});
  mocks.prisma.brandConnection.findUnique.mockResolvedValue({
    id: "conn-1",
    provider: "shopify",
    status: "connected",
  });
  mocks.prisma.campaignProduct.findFirst.mockResolvedValue({
    id: "cp-1",
    shopifyVariantId: "variant-1",
  });
  mocks.inngestSend.mockResolvedValue(undefined);
}

// ── Tests ──────────────────────────────────────────────────

describe("POST /api/campaigns/[campaignId]/creators/[creatorId]/approve-address", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupValidDefaults();
  });

  it("returns 200 and fires event with valid data", async () => {
    const res = await POST(makeRequest({ snapshotId: "snap-1" }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);

    expect(mocks.prisma.shippingAddressSnapshot.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "snap-1" },
        data: expect.objectContaining({
          isActive: true,
          confirmedBy: "user-1",
        }),
      })
    );

    expect(mocks.inngestSend).toHaveBeenCalledWith({
      name: "shipping/address.approved",
      data: {
        snapshotId: "snap-1",
        campaignCreatorId: "cc-1",
        brandId: "brand-1",
        campaignId: "camp-1",
      },
    });
  });

  it("returns 400 when snapshotId is missing", async () => {
    const res = await POST(makeRequest({}), makeContext());
    expect(res.status).toBe(400);
  });

  it("returns 409 when lifecycle is opted_out", async () => {
    mocks.prisma.campaignCreator.findUnique.mockResolvedValue({
      id: "cc-1",
      lifecycleStatus: "opted_out",
    });

    const res = await POST(makeRequest({ snapshotId: "snap-1" }), makeContext());
    expect(res.status).toBe(409);

    const body = await res.json();
    expect(body.error).toContain("opted_out");
  });

  it("returns 409 when lifecycle is completed", async () => {
    mocks.prisma.campaignCreator.findUnique.mockResolvedValue({
      id: "cc-1",
      lifecycleStatus: "completed",
    });

    const res = await POST(makeRequest({ snapshotId: "snap-1" }), makeContext());
    expect(res.status).toBe(409);
  });

  it("returns 200 for address_confirmed lifecycle", async () => {
    mocks.prisma.campaignCreator.findUnique.mockResolvedValue({
      id: "cc-1",
      campaignId: "camp-1",
      creatorId: "creator-1",
      lifecycleStatus: "address_confirmed",
    });

    const res = await POST(makeRequest({ snapshotId: "snap-1" }), makeContext());
    expect(res.status).toBe(200);
  });

  it("returns 200 for creator-submitted address_review lifecycle", async () => {
    mocks.prisma.campaignCreator.findUnique.mockResolvedValue({
      id: "cc-1",
      campaignId: "camp-1",
      creatorId: "creator-1",
      lifecycleStatus: "address_review",
    });

    const res = await POST(makeRequest({ snapshotId: "snap-1" }), makeContext());
    expect(res.status).toBe(200);
  });

  it("returns 422 when no Shopify connection", async () => {
    mocks.prisma.brandConnection.findUnique.mockResolvedValue(null);

    const res = await POST(makeRequest({ snapshotId: "snap-1" }), makeContext());
    expect(res.status).toBe(422);

    const body = await res.json();
    expect(body.error).toContain("Shopify connection");
  });

  it("returns 422 when Shopify connection is disconnected", async () => {
    mocks.prisma.brandConnection.findUnique.mockResolvedValue({
      id: "conn-1",
      provider: "shopify",
      status: "disconnected",
    });

    const res = await POST(makeRequest({ snapshotId: "snap-1" }), makeContext());
    expect(res.status).toBe(422);
  });

  it("returns 422 when no campaign product with Shopify variant", async () => {
    mocks.prisma.campaignProduct.findFirst.mockResolvedValue(null);

    const res = await POST(makeRequest({ snapshotId: "snap-1" }), makeContext());
    expect(res.status).toBe(422);

    const body = await res.json();
    expect(body.error).toContain("product");
  });

  it("returns 404 when snapshot does not belong to campaign creator", async () => {
    mocks.prisma.shippingAddressSnapshot.findUnique.mockResolvedValue({
      id: "snap-1",
      campaignCreatorId: "cc-other",
      isActive: false,
    });

    const res = await POST(makeRequest({ snapshotId: "snap-1" }), makeContext());
    expect(res.status).toBe(404);
  });

  it("returns 403 when shopifyOrderEnabled is false", async () => {
    mocks.getFeatureFlags.mockResolvedValue({ shopifyOrderEnabled: false });

    const res = await POST(makeRequest({ snapshotId: "snap-1" }), makeContext());
    expect(res.status).toBe(403);
  });
});
