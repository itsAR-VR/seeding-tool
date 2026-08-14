import {
  shouldBypassDiscoveryValidation,
} from "@/lib/creator-search/cache-policy";
import {
  normalizeUnifiedDiscoveryQuery,
  type UnifiedDiscoveryQuery,
} from "@/lib/creator-search/contracts";
import {
  validateInstagramCreators,
  type InstagramValidationErrorCode,
  type InstagramValidationResult,
} from "@/lib/instagram/validator";
import type { Prisma } from "@prisma/client";
import type { orchestrateUnifiedDiscovery } from "@/lib/creator-search/orchestrator";

export type DiscoveryCandidate = Awaited<
  ReturnType<typeof orchestrateUnifiedDiscovery>
>[number];

export type ValidatedDiscoveryCandidate = DiscoveryCandidate & {
  validationStatus: "valid" | "unknown" | "retry" | "invalid";
  validationError: string | null;
  validationErrorCode: InstagramValidationErrorCode | null;
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
  validation: InstagramValidationResult
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

  // Validation is Instagram-only: no TikTok validator exists, so TikTok
  // candidates are marked "unknown" instead of being checked against the
  // wrong platform (which would reject or mislabel valid candidates).
  const platform = query.platform ?? "instagram";

  const validationResults =
    targets.length > 0 && platform === "instagram"
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

  const validationByHandle = new Map(
    validationResults.map((result) => [result.handle.toLowerCase(), result])
  );

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
              creatorId: candidate.creatorId,
              handle: candidate.handle,
              url:
                candidate.profileUrl ??
                `https://tiktok.com/@${candidate.handle}`,
              followerCount: candidate.followerCount,
              avgViews: candidate.avgViews,
              checkedVideoCount: 0,
              blocked: false,
              status: "unknown",
              errorCode: null,
              error: null,
              attemptCount: 0,
            } satisfies InstagramValidationResult)
          : ({
              creatorId: candidate.creatorId,
              handle: candidate.handle,
              url:
                candidate.profileUrl ??
                `https://instagram.com/${candidate.handle}`,
              followerCount: null,
              avgViews: null,
              checkedVideoCount: 0,
              blocked: false,
              status: "retry",
              errorCode: "navigation_failed",
              error: "navigation_failed",
              attemptCount: 1,
            } satisfies InstagramValidationResult));

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
