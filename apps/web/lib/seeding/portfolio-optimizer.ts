import {
  DEFAULT_DIMENSIONS,
  type PortfolioCandidateLike,
  type PortfolioDimension,
} from "@/lib/seeding/portfolio-dimensions";

export interface PortfolioConfig<T extends PortfolioCandidateLike = PortfolioCandidateLike> {
  targetSize: number;
  dimensions?: PortfolioDimension<T>[];
  qualityWeight?: number;
  diversityWeight?: number;
  deduplicateByIdentity?: boolean;
}

export interface DiversityMetrics {
  perDimension: Record<
    string,
    {
      distribution: Record<string, number>;
      targetDeviation: number;
      entropy: number;
    }
  >;
  overallDiversity: number;
}

export interface QualityMetrics {
  meanScore: number;
  medianScore: number;
  minScore: number;
  maxScore: number;
  triageBreakdown: Record<string, number>;
}

export interface PortfolioResult<T> {
  selected: T[];
  diversityMetrics: DiversityMetrics;
  qualityMetrics: QualityMetrics;
  explanation: string;
}

type CandidateWithScore = PortfolioCandidateLike & {
  compositeScore: number;
  triage: string;
  influencerIdentityId?: string | null;
};

function distributionForDimension<T extends PortfolioCandidateLike>(
  candidates: T[],
  dimension: PortfolioDimension<T>
) {
  const counts: Record<string, number> = {};
  for (const candidate of candidates) {
    const bucket = dimension.extractor(candidate);
    counts[bucket] = (counts[bucket] ?? 0) + 1;
  }
  const total = Math.max(1, candidates.length);
  return Object.fromEntries(
    Object.entries(counts).map(([bucket, count]) => [bucket, count / total])
  );
}

function entropy(distribution: Record<string, number>) {
  return Object.values(distribution).reduce((sum, value) => {
    if (value <= 0) return sum;
    return sum - value * Math.log2(value);
  }, 0);
}

function targetDeviation(
  distribution: Record<string, number>,
  target: Record<string, number> | undefined
) {
  if (!target) return 0;
  const keys = new Set([...Object.keys(distribution), ...Object.keys(target)]);
  let deviation = 0;
  for (const key of keys) {
    deviation += Math.abs((distribution[key] ?? 0) - (target[key] ?? 0));
  }
  return deviation / Math.max(1, keys.size);
}

function marginalDiversityGain<T extends PortfolioCandidateLike>(
  candidate: T,
  currentPortfolio: T[],
  dimensions: PortfolioDimension<T>[]
) {
  if (currentPortfolio.length === 0) {
    return 1;
  }

  return dimensions.reduce((sum, dimension) => {
    const currentDistribution = distributionForDimension(currentPortfolio, dimension);
    const nextDistribution = distributionForDimension(
      [...currentPortfolio, candidate],
      dimension
    );
    const currentEntropy = entropy(currentDistribution);
    const nextEntropy = entropy(nextDistribution);
    const currentDeviation = targetDeviation(
      currentDistribution,
      dimension.targetDistribution
    );
    const nextDeviation = targetDeviation(
      nextDistribution,
      dimension.targetDistribution
    );
    const gain = (nextEntropy - currentEntropy) + (currentDeviation - nextDeviation);
    return sum + gain * dimension.diversityWeight;
  }, 0);
}

function deduplicateByIdentity<T extends CandidateWithScore>(candidates: T[]) {
  const seen = new Map<string, T>();
  for (const candidate of candidates) {
    const key = candidate.influencerIdentityId ?? `${candidate.compositeScore}:${candidate.followerCount}`;
    const existing = seen.get(key);
    if (!existing || candidate.compositeScore > existing.compositeScore) {
      seen.set(key, candidate);
    }
  }
  return [...seen.values()];
}

function buildMetrics<T extends CandidateWithScore>(
  selected: T[],
  dimensions: PortfolioDimension<T>[]
): Pick<PortfolioResult<T>, "diversityMetrics" | "qualityMetrics"> {
  const perDimension = Object.fromEntries(
    dimensions.map((dimension) => {
      const distribution = distributionForDimension(selected, dimension);
      return [
        dimension.name,
        {
          distribution,
          targetDeviation: targetDeviation(distribution, dimension.targetDistribution),
          entropy: entropy(distribution),
        },
      ];
    })
  );
  const scores = selected.map((candidate) => candidate.compositeScore);
  const sortedScores = [...scores].sort((a, b) => a - b);
  const triageBreakdown = selected.reduce<Record<string, number>>((acc, candidate) => {
    acc[candidate.triage] = (acc[candidate.triage] ?? 0) + 1;
    return acc;
  }, {});

  return {
    diversityMetrics: {
      perDimension,
      overallDiversity:
        Object.values(perDimension).reduce((sum, metric) => sum + metric.entropy, 0) /
        Math.max(1, dimensions.length),
    },
    qualityMetrics: {
      meanScore: scores.reduce((sum, value) => sum + value, 0) / Math.max(1, scores.length),
      medianScore:
        sortedScores.length === 0
          ? 0
          : sortedScores[Math.floor(sortedScores.length / 2)],
      minScore: sortedScores[0] ?? 0,
      maxScore: sortedScores[sortedScores.length - 1] ?? 0,
      triageBreakdown,
    },
  };
}

export function optimizePortfolio<T extends CandidateWithScore>(
  candidates: T[],
  config: PortfolioConfig<T>
): PortfolioResult<T> {
  const dimensions = (config.dimensions ?? DEFAULT_DIMENSIONS) as PortfolioDimension<T>[];
  const qualityWeight = config.qualityWeight ?? 0.6;
  const diversityWeight = config.diversityWeight ?? 0.4;
  const baseCandidates = config.deduplicateByIdentity === false ? candidates : deduplicateByIdentity(candidates);
  const remaining = [...baseCandidates]
    .filter((candidate) => candidate.triage !== "suppress")
    .sort((left, right) => right.compositeScore - left.compositeScore);
  const selected: T[] = [];

  while (selected.length < config.targetSize && remaining.length > 0) {
    const scored = remaining.map((candidate) => ({
      candidate,
      value:
        qualityWeight * candidate.compositeScore +
        diversityWeight * marginalDiversityGain(candidate, selected, dimensions),
    }));
    scored.sort((left, right) => right.value - left.value);
    const next = scored[0]?.candidate;
    if (!next) break;
    selected.push(next);
    const index = remaining.findIndex((candidate) => candidate === next);
    if (index >= 0) {
      remaining.splice(index, 1);
    }
  }

  const metrics = buildMetrics(selected, dimensions);
  return {
    selected,
    ...metrics,
    explanation: `Selected ${selected.length} creators with diversity-aware weighting.`,
  };
}
