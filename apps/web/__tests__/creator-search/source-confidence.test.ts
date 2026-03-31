import { describe, expect, it } from "vitest";
import {
  compareSourceConfidence,
  computeCompositeSourceConfidence,
  getSourceConfidence,
} from "@/lib/creator-search/source-confidence";

describe("source confidence", () => {
  it("returns configured tiers and weights", () => {
    expect(getSourceConfidence("collabstr")).toMatchObject({
      tier: "marketplace",
      weight: 0.65,
    });
  });

  it("boosts corroborated multi-source candidates", () => {
    expect(
      computeCompositeSourceConfidence(["apify_search", "collabstr"])
    ).toBeGreaterThan(getSourceConfidence("collabstr").weight);
  });

  it("prefers validated data over scraped data", () => {
    expect(compareSourceConfidence("apify_search", "instagram_validated")).toBeGreaterThan(0);
  });
});
