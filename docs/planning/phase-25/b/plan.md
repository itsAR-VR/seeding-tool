# Phase 25b — Outcome Feedback Loop + Calibration Wiring

## Focus

Wire `score-calibration.ts` (exists, tested, never called) into an automated weekly pipeline. When creators post (or don't), that signal feeds back into scoring weight suggestions.

## Inputs
- `apps/web/lib/seeding/score-calibration.ts` — `generateCalibrationReport()` (106 lines, tested)
- `CampaignOutcome` model — tracks lifecycle milestones
- Phase 23a adds `order_created` outcomes to the dataset
- `apps/web/lib/creator-search/scoring/composite.ts` — `DEFAULT_WEIGHTS`

## Skills Available for This Subphase
- `backend-coding-agent` — Inngest cron, calibration pipeline
- `tdd-guide` — test calibration with real-ish data
- `code-review` — post-implementation

## Work

### 1. Weekly Calibration Inngest Cron
**New file**: `apps/web/lib/inngest/functions/weekly-calibration.ts`

Weekly cron that:
- Queries `CampaignOutcome` for campaigns > 30 days old
- Calls `generateCalibrationReport()`
- Records results in new `CalibrationSnapshot` model
- If >= 50 outcomes: compute `suggestedWeightAdjustment`
- Weight adjustments bounded at +/- 0.05 per cycle (prevent wild swings)

### 2. Outcome Recording Enhancement
- Add `order_created` to outcome event types (Phase 23a wires this)
- Track `responseTimeHours` more precisely
- Record `fitScore` at seed time for later correlation

### 3. Calibration Dashboard API
**New endpoint**: `GET /api/analytics/calibration`
- Returns latest calibration report
- Shows predicted vs actual post rates by score band
- Shows suggested weight adjustments

### 4. Tests
- Test: calibration runs with < 50 outcomes → no weight adjustment
- Test: calibration with >= 50 outcomes → bounded weight suggestions
- Test: weight adjustment capped at +/- 0.05

## Output
- Weekly calibration cron producing `CalibrationSnapshot`
- Bounded weight adjustment suggestions
- API endpoint for calibration data

## Handoff
Subphase c (Embeddings) uses calibration data to validate semantic scoring against keyword scoring.
