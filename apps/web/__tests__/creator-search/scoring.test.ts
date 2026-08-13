import { describe, expect, it } from "vitest";
import { computeCompositeScore } from "@/lib/creator-search/scoring/composite";

describe("decision engine composite scoring", () => {
  it("produces auto shortlist when high-confidence components clear thresholds", () => {
    const scored = computeCompositeScore({
      candidateHandle: "janedoe",
      components: {
        topicalMatch: { score: 0.9, signals: ["beauty"] },
        categoryConfidence: { score: 0.85, signals: ["skincare"] },
        engagementQuality: { score: 0.82, signals: ["engagement:0.05"] },
        authenticity: { score: 0.88, signals: ["validation:valid"] },
        scaleFit: { score: 0.76, signals: ["followers:12000"] },
        identityConfidence: { score: 0.81, signals: ["platforms:2"] },
        contactability: { score: 0.7, signals: ["email:0.55"] },
      },
    });

    expect(scored.compositeScore).toBeGreaterThan(0.8);
    expect(scored.triage).toBe("auto_shortlist");
  });

  it("suppresses weak candidates", () => {
    const scored = computeCompositeScore({
      candidateHandle: "weakcreator",
      components: {
        topicalMatch: { score: 0.2, signals: [] },
        categoryConfidence: { score: 0.2, signals: [] },
        engagementQuality: { score: 0.2, signals: [] },
        authenticity: { score: 0.15, signals: [] },
        scaleFit: { score: 0.25, signals: [] },
        identityConfidence: { score: 0.1, signals: [] },
        contactability: { score: 0.1, signals: [] },
      },
    });

    expect(scored.triage).toBe("suppress");
  });
});
