import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";

/**
 * Per-brand feature flag system — disable subsystems for brand X without a deploy.
 * Flags stored in BrandSettings.metadata JSON field.
 *
 * All flags fail-CLOSED: if flag read fails, default to disabled (false), not enabled.
 */

export interface FeatureFlags {
  aiReplyEnabled: boolean;
  unipileDmEnabled: boolean;
  shopifyOrderEnabled: boolean;
  reminderEmailEnabled: boolean;
}

const DEFAULT_FLAGS: FeatureFlags = {
  aiReplyEnabled: false,
  unipileDmEnabled: false,
  shopifyOrderEnabled: false,
  reminderEmailEnabled: false,
};

/**
 * Read feature flags for a brand.
 * Fail-CLOSED: returns all-false defaults if read fails.
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
    const flags = (meta.featureFlags ?? {}) as Record<string, unknown>;

    return {
      aiReplyEnabled: flags.aiReplyEnabled === true,
      unipileDmEnabled: flags.unipileDmEnabled === true,
      shopifyOrderEnabled: flags.shopifyOrderEnabled === true,
      reminderEmailEnabled: flags.reminderEmailEnabled === true,
    };
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
  const validFlags: Array<keyof FeatureFlags> = [
    "aiReplyEnabled",
    "unipileDmEnabled",
    "shopifyOrderEnabled",
    "reminderEmailEnabled",
  ];

  if (!validFlags.includes(flag)) {
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
