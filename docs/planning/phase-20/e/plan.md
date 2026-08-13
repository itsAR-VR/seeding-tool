# Phase 20e — Portfolio Construction & Seeding Engine

## Focus

Transform seed list generation from "top N by score" into a portfolio allocation problem. The user's diagnosis is precise: "The best seed list is not just top 25 by score. It should balance creator tier, audience cluster, geography, language, content style, contactability, shipping feasibility, and response likelihood." This subphase builds a greedy portfolio optimizer that maximizes coverage and execution yield, not just individual creator quality.

This is one of the highest-leverage seeding improvements because it changes the actual package the brand team sees.

## Inputs

- Phase 20c: composite scores with 7-dimension decomposition, triage classification
- Phase 20d: authenticity scores, growth analysis (risk dimension for portfolio)
- Phase 20b: identity graph (avoids seeding the same person twice via different handles)
- Current: CampaignCreator with reviewStatus + lifecycleStatus, campaign filters (min/max followers, categories)
- Deep research report: "Re-rank for diversity and execution yield. A simple greedy optimizer can already improve outcomes."

## Skills Available for This Subphase

- `backend-coding-agent` — Portfolio algorithm implementation
- `superpowers:test-driven-development` — TDD for optimizer
- `database-design` — Portfolio metadata schema

## Work

### 1. Define Portfolio Dimensions

**New file: `lib/seeding/portfolio-dimensions.ts`**

```typescript
export interface PortfolioDimension {
  name: string;
  extractor: (candidate: ScoredCandidate) => string;  // maps candidate to bucket
  targetDistribution?: Record<string, number>;          // optional ideal % per bucket
  diversityWeight: number;                              // 0-1, how much we penalize concentration
}

export const DEFAULT_DIMENSIONS: PortfolioDimension[] = [
  {
    name: "tier",
    extractor: (c) => classifyTier(c.followerCount),
    targetDistribution: { nano: 0.35, micro: 0.40, mid: 0.20, macro: 0.05 },
    diversityWeight: 0.25,
  },
  {
    name: "category",
    extractor: (c) => c.canonicalCategory ?? "Other",
    // No fixed target — spread across campaign-relevant categories
    diversityWeight: 0.20,
  },
  {
    name: "region",
    extractor: (c) => c.region ?? "unknown",
    diversityWeight: 0.10,
  },
  {
    name: "language",
    extractor: (c) => c.languageDetected ?? "en",
    diversityWeight: 0.10,
  },
  {
    name: "contactability",
    extractor: (c) => c.contactabilityBand, // "strong" | "moderate" | "weak"
    targetDistribution: { strong: 0.60, moderate: 0.30, weak: 0.10 },
    diversityWeight: 0.15,
  },
  {
    name: "risk",
    extractor: (c) => c.authenticityBand, // "high_trust" | "moderate" | "low_trust" | "unknown"
    targetDistribution: { high_trust: 0.50, moderate: 0.35, low_trust: 0.05, unknown: 0.10 },
    diversityWeight: 0.20,
  },
];

export function classifyTier(followers: number | null): string {
  if (!followers) return "unknown";
  if (followers < 10_000) return "nano";
  if (followers < 50_000) return "micro";
  if (followers < 500_000) return "mid";
  return "macro";
}
```

### 2. Greedy Portfolio Optimizer

**New file: `lib/seeding/portfolio-optimizer.ts`**

```typescript
export interface PortfolioConfig {
  targetSize: number;                      // how many creators to seed
  dimensions: PortfolioDimension[];
  qualityWeight: number;                   // 0-1, weight of individual score vs diversity
  diversityWeight: number;                 // 0-1, weight of portfolio diversity vs individual score
  // qualityWeight + diversityWeight should = 1
  deduplicateByIdentity: boolean;          // use InfluencerIdentity to avoid same-person duplication
}

export interface PortfolioResult {
  selected: ScoredCandidate[];
  diversityMetrics: DiversityMetrics;
  qualityMetrics: QualityMetrics;
  explanation: string;                     // human-readable portfolio summary
}

export interface DiversityMetrics {
  perDimension: Record<string, {
    distribution: Record<string, number>;  // actual % per bucket
    targetDeviation: number;               // how far from target distribution
    entropy: number;                       // Shannon entropy (higher = more diverse)
  }>;
  overallDiversity: number;                // 0-1 composite
}

export interface QualityMetrics {
  meanScore: number;
  medianScore: number;
  minScore: number;
  maxScore: number;
  triageBreakdown: Record<string, number>; // count per triage band
}
```

**Algorithm: Diversity-Aware Greedy Selection**

```typescript
export function optimizePortfolio(
  candidates: ScoredCandidate[],
  config: PortfolioConfig,
): PortfolioResult {
  // 1. Filter: remove suppressed candidates, remove duplicates by identity
  // 2. Sort by composite score (descending) as initial ordering
  // 3. Greedy selection loop:
  //    For each slot in targetSize:
  //      a. For each remaining candidate, compute:
  //         marginalValue = qualityWeight * candidate.compositeScore
  //                       + diversityWeight * marginalDiversityGain(candidate, currentPortfolio)
  //      b. Select candidate with highest marginalValue
  //      c. Add to portfolio, update diversity state
  // 4. Compute final metrics
  // 5. Generate explanation
}

function marginalDiversityGain(
  candidate: ScoredCandidate,
  currentPortfolio: ScoredCandidate[],
  dimensions: PortfolioDimension[],
): number {
  // For each dimension:
  //   - Compute current distribution of portfolio
  //   - Compute distribution if candidate is added
  //   - Measure improvement toward target distribution (if set)
  //     or increase in entropy (if no target)
  //   - Weight by dimension's diversityWeight
  // Return weighted sum of marginal diversity gains
}
```

### 3. Identity-Aware Deduplication

Before portfolio optimization, deduplicate candidates using the identity graph:

```typescript
function deduplicateByIdentity(candidates: ScoredCandidate[]): ScoredCandidate[] {
  // 1. Group candidates by InfluencerIdentity (if linked)
  // 2. For each identity group with multiple candidates:
  //    - Keep the candidate with the highest composite score
  //    - Mark others as duplicates (preserve for audit)
  // 3. For candidates without identity links:
  //    - Fall back to handle-based dedup (existing behavior)
  // 4. Return deduplicated list
}
```

### 4. Seed List API

**New route: `app/api/campaigns/[campaignId]/seed-list/route.ts`**

```typescript
// POST: Generate optimized seed list
// Request: { targetSize: number, qualityWeight?: number, diversityWeight?: number }
// Response: PortfolioResult with selected creators + metrics + explanation

// GET: Retrieve last generated seed list
// Response: Same as POST response, from cache
```

This route:
1. Fetches scored candidates for the campaign (from CreatorSearchResult)
2. Enriches with identity graph data (cross-platform profiles, identity confidence)
3. Enriches with authenticity assessments (from Phase 20d)
4. Runs portfolio optimizer
5. Returns result with full diversity/quality metrics

### 5. Portfolio Explanation

**New file: `lib/seeding/portfolio-explanation.ts`**

Generate human-readable summary of the seed list:

```typescript
export function generatePortfolioExplanation(result: PortfolioResult): string;
```

Example output:
```
Seed list of 25 creators optimized for diversity + quality:
- Tier mix: 9 nano (36%), 10 micro (40%), 5 mid (20%), 1 macro (4%)
- Categories: 8 Beauty, 7 Fitness, 5 Food & Drink, 3 Fashion, 2 Other
- Regions: 18 US, 3 UK, 2 CA, 1 AU, 1 other
- Contact quality: 15 strong (60%), 7 moderate (28%), 3 weak (12%)
- Trust level: 13 high (52%), 9 moderate (36%), 2 low (8%), 1 unknown (4%)
- Quality: mean score 0.78, median 0.80, range [0.65, 0.94]
- 3 auto-shortlisted, 20 review-band, 2 edge cases included for diversity
```

### 6. Campaign-Level Portfolio Settings

**Schema change — Campaign model:**

```prisma
model Campaign {
  // ... existing fields ...
  portfolioConfig Json?   // NEW: stored portfolio preferences
  // e.g., { targetSize: 25, qualityWeight: 0.6, diversityWeight: 0.4,
  //         tierPreferences: { nano: 0.40, micro: 0.40 } }
}
```

### 7. Tests

- Unit tests for tier classification (boundary values: 9999, 10000, 49999, 50000, etc.)
- Unit tests for marginal diversity gain computation
- Unit tests for greedy optimizer (verify it doesn't just pick top-N)
- Test: 50 candidates, all same category → optimizer spreads across tiers + regions
- Test: 50 candidates, all high score but low diversity → diversity penalty activates
- Test: identity dedup removes same-person duplicates across platforms
- Test: portfolio explanation generates readable output
- Integration test: full pipeline from search results → portfolio → API response

## Output

- `lib/seeding/portfolio-dimensions.ts` — dimension definitions + tier classification
- `lib/seeding/portfolio-optimizer.ts` — greedy diversity-aware selection
- `lib/seeding/portfolio-explanation.ts` — human-readable summaries
- `app/api/campaigns/[campaignId]/seed-list/route.ts` — portfolio API
- Prisma migration: portfolioConfig on Campaign
- Test suite

## Handoff

Phase 20f adds the feedback loop that makes portfolio optimization improve over time. Campaign outcomes (approval rate, reply rate, delivery rate) become features that calibrate the optimizer — if nano creators in Beauty consistently deliver better than micro creators in Fitness for a given brand, the optimizer should learn that preference. Phase 20f also adds the UI provenance layer that exposes score decomposition, portfolio reasoning, and confidence bands to the brand team.
