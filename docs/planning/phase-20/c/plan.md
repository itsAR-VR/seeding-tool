# Phase 20c — Evidence-Rich Scoring Engine: Two-Stage Ranking with Score Decomposition

## Focus

Replace the shallow relevance scoring (keyword + category + source agreement + field completeness) with a two-stage scoring engine. Stage 1 is the existing orchestrator — it optimizes recall. Stage 2 is a new scorer that evaluates every candidate on 7 dimensions: topical match, category confidence, engagement quality, authenticity, scale fit, identity confidence, and contactability. Every score is decomposable into its components so the UI can show "why this creator was ranked here."

This is where the system stops being a search engine and starts being a recommendation engine.

## Inputs

- Phase 20a: source confidence tiers, 4-state validation
- Phase 20b: InfluencerIdentity + IdentityEdge match scores, ContactPoint confidence scores
- Current scoring: `orchestrator.ts` line ~600+ `computeRelevanceScore()` — keyword (10pts) + category (8pts) + source agreement (4pts) + completeness bonus
- Current classification: `classification.ts` — 6 categories via keyword rules
- CreatorSearchResult.fitScore and fitReasoning fields (exist but populated with basic data)
- User directive: "The best seed list is not just top 25 by score. Stage 2 should score candidates on topical match, scale fit, engagement quality, authenticity, identity confidence, and contactability."

## Skills Available for This Subphase

- `backend-coding-agent` — Scoring engine implementation
- `superpowers:test-driven-development` — TDD for scoring functions
- `context7-docs` — Zod schema validation for score contracts

## Work

### 1. Upgrade Classification from Keywords to Brief-Aware Matching

**Modify `lib/creator-search/classification.ts`:**

Current system: 6 categories × keyword lists → confidence. This misses multilingual bios, niche verticals, and content-visible fit.

New approach — layered classification:

```typescript
export interface EnhancedClassification {
  canonicalCategory: CanonicalDiscoveryCategory;
  rawSourceCategory: string | null;
  confidence: "high" | "medium" | "low";
  matchedKeywords: string[];
  // NEW fields:
  expandedCategories: string[];       // sub-categories (e.g., "Skincare Routine", "Korean Beauty")
  languageDetected: string | null;    // ISO 639-1 code
  topicSignals: TopicSignal[];        // extracted from bio + captions
}

export interface TopicSignal {
  topic: string;      // normalized topic term
  source: "bio" | "caption" | "hashtag" | "category";
  strength: number;   // 0-1
}
```

**Improvements:**
a. **Expand keyword rules** — add 30-50 more keywords per category including common misspellings, abbreviations, and multilingual equivalents (Spanish, Portuguese, French, Korean for beauty)
b. **Brief-aware matching** — when a campaign brief exists, extract key terms and compute text overlap with creator bio/captions (TF-IDF cosine similarity, no ML dependency)
c. **Sub-category extraction** — "Beauty" is too coarse. Extract sub-topics like "Skincare Routine", "Hair Tutorial", "Nail Art" from bio text
d. **Language detection** — simple trigram-based detection (no external dependency) to flag multilingual creators

### 2. Score Feature Computation

**New file: `lib/creator-search/scoring/features.ts`**

Each feature is a pure function returning a normalized 0-1 score:

```typescript
// ── Topical Match (T) ───────────────────────────────
export function computeTopicalMatch(input: {
  creatorBio: string | null;
  creatorCategories: string[];
  campaignKeywords: string[];
  campaignCategories: string[];
  briefText?: string | null;
}): { score: number; signals: string[] };

// ── Category Confidence (C) ─────────────────────────
export function computeCategoryConfidence(input: {
  classification: EnhancedClassification;
  campaignCategories: string[];
}): { score: number; signals: string[] };

// ── Engagement Quality (E) ──────────────────────────
export function computeEngagementQuality(input: {
  followerCount: number | null;
  avgViews: number | null;
  engagementRate: number | null;
  // Phase 20d will add: recentEngagementTrend, viewToFollowerRatio
}): { score: number; signals: string[] };

// ── Authenticity (A) ────────────────────────────────
// Placeholder until Phase 20d adds time-series data
export function computeAuthenticity(input: {
  validationStatus: string;
  sourceConfidence: number;
  isVerified: boolean;
  followerCount: number | null;
  followingCount?: number | null;
  // Phase 20d will add: growthAnomalyScore, botRiskScore
}): { score: number; signals: string[] };

// ── Scale Fit (S) ───────────────────────────────────
export function computeScaleFit(input: {
  followerCount: number | null;
  avgViews: number | null;
  minFollowers?: number | null;
  maxFollowers?: number | null;
  minAvgViews?: number | null;
}): { score: number; signals: string[] };

// ── Identity Confidence (I) ─────────────────────────
export function computeIdentityConfidence(input: {
  identityEdgeCount: number;
  bestEdgeScore: number | null;
  crossPlatformProfileCount: number;
  sourceCount: number;
  sourceConfidence: number;
}): { score: number; signals: string[] };

// ── Contactability (K) ──────────────────────────────
export function computeContactability(input: {
  contactPoints: Array<{ type: string; confidence: number; isStale: boolean }>;
  hasPublicEmail: boolean;
  // Phase 20f will add: historicalResponseRate, lastOutreachResult
}): { score: number; signals: string[] };
```

### 3. Composite Score Formula

**New file: `lib/creator-search/scoring/composite.ts`**

```typescript
export interface ScoreWeights {
  topicalMatch: number;        // T — default 0.25
  categoryConfidence: number;  // C — default 0.10
  engagementQuality: number;   // E — default 0.20
  authenticity: number;        // A — default 0.20
  scaleFit: number;            // S — default 0.10
  identityConfidence: number;  // I — default 0.10
  contactability: number;      // K — default 0.05
}

export const DEFAULT_WEIGHTS: ScoreWeights = {
  topicalMatch: 0.25,
  categoryConfidence: 0.10,
  engagementQuality: 0.20,
  authenticity: 0.20,
  scaleFit: 0.10,
  identityConfidence: 0.10,
  contactability: 0.05,
};

export interface ScoredCandidate {
  candidateHandle: string;
  compositeScore: number;       // 0-1
  triage: "auto_shortlist" | "review" | "suppress";
  components: {
    topicalMatch: { score: number; weight: number; signals: string[] };
    categoryConfidence: { score: number; weight: number; signals: string[] };
    engagementQuality: { score: number; weight: number; signals: string[] };
    authenticity: { score: number; weight: number; signals: string[] };
    scaleFit: { score: number; weight: number; signals: string[] };
    identityConfidence: { score: number; weight: number; signals: string[] };
    contactability: { score: number; weight: number; signals: string[] };
  };
  fitReasoning: string;         // human-readable "why" explanation
}

export function computeCompositeScore(features: FeatureInputs, weights?: Partial<ScoreWeights>): ScoredCandidate;

// Triage thresholds (from user's specification)
export const TRIAGE_THRESHOLDS = {
  AUTO_SHORTLIST: { minScore: 0.80, minAuthenticity: 0.70, minIdentity: 0.70 },
  REVIEW: { minScore: 0.65 },
  // Below review threshold or authenticity < 0.40 → suppress
};
```

### 4. Integrate into Job Runner

**Modify `lib/creator-search/job-runner.ts`:**

After validation and identity resolution, add scoring stage:

```
Discovery → Validation → Identity Resolution → Scoring → Persistence
```

The scoring step:
1. Compute all 7 features for each validated candidate
2. Compute composite score with campaign-specific weight overrides (if any)
3. Triage into auto_shortlist / review / suppress
4. Populate `CreatorSearchResult.fitScore` with composite score
5. Populate `CreatorSearchResult.fitReasoning` with human-readable explanation
6. Store full score decomposition in a new `scoreComponents` Json field

**Schema change — CreatorSearchResult:**

```prisma
model CreatorSearchResult {
  // ... existing fields ...
  fitScore        Float?    // EXISTING — now populated with composite score
  fitReasoning    String?   // EXISTING — now populated with explanation
  scoreComponents Json?     // NEW — full decomposition { T, C, E, A, S, I, K }
  triage          String?   // NEW — "auto_shortlist" | "review" | "suppress"
  sourceConfidence Float?   // from Phase 20a
}
```

### 5. Generate Fit Reasoning

**New file: `lib/creator-search/scoring/reasoning.ts`**

```typescript
export function generateFitReasoning(scored: ScoredCandidate): string;
```

Example outputs:
- "Strong topical match (beauty + skincare keywords in bio), high engagement rate (4.2%), verified profile with 3 source corroboration. Weakness: no public email found."
- "Good category fit (Fitness & Workout) but low identity confidence — only found via one Apify search. Recommend: verify cross-platform presence."
- "Suppressed: authenticity score below threshold (0.35) — follower-to-engagement ratio anomalous, single scraped source."

### 6. Keep Existing Relevance Score as Fallback

The current `computeRelevanceScore()` in the orchestrator remains as the Stage 1 retrieval score. The new composite score is the Stage 2 ranking score. Both are persisted:

- `relevanceScore` (existing) — stage 1, used for initial ordering
- `fitScore` (existing field, new computation) — stage 2, used for final ranking and triage

### 7. Tests

- Unit tests for each of the 7 feature functions with edge cases:
  - Null follower counts, empty bios, zero engagement
  - Multilingual bio classification
  - Cross-platform identity confidence computation
  - Contact point scoring with stale emails
- Unit tests for composite score computation and triage thresholds
- Unit tests for fit reasoning generation
- Integration test: full pipeline produces decomposed scores for a mock candidate set
- Snapshot tests for reasoning output format

## Output

- `lib/creator-search/scoring/features.ts` — 7 feature computation functions
- `lib/creator-search/scoring/composite.ts` — composite score + triage
- `lib/creator-search/scoring/reasoning.ts` — human-readable explanations
- Updated `lib/creator-search/classification.ts` — enhanced classification with sub-categories, language, topic signals
- Updated `lib/creator-search/job-runner.ts` — scoring stage integration
- Prisma migration: scoreComponents + triage fields on CreatorSearchResult
- Comprehensive test suite

## Handoff

Phase 20d adds time-series metrics and authenticity signals. Once daily snapshots exist, the `computeEngagementQuality()` and `computeAuthenticity()` functions gain access to growth velocity, engagement trend, and anomaly detection features — dramatically improving the two weakest dimensions of the current score. The scoring engine is designed to accept these additional inputs without structural changes (the feature functions already have commented placeholders for Phase 20d data).
