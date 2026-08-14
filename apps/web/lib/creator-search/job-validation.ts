import {
  shouldBypassDiscoveryValidation,
} from "@/lib/creator-search/cache-policy";
import {
  normalizeUnifiedDiscoveryQuery,
  type UnifiedDiscoveryQuery,
} from "@/lib/creator-search/contracts";
import {
  validateInstagramCreators,
  type InstagramValidationResult,
} from "@/lib/instagram/validator";
import { getValidator } from "@/lib/validation/registry";
import type { ValidationResult } from "@/lib/validation/types";
import type { Prisma } from "@prisma/client";
import type { orchestrateUnifiedDiscovery } from "@/lib/creator-search/orchestrator";

export type DiscoveryCandidate = Awaited<
  ReturnType<typeof orchestrateUnifiedDiscovery>
>[number];

export type ValidatedDiscoveryCandidate = DiscoveryCandidate & {
  validationStatus: "valid" | "unknown" | "retry" | "invalid";
  validationError: string | null;
  validationErrorCode: string | null;
  validationAttempts: number;
  validatedFollowerCount: number | null;
  validatedAvgViews: number | null;
  validatedProfileUrl: string | null;
};

export function parseJobQuery(
  value: Prisma.JsonValue | unknown
): UnifiedDiscoveryQuery {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return normalizeUnifiedDiscoveryQuery(
      value as Partial<UnifiedDiscoveryQuery>
    );
  }

  return normalizeUnifiedDiscoveryQuery({});
}

function toValidatedCandidate(
  candidate: DiscoveryCandidate,
  validation: InstagramValidationResult | ValidationResult
): ValidatedDiscoveryCandidate {
  return {
    ...candidate,
    validationStatus: validation.status,
    validationError: validation.error,
    validationErrorCode: validation.errorCode,
    validationAttempts: validation.attemptCount,
    validatedFollowerCount: validation.followerCount,
    validatedAvgViews: validation.avgViews,
    validatedProfileUrl: validation.url || candidate.profileUrl,
  };
}

export async function validateDiscoveryCandidates(
  candidates: DiscoveryCandidate[],
  query: UnifiedDiscoveryQuery
) {
  const prevalidated = candidates
    .filter((candidate) =>
      shouldBypassDiscoveryValidation({
        isCached: candidate.isCached,
        existingValidationStatus: candidate.existingValidationStatus,
      })
    )
    .map<ValidatedDiscoveryCandidate>((candidate) => ({
      ...candidate,
      validationStatus:
        candidate.existingValidationStatus === "unknown"
          ? "unknown"
          : "valid",
      validationError: null,
      validationErrorCode: null,
      validationAttempts: 0,
      validatedFollowerCount: candidate.followerCount,
      validatedAvgViews: candidate.avgViews,
      validatedProfileUrl: candidate.profileUrl,
    }));

  const targets = candidates
    .filter(
      (candidate) =>
        !shouldBypassDiscoveryValidation({
          isCached: candidate.isCached,
          existingValidationStatus: candidate.existingValidationStatus,
        })
    )
    .map((candidate) => ({
      creatorId: candidate.creatorId ?? candidate.handle,
      handle: candidate.handle,
      minFollowers: query.filters.minFollowers ?? null,
      maxFollowers: query.filters.maxFollowers ?? null,
    }));

  // Dispatch through the platform registry: TikTok targets go to the
  // registered TikTokValidator (Apify TikTok profile scraper), Instagram
  // keeps its tuned validator. Registry results use the platform-agnostic
  // ValidationResult shape; adapt Instagram's result into it so the
  // downstream mapping is uniform.
  const platform = query.platform ?? "instagram";

  let validationByHandle: Map<string, ValidationResult>;
  if (platform === "tiktok") {
    const validator = getValidator("tiktok");
    const results =
      validator && targets.length > 0
        ? await validator.validateBatch(
            targets.map((t) => ({ handle: t.handle, creatorId: t.creatorId }))
          )
        : [];
    validationByHandle = new Map(
      results.map((result) => [result.handle.toLowerCase(), { ...result }])
    );
  } else {
    const validationResults =
      targets.length > 0
        ? await validateInstagramCreators(targets, {
            concurrency: 1,
            includeAvgViews: false,
            navigationTimeoutSecs: 15,
            requestHandlerTimeoutSecs: 20,
            delayRangeMs: [200, 600],
            blockPauseMs: 1_000,
            maxPauseCycles: 0,
          })
        : [];
    validationByHandle = new Map(
      validationResults.map((result) => [
        result.handle.toLowerCase(),
        {
          handle: result.handle,
          creatorId: result.creatorId ?? null,
          url: result.url || null,
          status: result.status,
          followerCount: result.followerCount,
          avgViews: result.avgViews,
          engagementRate: null,
          isVerified: false,
          errorCode: result.errorCode,
          error: result.error,
          attemptCount: result.attemptCount,
          metadata: {},
        } satisfies ValidationResult,
      ])
    );
  }

  const newlyValidated = candidates
    .filter(
      (candidate) =>
        !shouldBypassDiscoveryValidation({
          isCached: candidate.isCached,
          existingValidationStatus: candidate.existingValidationStatus,
        })
    )
    .map<ValidatedDiscoveryCandidate>((candidate) => {
      const validation =
        validationByHandle.get(candidate.handle.toLowerCase()) ??
        (platform === "tiktok"
          ? ({
              creatorId: candidate.creatorId ?? null,
              handle: candidate.handle,
              url:
                candidate.profileUrl ??
                `https://tiktok.com/@${candidate.handle}`,
              followerCount: candidate.followerCount,
              avgViews: candidate.avgViews,
              engagementRate: null,
              isVerified: false,
              status: "unknown",
              errorCode: null,
              error: null,
              attemptCount: 0,
              metadata: {},
            } satisfies ValidationResult)
          : ({
              creatorId: candidate.creatorId ?? null,
              handle: candidate.handle,
              url:
                candidate.profileUrl ??
                `https://instagram.com/${candidate.handle}`,
              followerCount: null,
              avgViews: null,
              engagementRate: null,
              isVerified: false,
              status: "retry",
              errorCode: "navigation_failed",
              error: "navigation_failed",
              attemptCount: 1,
              metadata: {},
            } satisfies ValidationResult));

      return toValidatedCandidate(candidate, validation);
    });

  const validatedCandidates = [...prevalidated, ...newlyValidated];

  return {
    valid: validatedCandidates.filter(
      (candidate) => candidate.validationStatus === "valid"
    ),
    unknown: validatedCandidates.filter(
      (candidate) =>
        candidate.validationStatus === "unknown" ||
        candidate.validationStatus === "retry"
    ),
    invalid: validatedCandidates.filter(
      (candidate) => candidate.validationStatus === "invalid"
    ),
  };
}
