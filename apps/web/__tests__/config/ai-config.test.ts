import { describe, it, expect, vi, afterEach } from "vitest";

describe("AI_MODEL", () => {
  const originalEnv = process.env.AI_MODEL;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.AI_MODEL;
    } else {
      process.env.AI_MODEL = originalEnv;
    }
    vi.resetModules();
  });

  it("defaults to gpt-5-mini when env is not set", async () => {
    delete process.env.AI_MODEL;
    const { AI_MODEL } = await import("@/lib/ai/config");
    expect(AI_MODEL).toBe("gpt-5-mini");
  });

  it("uses env override when AI_MODEL is set", async () => {
    process.env.AI_MODEL = "gpt-5";
    const { AI_MODEL } = await import("@/lib/ai/config");
    expect(AI_MODEL).toBe("gpt-5");
  });

  it("supports suffixed variants via template literal", async () => {
    process.env.AI_MODEL = "gpt-5";
    const { AI_MODEL } = await import("@/lib/ai/config");
    expect(`${AI_MODEL}@fly-worker`).toBe("gpt-5@fly-worker");
    expect(`${AI_MODEL}@local`).toBe("gpt-5@local");
  });
});
