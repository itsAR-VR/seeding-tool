import { describe, expect, it } from "vitest";
import { optimizePortfolio } from "@/lib/seeding/portfolio-optimizer";

describe("portfolio optimizer", () => {
  it("does not simply return the highest scores when diversity changes the selection", () => {
    const candidates = [
      {
        id: "a",
        compositeScore: 0.95,
        triage: "auto_shortlist",
        followerCount: 8_000,
        canonicalCategory: "Beauty",
        region: "US",
        languageDetected: "en",
        contactabilityBand: "strong",
        authenticityBand: "high_trust",
        influencerIdentityId: "id-a",
      },
      {
        id: "b",
        compositeScore: 0.94,
        triage: "auto_shortlist",
        followerCount: 9_000,
        canonicalCategory: "Beauty",
        region: "US",
        languageDetected: "en",
        contactabilityBand: "strong",
        authenticityBand: "high_trust",
        influencerIdentityId: "id-b",
      },
      {
        id: "c",
        compositeScore: 0.82,
        triage: "review",
        followerCount: 120_000,
        canonicalCategory: "Fitness & Workout",
        region: "CA",
        languageDetected: "fr",
        contactabilityBand: "moderate",
        authenticityBand: "moderate",
        influencerIdentityId: "id-c",
      },
    ];

    const result = optimizePortfolio(candidates, {
      targetSize: 2,
    });

    expect(result.selected).toHaveLength(2);
    expect(result.selected.some((candidate) => candidate.id === "c")).toBe(true);
  });
});
