/**
 * Integration tests: RBAC (Role-Based Access Control)
 *
 * Tests role enforcement through actual route patterns using the
 * approve-address route as the canary — it exercises RBAC, feature flags,
 * and multi-brand cookie resolution.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// ── Hoisted mocks ────────────────────────────────────────────

const mocks = vi.hoisted(() => {
  const brandMembershipDb: Record<string, { role: string; userId: string; brandId: string }> = {};

  return {
    // Supabase auth
    supabaseAuth: {
      getUser: vi.fn(),
    },

    // Cookies
    cookieStore: {
      get: vi.fn(),
    },

    // User lookup
    getUserBySupabaseId: vi.fn(),

    // Brand membership DB store (for multi-brand tests)
    brandMembershipDb,

    // Prisma
    prisma: {
      brandMembership: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
      },
      campaign: { findUnique: vi.fn() },
      campaignCreator: { findUnique: vi.fn() },
      shippingAddressSnapshot: { findUnique: vi.fn(), update: vi.fn() },
      brandConnection: { findUnique: vi.fn() },
      campaignProduct: { findFirst: vi.fn() },
      brandSettings: { findUnique: vi.fn() },
    },

    // Feature flags
    getFeatureFlags: vi.fn(),

    // Inngest
    inngestSend: vi.fn(),
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: mocks.supabaseAuth,
  })),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => mocks.cookieStore),
}));

vi.mock("@/lib/tenancy", () => ({
  getUserBySupabaseId: mocks.getUserBySupabaseId,
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));

vi.mock("@/lib/feature-flags", () => ({
  getFeatureFlags: mocks.getFeatureFlags,
}));

vi.mock("@/lib/inngest/client", () => ({
  inngest: { send: mocks.inngestSend },
}));

vi.mock("@/lib/logger", () => ({ log: vi.fn() }));

// server-only shim for brand-access.ts
vi.mock("server-only", () => ({}));

// Import route AFTER mocks are set up
const { POST } = await import(
  "@/app/api/campaigns/[campaignId]/creators/[creatorId]/approve-address/route"
);

// ── Helpers ──────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown> = {}) {
  return new NextRequest("http://localhost/api/test", {
    method: "POST",
    body: JSON.stringify({ snapshotId: "snap-1", ...body }),
    headers: { "Content-Type": "application/json" },
  });
}

function makeContext(campaignId = "camp-1", creatorId = "creator-1") {
  return { params: Promise.resolve({ campaignId, creatorId }) };
}

function setupAuthenticatedUser(userId = "user-1", supabaseId = "sup-1") {
  mocks.supabaseAuth.getUser.mockResolvedValue({
    data: { user: { id: supabaseId } },
  });

  mocks.getUserBySupabaseId.mockResolvedValue({
    id: userId,
    email: "test@example.com",
  });
}

function setupMembership(
  role: "owner" | "editor" | "viewer",
  brandId = "brand-1"
) {
  mocks.prisma.brandMembership.findFirst.mockResolvedValue({
    id: "mem-1",
    role,
    userId: "user-1",
    brandId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  mocks.prisma.brandMembership.findUnique.mockResolvedValue({
    id: "mem-1",
    role,
    userId: "user-1",
    brandId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function setupValidDataForApproval(brandId = "brand-1") {
  mocks.getFeatureFlags.mockResolvedValue({ shopifyOrderEnabled: true });

  mocks.prisma.campaign.findUnique.mockResolvedValue({
    id: "camp-1",
    brandId,
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

// ── Lifecycle ────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mocks.cookieStore.get.mockReturnValue(undefined); // No brand cookie by default
});

// ── Tests ────────────────────────────────────────────────────

describe("RBAC — role enforcement through approve-address route", () => {
  it("viewer cannot POST to mutation route (403)", async () => {
    setupAuthenticatedUser();
    setupMembership("viewer");
    setupValidDataForApproval();

    const res = await POST(makeRequest(), makeContext());

    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.error).toContain("Write access required");

    // Inngest event should NOT fire
    expect(mocks.inngestSend).not.toHaveBeenCalled();
  });

  it("editor CAN POST (200)", async () => {
    setupAuthenticatedUser();
    setupMembership("editor");
    setupValidDataForApproval();

    const res = await POST(makeRequest(), makeContext());

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);

    // Inngest event SHOULD fire
    expect(mocks.inngestSend).toHaveBeenCalled();
  });

  it("owner CAN POST (200)", async () => {
    setupAuthenticatedUser();
    setupMembership("owner");
    setupValidDataForApproval();

    const res = await POST(makeRequest(), makeContext());

    expect(res.status).toBe(200);
  });

  it("unauthenticated user gets 401", async () => {
    mocks.supabaseAuth.getUser.mockResolvedValue({
      data: { user: null },
    });

    const res = await POST(makeRequest(), makeContext());

    expect(res.status).toBe(401);
  });
});

describe("RBAC — multi-brand cookie resolution", () => {
  it("selects correct brand from cookie", async () => {
    setupAuthenticatedUser();
    setupValidDataForApproval("brand-2");

    // User has memberships in two brands
    // Cookie selects brand-2
    mocks.cookieStore.get.mockImplementation((name: string) => {
      if (name === "seed-active-brand") {
        return { value: "brand-2" };
      }
      return undefined;
    });

    // When cookie is set, findUnique is called (not findFirst)
    mocks.prisma.brandMembership.findUnique.mockResolvedValue({
      id: "mem-2",
      role: "owner",
      userId: "user-1",
      brandId: "brand-2",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await POST(makeRequest(), makeContext());

    expect(res.status).toBe(200);

    // Verify the membership lookup used the cookie's brandId
    expect(mocks.prisma.brandMembership.findUnique).toHaveBeenCalledWith({
      where: {
        userId_brandId: { userId: "user-1", brandId: "brand-2" },
      },
    });
  });

  it("falls back to oldest brand when no cookie is set", async () => {
    setupAuthenticatedUser();
    setupValidDataForApproval();

    // No cookie
    mocks.cookieStore.get.mockReturnValue(undefined);

    // findFirst returns oldest membership
    mocks.prisma.brandMembership.findFirst.mockResolvedValue({
      id: "mem-1",
      role: "owner",
      userId: "user-1",
      brandId: "brand-1",
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
    });

    const res = await POST(makeRequest(), makeContext());

    expect(res.status).toBe(200);

    expect(mocks.prisma.brandMembership.findFirst).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: { createdAt: "asc" },
    });
  });

  it("returns 403 when cookie specifies a brand the user is not a member of", async () => {
    setupAuthenticatedUser();

    // Cookie points to brand-evil
    mocks.cookieStore.get.mockImplementation((name: string) => {
      if (name === "seed-active-brand") {
        return { value: "brand-evil" };
      }
      return undefined;
    });

    // User is NOT a member of brand-evil
    mocks.prisma.brandMembership.findUnique.mockResolvedValue(null);

    const res = await POST(makeRequest(), makeContext());

    // BrandAccessError with status 404 ("No brand found")
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.error).toContain("No brand found");
  });

  it("campaign not belonging to resolved brand returns 404", async () => {
    setupAuthenticatedUser();
    setupMembership("owner", "brand-1");
    setupValidDataForApproval();

    // Campaign belongs to a different brand
    mocks.prisma.campaign.findUnique.mockResolvedValue({
      id: "camp-1",
      brandId: "brand-OTHER",
    });

    const res = await POST(makeRequest(), makeContext());

    expect(res.status).toBe(404);
  });
});
