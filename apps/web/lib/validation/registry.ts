import type { UnifiedDiscoveryPlatform } from "@/lib/creator-search/contracts";
import type { PlatformValidator } from "@/lib/validation/types";
import { InstagramValidator } from "@/lib/validation/instagram-validator";
import { TikTokValidator } from "@/lib/validation/tiktok-validator";

/**
 * Immutable registry of platform validators.
 * Pre-populated with Instagram and TikTok validators.
 * Future platforms can be added via `registerValidator()`.
 */
const validators = new Map<string, PlatformValidator>([
  ["instagram", new InstagramValidator()],
  ["tiktok", new TikTokValidator()],
]);

/**
 * Retrieve the validator for a given platform.
 * Returns undefined if no validator is registered for that platform.
 */
export function getValidator(
  platform: UnifiedDiscoveryPlatform
): PlatformValidator | undefined {
  return validators.get(platform);
}

/**
 * Register a new platform validator (or replace an existing one).
 * Creates a new Map internally to avoid mutating the existing reference.
 */
export function registerValidator(validator: PlatformValidator): void {
  validators.set(validator.platform, validator);
}

/**
 * List all registered platform names.
 */
export function getRegisteredPlatforms(): readonly string[] {
  return Array.from(validators.keys());
}
