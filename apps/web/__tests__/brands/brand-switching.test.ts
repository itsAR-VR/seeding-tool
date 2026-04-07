import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

/**
 * Brand switching tests.
 *
 * Covers:
 * - Cookie-based brand selection via getCurrentBrandMembership
 * - POST /api/brands/switch validates membership
 * - GET /api/brands/list returns all user brands
 * - Spoofed cookie for non-member brand returns 403
 */

// ─── Mocks ───────────────────────────────────────────────

const mockCookieStore = new Map<string, { value: string }>();
const mockCookieSet = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: (name: string) => mockCookieStore.get(name),
    set: mockCookieSet,
  }),
}));

const mockSupabaseUser = {
  id: "supabase-user-1",
  email: "test@example.com",
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: mockSupabaseUser },
      }),
    },
  }),
}));

vi.mock("@/lib/tenancy", () => ({
  getUserBySupabaseId: vi.fn().mockResolvedValue({
    id: "user-1",
    supabaseUserId: "supabase-user-1",
  }),
}));

const mockPrisma = {
  brandMembership: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// ─── Tests ───────────────────────────────────────────────

describe("getCurrentBrandMembership with cookie", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookieStore.clear();
  });

  it("uses cookie brandId when present", async () => {
    mockCookieStore.set("seed-active-brand", { value: "brand-2" });

    mockPrisma.brandMembership.findUnique.mockResolvedValue({
      id: "bm-2",
      userId: "user-1",
      brandId: "brand-2",
      role: "editor",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const { getCurrentBrandMembership } = await import(
      "@/lib/integrations/brand-access"
    );
    const membership = await getCurrentBrandMembership();

    expect(membership.brandId).toBe("brand-2");
    expect(mockPrisma.brandMembership.findUnique).toHaveBeenCalledWith({
      where: { userId_brandId: { userId: "user-1", brandId: "brand-2" } },
    });
    // findFirst should NOT have been called
    expect(mockPrisma.brandMembership.findFirst).not.toHaveBeenCalled();
  });

  it("falls back to findFirst when no cookie", async () => {
    // No cookie set
    mockPrisma.brandMembership.findFirst.mockResolvedValue({
      id: "bm-1",
      userId: "user-1",
      brandId: "brand-1",
      role: "owner",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const { getCurrentBrandMembership } = await import(
      "@/lib/integrations/brand-access"
    );
    const membership = await getCurrentBrandMembership();

    expect(membership.brandId).toBe("brand-1");
    expect(mockPrisma.brandMembership.findFirst).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: { createdAt: "asc" },
    });
  });

  it("throws 403 when cookie brand is not user's", async () => {
    mockCookieStore.set("seed-active-brand", { value: "brand-999" });
    mockPrisma.brandMembership.findUnique.mockResolvedValue(null);

    const { getCurrentBrandMembership, BrandAccessError } = await import(
      "@/lib/integrations/brand-access"
    );

    await expect(getCurrentBrandMembership()).rejects.toThrow(BrandAccessError);
  });
});

describe("POST /api/brands/switch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookieStore.clear();
  });

  it("sets cookie for valid membership", async () => {
    mockPrisma.brandMembership.findUnique.mockResolvedValue({
      id: "bm-2",
      userId: "user-1",
      brandId: "brand-2",
      role: "editor",
      brand: { id: "brand-2", name: "Second Brand" },
    });

    const { POST } = await import("@/app/api/brands/switch/route");
    const { NextRequest } = require("next/server");
    const req = new NextRequest("http://localhost:3000/api/brands/switch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ brandId: "brand-2" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.activeBrandId).toBe("brand-2");
    expect(json.brandName).toBe("Second Brand");
    expect(mockCookieSet).toHaveBeenCalledWith(
      "seed-active-brand",
      "brand-2",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "strict",
        path: "/",
      })
    );
  });

  it("returns 403 for non-member brand", async () => {
    mockPrisma.brandMembership.findUnique.mockResolvedValue(null);

    const { POST } = await import("@/app/api/brands/switch/route");
    const { NextRequest } = require("next/server");
    const req = new NextRequest("http://localhost:3000/api/brands/switch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ brandId: "brand-999" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 400 when brandId is missing", async () => {
    const { POST } = await import("@/app/api/brands/switch/route");
    const { NextRequest } = require("next/server");
    const req = new NextRequest("http://localhost:3000/api/brands/switch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("GET /api/brands/list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all brands for user", async () => {
    mockPrisma.brandMembership.findMany.mockResolvedValue([
      {
        brand: { id: "brand-1", name: "First", websiteUrl: "https://first.com" },
        role: "owner",
      },
      {
        brand: { id: "brand-2", name: "Second", websiteUrl: null },
        role: "editor",
      },
    ]);

    const { GET } = await import("@/app/api/brands/list/route");
    const res = await GET();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.brands).toHaveLength(2);
    expect(json.brands[0].brandId).toBe("brand-1");
    expect(json.brands[0].role).toBe("owner");
    expect(json.brands[1].brandId).toBe("brand-2");
    expect(json.brands[1].role).toBe("editor");
  });
});
