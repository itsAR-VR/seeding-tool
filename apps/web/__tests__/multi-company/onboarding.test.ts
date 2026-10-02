import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * New-company setup (onboarding) in every situation: retries, double submits,
 * slow or broken websites, a second company for someone who already has one,
 * and brandIds that belong to another company.
 */

// ─── Mocks ───────────────────────────────────────────────

const cookieJar = new Map<string, string>();
const cookieSet = vi.fn((name: string, value: string) => cookieJar.set(name, value));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => (cookieJar.has(name) ? { value: cookieJar.get(name) } : undefined),
    set: cookieSet,
  })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "sb-1", email: "founder@newco.com" } } })) },
  })),
}));

const appUser = { id: "user-1", email: "founder@newco.com" };
vi.mock("@/lib/invite-user", () => ({ getOrAcceptInvitedUser: vi.fn(async () => appUser) }));

const findOpenCompanyInvite = vi.fn();
const isPlatformAdmin = vi.fn(() => false);
vi.mock("@/lib/invites", () => ({
  findOpenCompanyInvite: (...args: unknown[]) => findOpenCompanyInvite(...args),
  isPlatformAdmin: (...args: unknown[]) => isPlatformAdmin(...(args as [])),
}));

const org = { id: "org-1", name: "NewCo" };
vi.mock("@/lib/tenancy", () => ({
  getOrgForUser: vi.fn(async () => org),
  requireOrg: vi.fn(async () => org),
  getUserBySupabaseId: vi.fn(async () => appUser),
}));

const fetchBrandProfile = vi.fn();
vi.mock("@/lib/brands/profile", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/brands/profile")>()),
  fetchBrandProfile: (...args: unknown[]) => fetchBrandProfile(...args),
}));

const synthesizeBusinessDna = vi.fn();
vi.mock("@/lib/brands/synthesis", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/brands/synthesis")>()),
  synthesizeBusinessDna: (...args: unknown[]) => synthesizeBusinessDna(...args),
}));

vi.mock("@/lib/feature-flags", () => ({ setFeatureFlag: vi.fn(async () => undefined) }));

const mockPrisma = {
  brandMembership: { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
  client: { findFirst: vi.fn(), create: vi.fn() },
  brand: { create: vi.fn(), update: vi.fn(), deleteMany: vi.fn(), findUniqueOrThrow: vi.fn() },
  brandOnboarding: { create: vi.fn(), upsert: vi.fn() },
  brandSettings: { create: vi.fn(), upsert: vi.fn(), findUnique: vi.fn() },
  brandInvite: { updateMany: vi.fn() },
  $transaction: vi.fn(),
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const RAW_PROFILE = {
  sourceUrl: "https://newco.com/",
  domain: "newco.com",
  fetchedAt: new Date().toISOString(),
  title: "NewCo",
  description: "Calm tea",
  siteName: null,
  ogTitle: null,
  ogDescription: null,
  ogImage: null,
  twitterTitle: null,
  twitterDescription: null,
  twitterImage: null,
  heroHeadings: [],
  heroImageCandidates: [],
  textSignals: [],
  bodyExcerpt: null,
};

function brandRequest(body: unknown) {
  return new NextRequest("http://localhost/api/onboarding/brand", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function completeRequest(body: unknown) {
  return new Request("http://localhost/api/onboarding/complete", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  cookieJar.clear();
  delete process.env.OPENAI_API_KEY;
  isPlatformAdmin.mockReturnValue(false);
  findOpenCompanyInvite.mockResolvedValue({ id: "inv-1", companyName: "NewCo" });
  mockPrisma.brandMembership.findFirst.mockResolvedValue(null);
  mockPrisma.brandMembership.findMany.mockResolvedValue([]);
  mockPrisma.client.findFirst.mockResolvedValue({ id: "client-1" });
  mockPrisma.brand.create.mockResolvedValue({ id: "brand-new" });
  mockPrisma.brand.findUniqueOrThrow.mockImplementation(async ({ where }: { where: { id: string } }) => ({
    id: where.id,
    slug: "newco-abc",
  }));
  mockPrisma.brandInvite.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) => fn(mockPrisma));
});

// ─── Pure helpers ────────────────────────────────────────

describe("brand slugs", () => {
  it("handles accents, emoji, long names and never collides", async () => {
    const { brandSlug } = await import("@/lib/onboarding/brand-slug");
    expect(brandSlug("Café Olé")).toMatch(/^cafe-ole-[0-9a-f]{8}$/);
    expect(brandSlug("🌿✨")).toMatch(/^brand-[0-9a-f]{8}$/);
    expect(brandSlug("x".repeat(200)).length).toBeLessThanOrEqual(48 + 9);
    // Two companies with the same name get different slugs.
    expect(brandSlug("Kalm")).not.toBe(brandSlug("Kalm"));
  });
});

describe("website input", () => {
  it("accepts a bare domain and rejects garbage with a plain next step", async () => {
    const { normalizeBrandWebsiteUrl } = await import("@/lib/brands/profile");
    expect(normalizeBrandWebsiteUrl("newco.com")).toBe("https://newco.com/");
    expect(normalizeBrandWebsiteUrl("  ")).toBeNull();
    expect(() => normalizeBrandWebsiteUrl("asdf")).toThrow(/yourbrand\.com/);
    expect(() => normalizeBrandWebsiteUrl("not a site")).toThrow(/yourbrand\.com/);
    expect(() => normalizeBrandWebsiteUrl("ftp://newco.com")).toThrow(/http:\/\/ or https:\/\//);
  });

  it("only sends people back to paths on this site", async () => {
    const { safeReturnPath } = await import("@/lib/safe-return-path");
    expect(safeReturnPath("/onboarding?step=connect")).toBe("/onboarding?step=connect");
    expect(safeReturnPath("//evil.com")).toBeNull();
    expect(safeReturnPath("/\\evil.com")).toBeNull();
    expect(safeReturnPath("javascript:alert(1)")).toBeNull();
    expect(safeReturnPath("https://evil.com")).toBeNull();
  });
});

describe("reading the website", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("refuses to read private or local addresses", async () => {
    const actual = await vi.importActual<typeof import("@/lib/brands/profile")>("@/lib/brands/profile");
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
    await expect(actual.fetchBrandProfile("http://169.254.169.254/latest")).rejects.toThrow(/public/);
    await expect(actual.fetchBrandProfile("http://127.0.0.1:3000/")).rejects.toThrow(/public/);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("stops reading a huge page instead of loading all of it", async () => {
    const actual = await vi.importActual<typeof import("@/lib/brands/profile")>("@/lib/brands/profile");
    let pulled = 0;
    const chunk = new TextEncoder().encode(`<p>${"a".repeat(64 * 1024)}</p>`);
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        controller.enqueue(chunk); // never ends on its own
      },
    });
    globalThis.fetch = vi.fn(async () => {
      const res = new Response(body, { headers: { "content-type": "text/html" } });
      Object.defineProperty(res, "url", { value: "https://huge.example.com/" });
      return res;
    }) as unknown as typeof fetch;
    const profile = await actual.fetchBrandProfile("https://huge.example.com/");
    expect(profile.domain).toBe("huge.example.com");
    expect(pulled).toBeLessThan(40);
  });
});

// ─── POST /api/onboarding/brand ──────────────────────────

describe("brand step", () => {
  it("has a time budget above the slowest website read", async () => {
    const route = await import("@/app/api/onboarding/brand/route");
    expect(route.maxDuration).toBeGreaterThanOrEqual(60);
  });

  it("creates the brand with no website and points the app at it", async () => {
    const { POST } = await import("@/app/api/onboarding/brand/route");
    const res = await POST(brandRequest({ name: "  Café Olé 🌿 " }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toMatchObject({ brandId: "brand-new", analysisStatus: "skipped" });
    expect(fetchBrandProfile).not.toHaveBeenCalled();
    const created = mockPrisma.brand.create.mock.calls[0][0].data;
    expect(created.name).toBe("Café Olé 🌿");
    expect(created.slug).toMatch(/^cafe-ole-[0-9a-f]{8}$/);
    expect(cookieSet).toHaveBeenCalledWith("seed-active-brand", "brand-new", expect.objectContaining({ httpOnly: true, sameSite: "strict", path: "/" }));
  });

  it("still creates the brand when the website is unreachable, slow or blocks us", async () => {
    fetchBrandProfile.mockRejectedValue(new Error("The operation was aborted due to timeout"));
    const { POST } = await import("@/app/api/onboarding/brand/route");
    const res = await POST(brandRequest({ name: "NewCo", websiteUrl: "newco.com" }));
    expect(res.status).toBe(200);
    expect((await res.json()).analysisStatus).toBe("failed");
    expect(fetchBrandProfile).toHaveBeenCalledWith("https://newco.com/");
    expect(mockPrisma.brand.create).toHaveBeenCalledTimes(1);
  });

  it("keeps the website signals when OpenAI isn't set up or fails", async () => {
    fetchBrandProfile.mockResolvedValue(RAW_PROFILE);
    const { POST } = await import("@/app/api/onboarding/brand/route");
    let res = await POST(brandRequest({ name: "NewCo", websiteUrl: "https://newco.com" }));
    expect((await res.json()).analysisStatus).toBe("partial");
    expect(synthesizeBusinessDna).not.toHaveBeenCalled();

    process.env.OPENAI_API_KEY = "sk-test";
    synthesizeBusinessDna.mockResolvedValue(null);
    res = await POST(brandRequest({ name: "NewCo", websiteUrl: "https://newco.com" }));
    expect(res.status).toBe(200);
    expect((await res.json()).analysisStatus).toBe("partial");
  });

  it("rejects a garbage website or a very long name before doing any work", async () => {
    const { POST } = await import("@/app/api/onboarding/brand/route");
    let res = await POST(brandRequest({ name: "NewCo", websiteUrl: "asdf" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/yourbrand\.com/);
    res = await POST(brandRequest({ name: "x".repeat(81) }));
    expect(res.status).toBe(400);
    res = await POST(brandRequest({ name: "   " }));
    expect(res.status).toBe(400);
    expect(mockPrisma.brand.create).not.toHaveBeenCalled();
  });

  it("going Back and resubmitting reuses the same brand and renames it", async () => {
    mockPrisma.brandMembership.findFirst.mockResolvedValue({
      brandId: "brand-setup",
      brand: { id: "brand-setup", name: "Old Name", websiteUrl: null },
    });
    mockPrisma.brandMembership.findMany.mockResolvedValue([{ brandId: "brand-setup" }]);
    const { POST } = await import("@/app/api/onboarding/brand/route");
    const res = await POST(brandRequest({ name: "New Name" }));
    expect((await res.json()).brandId).toBe("brand-setup");
    expect(mockPrisma.brand.create).not.toHaveBeenCalled();
    expect(mockPrisma.brand.deleteMany).not.toHaveBeenCalled();
    const update = mockPrisma.brand.update.mock.calls[0][0];
    expect(update.where).toEqual({ id: "brand-setup" });
    expect(update.data.name).toBe("New Name");
    expect(update.data.slug).toMatch(/^new-name-/);
    // Retrying never needs (or uses up) an invite.
    expect(findOpenCompanyInvite).not.toHaveBeenCalled();
  });

  it("a double click that races the first request doesn't make a second brand", async () => {
    mockPrisma.brandInvite.updateMany.mockResolvedValue({ count: 0 });
    const { POST } = await import("@/app/api/onboarding/brand/route");
    const res = await POST(brandRequest({ name: "NewCo" }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/Refresh the page/);
  });

  it("without an invite, says so before spending time on the website", async () => {
    findOpenCompanyInvite.mockResolvedValue(null);
    const { POST } = await import("@/app/api/onboarding/brand/route");
    const res = await POST(brandRequest({ name: "NewCo", websiteUrl: "newco.com" }));
    expect(res.status).toBe(403);
    expect(fetchBrandProfile).not.toHaveBeenCalled();
  });

  it("a second company: creates a new brand and leaves the finished one alone", async () => {
    // Already owns a finished company (not "in setup"), and has an accepted company invite.
    mockPrisma.brandMembership.findFirst.mockResolvedValue(null);
    mockPrisma.brandMembership.findMany.mockResolvedValue([]);
    const { POST } = await import("@/app/api/onboarding/brand/route");
    const res = await POST(brandRequest({ name: "Second Co" }));
    expect((await res.json()).brandId).toBe("brand-new");
    expect(mockPrisma.brand.update).not.toHaveBeenCalled();
    expect(mockPrisma.brand.deleteMany).not.toHaveBeenCalled();
    expect(mockPrisma.brandInvite.updateMany).toHaveBeenCalledWith({
      where: { id: "inv-1", brandId: null },
      data: { brandId: "brand-new" },
    });
    expect(cookieJar.get("seed-active-brand")).toBe("brand-new");
    // "In setup" only ever means: owned, in this person's org, onboarding unfinished.
    expect(mockPrisma.brandMembership.findFirst.mock.calls[0][0].where).toMatchObject({
      userId: "user-1",
      role: "owner",
      brand: { client: { organizationId: "org-1" }, onboarding: { isComplete: false } },
    });
  });
});

// ─── GET /api/onboarding/status ──────────────────────────

describe("setup status", () => {
  it("resumes the company being set up and points the cookie at it", async () => {
    cookieJar.set("seed-active-brand", "brand-finished");
    mockPrisma.brandMembership.findFirst.mockResolvedValueOnce({
      brandId: "brand-setup",
      brand: { id: "brand-setup", name: "NewCo", websiteUrl: "https://newco.com/" },
    });
    const { GET } = await import("@/app/api/onboarding/status/route");
    const data = await (await GET()).json();
    expect(data).toEqual({
      isComplete: false,
      hasBrand: true,
      brandId: "brand-setup",
      brandName: "NewCo",
      websiteUrl: "https://newco.com/",
    });
    expect(cookieJar.get("seed-active-brand")).toBe("brand-setup");
  });

  it("someone with a finished company and a new company invite can start the new one", async () => {
    mockPrisma.brandMembership.findFirst
      .mockResolvedValueOnce(null) // nothing in setup
      .mockResolvedValueOnce({ id: "m-finished" }); // has a membership
    findOpenCompanyInvite.mockResolvedValue({ id: "inv-2", companyName: "Second Co" });
    const { GET } = await import("@/app/api/onboarding/status/route");
    const data = await (await GET()).json();
    expect(data).toEqual({ isComplete: false, hasBrand: false, canCreateBrand: true, companyName: "Second Co" });
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("finished with nothing new to set up: complete (the wizard sends them Home)", async () => {
    mockPrisma.brandMembership.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "m-1" });
    findOpenCompanyInvite.mockResolvedValue(null);
    const { GET } = await import("@/app/api/onboarding/status/route");
    expect(await (await GET()).json()).toEqual({ isComplete: true, hasBrand: true });
  });

  it("no company and no invite: can't create one", async () => {
    mockPrisma.brandMembership.findFirst.mockResolvedValue(null);
    findOpenCompanyInvite.mockResolvedValue(null);
    const { GET } = await import("@/app/api/onboarding/status/route");
    expect(await (await GET()).json()).toMatchObject({ isComplete: false, hasBrand: false, canCreateBrand: false });
  });
});

// ─── POST /api/onboarding/complete ───────────────────────

describe("finishing setup", () => {
  it("a brandId from another company is refused and nothing changes", async () => {
    mockPrisma.brandMembership.findUnique.mockResolvedValue(null);
    const { POST } = await import("@/app/api/onboarding/complete/route");
    const res = await POST(completeRequest({ brandId: "someone-elses-brand" }));
    expect(res.status).toBe(404);
    expect(mockPrisma.brandOnboarding.upsert).not.toHaveBeenCalled();
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("a viewer can't finish setup", async () => {
    mockPrisma.brandMembership.findUnique.mockResolvedValue({ brandId: "b2", role: "viewer" });
    const { POST } = await import("@/app/api/onboarding/complete/route");
    expect((await POST(completeRequest({ brandId: "b2" }))).status).toBe(403);
    expect(mockPrisma.brandOnboarding.upsert).not.toHaveBeenCalled();
  });

  it("with two companies, marks the one being set up and opens Home on it; twice is fine", async () => {
    cookieJar.set("seed-active-brand", "brand-finished");
    mockPrisma.brandMembership.findUnique.mockResolvedValue({ brandId: "brand-new", role: "owner" });
    mockPrisma.brandSettings.findUnique.mockResolvedValue(null);
    const { POST } = await import("@/app/api/onboarding/complete/route");
    for (let i = 0; i < 2; i++) {
      const res = await POST(completeRequest({ brandId: "brand-new" }));
      expect(res.status).toBe(200);
    }
    expect(mockPrisma.brandOnboarding.upsert).toHaveBeenCalledTimes(2);
    expect(mockPrisma.brandOnboarding.upsert.mock.calls[0][0].where).toEqual({ brandId: "brand-new" });
    expect(cookieJar.get("seed-active-brand")).toBe("brand-new");
  });

  it("without a brandId, finishes the company being set up rather than the oldest", async () => {
    mockPrisma.brandMembership.findFirst.mockResolvedValueOnce({
      brandId: "brand-setup",
      brand: { id: "brand-setup", name: "NewCo", websiteUrl: null },
    });
    mockPrisma.brandMembership.findUnique.mockResolvedValue({ brandId: "brand-setup", role: "owner" });
    mockPrisma.brandSettings.findUnique.mockResolvedValue(null);
    const { POST } = await import("@/app/api/onboarding/complete/route");
    expect((await POST(completeRequest({}))).status).toBe(200);
    expect(mockPrisma.brandOnboarding.upsert.mock.calls[0][0].where).toEqual({ brandId: "brand-setup" });
  });
});

// ─── Home's choice of company ────────────────────────────

describe("active company for Home", () => {
  it("a stale cookie (removed from that team) falls back to the oldest company", async () => {
    cookieJar.set("seed-active-brand", "brand-gone");
    mockPrisma.brandMembership.findUnique.mockResolvedValue(null);
    mockPrisma.brandMembership.findFirst.mockResolvedValue({ brandId: "brand-oldest", role: "owner" });
    const { getActiveMembership } = await import("@/lib/onboarding/setup-state");
    expect((await getActiveMembership("user-1"))?.brandId).toBe("brand-oldest");
  });

  it("only a company this person is setting up sends Home to setup (same rule as status)", async () => {
    mockPrisma.brandMembership.findFirst.mockResolvedValue(null);
    const { isBrandInSetup } = await import("@/lib/onboarding/setup-state");
    expect(await isBrandInSetup("user-1", "team-brand")).toBe(false);
    expect(mockPrisma.brandMembership.findFirst.mock.calls[0][0].where).toMatchObject({
      brandId: "team-brand",
      role: "owner",
      brand: { onboarding: { isComplete: false } },
    });
  });
});
