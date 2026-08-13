import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("SHOPIFY_API_VERSION", () => {
  const originalEnv = process.env.SHOPIFY_API_VERSION;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.SHOPIFY_API_VERSION;
    } else {
      process.env.SHOPIFY_API_VERSION = originalEnv;
    }
    vi.resetModules();
  });

  it("defaults to 2025-04 when env is not set", async () => {
    delete process.env.SHOPIFY_API_VERSION;
    const { SHOPIFY_API_VERSION } = await import("@/lib/shopify/config");
    expect(SHOPIFY_API_VERSION).toBe("2025-04");
  });

  it("uses env override when SHOPIFY_API_VERSION is set", async () => {
    process.env.SHOPIFY_API_VERSION = "2025-07";
    const { SHOPIFY_API_VERSION } = await import("@/lib/shopify/config");
    expect(SHOPIFY_API_VERSION).toBe("2025-07");
  });
});
