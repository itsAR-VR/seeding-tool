# Phase 25b — Outcome Feedback Loop + Calibration Wiring

## Focus

Wire the existing `generateCalibrationReport()` (106 lines, tested, never called) into an automated weekly Inngest cron. Store snapshots, expose via API, and produce bounded weight adjustment suggestions.

Confidence: **90%** (after corrections applied)

## Deep Sweep Corrections Applied

- [x] CRITICAL: Clamp `suggestedWeightAdjustment` to +/- 0.05 inside `generateCalibrationReport()` itself
- [x] HIGH: Filter out null `fitScoreAtSeed` outcomes (don't dump into `<0.60` bucket via `?? 0`)
- [x] HIGH: Handle `retrievalRelevance` shape mismatch (number, not `{score}`) in `scoreComponentsAtSeed`
- [x] HIGH: Re-normalize weights after applying adjustments (must sum to 1.0)
- [x] HIGH: Scope cron to brands with `outcomeLearningEnabled` flag (not global query)
- [x] MEDIUM: Register Inngest function in `app/api/inngest/route.ts`
- [x] MEDIUM: Add `CalibrationSnapshot` Prisma model with explicit schema
- [x] MEDIUM: Use compound filter: ">= 50 outcomes that are >= 30 days old" (not separate checks)

## Inputs

- `apps/web/lib/seeding/score-calibration.ts` — `generateCalibrationReport()` (exists, 1 test)
- `apps/web/lib/seeding/outcome-recorder.ts` — `OutcomeEvent` types
- `apps/web/lib/creator-search/scoring/composite.ts` — `DEFAULT_WEIGHTS`
- `apps/web/lib/feature-flags.ts` — `outcomeLearningEnabled`
- `apps/web/prisma/schema.prisma` — `CampaignOutcome` model

## Skills Available

- `backend-coding-agent`, `tdd-guide`, `database-reviewer`, `code-review`

## Work

### 1. Add CalibrationSnapshot Model

**File**: `apps/web/prisma/schema.prisma`

```prisma
model CalibrationSnapshot {
  id                String   @id @default(uuid())
  createdAt         DateTime @default(now())
  brandId           String?
  outcomeCount      Int
  reportJson        Json
  adjustmentsApplied Boolean @default(false)
  weightsBefore     Json
  suggestedWeights  Json
}
```

Run migration: `npx prisma migrate dev --name add-calibration-snapshot`

### 2. Fix generateCalibrationReport()

**File**: `apps/web/lib/seeding/score-calibration.ts`

Three fixes:
1. **Clamp adjustments**: `Math.max(-0.05, Math.min(0.05, avgCompletion - avgApproval))`
2. **Filter nulls**: Skip outcomes where `fitScoreAtSeed` is null (don't default to 0)
3. **Handle shape mismatch**: Strip `retrievalRelevance` key (it's a raw number, not `{score}`) before iterating `scoreComponentsAtSeed`

### 3. Add Weight Normalization Utility

**New function** in `composite.ts`:
```ts
export function normalizeWeights(weights: ScoreWeights): ScoreWeights {
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  if (sum === 0) return weights;
  return Object.fromEntries(
    Object.entries(weights).map(([k, v]) => [k, v / sum])
  ) as ScoreWeights;
}
```

### 4. Weekly Calibration Inngest Cron

**New file**: `apps/web/lib/inngest/functions/weekly-calibration.ts`

Cron: `0 2 * * 1` (Monday 2 AM)

Steps:
1. Query all brands with `outcomeLearningEnabled: true`
2. For each brand: query `CampaignOutcome` where campaign is >= 30 days old
3. If count >= 50: call `generateCalibrationReport(outcomes)`
4. Store `CalibrationSnapshot` with `weightsBefore`, `suggestedWeights` (clamped + normalized)
5. If count < 50: skip (not enough data)
6. Log results

### 5. Register Function

**File**: `apps/web/app/api/inngest/route.ts` — add `weeklyCalibration` to functions array.

### 6. Calibration API

**New file**: `apps/web/app/api/analytics/calibration/route.ts`

`GET` — returns latest `CalibrationSnapshot` for the current brand. Auth via `getCurrentBrandMembership()`.

### 7. Tests

- Test: < 50 outcomes → no snapshot created
- Test: >= 50 outcomes → snapshot with clamped adjustments
- Test: null fitScoreAtSeed filtered out (not bucketed as <0.60)
- Test: weights normalized to sum to 1.0 after adjustment
- Test: retrievalRelevance key stripped from scoreComponents
- Test: cron only queries brands with outcomeLearningEnabled
- Test: API returns latest snapshot for authenticated brand

## Output

### Implemented

- `CalibrationSnapshot` Prisma model added to schema (prisma generate run)
- `generateCalibrationReport()` fixed with all three deep-sweep corrections:
  - Clamp `suggestedWeightAdjustment` to +/- 0.05 via `clampAdjustment()`
  - Filter out null `fitScoreAtSeed` outcomes (skip, not bucket as <0.60)
  - Handle `retrievalRelevance` shape mismatch via `extractComponentScore()` (raw number or `{score}`)
- `normalizeWeights()` utility added to `composite.ts` — re-normalizes to sum 1.0
- Weekly Inngest cron (`weekly-calibration.ts`) — Monday 2 AM UTC, per-brand, flag-gated
- Cron registered in `app/api/inngest/route.ts`
- `GET /api/analytics/calibration` — returns latest snapshot for authenticated brand
- Accepts `preloadedOutcomes` param for testability (no DB in unit tests)

### Files Modified

- `apps/web/prisma/schema.prisma` — added `CalibrationSnapshot` model
- `apps/web/lib/seeding/score-calibration.ts` — three fixes + `OutcomeRow` type export + preloaded param
- `apps/web/lib/creator-search/scoring/composite.ts` — added `normalizeWeights()`

### Files Created

- `apps/web/lib/inngest/functions/weekly-calibration.ts` — cron function
- `apps/web/app/api/analytics/calibration/route.ts` — API endpoint

### Tests (14 passing across 3 files)

- `__tests__/seeding/score-calibration.test.ts` (5 tests) — buckets, clamping, null filtering, shape mismatch, non-numeric skip
- `__tests__/creator-search/normalize-weights.test.ts` (5 tests) — default, unbalanced, all-zero, immutability, post-adjustment
- `__tests__/seeding/weekly-calibration.test.ts` (4 tests) — flag gating, <50 skip, >=50 snapshot, normalized weights

### Build Status

- `npx tsc --noEmit` passes (only pre-existing classification.test.ts error from Phase 25a)
- `npm run web:build` passes

## Handoff

Phase 25c (Embeddings) uses calibration data to validate semantic scoring against keyword scoring. The suggested weights from calibration provide the baseline for comparison.
