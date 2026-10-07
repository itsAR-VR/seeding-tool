import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";

/**
 * Per-brand feature flag system — disable subsystems for brand X without a deploy.
 * Flags stored in BrandSettings.metadata JSON field.
 *
 * All flags fail-CLOSED: if flag read fails, default to disabled (false), not enabled.
 * Exception: instagramMentionPollEnabled defaults TRUE (fail-OPEN — turning it off
 * breaks mention detection entirely).
 */

export interface FeatureFlags {
  aiReplyEnabled: boolean;
  unipileDmEnabled: boolean;
  shopifyOrderEnabled: boolean;
  reminderEmailEnabled: boolean;
  identityGraphEnabled: boolean;
  identityAutoLinkEnabled: boolean;
  decisionEngineScoringEnabled: boolean;
  portfolioOptimizerEnabled: boolean;
  outcomeLearningEnabled: boolean;
  instagramMentionPollEnabled: boolean;
  /** Creator claim-form submissions create a Shopify draft order right away (never completed). */
  claimAutoDraftEnabled: boolean;
}

export const DEFAULT_FLAGS: FeatureFlags = {
  aiReplyEnabled: false,
  unipileDmEnabled: false,
  shopifyOrderEnabled: false,
  reminderEmailEnabled: false,
  identityGraphEnabled: false,
  identityAutoLinkEnabled: false,
  decisionEngineScoringEnabled: false,
  portfolioOptimizerEnabled: false,
  outcomeLearningEnabled: false,
  instagramMentionPollEnabled: true,
  claimAutoDraftEnabled: false,
};

/**
 * Single source of truth for valid flag names.
 * Derived from DEFAULT_FLAGS so it can never drift out of sync with the interface.
 */
export const VALID_FLAG_NAMES = Object.keys(DEFAULT_FLAGS) as (keyof FeatureFlags)[];

/**
 * Feature flag presets for different automation levels.
 *
 * EXCLUDED from all presets:
 * - identityAutoLinkEnabled: merges identity records permanently without review.
 *   Only available as manual toggle after brand validates identity review queue.
 * - embeddingScoringEnabled: does NOT exist in code (Phase 25c deferred).
 *
 * ALWAYS TRUE in all presets:
 * - instagramMentionPollEnabled: the only fail-OPEN flag. Turning it off breaks
 *   mention detection entirely. Defaults true in DEFAULT_FLAGS.
 *
 * DEPENDENCY: portfolioOptimizerEnabled requires decisionEngineScoringEnabled
 * (seed-list route checks both). Presets enable both or neither.
 */
export const FLAG_PRESETS = {
  manual: {
    ...DEFAULT_FLAGS,
    // All false except instagramMentionPollEnabled (true via DEFAULT_FLAGS)
  },
  assisted: {
    ...DEFAULT_FLAGS,
    decisionEngineScoringEnabled: true,
    shopifyOrderEnabled: true,
    reminderEmailEnabled: true,
    aiReplyEnabled: true,
    outcomeLearningEnabled: true,
    instagramMentionPollEnabled: true,
  },
  autonomous: {
    ...DEFAULT_FLAGS,
    decisionEngineScoringEnabled: true,
    identityGraphEnabled: true,
    // identityAutoLinkEnabled intentionally EXCLUDED — requires manual review
    portfolioOptimizerEnabled: true, // requires decisionEngineScoringEnabled (both enabled)
    shopifyOrderEnabled: true,
    reminderEmailEnabled: true,
    aiReplyEnabled: true,
    outcomeLearningEnabled: true,
    instagramMentionPollEnabled: true,
  },
} as const satisfies Record<string, FeatureFlags>;

export type FlagPreset = keyof typeof FLAG_PRESETS;

/**
 * Read feature flags for a brand.
 * Fail-CLOSED: returns all-false defaults if read fails.
 *
 * When BrandSettings exists but metadata.featureFlags is empty/undefined,
 * DEFAULT_FLAGS fill in all missing keys — ensuring instagramMentionPollEnabled
 * stays true even if no flags have been explicitly set.
 */
export async function getFeatureFlags(brandId: string): Promise<FeatureFlags> {
  try {
    const settings = await prisma.brandSettings.findUnique({
      where: { brandId },
      select: { metadata: true },
    });

    if (!settings?.metadata || typeof settings.metadata !== "object") {
      return { ...DEFAULT_FLAGS };
    }

    const meta = settings.metadata as Record<string, unknown>;
    const storedFlags = (meta.featureFlags ?? {}) as Record<string, unknown>;

    // Spread DEFAULT_FLAGS first so missing keys get their defaults.
    // Only override with stored values when they are explicitly boolean.
    const merged: Record<string, boolean> = {};
    for (const key of VALID_FLAG_NAMES) {
      merged[key] =
        typeof storedFlags[key] === "boolean"
          ? (storedFlags[key] as boolean)
          : DEFAULT_FLAGS[key];
    }

    return merged as unknown as FeatureFlags;
  } catch (error) {
    // Fail-CLOSED: if anything goes wrong, all flags are disabled
    log("error", "feature_flags.read_failed", {
      brandId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { ...DEFAULT_FLAGS };
  }
}

/**
 * Set a single feature flag for a brand.
 */
export async function setFeatureFlag(
  brandId: string,
  flag: keyof FeatureFlags,
  value: boolean
): Promise<void> {
  if (!VALID_FLAG_NAMES.includes(flag)) {
    throw new Error(`Invalid feature flag: ${flag}`);
  }

  const settings = await prisma.brandSettings.findUnique({
    where: { brandId },
    select: { metadata: true },
  });

  const currentMeta = (settings?.metadata ?? {}) as Record<string, unknown>;
  const currentFlags = ((currentMeta.featureFlags ?? {}) as Record<string, boolean>);

  const updatedFlags: Record<string, boolean> = {
    ...currentFlags,
    [flag]: value,
  };

  const updatedMeta = JSON.parse(JSON.stringify({
    ...currentMeta,
    featureFlags: updatedFlags,
  }));

  await prisma.brandSettings.update({
    where: { brandId },
    data: {
      metadata: updatedMeta,
    },
  });

  log("info", "feature_flags.updated", { brandId, flag, value });
}

/**
 * Apply a feature flag preset for a brand.
 * Atomic single-write: reads current metadata, merges preset flags, writes once.
 */
export async function applyPreset(
  brandId: string,
  preset: FlagPreset
): Promise<FeatureFlags> {
  const flags = FLAG_PRESETS[preset];

  const settings = await prisma.brandSettings.findUnique({
    where: { brandId },
    select: { metadata: true },
  });

  const currentMetadata = (settings?.metadata as Record<string, unknown>) ?? {};

  await prisma.brandSettings.upsert({
    where: { brandId },
    update: {
      metadata: {
        ...currentMetadata,
        featureFlags: { ...flags },
      },
    },
    create: {
      brandId,
      metadata: { featureFlags: { ...flags } },
    },
  });

  log("info", "feature_flags.preset_applied", { brandId, preset });

  return { ...flags };
}
