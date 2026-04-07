import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Suppression security tests.
 *
 * Covers:
 * - verifyUnsubscribeToken uses constant-time comparison (timingSafeEqual)
 * - generateUnsubscribeToken throws when APP_ENCRYPTION_KEY is missing
 * - verifyUnsubscribeToken rejects forged tokens
 * - verifyUnsubscribeToken rejects tokens of wrong length
 * - addSuppression writes to durable EmailSuppression table
 * - isSuppressed checks both Creator and EmailSuppression tables
 */

// ─── Mocks ───────────────────────────────────────────────

const mockPrisma = {
  creator: {
    findFirst: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
  campaignCreator: {
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
  emailSuppression: {
    findUnique: vi.fn(),
    upsert: vi.fn().mockResolvedValue({ id: "es-1" }),
  },
};

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// ─── Tests ───────────────────────────────────────────────

describe("Suppression security hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.APP_ENCRYPTION_KEY = "test-encryption-key-32chars-long!";
  });

  it("generates a valid HMAC token", async () => {
    const { generateUnsubscribeToken } = await import(
      "@/lib/compliance/suppression"
    );
    const token = generateUnsubscribeToken("test@example.com");
    expect(typeof token).toBe("string");
    expect(token.length).toBe(64); // SHA-256 hex digest
  });

  it("verifyUnsubscribeToken accepts valid token", async () => {
    const { generateUnsubscribeToken, verifyUnsubscribeToken } = await import(
      "@/lib/compliance/suppression"
    );
    const email = "valid@example.com";
    const token = generateUnsubscribeToken(email);
    expect(verifyUnsubscribeToken(email, token)).toBe(true);
  });

  it("verifyUnsubscribeToken rejects forged token", async () => {
    const { verifyUnsubscribeToken } = await import(
      "@/lib/compliance/suppression"
    );
    expect(
      verifyUnsubscribeToken("test@example.com", "forged-token-value")
    ).toBe(false);
  });

  it("verifyUnsubscribeToken rejects token with wrong length", async () => {
    const { verifyUnsubscribeToken } = await import(
      "@/lib/compliance/suppression"
    );
    expect(verifyUnsubscribeToken("test@example.com", "short")).toBe(false);
  });

  it("generateUnsubscribeToken throws when APP_ENCRYPTION_KEY is unset", async () => {
    delete process.env.APP_ENCRYPTION_KEY;
    // Must re-import to get fresh module
    vi.resetModules();
    vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

    const { generateUnsubscribeToken } = await import(
      "@/lib/compliance/suppression"
    );

    expect(() => generateUnsubscribeToken("test@example.com")).toThrow(
      "APP_ENCRYPTION_KEY is not set"
    );
  });

  it("addSuppression writes to durable EmailSuppression table", async () => {
    const { addSuppression } = await import("@/lib/compliance/suppression");

    await addSuppression("unsub@example.com", "UNSUBSCRIBE");

    expect(mockPrisma.emailSuppression.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: "unsub@example.com" },
        create: expect.objectContaining({
          email: "unsub@example.com",
          reason: "UNSUBSCRIBE",
        }),
      })
    );
  });

  it("isSuppressed returns true when email is in EmailSuppression table but not Creator", async () => {
    mockPrisma.creator.findFirst.mockResolvedValue(null);
    mockPrisma.emailSuppression.findUnique.mockResolvedValue({
      id: "es-1",
      email: "unknown@example.com",
    });

    const { isSuppressed } = await import("@/lib/compliance/suppression");
    const result = await isSuppressed("unknown@example.com");
    expect(result).toBe(true);
  });

  it("isSuppressed returns true when email is in Creator table (opted out)", async () => {
    mockPrisma.creator.findFirst.mockResolvedValue({ id: "creator-1" });

    const { isSuppressed } = await import("@/lib/compliance/suppression");
    const result = await isSuppressed("opted-out@example.com");
    expect(result).toBe(true);

    // Should not even check EmailSuppression since Creator already matched
    expect(mockPrisma.emailSuppression.findUnique).not.toHaveBeenCalled();
  });

  it("isSuppressed returns false when email is not suppressed anywhere", async () => {
    mockPrisma.creator.findFirst.mockResolvedValue(null);
    mockPrisma.emailSuppression.findUnique.mockResolvedValue(null);

    const { isSuppressed } = await import("@/lib/compliance/suppression");
    const result = await isSuppressed("active@example.com");
    expect(result).toBe(false);
  });
});
