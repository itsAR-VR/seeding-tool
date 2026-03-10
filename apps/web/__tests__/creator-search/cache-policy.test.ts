import { describe, expect, it } from "vitest";
import {
  shouldBypassDiscoveryValidation,
  shouldUseStoredCreatorAsCached,
} from "@/lib/creator-search/cache-policy";

describe("creator-search cache policy", () => {
  it("does not trust stored collabstr metadata when the creator was previously invalid", () => {
    const isCached = shouldUseStoredCreatorAsCached({
      validationStatus: "invalid",
      lastValidatedAt: new Date(),
      primarySource: "collabstr",
      followerCount: 12_000,
      bio: "Sleep creator",
      profileUrl: "https://instagram.com/sleepy",
      imageUrl: null,
    });

    expect(isCached).toBe(false);
  });

  it("forces revalidation when a cached candidate has an invalid prior status", () => {
    expect(
      shouldBypassDiscoveryValidation({
        isCached: true,
        existingValidationStatus: "invalid",
      })
    ).toBe(false);
  });
});
