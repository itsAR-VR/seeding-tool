# Phase 24b+24c + Phase 25a+25b+25c — Deep Sweep Findings

Date: 2026-04-07
Models: Opus 4.6 (5 combined deep analysis + RED TEAM agents)

## Confidence After Sweep

| Phase | Before | After | Key Risk |
|-------|--------|-------|----------|
| 24b Warmup | 55% | **78%** | Data migration breaks all sending; bounce data never written |
| 24c HTML | 70% | **88%** | Three send paths (all addressed); bodyHtml through entire chain; warmup gate added |
| 25a Categories | 92% | **72%** | Return type change breaks 6+ consumers; catalog/Zod not updated |
| 25b Calibration | 82% | **78%** | suggestedWeightAdjustment unbounded; weight normalization missing |
| 25c Embeddings | 35% | **32%** | DEFERRED — score distribution shift, calibration contamination, no vector infrastructure |

---

## CRITICAL Findings

### 24b-C1: Existing aliases become un-sendable on deploy
All current `EmailAlias` rows have `isWarmedUp: false`. After migration, `getEffectiveDailyLimit()` returns 0 for aliases with `warmupStartedAt: null`. **All sending breaks.**
**Fix**: Data migration must set `isWarmedUp: true` for all existing aliases.

### 25a-C1: Return type change breaks 6+ consumers
Changing from single `canonicalCategory` to array breaks orchestrator, decision engine, features, contracts, Zod schema, and Prisma column. All 6 files need updating.
**Fix**: Keep primary `canonicalCategory` as top-ranked label, add `secondaryCategories` array alongside (backward-compatible).

### 25a-C2: Catalog + Zod schema not mentioned
`CANONICAL_DISCOVERY_CATEGORIES` in `catalog.ts` and Zod schema in `contracts.ts` must be expanded. `CATEGORY_ALIASES` needs new entries. UI category filters need updating.
**Fix**: Add explicit catalog/schema update steps.

### 25c-C1: Cosine similarity scores are fundamentally different from keyword overlap
`overlapScore()` rarely exceeds 0.4-0.5. Cosine similarity routinely returns 0.6-0.8 even for loosely related text. A +0.2 shift in topical match (weight 0.25) pushes borderline candidates across triage thresholds.
**Fix**: Add calibration mapping step — collect paired scores during shadow, fit monotonic mapping, only cut over when triage distributions match.

---

## HIGH Findings

### 24b
- H1: `send.ts` select clause missing warmup fields (`isWarmedUp`, `warmupStartedAt`, `warmupDay`)
- H2: `DailyLimitExceededError` reports `alias.dailyLimit` not effective limit
- H3: No bounce/complaint data written anywhere — auto-pause is dead code
- H4: Recommend computing warmup day from `warmupStartedAt` (date math) instead of storing `warmupDay` counter

### 24c
- H1: Two send paths (pipeline + inbox reply) — plan only addresses pipeline
- H2: `Message.bodyHtml` not persisted for outbound HTML messages
- H3: `AIDraft` model has no `bodyHtml` field — can't preview HTML before approval
- H4: Template variables must be HTML-escaped (XSS in webmail)
- H5: Gmail clips messages over ~102KB — images must be URLs, not data URIs

### 25a
- H1: Confidence type mismatch — currently `"high"|"medium"|"low"` (string), plan assumes numeric 0.3 threshold
- H2: LLM fallback makes sync function async — cascades through orchestrator
- H3: Cost explosion — ~22 LLM calls per search if 30% are low-confidence

### 25b
- H1: `suggestedWeightAdjustment` is unbounded in current code — must clamp
- H2: `scoreComponentsAtSeed` has shape mismatch (`retrievalRelevance` is number, not `{score}`)
- H3: No feature flag gating — cron queries ALL brands globally
- H4: Weight normalization missing — adjustments make weights not sum to 1.0

### 25c
- H1: JSON embedding storage risks metadata collision (shared `Json?` column)
- H2: Shadow scoring via AIArtifact is wrong — AIArtifact is thread-scoped, scoring runs are batch jobs
- H3: Campaign brief embedding staleness (brief changes after embedding cached)
- H4: Feature flag naming conflict (env var vs per-brand flag system)

---

## Execution Order (Updated)

### Tier 1 (parallel, all deps met):
- **24b** (warmup) — independent
- **25a** (categories) — independent
- **25b** (calibration) — independent

### Tier 2 (sequential after Tier 1):
- **24c** (HTML templates) — after 24b warmup is active
- **25c** (embeddings) — after 25b calibration is wired + 25a categories expanded

### Tier 3 (after Tier 2):
- **26a, 26b, 26c** — after 24+25

### Key Sequencing Insight:
25c should be LAST in Phase 25 and possibly deferred. At 35% confidence, it's the highest-risk item in the entire roadmap. Ship 25a+25b first, accumulate outcome data, then sweep 25c again with real calibration data before implementing.

---

## Required Plan Updates Summary

| Phase | Critical Updates Needed |
|-------|----------------------|
| 24b | Data migration for existing aliases; compute day from date math; defer auto-pause until bounce data flows |
| 24c | Add warmup gate; update both send paths; HTML escape variables; persist `bodyHtml`; add `AIDraft.bodyHtml` field |
| 25a | Keep backward-compatible types; update catalog+Zod+aliases; batch LLM calls; make classification async in separate wrapper |
| 25b | Add CalibrationSnapshot schema; clamp adjustments; normalize weights; register Inngest function; scope to flagged brands |
| 25c | Add calibration mapping step; decouple weight UI; replace AIArtifact logging; store embeddings in dedicated column |
