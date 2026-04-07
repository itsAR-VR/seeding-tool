# Phase 25c — Semantic/Embedding Relevance Scoring

## Focus

Replace keyword `.includes()` relevance scoring with OpenAI embeddings for the topical match component (weight 0.25 — highest single weight). This is the highest-risk subphase — needs shadow-scoring before live cutover.

## Inputs
- `apps/web/lib/creator-search/scoring/features.ts` — `computeTopicalMatch()` uses `overlapScore()` (token intersection)
- Phase 25b calibration data for validating embedding quality vs keyword quality
- `AI_MODEL` config from Phase 22c

## Skills Available for This Subphase
- `architect` — vector storage decision (pgvector vs JSON vs external)
- `backend-coding-agent` — embedding pipeline
- `context7-docs` — OpenAI embeddings API docs
- `tdd-guide` — shadow-scoring comparison tests
- `code-review` — post-implementation

## Work

### 1. Vector Storage Decision
Options:
- **pgvector** (Supabase extension) — best for similarity search, requires DB config change
- **JSON column** — simple, no infrastructure change, slower similarity computation
- **External store** (Pinecone) — scalable but adds dependency

Decision criteria: current scale (hundreds of creators, not millions) → JSON column is sufficient for v1. Migrate to pgvector later if needed.

### 2. Embedding Pipeline
- Embed creator bios on discovery/enrichment using `text-embedding-3-small`
- Store embedding vector in `InfluencerPlatformProfile.metadata` (JSON)
- Embed campaign brief + keywords on campaign creation
- Compute cosine similarity for topical match

### 3. Shadow Scoring
- Run BOTH keyword and embedding scoring in parallel
- Log both scores to `AIArtifact` for comparison
- Do NOT use embedding score for triage decisions yet
- Compare: does embedding scoring correlate better with actual outcomes than keyword scoring?

### 4. Cutover (when confidence > 84.7%)
- After sufficient comparison data: switch topical match to embedding-based
- Keep keyword matching as fallback (if OpenAI API fails)
- Feature flag: `EMBEDDING_SCORING_ENABLED`

### 5. Brand-Configurable Weights
**File**: `BrandSettings.metadata` → add `scoringWeights` JSON

- UI: slider-based weight configuration
- Presets: "Quality First", "Scale First", "Balanced"
- Per-campaign overrides

### 6. Tests
- Test: embedding generated and stored on creator import
- Test: cosine similarity computed correctly
- Test: shadow scoring logs both keyword and embedding scores
- Test: fallback to keyword when embedding API fails
- Test: custom weights apply to composite score

## Output
- Embedding pipeline for creator bios and campaign briefs
- Shadow scoring logging both methods
- Feature-flagged cutover
- Brand-configurable scoring weights with UI

## Handoff
Phase 25 complete. The identification system now has 15 categories, learns from outcomes, and uses semantic matching. Phase 26 (Platform Expansion) can proceed.
