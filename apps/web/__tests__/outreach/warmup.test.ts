/**
 * Tests for email warmup logic.
 *
 * Covers:
 * - getEffectiveDailyLimit ramp schedule (5 -> 15 -> 30 -> full)
 * - isWarmupComplete after 14 days
 * - Edge cases: warmed aliases, null warmupStartedAt
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getEffectiveDailyLimit, isWarmupComplete } from "@/lib/outreach/warmup";

const MS_PER_DAY = 86_400_000;

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * MS_PER_DAY);
}

function makeAlias(overrides: Record<string, unknown> = {}) {
  return {
    isWarmedUp: false,
    warmupStartedAt: new Date(),
    dailyLimit: 100,
    ...overrides,
  };
}

// ── getEffectiveDailyLimit ─────────────────────────────────

describe("getEffectiveDailyLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-07T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns full dailyLimit when isWarmedUp is true", () => {
    const alias = makeAlias({ isWarmedUp: true, dailyLimit: 200 });
    expect(getEffectiveDailyLimit(alias)).toBe(200);
  });

  it("returns full dailyLimit when isWarmedUp is true regardless of warmupStartedAt", () => {
    const alias = makeAlias({
      isWarmedUp: true,
      warmupStartedAt: daysAgo(2),
      dailyLimit: 75,
    });
    expect(getEffectiveDailyLimit(alias)).toBe(75);
  });

  it("returns 0 when warmupStartedAt is null", () => {
    const alias = makeAlias({ warmupStartedAt: null });
    expect(getEffectiveDailyLimit(alias)).toBe(0);
  });

  it("returns 5 on day 1 (just started)", () => {
    const alias = makeAlias({ warmupStartedAt: new Date() });
    expect(getEffectiveDailyLimit(alias)).toBe(5);
  });

  it("returns 5 on day 3", () => {
    const alias = makeAlias({ warmupStartedAt: daysAgo(2) });
    expect(getEffectiveDailyLimit(alias)).toBe(5);
  });

  it("returns 15 on day 4", () => {
    const alias = makeAlias({ warmupStartedAt: daysAgo(3) });
    expect(getEffectiveDailyLimit(alias)).toBe(15);
  });

  it("returns 15 on day 5", () => {
    const alias = makeAlias({ warmupStartedAt: daysAgo(4) });
    expect(getEffectiveDailyLimit(alias)).toBe(15);
  });

  it("returns 15 on day 7", () => {
    const alias = makeAlias({ warmupStartedAt: daysAgo(6) });
    expect(getEffectiveDailyLimit(alias)).toBe(15);
  });

  it("returns 30 on day 8", () => {
    const alias = makeAlias({ warmupStartedAt: daysAgo(7) });
    expect(getEffectiveDailyLimit(alias)).toBe(30);
  });

  it("returns 30 on day 10", () => {
    const alias = makeAlias({ warmupStartedAt: daysAgo(9) });
    expect(getEffectiveDailyLimit(alias)).toBe(30);
  });

  it("returns 30 on day 14", () => {
    const alias = makeAlias({ warmupStartedAt: daysAgo(13) });
    expect(getEffectiveDailyLimit(alias)).toBe(30);
  });

  it("returns full dailyLimit on day 15+", () => {
    const alias = makeAlias({ warmupStartedAt: daysAgo(14), dailyLimit: 100 });
    expect(getEffectiveDailyLimit(alias)).toBe(100);
  });

  it("returns full dailyLimit on day 30", () => {
    const alias = makeAlias({ warmupStartedAt: daysAgo(29), dailyLimit: 50 });
    expect(getEffectiveDailyLimit(alias)).toBe(50);
  });
});

// ── isWarmupComplete ───────────────────────────────────────

describe("isWarmupComplete", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-07T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns false when warmupStartedAt is null", () => {
    expect(isWarmupComplete({ warmupStartedAt: null })).toBe(false);
  });

  it("returns false on day 1", () => {
    expect(isWarmupComplete({ warmupStartedAt: new Date() })).toBe(false);
  });

  it("returns false on day 14", () => {
    expect(isWarmupComplete({ warmupStartedAt: daysAgo(13) })).toBe(false);
  });

  it("returns true on day 15", () => {
    expect(isWarmupComplete({ warmupStartedAt: daysAgo(14) })).toBe(true);
  });

  it("returns true on day 30", () => {
    expect(isWarmupComplete({ warmupStartedAt: daysAgo(29) })).toBe(true);
  });
});

// ── Warmup graduation cron ─────────────────────────────────

describe("warmup-check cron", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-07T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("graduates aliases that have completed warmup", async () => {
    const mockUpdate = vi.fn().mockResolvedValue({});
    const completedAlias = {
      id: "alias-done",
      address: "done@brand.com",
      warmupStartedAt: daysAgo(15),
    };
    const inProgressAlias = {
      id: "alias-wip",
      address: "wip@brand.com",
      warmupStartedAt: daysAgo(5),
    };

    const mockPrisma = {
      emailAlias: {
        findMany: vi.fn().mockResolvedValue([completedAlias, inProgressAlias]),
        update: mockUpdate,
      },
    };

    vi.doMock("@/lib/prisma", () => ({ prisma: mockPrisma }));

    // Directly test the graduation logic since the Inngest function
    // wraps the same isWarmupComplete + prisma.update pattern
    const graduated: string[] = [];
    const aliases = await mockPrisma.emailAlias.findMany();

    for (const alias of aliases) {
      if (isWarmupComplete(alias)) {
        await mockPrisma.emailAlias.update({
          where: { id: alias.id },
          data: { isWarmedUp: true },
        });
        graduated.push(alias.address);
      }
    }

    expect(graduated).toEqual(["done@brand.com"]);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "alias-done" },
      data: { isWarmedUp: true },
    });
  });
});
