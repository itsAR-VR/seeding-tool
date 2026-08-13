import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: () => undefined,
    set: vi.fn(),
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
vi.mock("@/lib/tenancy", () => ({
  getUserBySupabaseId: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

import {
  isAdminRole,
  requireWriteAccess,
  requireAdminAccess,
  requireOwnerAccess,
  BrandAccessError,
} from "@/lib/integrations/brand-access";

// ─── Test data ──────────────────────────────────────────

function makeMembership(role: string) {
  return {
    id: "bm-1",
    role,
    userId: "user-1",
    brandId: "brand-1",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// ─── isAdminRole ────────────────────────────────────────

describe("isAdminRole", () => {
  it("returns true for owner", () => {
    expect(isAdminRole("owner")).toBe(true);
  });

  it("returns true for editor", () => {
    expect(isAdminRole("editor")).toBe(true);
  });

  it("returns false for member", () => {
    expect(isAdminRole("member")).toBe(false);
  });

  it("returns false for viewer", () => {
    expect(isAdminRole("viewer")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isAdminRole(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isAdminRole(undefined)).toBe(false);
  });

  it("returns false for unknown role values", () => {
    expect(isAdminRole("superadmin")).toBe(false);
    expect(isAdminRole("admin")).toBe(false);
    expect(isAdminRole("")).toBe(false);
  });
});

// ─── requireWriteAccess ─────────────────────────────────

describe("requireWriteAccess", () => {
  it("allows owner", () => {
    const m = makeMembership("owner");
    expect(requireWriteAccess(m)).toBe(m);
  });

  it("allows editor", () => {
    const m = makeMembership("editor");
    expect(requireWriteAccess(m)).toBe(m);
  });

  it("blocks member with 403", () => {
    expect(() => requireWriteAccess(makeMembership("member"))).toThrow(
      BrandAccessError
    );
    try {
      requireWriteAccess(makeMembership("member"));
    } catch (error) {
      expect((error as BrandAccessError).status).toBe(403);
      expect((error as BrandAccessError).message).toBe("Write access required");
    }
  });

  it("blocks viewer with 403", () => {
    expect(() => requireWriteAccess(makeMembership("viewer"))).toThrow(
      BrandAccessError
    );
  });

  it("blocks unknown roles", () => {
    expect(() => requireWriteAccess(makeMembership("guest"))).toThrow(
      BrandAccessError
    );
  });
});

// ─── requireAdminAccess ─────────────────────────────────

describe("requireAdminAccess", () => {
  it("allows owner", () => {
    const m = makeMembership("owner");
    expect(requireAdminAccess(m)).toBe(m);
  });

  it("allows editor", () => {
    const m = makeMembership("editor");
    expect(requireAdminAccess(m)).toBe(m);
  });

  it("blocks member", () => {
    expect(() => requireAdminAccess(makeMembership("member"))).toThrow(
      BrandAccessError
    );
  });
});

// ─── requireOwnerAccess ─────────────────────────────────

describe("requireOwnerAccess", () => {
  it("allows owner", () => {
    const m = makeMembership("owner");
    expect(requireOwnerAccess(m)).toBe(m);
  });

  it("blocks editor with 403", () => {
    try {
      requireOwnerAccess(makeMembership("editor"));
    } catch (error) {
      expect((error as BrandAccessError).status).toBe(403);
      expect((error as BrandAccessError).message).toBe("Owner access required");
    }
  });

  it("blocks member", () => {
    expect(() => requireOwnerAccess(makeMembership("member"))).toThrow(
      BrandAccessError
    );
  });

  it("blocks viewer", () => {
    expect(() => requireOwnerAccess(makeMembership("viewer"))).toThrow(
      BrandAccessError
    );
  });
});
