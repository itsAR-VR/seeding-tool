export type PortfolioCandidateLike = {
  followerCount: number | null;
  canonicalCategory?: string | null;
  region?: string | null;
  languageDetected?: string | null;
  contactabilityBand?: string | null;
  authenticityBand?: string | null;
};

export interface PortfolioDimension<T extends PortfolioCandidateLike = PortfolioCandidateLike> {
  name: string;
  extractor: (candidate: T) => string;
  targetDistribution?: Record<string, number>;
  diversityWeight: number;
}

export function classifyTier(followers: number | null) {
  if (!followers) return "unknown";
  if (followers < 10_000) return "nano";
  if (followers < 50_000) return "micro";
  if (followers < 500_000) return "mid";
  return "macro";
}

export const DEFAULT_DIMENSIONS: PortfolioDimension[] = [
  {
    name: "tier",
    extractor: (candidate) => classifyTier(candidate.followerCount),
    targetDistribution: { nano: 0.35, micro: 0.4, mid: 0.2, macro: 0.05 },
    diversityWeight: 0.25,
  },
  {
    name: "category",
    extractor: (candidate) => candidate.canonicalCategory ?? "Other",
    diversityWeight: 0.2,
  },
  {
    name: "region",
    extractor: (candidate) => candidate.region ?? "unknown",
    diversityWeight: 0.1,
  },
  {
    name: "language",
    extractor: (candidate) => candidate.languageDetected ?? "en",
    diversityWeight: 0.1,
  },
  {
    name: "contactability",
    extractor: (candidate) => candidate.contactabilityBand ?? "weak",
    targetDistribution: { strong: 0.6, moderate: 0.3, weak: 0.1 },
    diversityWeight: 0.15,
  },
  {
    name: "risk",
    extractor: (candidate) => candidate.authenticityBand ?? "unknown",
    targetDistribution: {
      high_trust: 0.5,
      moderate: 0.35,
      low_trust: 0.05,
      unknown: 0.1,
    },
    diversityWeight: 0.2,
  },
];
