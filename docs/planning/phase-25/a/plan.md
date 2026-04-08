# Phase 25a — Category Expansion + Enhanced Classification

## Focus

Expand creator classification from 5 keyword-only categories to 15 categories with LLM fallback for ambiguous bios and multi-label support. Backward-compatible — no breaking changes to existing consumers.

Confidence: **90%** (after corrections applied)

## Deep Sweep Corrections Applied

- [x] CRITICAL: Keep `canonicalCategory` as primary (backward-compatible), add `secondaryCategories` array alongside
- [x] CRITICAL: Update `CANONICAL_DISCOVERY_CATEGORIES` in `catalog.ts` + Zod schema in `contracts.ts` + `CATEGORY_ALIASES` in `classification.ts`
- [x] HIGH: Keep `classifyDiscoveryText()` synchronous — add separate `classifyWithLLMFallback()` async wrapper
- [x] HIGH: Batch LLM calls (classify up to 10 bios per prompt) to reduce API cost
- [x] HIGH: Confidence stays as string enum (`high|medium|low`) — LLM fallback triggers on `"low"` string, not numeric 0.3
- [x] MEDIUM: Validate LLM response against `CANONICAL_DISCOVERY_CATEGORIES` before accepting
- [x] MEDIUM: Cache LLM results in `Creator.bioCategory` column

## Inputs

- `apps/web/lib/creator-search/classification.ts` — current 5-category keyword classifier
- `apps/web/lib/creator-search/catalog.ts` — `CANONICAL_DISCOVERY_CATEGORIES`, `CATEGORY_ALIASES`
- `apps/web/lib/creator-search/contracts.ts` — Zod schema for categories
- `apps/web/lib/creator-search/scoring/features.ts` — `computeCategoryConfidence()` consumer
- `apps/web/lib/ai/config.ts` — `AI_MODEL` for LLM calls

## Skills Available

- `backend-coding-agent`, `tdd-guide`, `code-review`

## Work

### 1. Expand Category Taxonomy

**File**: `apps/web/lib/creator-search/catalog.ts`

Add 10 new categories to `CANONICAL_DISCOVERY_CATEGORIES`:
Tech, Gaming, Travel, Parenting, Pets, Sports, Education, Entertainment, Finance, Automotive

**File**: `apps/web/lib/creator-search/contracts.ts`

Zod schema auto-derives from `CANONICAL_DISCOVERY_CATEGORIES` — will update automatically.

### 2. Add Keyword Rules for New Categories

**File**: `apps/web/lib/creator-search/classification.ts`

Add `CATEGORY_ALIASES` entries and keyword lists for each new category. Handle overlaps:
- Sports vs Fitness: sports = teams, athlete, league; fitness = workout, gym, exercise
- Entertainment vs Gaming: entertainment = movies, music, shows; gaming = console, streamer, esports
- Education vs Tech: education = teacher, learning, tutorial; tech = software, startup, developer

### 3. Multi-Label Support (Backward-Compatible)

**File**: `apps/web/lib/creator-search/classification.ts`

Extend `DiscoveryClassification` type:
```ts
type DiscoveryClassification = {
  canonicalCategory: CanonicalDiscoveryCategory;  // PRIMARY — unchanged
  confidence: "high" | "medium" | "low";           // unchanged
  secondaryCategories?: Array<{                     // NEW — additive
    category: CanonicalDiscoveryCategory;
    confidence: "high" | "medium" | "low";
  }>;
};
```

The `classifyDiscoveryText()` function returns ALL matching categories. The first is `canonicalCategory` (highest confidence). Additional matches go in `secondaryCategories`. **No downstream consumers break** because `canonicalCategory` still exists.

### 4. LLM Fallback (Separate Async Function)

**New function**: `classifyWithLLMFallback()` in `classification.ts`

```ts
export async function classifyWithLLMFallback(
  text: string,
  keywordResult: DiscoveryClassification
): Promise<DiscoveryClassification> {
  if (keywordResult.confidence !== "low") return keywordResult;

  // Call OpenAI with AI_MODEL
  // Prompt: "Classify this creator bio into one of: [categories]. Return JSON."
  // Validate response against CANONICAL_DISCOVERY_CATEGORIES
  // Cache result in Creator.bioCategory on success
  // Fallback to keyword result on API failure
}
```

**Batch variant** for orchestrator: `classifyBatchWithLLM(bios: string[])` — classify up to 10 bios in one prompt to reduce API calls from ~22 to ~3 per search run.

The orchestrator calls `classifyWithLLMFallback()` instead of `classifyDiscoveryText()` when the async context is available. The sync function remains for hot paths.

### 5. Update Orchestrator (Optional Async Path)

**File**: `apps/web/lib/creator-search/orchestrator.ts`

After `classifyDiscoveryText()` runs synchronously, collect all `"low"` confidence results and batch-classify them via `classifyBatchWithLLM()` in a single async call. This keeps the hot path sync and only adds one async step for ambiguous bios.

### 6. Tests

- Test: each new category has keyword matches
- Test: multi-label returns primary + secondaries
- Test: `secondaryCategories` is undefined when only one match (backward compat)
- Test: LLM fallback triggers on `confidence === "low"`
- Test: LLM response validated against canonical list (invalid category rejected)
- Test: LLM API failure falls back to keyword result
- Test: batch classify sends 1 prompt for 10 bios
- Test: existing consumers still work with single `canonicalCategory`

## Output

**Completed 2026-04-08**

- 16 canonical categories + Other (was 6 + Other): Automotive, Beauty, Education, Entertainment, Fashion, Finance, Fitness & Workout, Food & Drink, Gaming, Health & Wellness, Home & Garden, Parenting, Pets, Sports, Tech, Travel
- Multi-label `secondaryCategories` array on `DiscoveryClassification` (additive, omitted when only one match)
- LLM fallback via `classifyWithLLMFallback()` and `classifyBatchWithLLM()` (batches of 10, validates against canonical list)
- Orchestrator calls `reclassifyLowConfidenceCandidates()` after enrichment to batch-classify low-confidence bios via LLM
- Zero breaking changes: `canonicalCategory` still works as single string everywhere
- 39 new tests across 2 test files (26 expanded taxonomy + 8 LLM fallback + 5 existing preserved)
- All 70 creator-search tests pass, build succeeds, no new tsc errors

### Files Modified
- `apps/web/lib/categories/catalog.ts` -- expanded APIFY_CATEGORIES from 6 to 16
- `apps/web/lib/creator-search/classification.ts` -- added 10 category keyword rules, CATEGORY_ALIASES for new categories, `SecondaryCategory` type, multi-label `collectKeywordMatches()`, `secondaryCategories` on return type
- `apps/web/lib/creator-search/orchestrator.ts` -- added `reclassifyLowConfidenceCandidates()` async step after enrichment

### Files Created
- `apps/web/lib/creator-search/classification-llm.ts` -- async LLM fallback: `classifyWithLLMFallback()`, `classifyBatchWithLLM()`, prompt builder, response parser with canonical validation
- `apps/web/__tests__/creator-search/classification-expanded.test.ts` -- 26 tests for expanded taxonomy, multi-label, overlap disambiguation, backward compat
- `apps/web/__tests__/creator-search/classification-llm.test.ts` -- 8 tests for LLM fallback (mock OpenAI, API failure, invalid category rejection, batch sizing)

## Handoff

Phase 25b (Calibration) uses classification confidence as a signal. Phase 25c (Embeddings) replaces the topical match scoring that classification feeds into. The `secondaryCategories` field is available for 25b to use as additional scoring signals.
