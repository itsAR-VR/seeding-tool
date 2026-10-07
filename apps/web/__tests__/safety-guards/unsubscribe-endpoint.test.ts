import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Unsubscribe endpoint tests (GET and POST).
 *
 * Covers:
 * - GET with valid token adds suppression
 * - GET with forged token returns 403
 * - POST (RFC 8058 one-click) with valid token adds suppression
 * - POST with forged token returns 403
 * - Missing params return 400
 */

// ─── Mocks ───────────────────────────────────────────────

const mockAddSuppression = vi.fn().mockResolvedValue(undefined);
const mockVerifyToken = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    creator: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([{ brandId: "brand-a", brand: { name: "Brand A" } }]),
    },
    brand: { findUnique: vi.fn().mockResolvedValue({ name: "Brand A" }) },
  },
}));

vi.mock("@/lib/compliance/suppression", () => ({
  verifyUnsubscribeToken: (...args: unknown[]) => mockVerifyToken(...args),
  addSuppression: (...args: unknown[]) => mockAddSuppression(...args),
}));

// ─── Helper ──────────────────────────────────────────────

function makeUrl(email?: string, token?: string): string {
  const params = new URLSearchParams();
  if (email) params.set("email", email);
  if (token) params.set("token", token);
  return `http://localhost:3000/api/webhooks/unsubscribe?${params.toString()}`;
}

// ─── Tests ───────────────────────────────────────────────

describe("Unsubscribe endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET handler", () => {
    it("returns 400 when email or token is missing", async () => {
      const mod = await import("@/app/api/webhooks/unsubscribe/route");

      const req = new NextRequest(makeUrl(), { method: "GET" });
      const res = await mod.GET(req);
      expect(res.status).toBe(400);
    });

    it("returns 403 when token is invalid", async () => {
      mockVerifyToken.mockReturnValue(false);

      const mod = await import("@/app/api/webhooks/unsubscribe/route");
      const req = new NextRequest(
        makeUrl("test@example.com", "forged"),
        { method: "GET" }
      );
      const res = await mod.GET(req);
      expect(res.status).toBe(403);
    });

    it("adds suppression and returns 200 for valid token", async () => {
      mockVerifyToken.mockReturnValue(true);

      const mod = await import("@/app/api/webhooks/unsubscribe/route");
      const req = new NextRequest(
        makeUrl("test@example.com", "valid-token"),
        { method: "GET" }
      );
      const res = await mod.GET(req);

      expect(res.status).toBe(200);
      // Legacy link (no brand): opts out of each brand that has this person.
      expect(mockAddSuppression).toHaveBeenCalledWith(
        "test@example.com",
        "UNSUBSCRIBE",
        "brand-a"
      );
    });
  });

  describe("brand-scoped links", () => {
    it("opts out of only the brand in the link", async () => {
      mockVerifyToken.mockReturnValue(true);
      const mod = await import("@/app/api/webhooks/unsubscribe/route");
      const req = new NextRequest(
        "http://localhost:3000/api/webhooks/unsubscribe?email=b%40example.com&b=brand-z&token=t",
        { method: "GET" }
      );
      const res = await mod.GET(req);
      expect(res.status).toBe(200);
      expect(mockVerifyToken).toHaveBeenCalledWith("b@example.com", "t", "brand-z");
      expect(mockAddSuppression).toHaveBeenCalledTimes(1);
      expect(mockAddSuppression).toHaveBeenCalledWith("b@example.com", "UNSUBSCRIBE", "brand-z");
    });
  });

  describe("POST handler (RFC 8058 one-click)", () => {
    it("returns 400 when email or token is missing", async () => {
      const mod = await import("@/app/api/webhooks/unsubscribe/route");

      const req = new NextRequest(makeUrl(), {
        method: "POST",
        body: "List-Unsubscribe=One-Click",
      });
      const res = await mod.POST(req);
      expect(res.status).toBe(400);
    });

    it("returns 403 when token is forged", async () => {
      mockVerifyToken.mockReturnValue(false);

      const mod = await import("@/app/api/webhooks/unsubscribe/route");
      const req = new NextRequest(
        makeUrl("test@example.com", "forged-token"),
        {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: "List-Unsubscribe=One-Click",
        }
      );
      const res = await mod.POST(req);
      expect(res.status).toBe(403);
    });

    it("adds suppression for valid RFC 8058 one-click POST", async () => {
      mockVerifyToken.mockReturnValue(true);

      const mod = await import("@/app/api/webhooks/unsubscribe/route");
      const req = new NextRequest(
        makeUrl("oneclick@example.com", "valid-token"),
        {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: "List-Unsubscribe=One-Click",
        }
      );
      const res = await mod.POST(req);

      expect(res.status).toBe(200);
      expect(mockAddSuppression).toHaveBeenCalledWith(
        "oneclick@example.com",
        "UNSUBSCRIBE",
        "brand-a"
      );
    });
  });
});
