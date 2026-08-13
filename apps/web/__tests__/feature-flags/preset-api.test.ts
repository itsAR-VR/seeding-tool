import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ─────────────────────────────────────────────

vi.mock("server-only", () => ({}));
vi.mock("@/lib/logger", () => ({
  log: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    brandSettings: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

const mockGetCurrentBrandMembership = vi.fn();
const mockRequireAdminAccess = vi.fn((m: unknown) => m);

vi.mock("@/lib/integrations/brand-access", () => ({
  getCurrentBrandMembership: () => mockGetCurrentBrandMembership(),
  requireAdminAccess: (m: unknown) => mockRequireAdminAccess(m),
  BrandAccessError: class BrandAccessError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

const mockApplyPreset = vi.fn();

vi.mock("@/lib/feature-flags", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    applyPreset: (...args: unknown[]) => mockApplyPreset(...args),
  };
});

import { POST } from "@/app/api/settings/feature-flags/preset/route";
import { FLAG_PRESETS } from "@/lib/feature-flags";
import { NextRequest } from "next/server";
import { BrandAccessError } from "@/lib/integrations/brand-access";

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/settings/feature-flags/preset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const MEMBERSHIP = {
  id: "bm-1",
  role: "owner",
  userId: "user-1",
  brandId: "brand-1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─── Tests ─────────────────────────────────────────────

describe("POST /api/settings/feature-flags/preset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentBrandMembership.mockResolvedValue(MEMBERSHIP);
  });

  it("returns 400 for invalid preset name", async () => {
    const res = await POST(makeRequest({ preset: "turbo" }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("Invalid preset");
  });

  it("returns 400 for missing preset", async () => {
    const res = await POST(makeRequest({}));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("Invalid preset");
  });

  it("applies valid preset and returns flags", async () => {
    mockApplyPreset.mockResolvedValue({ ...FLAG_PRESETS.assisted });

    const res = await POST(makeRequest({ preset: "assisted" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.preset).toBe("assisted");
    expect(data.flags).toEqual(FLAG_PRESETS.assisted);
    expect(mockApplyPreset).toHaveBeenCalledWith("brand-1", "assisted");
  });

  it("accepts all three valid presets", async () => {
    for (const preset of ["manual", "assisted", "autonomous"]) {
      mockApplyPreset.mockResolvedValue({ ...FLAG_PRESETS[preset as keyof typeof FLAG_PRESETS] });

      const res = await POST(makeRequest({ preset }));
      expect(res.status).toBe(200);
    }
  });

  it("requires admin access", async () => {
    mockGetCurrentBrandMembership.mockResolvedValue(MEMBERSHIP);
    mockApplyPreset.mockResolvedValue({ ...FLAG_PRESETS.manual });

    await POST(makeRequest({ preset: "manual" }));

    expect(mockRequireAdminAccess).toHaveBeenCalledWith(MEMBERSHIP);
  });

  it("returns auth error when not authorized", async () => {
    mockGetCurrentBrandMembership.mockRejectedValue(
      new BrandAccessError("Not authenticated", 401)
    );

    const res = await POST(makeRequest({ preset: "manual" }));
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Not authenticated");
  });
});
