export type SourceConfidenceTier =
  | "official"
  | "validated"
  | "marketplace"
  | "scraped"
  | "inferred";

export type SourceConfidence = {
  tier: SourceConfidenceTier;
  weight: number;
};

const SOURCE_CONFIDENCE: Record<string, SourceConfidence> = {
  youtube_api: { tier: "official", weight: 1.0 },
  tiktok_display_api: { tier: "official", weight: 1.0 },
  instagram_validated: { tier: "validated", weight: 0.85 },
  collabstr: { tier: "marketplace", weight: 0.65 },
  creator_marketplace: { tier: "marketplace", weight: 0.65 },
  apify_search: { tier: "scraped", weight: 0.5 },
  apify_keyword_email: { tier: "scraped", weight: 0.4 },
  approved_seed_following: { tier: "inferred", weight: 0.45 },
  seed_following: { tier: "inferred", weight: 0.35 },
  instagram_html: { tier: "validated", weight: 0.85 },
  manual: { tier: "validated", weight: 0.8 },
  csv_import: { tier: "marketplace", weight: 0.55 },
};

const TIER_RANK: Record<SourceConfidenceTier, number> = {
  official: 5,
  validated: 4,
  marketplace: 3,
  scraped: 2,
  inferred: 1,
};

export function getSourceConfidence(source: string | null | undefined): SourceConfidence {
  if (!source) {
    return { tier: "inferred", weight: 0.3 };
  }

  return SOURCE_CONFIDENCE[source] ?? { tier: "inferred", weight: 0.3 };
}

export function computeCompositeSourceConfidence(sources: string[]) {
  if (sources.length === 0) {
    return 0;
  }

  const weights = sources.map((source) => getSourceConfidence(source).weight);
  const maxWeight = Math.max(...weights);
  const corroborationBonus = Math.min(0.15, Math.max(0, sources.length - 1) * 0.05);
  return Math.min(1, maxWeight + corroborationBonus);
}

export function compareSourceConfidence(
  currentSource: string | null | undefined,
  incomingSource: string | null | undefined
) {
  const current = getSourceConfidence(currentSource);
  const incoming = getSourceConfidence(incomingSource);

  if (incoming.weight !== current.weight) {
    return incoming.weight - current.weight;
  }

  return TIER_RANK[incoming.tier] - TIER_RANK[current.tier];
}
