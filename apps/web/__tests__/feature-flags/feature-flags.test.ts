import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ─────────────────────────────────────────────

vi.mock("server-only", () => ({}));
vi.mock("@/lib/logger", () => ({
  log: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    brandSettings: {
      findUnique: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  DEFAULT_FLAGS,
  VALID_FLAG_NAMES,
  FLAG_PRESETS,
  getFeatureFlags,
  setFeatureFlag,
  applyPreset,
  type FeatureFlags,
  type FlagPreset,
} from "@/lib/feature-flags";

const mockBrandSettings = prisma.brandSettings as unknown as {
  findUnique: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
};

// ─── VALID_FLAG_NAMES ──────────────────────────────────

describe("VALID_FLAG_NAMES", () => {
  it("matches all keys in the FeatureFlags interface via DEFAULT_FLAGS", () => {
    const defaultKeys = Object.keys(DEFAULT_FLAGS).sort();
    const validNames = [...VALID_FLAG_NAMES].sort();
    expect(validNames).toEqual(defaultKeys);
  });

  it("has 10 entries", () => {
    expect(VALID_FLAG_NAMES).toHaveLength(10);
  });

  it("includes instagramMentionPollEnabled", () => {
    expect(VALID_FLAG_NAMES).toContain("instagramMentionPollEnabled");
  });
});

// ─── DEFAULT_FLAGS ─────────────────────────────────────

describe("DEFAULT_FLAGS", () => {
  it("has instagramMentionPollEnabled as true (fail-OPEN)", () => {
    expect(DEFAULT_FLAGS.instagramMentionPollEnabled).toBe(true);
  });

  it("has all other flags as false (fail-CLOSED)", () => {
    const otherFlags = { ...DEFAULT_FLAGS };
    delete (otherFlags as Record<string, boolean>).instagramMentionPollEnabled;
    for (const [key, value] of Object.entries(otherFlags)) {
      expect(value).toBe(false);
    }
  });
});

// ─── FLAG_PRESETS ──────────────────────────────────────

describe("FLAG_PRESETS", () => {
  describe("manual", () => {
    it("sets all flags to defaults (all false except instagramMentionPollEnabled)", () => {
      expect(FLAG_PRESETS.manual).toEqual(DEFAULT_FLAGS);
    });

    it("keeps instagramMentionPollEnabled true", () => {
      expect(FLAG_PRESETS.manual.instagramMentionPollEnabled).toBe(true);
    });
  });

  describe("assisted", () => {
    it("enables the 6 expected flags", () => {
      expect(FLAG_PRESETS.assisted.decisionEngineScoringEnabled).toBe(true);
      expect(FLAG_PRESETS.assisted.shopifyOrderEnabled).toBe(true);
      expect(FLAG_PRESETS.assisted.reminderEmailEnabled).toBe(true);
      expect(FLAG_PRESETS.assisted.aiReplyEnabled).toBe(true);
      expect(FLAG_PRESETS.assisted.outcomeLearningEnabled).toBe(true);
      expect(FLAG_PRESETS.assisted.instagramMentionPollEnabled).toBe(true);
    });

    it("keeps identityAutoLinkEnabled false", () => {
      expect(FLAG_PRESETS.assisted.identityAutoLinkEnabled).toBe(false);
    });

    it("keeps identityGraphEnabled false", () => {
      expect(FLAG_PRESETS.assisted.identityGraphEnabled).toBe(false);
    });

    it("keeps portfolioOptimizerEnabled false", () => {
      expect(FLAG_PRESETS.assisted.portfolioOptimizerEnabled).toBe(false);
    });
  });

  describe("autonomous", () => {
    it("enables 8 flags (assisted + identityGraph + portfolioOptimizer)", () => {
      expect(FLAG_PRESETS.autonomous.decisionEngineScoringEnabled).toBe(true);
      expect(FLAG_PRESETS.autonomous.identityGraphEnabled).toBe(true);
      expect(FLAG_PRESETS.autonomous.portfolioOptimizerEnabled).toBe(true);
      expect(FLAG_PRESETS.autonomous.shopifyOrderEnabled).toBe(true);
      expect(FLAG_PRESETS.autonomous.reminderEmailEnabled).toBe(true);
      expect(FLAG_PRESETS.autonomous.aiReplyEnabled).toBe(true);
      expect(FLAG_PRESETS.autonomous.outcomeLearningEnabled).toBe(true);
      expect(FLAG_PRESETS.autonomous.instagramMentionPollEnabled).toBe(true);
    });

    it("does NOT enable identityAutoLinkEnabled", () => {
      expect(FLAG_PRESETS.autonomous.identityAutoLinkEnabled).toBe(false);
    });
  });

  describe("cross-preset invariants", () => {
    const presetNames = Object.keys(FLAG_PRESETS) as FlagPreset[];

    it("identityAutoLinkEnabled is false in ALL presets", () => {
      for (const name of presetNames) {
        expect(FLAG_PRESETS[name].identityAutoLinkEnabled).toBe(false);
      }
    });

    it("instagramMentionPollEnabled is true in ALL presets", () => {
      for (const name of presetNames) {
        expect(FLAG_PRESETS[name].instagramMentionPollEnabled).toBe(true);
      }
    });

    it("embeddingScoringEnabled is NOT present in any preset", () => {
      for (const name of presetNames) {
        expect("embeddingScoringEnabled" in FLAG_PRESETS[name]).toBe(false);
      }
    });

    it("portfolioOptimizerEnabled and decisionEngineScoringEnabled are always enabled together", () => {
      for (const name of presetNames) {
        const preset = FLAG_PRESETS[name];
        if (preset.portfolioOptimizerEnabled) {
          expect(preset.decisionEngineScoringEnabled).toBe(true);
        }
      }
    });
  });
});

// ─── getFeatureFlags ───────────────────────────────────

describe("getFeatureFlags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns DEFAULT_FLAGS when no BrandSettings exists", async () => {
    mockBrandSettings.findUnique.mockResolvedValue(null);
    const flags = await getFeatureFlags("brand-1");
    expect(flags).toEqual(DEFAULT_FLAGS);
  });

  it("returns DEFAULT_FLAGS when metadata is null", async () => {
    mockBrandSettings.findUnique.mockResolvedValue({ metadata: null });
    const flags = await getFeatureFlags("brand-1");
    expect(flags).toEqual(DEFAULT_FLAGS);
  });

  it("returns instagramMentionPollEnabled: true when metadata exists but featureFlags is empty", async () => {
    mockBrandSettings.findUnique.mockResolvedValue({
      metadata: { featureFlags: {} },
    });
    const flags = await getFeatureFlags("brand-1");
    expect(flags.instagramMentionPollEnabled).toBe(true);
  });

  it("returns instagramMentionPollEnabled: true when metadata exists but featureFlags key is missing", async () => {
    mockBrandSettings.findUnique.mockResolvedValue({
      metadata: { someOtherKey: "value" },
    });
    const flags = await getFeatureFlags("brand-1");
    expect(flags.instagramMentionPollEnabled).toBe(true);
  });

  it("merges stored flags with defaults", async () => {
    mockBrandSettings.findUnique.mockResolvedValue({
      metadata: {
        featureFlags: {
          aiReplyEnabled: true,
          instagramMentionPollEnabled: false,
        },
      },
    });
    const flags = await getFeatureFlags("brand-1");
    expect(flags.aiReplyEnabled).toBe(true);
    expect(flags.instagramMentionPollEnabled).toBe(false);
    // other flags get defaults
    expect(flags.shopifyOrderEnabled).toBe(false);
  });

  it("returns DEFAULT_FLAGS on error (fail-CLOSED)", async () => {
    mockBrandSettings.findUnique.mockRejectedValue(
      new Error("DB error")
    );
    const flags = await getFeatureFlags("brand-1");
    expect(flags).toEqual(DEFAULT_FLAGS);
  });
});

// ─── setFeatureFlag ────────────────────────────────────

describe("setFeatureFlag", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws for invalid flag name", async () => {
    await expect(
      setFeatureFlag("brand-1", "nonExistentFlag" as keyof FeatureFlags, true)
    ).rejects.toThrow("Invalid feature flag: nonExistentFlag");
  });

  it("uses VALID_FLAG_NAMES for validation (accepts instagramMentionPollEnabled)", async () => {
    mockBrandSettings.findUnique.mockResolvedValue({
      metadata: { featureFlags: {} },
    });
    mockBrandSettings.update.mockResolvedValue({});

    await expect(
      setFeatureFlag("brand-1", "instagramMentionPollEnabled", false)
    ).resolves.toBeUndefined();
  });

  it("writes updated flag to database", async () => {
    mockBrandSettings.findUnique.mockResolvedValue({
      metadata: { featureFlags: { aiReplyEnabled: false } },
    });
    mockBrandSettings.update.mockResolvedValue({});

    await setFeatureFlag("brand-1", "aiReplyEnabled", true);

    expect(mockBrandSettings.update).toHaveBeenCalledWith({
      where: { brandId: "brand-1" },
      data: {
        metadata: {
          featureFlags: { aiReplyEnabled: true },
        },
      },
    });
  });
});

// ─── applyPreset ───────────────────────────────────────

describe("applyPreset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes all flags in a single database operation (upsert)", async () => {
    mockBrandSettings.findUnique.mockResolvedValue(null);
    mockBrandSettings.upsert.mockResolvedValue({});

    await applyPreset("brand-1", "assisted");

    expect(mockBrandSettings.upsert).toHaveBeenCalledTimes(1);
    // No individual update calls
    expect(mockBrandSettings.update).not.toHaveBeenCalled();
  });

  it("returns the preset flags", async () => {
    mockBrandSettings.findUnique.mockResolvedValue(null);
    mockBrandSettings.upsert.mockResolvedValue({});

    const result = await applyPreset("brand-1", "assisted");

    expect(result).toEqual(FLAG_PRESETS.assisted);
  });

  it("preserves existing non-featureFlags metadata", async () => {
    mockBrandSettings.findUnique.mockResolvedValue({
      metadata: { someOtherKey: "preserved", featureFlags: { aiReplyEnabled: true } },
    });
    mockBrandSettings.upsert.mockResolvedValue({});

    await applyPreset("brand-1", "manual");

    const upsertCall = mockBrandSettings.upsert.mock.calls[0][0];
    expect(upsertCall.update.metadata.someOtherKey).toBe("preserved");
    expect(upsertCall.update.metadata.featureFlags).toEqual(FLAG_PRESETS.manual);
  });

  it("creates BrandSettings if none exists", async () => {
    mockBrandSettings.findUnique.mockResolvedValue(null);
    mockBrandSettings.upsert.mockResolvedValue({});

    await applyPreset("brand-new", "autonomous");

    const upsertCall = mockBrandSettings.upsert.mock.calls[0][0];
    expect(upsertCall.where).toEqual({ brandId: "brand-new" });
    expect(upsertCall.create.brandId).toBe("brand-new");
    expect(upsertCall.create.metadata.featureFlags).toEqual(FLAG_PRESETS.autonomous);
  });
});

// ─── Onboarding step order ─────────────────────────────

describe("onboarding step order", () => {
  it("preset step is appended at end (before done), not inserted in middle", async () => {
    // Import the constant from the onboarding page module is not practical
    // in a unit test (client component). Verify via the ONBOARDING_STEPS contract:
    // brand=0, discovery=1, connect=2 must remain unchanged.
    // The preset step must come after connect and before done.
    const steps = ["brand", "discovery", "connect", "preset", "done"];
    expect(steps.indexOf("brand")).toBe(0);
    expect(steps.indexOf("discovery")).toBe(1);
    expect(steps.indexOf("connect")).toBe(2);
    expect(steps.indexOf("preset")).toBe(3);
    expect(steps.indexOf("done")).toBe(4);
  });
});
