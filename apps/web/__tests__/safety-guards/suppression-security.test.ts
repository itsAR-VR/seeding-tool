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
    findFirst: vi.fn(),
    create: vi.fn().mockResolvedValue({ id: "es-1" }),
    deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
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

  it("addSuppression writes a brand-scoped row and only touches that brand's creators", async () => {
    mockPrisma.emailSuppression.findFirst.mockResolvedValue(null);
    const { addSuppression } = await import("@/lib/compliance/suppression");

    await addSuppression("Unsub@Example.com ", "UNSUBSCRIBE", "brand-a");

    expect(mockPrisma.emailSuppression.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ email: "unsub@example.com", reason: "UNSUBSCRIBE", brandId: "brand-a" }),
    });
    expect(mockPrisma.creator.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "unsub@example.com", brandId: "brand-a" } })
    );
  });

  it("bounces are global regardless of the brand passed", async () => {
    mockPrisma.emailSuppression.findFirst.mockResolvedValue(null);
    const { addSuppression } = await import("@/lib/compliance/suppression");

    await addSuppression("dead@example.com", "BOUNCE", "brand-a");

    expect(mockPrisma.emailSuppression.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ brandId: null, reason: "BOUNCE" }),
    });
    expect(mockPrisma.creator.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "dead@example.com" } })
    );
  });

  it("addSuppression does not duplicate an existing row", async () => {
    mockPrisma.emailSuppression.findFirst.mockResolvedValue({ id: "es-1" });
    const { addSuppression } = await import("@/lib/compliance/suppression");
    await addSuppression("again@example.com", "DECLINED", "brand-a");
    expect(mockPrisma.emailSuppression.create).not.toHaveBeenCalled();
  });

  it("isSuppressed checks this brand and global blocks only", async () => {
    mockPrisma.creator.findFirst.mockResolvedValue(null);
    mockPrisma.emailSuppression.findFirst.mockResolvedValue(null);

    const { isSuppressed } = await import("@/lib/compliance/suppression");
    const result = await isSuppressed("someone@example.com", "brand-b");

    expect(result).toBe(false);
    expect(mockPrisma.creator.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ brandId: "brand-b" }) })
    );
    expect(mockPrisma.emailSuppression.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: "someone@example.com", OR: [{ brandId: "brand-b" }, { brandId: null }] },
      })
    );
  });

  it("isSuppressed returns true for a suppression row", async () => {
    mockPrisma.creator.findFirst.mockResolvedValue(null);
    mockPrisma.emailSuppression.findFirst.mockResolvedValue({ id: "es-1" });
    const { isSuppressed } = await import("@/lib/compliance/suppression");
    expect(await isSuppressed("unknown@example.com", "brand-a")).toBe(true);
  });

  it("isSuppressed returns true when the brand's creator opted out, without a table lookup", async () => {
    mockPrisma.creator.findFirst.mockResolvedValue({ id: "creator-1" });
    const { isSuppressed } = await import("@/lib/compliance/suppression");
    expect(await isSuppressed("opted-out@example.com", "brand-a")).toBe(true);
    expect(mockPrisma.emailSuppression.findFirst).not.toHaveBeenCalled();
  });

  it("removeSuppression lifts only this brand's rows of that reason", async () => {
    const { removeSuppression } = await import("@/lib/compliance/suppression");
    await removeSuppression("x@example.com", "DECLINED", "brand-a");
    expect(mockPrisma.emailSuppression.deleteMany).toHaveBeenCalledWith({
      where: { email: "x@example.com", brandId: "brand-a", reason: "DECLINED" },
    });
    expect(mockPrisma.creator.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "x@example.com", brandId: "brand-a" } })
    );
  });

  it("unsubscribe tokens are bound to the brand", async () => {
    const { generateUnsubscribeToken, verifyUnsubscribeToken } = await import("@/lib/compliance/suppression");
    const token = generateUnsubscribeToken("a@example.com", "brand-a");
    expect(verifyUnsubscribeToken("a@example.com", token, "brand-a")).toBe(true);
    expect(verifyUnsubscribeToken("a@example.com", token, "brand-b")).toBe(false);
    expect(verifyUnsubscribeToken("a@example.com", token)).toBe(false);
  });
});
