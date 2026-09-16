import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getCurrentBrandMembership: vi.fn(),
  requireWriteAccess: vi.fn((membership: unknown) => membership),
  campaignFindFirst: vi.fn(),
  campaignCreatorFindUnique: vi.fn(),
  claimUpdateMany: vi.fn(),
  claimCreate: vi.fn(),
  transaction: vi.fn(),
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

vi.mock("@/lib/prisma", () => ({
  prisma: {
    campaign: {
      findFirst: mocks.campaignFindFirst,
    },
    campaignCreator: {
      findUnique: mocks.campaignCreatorFindUnique,
    },
    creatorGiftClaim: {
      updateMany: mocks.claimUpdateMany,
      create: mocks.claimCreate,
    },
    $transaction: mocks.transaction,
  },
}));

import { POST } from "@/app/api/campaigns/[campaignId]/creators/[creatorId]/gift-claim/route";

function makeContext(campaignId = "camp-1", creatorId = "creator-1") {
  return { params: Promise.resolve({ campaignId, creatorId }) };
}

function makeRequest() {
  return new NextRequest(
    "http://localhost/api/campaigns/camp-1/creators/creator-1/gift-claim",
    { method: "POST" }
  );
}

function setupHappyPath() {
  mocks.getCurrentBrandMembership.mockResolvedValue({
    userId: "user-1",
    brandId: "brand-1",
    role: "owner",
  });
  mocks.campaignFindFirst.mockResolvedValue({
    id: "camp-1",
    brandId: "brand-1",
    campaignProducts: [
      {
        id: "cp-1",
        product: { name: "Kalm Mouth Tape 7 Pack" },
      },
    ],
  });
  mocks.campaignCreatorFindUnique.mockResolvedValue({
    id: "cc-1",
    reviewStatus: "approved",
  });
  mocks.claimUpdateMany.mockResolvedValue({ count: 0 });
  mocks.claimCreate.mockResolvedValue({ id: "claim-1" });
  mocks.transaction.mockResolvedValue([]);
}

describe("internal gift claim link generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-16T12:00:00.000Z"));
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://seed.example.com");
    setupHappyPath();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("creates a claim link for an approved creator without storing the raw token", async () => {
    const response = await POST(makeRequest(), makeContext());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(body.productName).toBe("Kalm Mouth Tape 7 Pack");
    expect(body.expiresAt).toBe("2026-09-30T12:00:00.000Z");
    expect(body.claimUrl).toMatch(/^https:\/\/seed\.example\.com\/claim\//);

    const rawToken = String(body.claimUrl).split("/claim/")[1];
    expect(rawToken).toBeTruthy();

    expect(mocks.claimCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        expiresAt: new Date("2026-09-30T12:00:00.000Z"),
        createdBy: "user-1",
        campaignCreatorId: "cc-1",
        campaignProductId: "cp-1",
      }),
    });

    const storedData = mocks.claimCreate.mock.calls[0][0].data;
    expect(storedData.tokenHash).toHaveLength(64);
    expect(storedData.tokenHash).not.toBe(rawToken);
    expect(JSON.stringify(storedData)).not.toContain(rawToken);
  });

  it("returns 422 when the campaign has no product", async () => {
    mocks.campaignFindFirst.mockResolvedValue({
      id: "camp-1",
      brandId: "brand-1",
      campaignProducts: [],
    });

    const response = await POST(makeRequest(), makeContext());

    expect(response.status).toBe(422);
    expect(mocks.claimCreate).not.toHaveBeenCalled();
  });

  it("returns 409 when the creator is not approved", async () => {
    mocks.campaignCreatorFindUnique.mockResolvedValue({
      id: "cc-1",
      reviewStatus: "pending",
    });

    const response = await POST(makeRequest(), makeContext());

    expect(response.status).toBe(409);
    expect(mocks.claimCreate).not.toHaveBeenCalled();
  });

  it("revokes active unused links before creating a fresh one", async () => {
    await POST(makeRequest(), makeContext());

    expect(mocks.claimUpdateMany).toHaveBeenCalledWith({
      where: {
        campaignCreatorId: "cc-1",
        claimedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date("2026-09-16T12:00:00.000Z") },
      },
      data: { revokedAt: new Date("2026-09-16T12:00:00.000Z") },
    });
  });
});
