import {
  validateInstagramCreators,
  type InstagramValidationResult,
} from "@/lib/instagram/validator";
import type {
  PlatformValidator,
  PlatformValidationOptions,
  ValidationTarget,
  ValidationResult,
} from "@/lib/validation/types";

/**
 * Map the Instagram-specific result shape into the platform-agnostic ValidationResult.
 */
function toValidationResult(
  igResult: InstagramValidationResult
): ValidationResult {
  return {
    handle: igResult.handle,
    creatorId: igResult.creatorId,
    url: igResult.url,
    status: igResult.status,
    followerCount: igResult.followerCount,
    avgViews: igResult.avgViews,
    engagementRate: null,
    isVerified: false,
    errorCode: igResult.errorCode,
    error: igResult.error,
    attemptCount: igResult.attemptCount,
    metadata: {
      checkedVideoCount: igResult.checkedVideoCount,
      blocked: igResult.blocked,
    },
  };
}

/**
 * Adapter that wraps the existing `validateInstagramCreators()` Playwright
 * validator behind the platform-agnostic `PlatformValidator` interface.
 *
 * No behavior change to Instagram validation -- pure pass-through.
 */
export class InstagramValidator implements PlatformValidator {
  readonly platform = "instagram" as const;

  async validateBatch(
    targets: readonly ValidationTarget[],
    options?: PlatformValidationOptions
  ): Promise<readonly ValidationResult[]> {
    if (targets.length === 0) {
      return [];
    }

    const igTargets = targets.map((target) => ({
      creatorId: target.creatorId,
      handle: target.handle,
      minFollowers: target.existingProfile?.followerCount
        ? undefined
        : undefined,
    }));

    const igResults = await validateInstagramCreators(igTargets, {
      concurrency: options?.concurrency ?? 1,
      includeAvgViews: options?.includeAvgViews ?? false,
      ...(options?.timeout
        ? { navigationTimeoutSecs: Math.ceil(options.timeout / 1_000) }
        : {}),
    });

    return igResults.map(toValidationResult);
  }
}
