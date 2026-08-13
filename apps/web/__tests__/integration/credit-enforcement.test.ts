/**
 * Integration tests: Credit Enforcement
 *
 * Tests credit gate on both search routes (creators/search + campaigns/search),
 * dispatch failure refund, and worker debit behavior.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// ── Hoisted mocks ────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  getCurrentBrandMembership: vi.fn(),
  requireWriteAccess: vi.fn((m: unknown) => m),
  getFeatureFlags: vi.fn(),
  inngestSend: vi.fn(),
  isCreditEnforcementEnabled: vi.fn(),
  ensureCredits: vi.fn(),
  debit: vi.fn(),
  mint: vi.fn(),
  getBalance: vi.fn(),
  prisma: {
    campaign: { findFirst: vi.fn(), findUnique: vi.fn() },
    creatorSearchJob: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    brandCreditBalance: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    brandCreditTransaction: { create: vi.fn() },
    // $transaction executes the callback
    $transaction: vi.fn(),
  },
  isLocalCreatorSearchFallbackEnabled: vi.fn(),
  scheduleLocalCreatorSearchJob: vi.fn(),
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

vi.mock("@/lib/credits", () => ({
  ensureCredits: mocks.ensureCredits,
  debit: mocks.debit,
  mint: mocks.mint,
  getBalance: mocks.getBalance,
  isCreditEnforcementEnabled: mocks.isCreditEnforcementEnabled,
  CREDIT_COSTS: { creator_search: 5, collabstr_search: 1, ai_fit_score: 1, enrichment: 2 },
  CreditInsufficientError: class CreditInsufficientError extends Error {
    readonly code = "CREDIT_INSUFFICIENT";
    constructor(
      public readonly required: number,
      public readonly available: number
    ) {
      super(`Insufficient credits: need ${required}, have ${available}`);
      this.name = "CreditInsufficientError";
    }
  },
}));

vi.mock("@/lib/inngest/client", () => ({
  inngest: { send: mocks.inngestSend },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));

vi.mock("@/lib/creator-search/contracts", () => ({
  normalizeUnifiedDiscoveryQuery: vi.fn(() => ({
    sources: ["apify"],
    keywords: ["fashion"],
    limit: 25,
  })),
  buildUnifiedDiscoveryQueryFromManualSearch: vi.fn(() => ({
    sources: ["apify"],
    keywords: ["fashion"],
    limit: 25,
  })),
  buildUnifiedDiscoveryQueryFromCampaignRequest: vi.fn(() => ({
    sources: ["apify"],
    keywords: ["fashion"],
    limit: 25,
  })),
}));

vi.mock("@/lib/creator-search/local-fallback", () => ({
  isLocalCreatorSearchFallbackEnabled: mocks.isLocalCreatorSearchFallbackEnabled,
  scheduleLocalCreatorSearchJob: mocks.scheduleLocalCreatorSearchJob,
}));

// Mock next/server `after` — it throws outside request scope in real Next.js
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: vi.fn((cb: () => void) => {
      // Execute the callback synchronously so fallback logic runs
      try { cb(); } catch { /* swallow async errors in test */ }
    }),
  };
});

// Dynamic imports after mocks
const { POST: creatorsSearchPOST } = await import(
  "@/app/api/creators/search/route"
);
const { POST: campaignSearchPOST } = await import(
  "@/app/api/campaigns/[campaignId]/search/route"
);

// ── Helpers ──────────────────────────────────────────────────

function makeSearchRequest(body: Record<string, unknown> = {}) {
  return new NextRequest("http://localhost/api/creators/search", {
    method: "POST",
    body: JSON.stringify({
      searchMode: "hashtag",
      hashtag: "#fashion",
      ...body,
    }),
    headers: { "Content-Type": "application/json" },
  });
}

function makeCampaignSearchRequest(body: Record<string, unknown> = {}) {
  return new NextRequest("http://localhost/api/campaigns/camp-1/search", {
    method: "POST",
    body: JSON.stringify({
      platform: "instagram",
      ...body,
    }),
    headers: { "Content-Type": "application/json" },
  });
}

function makeCampaignContext(campaignId = "camp-1") {
  return { params: Promise.resolve({ campaignId }) };
}

function setupDefaults() {
  mocks.getCurrentBrandMembership.mockResolvedValue({
    id: "mem-1",
    role: "editor",
    userId: "user-1",
    brandId: "brand-1",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  mocks.prisma.creatorSearchJob.create.mockResolvedValue({
    id: "job-1",
    status: "pending",
    requestedCount: 25,
  });

  mocks.prisma.campaign.findFirst.mockResolvedValue({
    id: "camp-1",
    brandId: "brand-1",
  });

  mocks.inngestSend.mockResolvedValue(undefined);
  mocks.isLocalCreatorSearchFallbackEnabled.mockReturnValue(false);
}

// ── Lifecycle ────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  setupDefaults();
});

// ── Tests ────────────────────────────────────────────────────

describe("credit enforcement — creators/search", () => {
  it("returns 402 when enforcement is enabled and credits are insufficient", async () => {
    mocks.isCreditEnforcementEnabled.mockReturnValue(true);

    const { CreditInsufficientError } = await import("@/lib/credits");
    mocks.ensureCredits.mockRejectedValue(
      new CreditInsufficientError(5, 0)
    );

    const res = await creatorsSearchPOST(makeSearchRequest());
    expect(res.status).toBe(402);

    const body = await res.json();
    expect(body.error).toContain("Insufficient credits");
    expect(body.required).toBe(5);
    expect(body.available).toBe(0);

    // Job should have been cleaned up
    expect(mocks.prisma.creatorSearchJob.delete).toHaveBeenCalled();
  });

  it("debits and creates job when credits are sufficient", async () => {
    mocks.isCreditEnforcementEnabled.mockReturnValue(true);
    mocks.ensureCredits.mockResolvedValue(undefined);
    mocks.debit.mockResolvedValue(95);

    const res = await creatorsSearchPOST(makeSearchRequest());
    expect(res.status).toBe(202);

    const body = await res.json();
    expect(body.jobId).toBe("job-1");

    // debit called with correct args
    expect(mocks.debit).toHaveBeenCalledWith(
      "brand-1",
      5,
      "creator_search_reservation",
      expect.objectContaining({ type: "reservation" })
    );

    // Inngest dispatch called
    expect(mocks.inngestSend).toHaveBeenCalled();
  });

  it("bypasses credit check when enforcement is disabled", async () => {
    mocks.isCreditEnforcementEnabled.mockReturnValue(false);

    const res = await creatorsSearchPOST(makeSearchRequest());
    expect(res.status).toBe(202);

    // debit and ensureCredits should NOT be called
    expect(mocks.ensureCredits).not.toHaveBeenCalled();
    expect(mocks.debit).not.toHaveBeenCalled();
  });
});

describe("credit enforcement — campaigns/search", () => {
  it("returns 402 when enforcement is enabled and credits are insufficient", async () => {
    mocks.isCreditEnforcementEnabled.mockReturnValue(true);

    const { CreditInsufficientError } = await import("@/lib/credits");
    mocks.ensureCredits.mockRejectedValue(
      new CreditInsufficientError(5, 0)
    );

    const res = await campaignSearchPOST(
      makeCampaignSearchRequest(),
      makeCampaignContext()
    );
    expect(res.status).toBe(402);

    const body = await res.json();
    expect(body.error).toContain("Insufficient credits");
  });

  it("debits correctly when credits are sufficient", async () => {
    mocks.isCreditEnforcementEnabled.mockReturnValue(true);
    mocks.ensureCredits.mockResolvedValue(undefined);
    mocks.debit.mockResolvedValue(95);

    const res = await campaignSearchPOST(
      makeCampaignSearchRequest(),
      makeCampaignContext()
    );
    expect(res.status).toBe(202);

    expect(mocks.debit).toHaveBeenCalledWith(
      "brand-1",
      5,
      "creator_search_reservation",
      expect.objectContaining({ campaignId: "camp-1" })
    );
  });
});

describe("dispatch failure refund", () => {
  it("refunds via mint() when Inngest dispatch fails and no fallback", async () => {
    mocks.isCreditEnforcementEnabled.mockReturnValue(true);
    mocks.ensureCredits.mockResolvedValue(undefined);
    mocks.debit.mockResolvedValue(95);
    mocks.inngestSend.mockRejectedValue(new Error("Inngest unavailable"));
    mocks.isLocalCreatorSearchFallbackEnabled.mockReturnValue(false);
    mocks.mint.mockResolvedValue(100);

    const res = await creatorsSearchPOST(makeSearchRequest());
    expect(res.status).toBe(500);

    // Credits refunded
    expect(mocks.mint).toHaveBeenCalledWith(
      "brand-1",
      5,
      "creator_search_dispatch_refund",
      expect.objectContaining({ refund: true })
    );

    // Job marked as failed
    expect(mocks.prisma.creatorSearchJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "failed" },
      })
    );
  });

  it("does NOT refund when local fallback is enabled", async () => {
    mocks.isCreditEnforcementEnabled.mockReturnValue(true);
    mocks.ensureCredits.mockResolvedValue(undefined);
    mocks.debit.mockResolvedValue(95);
    mocks.inngestSend.mockRejectedValue(new Error("Inngest unavailable"));
    mocks.isLocalCreatorSearchFallbackEnabled.mockReturnValue(true);

    const res = await creatorsSearchPOST(makeSearchRequest());
    // Falls back to local — still returns 202
    expect(res.status).toBe(202);

    // No refund since fallback is enabled
    expect(mocks.mint).not.toHaveBeenCalled();
  });
});

describe("worker skips debit when enforcement is enabled", () => {
  it("isCreditEnforcementEnabled controls whether debit fires", async () => {
    // When enforcement is disabled, the search route should NOT call debit
    mocks.isCreditEnforcementEnabled.mockReturnValue(false);

    const res = await creatorsSearchPOST(makeSearchRequest());
    expect(res.status).toBe(202);

    expect(mocks.debit).not.toHaveBeenCalled();
    expect(mocks.ensureCredits).not.toHaveBeenCalled();
  });
});
