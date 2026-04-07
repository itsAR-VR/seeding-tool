/**
 * Shared Prisma mock factory for integration tests.
 *
 * Prevents mock-shape drift by centralizing the mock definition.
 * CRITICAL: $transaction executes its callback with the mock as the tx client.
 */
import { vi } from "vitest";

export type MockPrisma = ReturnType<typeof createMockPrisma>;

export function createMockPrisma() {
  const mock = {
    // ── Models ─────────────────────────────────────────────
    campaign: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    campaignCreator: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    campaignProduct: {
      findFirst: vi.fn(),
    },
    creator: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    conversationThread: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    message: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    emailAlias: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    sendingMetric: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    shippingAddressSnapshot: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    shopifyOrder: {
      create: vi.fn(),
    },
    brandConnection: {
      findUnique: vi.fn(),
    },
    brandMembership: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    brandSettings: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    brandCreditBalance: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    brandCreditTransaction: {
      create: vi.fn(),
    },
    creatorSearchJob: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    emailSuppression: {
      findUnique: vi.fn(),
    },
    activityLog: {
      create: vi.fn(),
    },
    interventionCase: {
      create: vi.fn(),
    },
    aIDraft: {
      create: vi.fn(),
    },

    // ── Transaction (CRITICAL: executes the callback) ──────
    $transaction: vi.fn(),
  };

  // Wire $transaction to execute its callback with the mock as tx client
  mock.$transaction.mockImplementation(
    async (cb: (tx: typeof mock) => Promise<unknown>) => cb(mock)
  );

  return mock;
}

// ── Data factories ─────────────────────────────────────────

export function makeMembership(
  role: "owner" | "editor" | "viewer" = "owner",
  overrides: Record<string, unknown> = {}
) {
  return {
    id: "mem-1",
    role,
    userId: "user-1",
    brandId: "brand-1",
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    ...overrides,
  };
}

export function makeCreator(overrides: Record<string, unknown> = {}) {
  return {
    id: "creator-1",
    email: "creator@example.com",
    instagramHandle: "creator_ig",
    name: "Test Creator",
    optedOut: false,
    ...overrides,
  };
}

export function makeCampaign(overrides: Record<string, unknown> = {}) {
  return {
    id: "camp-1",
    brandId: "brand-1",
    name: "Test Campaign",
    ...overrides,
  };
}

export function makeCampaignCreator(overrides: Record<string, unknown> = {}) {
  return {
    id: "cc-1",
    campaignId: "camp-1",
    creatorId: "creator-1",
    lifecycleStatus: "outreach_sent",
    outreachCount: 1,
    lastOutreachAt: new Date("2025-01-01"),
    ...overrides,
  };
}

export function makeSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    id: "snap-1",
    campaignCreatorId: "cc-1",
    isActive: false,
    confirmedAt: null,
    confirmedBy: null,
    fullName: "Test Creator",
    line1: "123 Main St",
    line2: null,
    city: "Springfield",
    state: "IL",
    postalCode: "62701",
    country: "US",
    phone: "555-0100",
    source: "ai_extracted",
    ...overrides,
  };
}

export function makeEmailAlias(overrides: Record<string, unknown> = {}) {
  return {
    id: "alias-1",
    address: "outreach@brand.com",
    displayName: "Brand Outreach",
    brandId: "brand-1",
    isPrimary: true,
    isPaused: false,
    dailyLimit: 100,
    ...overrides,
  };
}
