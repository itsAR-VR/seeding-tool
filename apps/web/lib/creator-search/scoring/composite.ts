export interface ScoreWeights {
  topicalMatch: number;
  categoryConfidence: number;
  engagementQuality: number;
  authenticity: number;
  scaleFit: number;
  identityConfidence: number;
  contactability: number;
}

export const DEFAULT_WEIGHTS: ScoreWeights = {
  topicalMatch: 0.25,
  categoryConfidence: 0.1,
  engagementQuality: 0.2,
  authenticity: 0.2,
  scaleFit: 0.1,
  identityConfidence: 0.1,
  contactability: 0.05,
};

export const TRIAGE_THRESHOLDS = {
  AUTO_SHORTLIST: { minScore: 0.8, minAuthenticity: 0.7, minIdentity: 0.7 },
  REVIEW: { minScore: 0.65 },
} as const;

type ComponentScore = {
  score: number;
  signals: string[];
};

export type ScoredCandidate = {
  candidateHandle: string;
  compositeScore: number;
  triage: "auto_shortlist" | "review" | "suppress";
  components: Record<keyof ScoreWeights, ComponentScore & { weight: number }>;
};

export function computeCompositeScore(input: {
  candidateHandle: string;
  components: Record<keyof ScoreWeights, ComponentScore>;
  weights?: Partial<ScoreWeights>;
}): ScoredCandidate {
  const weights = { ...DEFAULT_WEIGHTS, ...(input.weights ?? {}) };
  const components = Object.fromEntries(
    Object.entries(input.components).map(([key, value]) => [
      key,
      { ...value, weight: weights[key as keyof ScoreWeights] },
    ])
  ) as ScoredCandidate["components"];

  const compositeScore = Math.max(
    0,
    Math.min(
      1,
      Object.entries(components).reduce(
        (sum, [key, value]) => sum + value.score * weights[key as keyof ScoreWeights],
        0
      )
    )
  );

  const triage =
    compositeScore >= TRIAGE_THRESHOLDS.AUTO_SHORTLIST.minScore &&
    components.authenticity.score >= TRIAGE_THRESHOLDS.AUTO_SHORTLIST.minAuthenticity &&
    components.identityConfidence.score >= TRIAGE_THRESHOLDS.AUTO_SHORTLIST.minIdentity
      ? "auto_shortlist"
      : compositeScore >= TRIAGE_THRESHOLDS.REVIEW.minScore
        ? "review"
        : "suppress";

  return {
    candidateHandle: input.candidateHandle,
    compositeScore,
    triage,
    components,
  };
}
