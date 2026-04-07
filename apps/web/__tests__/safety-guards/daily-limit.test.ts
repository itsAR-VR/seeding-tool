import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DailyLimitExceededError,
  AliasPausedError,
} from "@/lib/outreach/errors";

/**
 * Daily send limit enforcement tests.
 *
 * Covers:
 * - sendEmail throws DailyLimitExceededError at limit
 * - sendEmail throws AliasPausedError for paused aliases
 * - sendEmail throws on cross-brand alias use
 * - DailyLimitExceededError properties
 */

// ─── Mocks ───────────────────────────────────────────────

const mockAlias = {
  id: "alias-1",
  address: "outreach@brand.com",
  displayName: "Brand Outreach",
  brandId: "brand-1",
  isPaused: false,
  dailyLimit: 50,
};

const mockPrisma = {
  emailAlias: {
    findUnique: vi.fn(),
  },
  sendingMetric: {
    findUnique: vi.fn(),
    upsert: vi.fn().mockResolvedValue({}),
  },
  creator: {
    findFirst: vi.fn().mockResolvedValue(null),
  },
  emailSuppression: {
    findUnique: vi.fn().mockResolvedValue(null),
  },
  message: {
    create: vi.fn().mockResolvedValue({}),
  },
  conversationThread: {
    update: vi.fn().mockResolvedValue({}),
  },
};

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/integrations/state", () => ({
  resolveProviderCredential: vi.fn().mockResolvedValue({
    decryptedValue: "mock-refresh-token",
  }),
}));

// Mock environment for suppression token generation
process.env.APP_ENCRYPTION_KEY = "test-key-for-hmac-generation";

// ─── Tests ───────────────────────────────────────────────

describe("Daily send limit enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws DailyLimitExceededError when alias is at daily limit", async () => {
    mockPrisma.emailAlias.findUnique.mockResolvedValue({ ...mockAlias });
    mockPrisma.sendingMetric.findUnique.mockResolvedValue({ sent: 50 });

    const { sendEmail } = await import("@/lib/gmail/send");

    await expect(
      sendEmail({
        aliasId: "alias-1",
        to: "creator@example.com",
        subject: "Test",
        body: "Hello",
      })
    ).rejects.toThrow(DailyLimitExceededError);
  });

  it("throws AliasPausedError when alias is paused", async () => {
    mockPrisma.emailAlias.findUnique.mockResolvedValue({
      ...mockAlias,
      isPaused: true,
    });

    const { sendEmail } = await import("@/lib/gmail/send");

    await expect(
      sendEmail({
        aliasId: "alias-1",
        to: "creator@example.com",
        subject: "Test",
        body: "Hello",
      })
    ).rejects.toThrow(AliasPausedError);
  });

  it("throws error on cross-brand alias use", async () => {
    mockPrisma.emailAlias.findUnique.mockResolvedValue({ ...mockAlias });
    mockPrisma.sendingMetric.findUnique.mockResolvedValue(null);

    const { sendEmail } = await import("@/lib/gmail/send");

    await expect(
      sendEmail({
        aliasId: "alias-1",
        to: "creator@example.com",
        subject: "Test",
        body: "Hello",
        senderBrandId: "different-brand-id",
      })
    ).rejects.toThrow(/belongs to brand/);
  });

  it("DailyLimitExceededError contains correct properties", () => {
    const err = new DailyLimitExceededError("alias-1", 50, 50);
    expect(err.aliasId).toBe("alias-1");
    expect(err.sent).toBe(50);
    expect(err.dailyLimit).toBe(50);
    expect(err.code).toBe("DAILY_LIMIT_EXCEEDED");
    expect(err.name).toBe("DailyLimitExceededError");
  });

  it("AliasPausedError contains correct properties", () => {
    const err = new AliasPausedError("alias-1");
    expect(err.aliasId).toBe("alias-1");
    expect(err.code).toBe("ALIAS_PAUSED");
    expect(err.name).toBe("AliasPausedError");
  });
});
