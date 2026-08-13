# Phase 25c — Semantic/Embedding Relevance Scoring

## Focus

Replace keyword `.includes()` relevance scoring with OpenAI embeddings for the topical match component (weight 0.25 — highest single weight). This is the highest-risk subphase — needs shadow-scoring before live cutover.

**Status: DEFERRED** — Confidence: **32%**

## Deep Sweep Corrections Applied

- [x] CRITICAL: Score distribution shift — cosine similarity (0.6-0.8) vs keyword overlap (0.1-0.4) pushes borderline candidates across TRIAGE_THRESHOLDS (AUTO_SHORTLIST: 0.8, REVIEW: 0.65). A +0.1125 composite score increase from topical match alone breaks triage.
- [x] CRITICAL: Calibration data contamination — mixing keyword-era and embedding-era `scoreComponentsAtSeed` in the same calibration report produces meaningless correlations. Need `scoringVersion` field on `CampaignOutcome`.
- [x] CRITICAL: No embedding/vector infrastructure exists anywhere in the repo (confirmed by Codex grep for `embedding|vector|pgvector|cosine`)
- [x] HIGH: JSON embedding storage in `InfluencerPlatformProfile.metadata` collides with platform stats. Real collision hotspot is `CreatorProfile.metadata` where job-runner.ts and validation-ops.ts merge data.
- [x] HIGH: AIArtifact is thread-scoped — wrong model for batch scoring logs. Need dedicated `ScoringComparison` model.
- [x] HIGH: No embedding model versioning — if OpenAI changes `text-embedding-3-small` output, cached embeddings become incomparable.
- [x] HIGH: Cost estimation missing — 75 candidates per search run, no caching strategy specified
- [x] HIGH: Feature flag should be per-brand `embeddingScoringEnabled` (not env var `EMBEDDING_SCORING_ENABLED`)
- [x] MEDIUM: Campaign brief embedding staleness — ICP summary changes when brand profile/products change, no invalidation
- [x] MEDIUM: Fallback path creates score discontinuity — partial API failure means some candidates get embedding scores and others get keyword scores in the same batch
- [x] MEDIUM: Latency budget not accounted for — 75 concurrent OpenAI calls with no timeout wrapper
- [x] LOW: `overlapScore()` asymmetry penalizes long bios — embeddings remove this asymmetry, making distribution shift bio-length-dependent
- [x] LOW: `CalibrationSnapshot.weightsBefore` always records DEFAULT_WEIGHTS, not brand's actual custom weights

## Why Deferred

1. **Insufficient calibration data**: Weekly calibration requires >= 50 mature outcomes (>= 30 days old) per brand. Phase 25b just shipped. No brand has accumulated outcomes under the new 16-category system.
2. **No shadow-scoring infrastructure**: AIArtifact is wrong model. Building a `ScoringComparison` table is prerequisite work.
3. **Score normalization not designed**: Embedding scores must be rescaled to match keyword score distributions before they can enter the composite scorer, or triage thresholds must be recalibrated.
4. **Calibration contamination has no mitigation**: Shipping embeddings before adding `scoringVersion` to `CampaignOutcome` makes the calibration system (25b) unreliable.

## Prerequisites Before Implementation

1. Run the system with 25a+25b for **60-90 days** to accumulate baseline calibration data under 16-category keyword scoring
2. Build shadow-scoring infrastructure (`ScoringComparison` model, not AIArtifact)
3. Design and implement score normalization layer (z-score normalization against running baseline)
4. Add `scoringVersion` to `CampaignOutcome` to prevent calibration contamination
5. Verify calibration shows stable correlations under keyword scoring before introducing a second scoring method

## Inputs

- `apps/web/lib/creator-search/scoring/features.ts` — `computeTopicalMatch()` uses `overlapScore()` (token intersection)
- `apps/web/lib/creator-search/scoring/composite.ts` — `DEFAULT_WEIGHTS` (topicalMatch: 0.25), `TRIAGE_THRESHOLDS`
- `apps/web/lib/creator-search/orchestrator.ts` — scoring pipeline flow
- `apps/web/lib/seeding/score-calibration.ts` — calibration data consumer
- `apps/web/lib/feature-flags.ts` — per-brand flag system (fail-closed)
- `apps/web/lib/ai/config.ts` — `AI_MODEL` (note: embeddings use different model, not AI_MODEL)
- Phase 25b calibration data for validating embedding quality vs keyword quality

## Skills Available

- `architect` — vector storage decision (pgvector vs dedicated column)
- `backend-coding-agent` — embedding pipeline
- `tdd-guide` — shadow-scoring comparison tests
- `code-review` — post-implementation

## Work (When Prerequisites Met)

### 0. Shadow-Scoring Infrastructure (Prerequisite)

**New model**: `ScoringComparison` in schema.prisma
```prisma
model ScoringComparison {
  id              String   @id @default(uuid())
  createdAt       DateTime @default(now())
  searchJobId     String
  candidateHandle String
  keywordScore    Float
  embeddingScore  Float?
  method          String   // "keyword" | "embedding" | "both"
  scoringVersion  Int      @default(1)
}
```

**Add to CampaignOutcome**: `scoringVersion Int @default(1)`

### 1. Vector Storage

**Decision**: Dedicated `bioEmbedding Bytes?` column on `InfluencerPlatformProfile` with `embeddingModel String?` and `embeddingVersion Int?`. NOT JSON metadata (collision risk confirmed by Codex). NOT pgvector (overkill at current scale — hundreds of creators, not millions).

### 2. Embedding Pipeline

- Embed creator bios on discovery/enrichment using `text-embedding-3-small` (1536 dimensions)
- **Batch embedding calls** — OpenAI accepts arrays of up to 2048 texts. Send one batch call for all bios in a search run (~75 candidates) instead of 75 individual calls.
- Cache embedding in `InfluencerPlatformProfile.bioEmbedding` with `embeddingModel` and `embeddingVersion`
- Embed campaign brief on campaign creation, cache in `Campaign.briefEmbedding`
- **Invalidation**: Re-embed when bio changes (enrichment update) or brief changes (campaign edit)

### 3. Score Normalization Layer

Before embedding scores enter `computeTopicalMatch()`, normalize to match keyword score distribution:
- Collect paired scores during shadow period
- Fit monotonic mapping (e.g., percentile rank normalization)
- Only cut over when triage distributions match within 5% of keyword-era baseline

### 4. Shadow Scoring

- Run BOTH keyword and embedding scoring in parallel
- Log both scores to `ScoringComparison` table (NOT AIArtifact)
- Gate behind `embeddingScoringEnabled` per-brand flag (added to `FeatureFlags` interface)
- Do NOT use embedding score for triage decisions during shadow phase
- Minimum gate: 100 shadow comparisons AND keyword-era calibration stable

### 5. Cutover

- After shadow validation: switch topical match to normalized embedding score
- **All-or-nothing fallback**: if embedding fails for ANY candidate in a search run, fall back to keyword scoring for ALL candidates in that run (prevents score discontinuity)
- Feature flag controls per-brand rollout

### 6. Brand-Configurable Weights (SEPARATE from embeddings)

This is independent and can ship earlier with keyword scoring:
- Move `DEFAULT_WEIGHTS` to `BrandSettings.metadata.scoringWeights` (JSON)
- Presets: "Quality First", "Scale First", "Balanced"
- Per-campaign overrides
- UI: slider-based weight configuration

### 7. Tests

- Test: embedding generated and stored on creator import
- Test: batch embedding call sends all bios in one request
- Test: cosine similarity computed correctly
- Test: shadow scoring logs to ScoringComparison (not AIArtifact)
- Test: normalized embedding score matches keyword score distribution
- Test: fallback to keyword when embedding API fails (all-or-nothing per batch)
- Test: custom weights apply to composite score
- Test: stale embedding re-generated on bio update
- Test: embeddingScoringEnabled flag controls shadow mode per brand
- Test: scoringVersion persisted on CampaignOutcome

## Output

(empty — deferred)

## Handoff

Phase 25 complete when 25c ships. The identification system then has 16 categories, learns from outcomes, and uses semantic matching. Phase 26 (Platform Expansion) can proceed without 25c — it is non-blocking.
