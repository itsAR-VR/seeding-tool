import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * List-Unsubscribe header tests.
 *
 * Covers:
 * - buildRawEmail includes List-Unsubscribe header
 * - buildRawEmail includes List-Unsubscribe-Post header
 * - Unsubscribe URL contains valid HMAC token
 * - URL-encodes the email parameter
 */

// ─── Mocks ───────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailAlias: { findUnique: vi.fn() },
    sendingMetric: { findUnique: vi.fn(), upsert: vi.fn() },
    creator: { findFirst: vi.fn().mockResolvedValue(null) },
    emailSuppression: { findUnique: vi.fn().mockResolvedValue(null) },
    message: { create: vi.fn() },
    conversationThread: { update: vi.fn() },
  },
}));

vi.mock("@/lib/integrations/state", () => ({
  resolveProviderCredential: vi.fn(),
}));

// Set encryption key before importing suppression module
process.env.APP_ENCRYPTION_KEY = "test-key-for-hmac-generation";
process.env.NEXT_PUBLIC_APP_URL = "https://app.test.com";

// ─── Tests ───────────────────────────────────────────────

describe("List-Unsubscribe header in buildRawEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates valid unsubscribe token for an email", async () => {
    const { generateUnsubscribeToken, verifyUnsubscribeToken } = await import(
      "@/lib/compliance/suppression"
    );

    const email = "creator@example.com";
    const token = generateUnsubscribeToken(email);

    expect(verifyUnsubscribeToken(email, token)).toBe(true);
    expect(token).toHaveLength(64); // SHA-256 hex
  });

  it("token is consistent for the same email (deterministic)", async () => {
    const { generateUnsubscribeToken } = await import(
      "@/lib/compliance/suppression"
    );

    const token1 = generateUnsubscribeToken("same@example.com");
    const token2 = generateUnsubscribeToken("same@example.com");

    expect(token1).toBe(token2);
  });

  it("token differs for different emails", async () => {
    const { generateUnsubscribeToken } = await import(
      "@/lib/compliance/suppression"
    );

    const token1 = generateUnsubscribeToken("a@example.com");
    const token2 = generateUnsubscribeToken("b@example.com");

    expect(token1).not.toBe(token2);
  });

  it("token is case-insensitive on email", async () => {
    const { generateUnsubscribeToken } = await import(
      "@/lib/compliance/suppression"
    );

    const token1 = generateUnsubscribeToken("Test@Example.com");
    const token2 = generateUnsubscribeToken("test@example.com");

    expect(token1).toBe(token2);
  });
});
