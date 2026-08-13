import { describe, expect, it } from "vitest";
import {
  DEFAULT_WEIGHTS,
  normalizeWeights,
} from "@/lib/creator-search/scoring/composite";
import type { ScoreWeights } from "@/lib/creator-search/scoring/composite";

describe("normalizeWeights", () => {
  it("returns weights summing to 1.0 for DEFAULT_WEIGHTS", () => {
    const normalized = normalizeWeights(DEFAULT_WEIGHTS);
    const sum = Object.values(normalized).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 10);
  });

  it("normalizes unbalanced weights to sum to 1.0", () => {
    const unbalanced: ScoreWeights = {
      topicalMatch: 0.5,
      categoryConfidence: 0.3,
      engagementQuality: 0.4,
      authenticity: 0.3,
      scaleFit: 0.2,
      identityConfidence: 0.2,
      contactability: 0.1,
    };

    const normalized = normalizeWeights(unbalanced);
    const sum = Object.values(normalized).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 10);

    // Ratios should be preserved
    expect(normalized.topicalMatch).toBeGreaterThan(normalized.contactability);
  });

  it("returns input unchanged when all weights are zero", () => {
    const allZero: ScoreWeights = {
      topicalMatch: 0,
      categoryConfidence: 0,
      engagementQuality: 0,
      authenticity: 0,
      scaleFit: 0,
      identityConfidence: 0,
      contactability: 0,
    };

    const result = normalizeWeights(allZero);
    expect(result).toEqual(allZero);
  });

  it("does not mutate the input", () => {
    const original: ScoreWeights = { ...DEFAULT_WEIGHTS };
    const originalCopy = { ...original };
    normalizeWeights(original);
    expect(original).toEqual(originalCopy);
  });

  it("handles weights after adjustment that don't sum to 1.0", () => {
    // Simulate: DEFAULT_WEIGHTS + some +0.05 adjustments
    const adjusted: ScoreWeights = {
      topicalMatch: 0.30,   // +0.05
      categoryConfidence: 0.10,
      engagementQuality: 0.25, // +0.05
      authenticity: 0.20,
      scaleFit: 0.10,
      identityConfidence: 0.10,
      contactability: 0.05,
    };

    const normalized = normalizeWeights(adjusted);
    const sum = Object.values(normalized).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 10);
  });
});
