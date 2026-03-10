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

  return (
    (input.validationStatus === "valid" &&
      isCreatorValidationFresh(input.lastValidatedAt ?? null)) ||
    (input.primarySource === "collabstr" &&
      input.validationStatus !== "invalid" &&
      hasStoredMetadata)
  );
}

export function shouldBypassDiscoveryValidation(
  input: ValidationBypassInput
) {
  return input.isCached && input.existingValidationStatus !== "invalid";
}
