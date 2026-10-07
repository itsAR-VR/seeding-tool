import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User as AuthUser } from "@supabase/supabase-js";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  prisma: {
    brandInvite: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    brandMembership: { findFirst: vi.fn(), upsert: vi.fn() },
    user: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
    organization: { create: vi.fn() },
    organizationMembership: { create: vi.fn() },
    $transaction: vi.fn(),
  },
  supabaseAuth: { verifyOtp: vi.fn(), exchangeCodeForSession: vi.fn(), signOut: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: mocks.supabaseAuth })),
}));

import { safeNextPath } from "@/lib/auth/safe-next";
import { createInvite, findInviteForLink, findUsableInvite, InviteError } from "@/lib/invites";
import { ensureAppUser, getOrAcceptInvitedUser, joinInvite } from "@/lib/invite-user";
import { bootstrapNewUser } from "@/lib/tenancy";
import { GET as callback } from "@/app/(auth)/callback/route";
import { POST as logout } from "@/app/api/auth/logout/route";

const future = new Date(Date.now() + 86_400_000);
const past = new Date(Date.now() - 86_400_000);

function invite(overrides: Record<string, unknown> = {}) {
  return {
    id: "inv-1",
    email: "sam@brand.test",
    role: "editor",
    brandId: "brand-1",
    companyName: null,
    acceptedAt: null,
    revokedAt: null,
    expiresAt: future,
    brand: { id: "brand-1", name: "Brand One", logoUrl: null },
    ...overrides,
  };
}

function authUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "auth-1",
    email: "Sam@Brand.test",
    email_confirmed_at: "2026-10-01T00:00:00Z",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: "2026-10-01T00:00:00Z",
    ...overrides,
  } as AuthUser;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.$transaction.mockImplementation(async (fn: (tx: typeof mocks.prisma) => unknown) => fn(mocks.prisma));
});

describe("invite link states", () => {
  it("rejects an unknown token", async () => {
    mocks.prisma.brandInvite.findUnique.mockResolvedValue(null);
    await expect(findUsableInvite("nope")).rejects.toMatchObject({ status: 404 });
  });

  it("rejects a revoked invite (for example after a resend)", async () => {
    mocks.prisma.brandInvite.findUnique.mockResolvedValue(invite({ revokedAt: past }));
    await expect(findInviteForLink("t")).rejects.toMatchObject({ status: 404 });
  });

  it("rejects an expired invite that was never used", async () => {
    mocks.prisma.brandInvite.findUnique.mockResolvedValue(invite({ expiresAt: past }));
    await expect(findUsableInvite("t")).rejects.toMatchObject({ status: 410 });
    await expect(findInviteForLink("t")).rejects.toMatchObject({ status: 410 });
  });

  it("a used invite can't be accepted again but still lets its owner get a sign-in link", async () => {
    mocks.prisma.brandInvite.findUnique.mockResolvedValue(invite({ acceptedAt: past, expiresAt: past }));
    await expect(findUsableInvite("t")).rejects.toBeInstanceOf(InviteError);
    await expect(findInviteForLink("t")).resolves.toMatchObject({ state: "joined" });
  });

  it("an open invite is usable", async () => {
    mocks.prisma.brandInvite.findUnique.mockResolvedValue(invite());
    await expect(findInviteForLink("t")).resolves.toMatchObject({ state: "open" });
  });
});

describe("creating invites", () => {
  it("refuses someone already on the team", async () => {
    mocks.prisma.brandMembership.findFirst.mockResolvedValue({ id: "m1" });
    await expect(
      createInvite({ email: "sam@brand.test", role: "editor", brandId: "brand-1", invitedById: "u1" }),
    ).rejects.toThrow("already on this team");
    expect(mocks.prisma.brandInvite.create).not.toHaveBeenCalled();
  });

  it("revokes the older open invite for the same email and company when re-sending", async () => {
    mocks.prisma.brandMembership.findFirst.mockResolvedValue(null);
    mocks.prisma.brandInvite.create.mockResolvedValue({ id: "inv-2" });
    await createInvite({ email: " Sam@Brand.test ", role: "viewer", brandId: "brand-1", invitedById: "u1" });
    expect(mocks.prisma.brandInvite.updateMany).toHaveBeenCalledWith({
      where: { email: "sam@brand.test", brandId: "brand-1", acceptedAt: null, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});

describe("joining", () => {
  it("adds the invitee to the company with the invited role", async () => {
    mocks.prisma.brandInvite.updateMany.mockResolvedValue({ count: 1 });
    mocks.prisma.user.findUnique.mockResolvedValue({ id: "u-sam" });
    const user = await joinInvite(invite(), "auth-1");
    expect(user).toEqual({ id: "u-sam" });
    expect(mocks.prisma.brandMembership.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: { userId: "u-sam", brandId: "brand-1", role: "editor" } }),
    );
  });

  it("returns null when another tab already used the invite", async () => {
    mocks.prisma.brandInvite.updateMany.mockResolvedValue({ count: 0 });
    expect(await joinInvite(invite(), "auth-1")).toBeNull();
    expect(mocks.prisma.brandMembership.upsert).not.toHaveBeenCalled();
  });

  it("gives the invite back when joining fails", async () => {
    mocks.prisma.brandInvite.updateMany.mockResolvedValue({ count: 1 });
    mocks.prisma.user.findUnique.mockResolvedValue({ id: "u-sam" });
    mocks.prisma.brandMembership.upsert.mockRejectedValueOnce(new Error("db down"));
    await expect(joinInvite(invite(), "auth-1")).rejects.toThrow("db down");
    expect(mocks.prisma.brandInvite.update).toHaveBeenCalledWith({ where: { id: "inv-1" }, data: { acceptedAt: null } });
  });

  it("relinks an app user with the same email instead of failing on the unique email", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(null);
    mocks.prisma.user.findFirst.mockResolvedValue({ id: "u-old" });
    mocks.prisma.user.update.mockResolvedValue({ id: "u-old", supabaseId: "auth-new" });
    await ensureAppUser("auth-new", "sam@brand.test", "sam");
    expect(mocks.prisma.user.update).toHaveBeenCalledWith({ where: { id: "u-old" }, data: { supabaseId: "auth-new" } });
    expect(mocks.prisma.user.create).not.toHaveBeenCalled();
  });

  it("gives every new workspace a unique slug, even for the same name", async () => {
    mocks.prisma.user.create.mockResolvedValue({ id: "u1" });
    mocks.prisma.organization.create.mockResolvedValue({ id: "o1" });
    await bootstrapNewUser("a1", "hello@a.test", "hello");
    await bootstrapNewUser("a2", "hello@b.test", "hello");
    const [first, second] = mocks.prisma.organization.create.mock.calls.map((c) => c[0].data.slug as string);
    expect(first).toMatch(/^hello-[0-9a-f]{8}$/);
    expect(first).not.toBe(second);
  });
});

describe("invitee who signed in from the email but never pressed Accept", () => {
  it("is joined automatically on their next page", async () => {
    mocks.prisma.user.findUnique.mockResolvedValueOnce(null).mockResolvedValue({ id: "u-sam" });
    mocks.prisma.brandInvite.findFirst.mockResolvedValue(invite());
    mocks.prisma.brandInvite.updateMany.mockResolvedValue({ count: 1 });
    const user = await getOrAcceptInvitedUser(authUser());
    expect(user).toEqual({ id: "u-sam" });
    expect(mocks.prisma.brandInvite.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ email: "sam@brand.test" }) }),
    );
    expect(mocks.prisma.brandMembership.upsert).toHaveBeenCalled();
  });

  it("is not joined without a confirmed email", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(null);
    expect(await getOrAcceptInvitedUser(authUser({ email_confirmed_at: undefined }))).toBeNull();
    expect(mocks.prisma.brandInvite.findFirst).not.toHaveBeenCalled();
  });

  it("returns null (no workspace) for a login with no invite", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(null);
    mocks.prisma.brandInvite.findFirst.mockResolvedValue(null);
    expect(await getOrAcceptInvitedUser(authUser())).toBeNull();
  });
});

describe("sign-in link callback", () => {
  const url = (q: string) => new Request(`http://localhost:3000/callback?${q}`);

  it("signs in and goes back to the invite", async () => {
    mocks.supabaseAuth.verifyOtp.mockResolvedValue({ error: null });
    const res = await callback(url("token_hash=h&type=invite&next=%2Finvite%2Fabc"));
    expect(mocks.supabaseAuth.verifyOtp).toHaveBeenCalledWith({ token_hash: "h", type: "invite" });
    expect(res.headers.get("location")).toBe("http://localhost:3000/invite/abc");
  });

  it("sends a used or expired invite link back to the invite with a clear message", async () => {
    mocks.supabaseAuth.verifyOtp.mockResolvedValue({ error: { message: "Token has expired or is invalid" } });
    const res = await callback(url("token_hash=h&type=magiclink&next=%2Finvite%2Fabc"));
    expect(res.headers.get("location")).toBe("http://localhost:3000/invite/abc?link=expired");
  });

  it("only follows same-site next paths", async () => {
    mocks.supabaseAuth.verifyOtp.mockResolvedValue({ error: null });
    const res = await callback(url("token_hash=h&type=magiclink&next=%2F%2Fevil.test"));
    expect(res.headers.get("location")).toBe("http://localhost:3000/dashboard");
  });

  it("refuses unknown link types", async () => {
    const res = await callback(url("token_hash=h&type=recovery"));
    expect(mocks.supabaseAuth.verifyOtp).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toBe("http://localhost:3000/login?error=auth");
  });

  it.each([
    ["//evil.test", "/dashboard"],
    ["/\\evil.test", "/dashboard"],
    ["/\t/evil.test", "/dashboard"],
    ["https://evil.test", "/dashboard"],
    ["/campaigns?x=1", "/campaigns?x=1"],
  ])("safeNextPath(%j) is %j", (raw, expected) => {
    expect(safeNextPath(raw)).toBe(expected);
  });
});

describe("logout", () => {
  it("signs out, clears the chosen company and goes to sign in", async () => {
    const res = await logout(new Request("http://localhost:3000/api/auth/logout", { method: "POST" }));
    expect(mocks.supabaseAuth.signOut).toHaveBeenCalled();
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("http://localhost:3000/login");
    expect(res.headers.get("set-cookie")).toMatch(/seed-active-brand=;/);
  });
});
