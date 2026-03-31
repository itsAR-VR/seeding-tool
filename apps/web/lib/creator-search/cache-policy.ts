import type { UnifiedDiscoverySource } from "@/lib/creator-search/contracts";
import { isCreatorValidationFresh } from "@/lib/creators/validation-policy";

type StoredCreatorCacheInput = {
  validationStatus: string | null | undefined;
  lastValidatedAt: Date | null | undefined;
  primarySource: UnifiedDiscoverySource;
  followerCount: number | null | undefined;
  bio: string | null | undefined;
  profileUrl: string | null | undefined;
  imageUrl: string | null | undefined;
};

type ValidationBypassInput = {
  isCached: boolean;
  existingValidationStatus: string | null | undefined;
};

export function shouldUseStoredCreatorAsCached(
  input: StoredCreatorCacheInput
) {
  const hasStoredMetadata = Boolean(
    input.followerCount || input.bio || input.profileUrl || input.imageUrl
  );
  const isFresh = isCreatorValidationFresh(input.lastValidatedAt ?? null);

  return (
    ((input.validationStatus === "valid" || input.validationStatus === "unknown") &&
      isFresh) ||
    (input.primarySource === "collabstr" &&
      input.validationStatus !== "invalid" &&
      hasStoredMetadata)
  );
}

export function shouldBypassDiscoveryValidation(
  input: ValidationBypassInput
) {
  return (
    input.isCached &&
    input.existingValidationStatus !== "invalid" &&
    input.existingValidationStatus !== "retry"
  );
}

export function shouldRetryValidation(input: {
  validationStatus: string | null | undefined;
  validationAttempts: number | null | undefined;
  lastValidatedAt: Date | null | undefined;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  if (input.validationStatus !== "retry") {
    return false;
  }
  if ((input.validationAttempts ?? 0) >= 3) {
    return false;
  }
  if (!input.lastValidatedAt) {
    return true;
  }
  return now.getTime() - input.lastValidatedAt.getTime() >= 60 * 60 * 1000;
}
