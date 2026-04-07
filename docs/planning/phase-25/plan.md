# Phase 25 — Intelligence Upgrade

## Original User Request (verbatim)

I'm pretty sure the influencer identification is pretty garbage. The data labeling of those influencers is pretty shit too. The enrichment is not there.

## Purpose

Transform identification from keyword matching to semantic understanding. Connect the outcome feedback loop so the system learns from campaign results. Expand classification beyond 5 categories.

## Context

Phase 22 stabilized the platform. Phase 23 added address→order automation and integration tests. Phase 25 makes the identification and scoring actually intelligent.

### Ultraplan Corrections
- Classification is keyword-only with 5 categories via `.includes()` in `lib/creator-search/classification.ts`
- `score-calibration.ts` exists and is tested but never called from any pipeline
- Both discovery AND scoring are equally broken (user decision)

### Deep Sweep Confidence
- **58%** overall (category expansion 92%, calibration wiring 82%, embeddings 45%)
- Embeddings risk: switching from keyword overlap to cosine similarity will fundamentally change scores — needs shadow-scoring period
- Vector storage decision needed (pgvector, JSON column, or external store)

### Dependencies
- Phase 23 must complete first (needs outcome data from completed campaigns for calibration)
- Phase 22c AI model config used by embedding calls

## Skills Available for Implementation
- `backend-coding-agent` — embedding pipeline, calibration loop
- `architect` — vector storage decision, scoring architecture
- `context7-docs` — OpenAI embeddings API, pgvector docs
- `tdd-guide` — TDD for scoring changes
- `code-review` — post-implementation

## Objectives
* [ ] Expand from 5 to 15 categories with LLM fallback classification
* [ ] Wire `score-calibration.ts` into automated weekly pipeline
* [ ] Semantic/embedding relevance scoring alongside keyword matching
* [ ] Brand-configurable scoring weights via BrandSettings
* [ ] Shadow-scoring period before switching to embeddings

## Constraints
- Category expansion and calibration can ship before embeddings (lower risk)
- Embeddings must NOT change live scoring without shadow-scoring comparison
- Minimum 50 `CampaignOutcome` records before calibration adjusts weights
- Keep keyword matching as fallback if embedding API fails

## Success Criteria
1. 15 categories with multi-label support
2. Calibration report runs weekly and produces `suggestedWeightAdjustment`
3. Embedding-based topical match score available alongside keyword-based
4. Brands can configure scoring weights via UI
5. No scoring regression (shadow-score comparison shows >= parity)

## Subphase Index
* a — Category Expansion + Enhanced Classification (lowest risk)
* b — Outcome Feedback Loop + Calibration Wiring (medium risk)
* c — Semantic/Embedding Relevance Scoring (highest risk, needs shadow period)
