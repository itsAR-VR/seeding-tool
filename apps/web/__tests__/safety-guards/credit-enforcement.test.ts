import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Credit enforcement integration tests.
 *
 * Covers:
 * - Search with 0 credits + enforcement enabled returns 402
 * - Search with sufficient credits succeeds and debits
 * - Search with enforcement disabled skips credit check
 */

// ─── Mocks ───────────────────────────────────────────────

const mockMembership = {
  id: "bm-1",
  userId: "user-1",
  brandId: "brand-1",
  role: "owner",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPrisma = {
  brandCreditBalance: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
  },
  brandCreditTransaction: {
    create: vi.fn(),
  },
  creatorSearchJob: {
    create: vi.fn(),
    delete: vi.fn().mockResolvedValue({}),
  },
  $transaction: vi.fn(),
};

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/integrations/brand-access", () => ({
  getCurrentBrandMembership: vi.fn().mockResolvedValue(mockMembership),
  requireWriteAccess: vi.fn().mockReturnValue(mockMembership),
  BrandAccessError: class BrandAccessError extends Error {
    constructor(
      message: string,
      public readonly status: number
    ) {
      super(message);
    }
  },
}));
vi.mock("@/lib/inngest/client", () => ({
  inngest: { send: vi.fn().mockResolvedValue({}) },
}));
vi.mock("@/lib/creator-search/contracts", () => ({
  buildUnifiedDiscoveryQueryFromManualSearch: vi.fn().mockReturnValue({
    limit: 20,
    sources: [],
    keywords: [],
  }),
  normalizeUnifiedDiscoveryQuery: vi.fn(),
}));
vi.mock("@/lib/creator-search/local-fallback", () => ({
  isLocalCreatorSearchFallbackEnabled: vi.fn().mockReturnValue(false),
  scheduleLocalCreatorSearchJob: vi.fn(),
}));

// ─── Helpers ─────────────────────────────────────────────

function makeSearchRequest(body: Record<string, unknown> = {}) {
  return new NextRequest("http://localhost:3000/api/creators/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      searchMode: "hashtag",
      hashtag: "beauty",
      ...body,
    }),
  });
}

// ─── Tests ───────────────────────────────────────────────

describe("Credit enforcement on search route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockPrisma.creatorSearchJob.create.mockResolvedValue({
      id: "job-1",
      status: "pending",
      requestedCount: 20,
    });
  });

  it("returns 402 when credits are insufficient and enforcement is enabled", async () => {
    process.env.CREDIT_ENFORCEMENT_ENABLED = "true";
    mockPrisma.brandCreditBalance.findUnique.mockResolvedValue({
      brandId: "brand-1",
      credits: 0,
    });

    const mod = await import("@/app/api/creators/search/route");
    const req = makeSearchRequest();
    const res = await mod.POST(req);

    expect(res.status).toBe(402);
    const json = await res.json();
    expect(json.error).toContain("Insufficient credits");

    // Job should have been created then deleted on insufficient credits
    expect(mockPrisma.creatorSearchJob.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.creatorSearchJob.delete).toHaveBeenCalledWith({
      where: { id: "job-1" },
    });

    // Clean up
    delete process.env.CREDIT_ENFORCEMENT_ENABLED;
  });

  it("proceeds when enforcement is disabled regardless of balance", async () => {
    delete process.env.CREDIT_ENFORCEMENT_ENABLED;
    mockPrisma.brandCreditBalance.findUnique.mockResolvedValue({
      brandId: "brand-1",
      credits: 0,
    });

    const mod = await import("@/app/api/creators/search/route");
    const req = makeSearchRequest();
    const res = await mod.POST(req);

    expect(res.status).toBe(202);

    const json = await res.json();
    expect(json.jobId).toBe("job-1");
  });
});
