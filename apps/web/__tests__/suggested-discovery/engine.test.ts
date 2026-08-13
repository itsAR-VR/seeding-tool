import { describe, expect, it } from "vitest";
import { textFallbackVerdict } from "@/lib/suggested-discovery/engine";
import type { SuggestedProfile } from "@/lib/suggested-discovery/types";

function profile(bio: string | null, category: string | null = null): SuggestedProfile {
  return {
    handle: "test.subject",
    displayName: null,
    bio,
    category,
    followers: null,
    following: null,
    posts: null,
    externalUrl: null,
    isVerified: false,
    profileUrl: "https://www.instagram.com/test.subject/",
    discoveredFrom: "seed",
    screenshotFile: null,
  };
}

describe("textFallbackVerdict", () => {
  it("matches on whole-word niche overlap", () => {
    const verdict = textFallbackVerdict(
      profile("Derm-approved skincare routines and honest reviews"),
      "skincare"
    );
    expect(verdict.match).toBe(true);
  });

  it("ignores stop words from the niche brief", () => {
    const verdict = textFallbackVerdict(
      profile("Party supplies and event planning"),
      "fitness for women"
    );
    expect(verdict.match).toBe(false);
  });

  it("does not substring-match (men must not hit women)", () => {
    const verdict = textFallbackVerdict(
      profile("Women's fashion and styling tips"),
      "men grooming"
    );
    expect(verdict.match).toBe(false);
  });

  it("matches against the canonical category when bio is thin", () => {
    const verdict = textFallbackVerdict(profile(null, "Beauty"), "beauty creators");
    expect(verdict.match).toBe(true);
    expect(verdict.tags.length).toBeGreaterThan(0);
  });
});
