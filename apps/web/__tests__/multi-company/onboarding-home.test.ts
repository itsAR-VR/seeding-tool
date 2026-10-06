import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Home's "Finish setting up" checklist and its setup redirect: a broken
 * integration must not crash Home, and Home only sends someone to setup for a
 * company they're still setting up (so /dashboard and /onboarding can't loop).
 */

vi.mock("server-only", () => ({}));

const redirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirect(url) }));

vi.mock("@/lib/integrations/brand-access", () => {
  class BrandAccessError extends Error {
    constructor(message: string, public readonly status: number) {
      super(message);
    }
  }
  return { BrandAccessError, getCurrentUserRecord: vi.fn(async () => ({ id: "user-1" })) };
});

const getActiveMembership = vi.fn();
const isBrandInSetup = vi.fn();
vi.mock("@/lib/onboarding/setup-state", () => ({
  getActiveMembership: (...a: unknown[]) => getActiveMembership(...a),
  isBrandInSetup: (...a: unknown[]) => isBrandInSetup(...a),
}));

const resolveProviderCredential = vi.fn();
vi.mock("@/lib/integrations/state", () => ({
  resolveProviderCredential: (...a: unknown[]) => resolveProviderCredential(...a),
}));

vi.mock("@/app/(platform)/dashboard/components/campaign-health", () => ({ CampaignHealthWidget: () => null }));

const count = vi.fn(async () => 0);
const findMany = vi.fn(async () => []);
vi.mock("@/lib/prisma", () => ({
  prisma: {
    conversationThread: { findMany },
    shopifyOrder: { count },
    contentPost: { count },
    interventionCase: { count },
    campaignCreator: { count, findMany },
    campaign: { findMany },
    campaignHealthSnapshot: { findMany },
    brand: { findUnique: vi.fn(async () => ({ productFacts: null, apifyTokenEnc: null, useSharedApify: false })) },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  getActiveMembership.mockResolvedValue({ brandId: "b1", role: "owner" });
  isBrandInSetup.mockResolvedValue(false);
});

describe("Home", () => {
  it("still renders the checklist when an integration check throws", async () => {
    resolveProviderCredential.mockImplementation(async (_b: string, provider: string) => {
      if (provider === "gmail") throw new Error("token decrypt failed");
      return { connected: provider === "shopify" };
    });
    const { default: DashboardPage } = await import("@/app/(platform)/dashboard/page");
    const page = await DashboardPage();
    expect(page).toBeTruthy();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("sends a company still being set up to setup", async () => {
    isBrandInSetup.mockResolvedValue(true);
    const { default: DashboardPage } = await import("@/app/(platform)/dashboard/page");
    await expect(DashboardPage()).rejects.toThrow("REDIRECT:/onboarding");
  });

  it("opens Home for a team brand with no or unfinished setup row it doesn't own (no loop)", async () => {
    getActiveMembership.mockResolvedValue({ brandId: "team-brand", role: "editor" });
    isBrandInSetup.mockResolvedValue(false);
    resolveProviderCredential.mockResolvedValue({ connected: false });
    const { default: DashboardPage } = await import("@/app/(platform)/dashboard/page");
    await DashboardPage();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("someone with no company yet goes to setup", async () => {
    getActiveMembership.mockResolvedValue(null);
    const { default: DashboardPage } = await import("@/app/(platform)/dashboard/page");
    await expect(DashboardPage()).rejects.toThrow("REDIRECT:/onboarding");
  });
});
