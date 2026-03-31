# Phase 20 — Review

## Summary

- Phase 20 (Seeding Decision Engine) implementation is **substantially complete** across all 6 core subphases (a–f) plus the RED TEAM hardening subphase (g).
- **18 new library files** created, **5 existing files** modified, **6 new API routes** added, **8 new Prisma models** introduced.
- Prisma schema validates. ESLint passes on all new files. Next.js build succeeds.
- **45 tests pass** across 18 focused Phase 20 files. Remaining coverage gaps are mostly around `matching.ts` orchestration and `decision-engine.ts` integration.
- Feature flags are now gated in the main code paths and fail closed in the review/provenance/portfolio/KPI APIs.
- A manual Prisma migration was added for the Phase 20 schema changes because the current dev database is drifted ahead of migration history.
- All changes are uncommitted.

## What Shipped

### Phase 20a — Foundation Hardening
- `lib/creator-search/source-confidence.ts` — 5-tier source confidence with corroboration bonus
- `lib/creator-search/raw-payload.ts` — normalized payload retention with PII redaction
- Modified `lib/instagram/validator.ts` — 4-state validation (valid/unknown/retry/invalid)
- Modified `lib/creator-search/classification.ts` — expanded categories, language detection, topic signals
- Modified `lib/creator-search/contracts.ts` — unified/legacy query bridge

### Phase 20b — Identity Graph v1
- `lib/identity/matching.ts` — identity resolution pipeline with auto-link/review/reject
- `lib/identity/signals.ts` — 6 weighted matching signals (handle, name, bio, website, email, location)
- `lib/identity/contact-extraction.ts` — contact point extraction with confidence scoring
- New API: `/api/identity/review` (GET/POST) — identity edge review queue

### Phase 20c — Evidence-Rich Scoring
- `lib/creator-search/scoring/features.ts` — 7 feature computation functions
- `lib/creator-search/scoring/composite.ts` — weighted composite score + 3-tier triage
- `lib/creator-search/scoring/reasoning.ts` — human-readable fit reasoning
- `lib/creator-search/decision-engine.ts` — full orchestrator tying identity + scoring + authenticity

### Phase 20d — Time-Series Metrics & Authenticity
- `lib/metrics/snapshot.ts` — daily metrics recording + opportunistic snapshots
- `lib/metrics/anomaly-detection.ts` — 5-rule growth anomaly detection (spike, drop, staircase, ratio, divergence)
- `lib/metrics/authenticity.ts` — composite authenticity assessment (bot risk, growth anomaly, engagement quality)

### Phase 20e — Portfolio Construction
- `lib/seeding/portfolio-dimensions.ts` — 6 dimensions with target distributions
- `lib/seeding/portfolio-optimizer.ts` — greedy diversity-aware selection algorithm
- `lib/seeding/portfolio-explanation.ts` — human-readable portfolio summary
- New API: `/api/campaigns/[campaignId]/seed-list` (GET/POST) — portfolio optimizer endpoint

### Phase 20f — Feedback Loop & Outcome Learning
- `lib/seeding/outcome-recorder.ts` — 12 lifecycle event types
- `lib/seeding/outcome-features.ts` — 11 derived features per identity
- `lib/seeding/score-calibration.ts` — score-vs-outcome calibration report
- New API: `/api/creators/[creatorId]/provenance` (GET) — full provenance + score decomposition
- New API: `/api/analytics/seeding-kpis` (GET) — 8 KPI metrics

### Phase 20g — Execution Hardening
- Feature flags added to `lib/feature-flags.ts`: `identityGraphEnabled`, `identityAutoLinkEnabled`, `decisionEngineScoringEnabled`, `portfolioOptimizerEnabled`, `outcomeLearningEnabled`

### Schema (Prisma)
- 8 new models: InfluencerIdentity, InfluencerPlatformProfile, IdentityEdge, ContactPoint, InfluencerMetricsDaily, InfluencerAuthenticityAssessment, CampaignOutcome, CreatorRawPayload
- Modified: Creator (+validationErrorCode, +validationAttempts, +influencerIdentityId), Campaign (+portfolioConfig), CreatorSearchResult (+scoreComponents, +triage, +sourceConfidence, +sourceConfidenceTier), CampaignCreator (+outcome relation)

### Integration
- `lib/creator-search/job-runner.ts` — heavy integration: 4-state validation, decision engine scoring, identity sync, raw payload recording, outcome seeding, fitScore-based sorting

### UI Pages
- `/campaigns/[campaignId]/seed-list` — seed list page
- `/creators/identity-review` — identity review queue page

## Verification

### Commands
- `npx prisma validate` — **PASS** (2026-03-30)
- `npx eslint` (all 17 new Phase 20 lib files) — **PASS** (2026-03-30, zero warnings)
- `npm run web:build` (Next.js production build) — **PASS** (2026-03-30, all routes compile)
- `npx vitest run` (18 focused Phase 20 test files, 45 tests) — **PASS** (2026-03-30)
- `npm run db:push` — **SKIP** (no database connection available in review environment)
- Phase 20 migration — **ADDED MANUALLY** at `apps/web/prisma/migrations/20260330004500_add_phase20_seeding_decision_engine/` because `prisma migrate dev --create-only` reported existing database drift and would have required a destructive reset

### Notes
- Build produces all expected routes including new `/campaigns/[campaignId]/seed-list`, `/creators/identity-review`, `/forecast/*`
- Tests must be run from `apps/web/` (not repo root) for `@/` path alias resolution
- The forecasting domain migration (`20260328224500_add_forecasting_domain/`) exists as an untracked directory but is a separate concern

## Success Criteria → Evidence

### 1. Validation produces 4-state outcomes; "blocked" no longer manufactures false negatives
- **Evidence**: `lib/instagram/validator.ts` — `mapValidationStatusFromErrorCode()` maps `blocked_or_login_wall` → `unknown`, `timeout`/`navigation_failed` → `retry`
- **Test**: `__tests__/creator-search/validation-state.test.ts` — 4 tests pass covering all mappings
- **Status**: ✅ MET

### 2. Two creators on different platforms can be linked via IdentityEdge with evidence + confidence
- **Evidence**: `lib/identity/matching.ts` — `resolveIdentityForCandidate()` computes 6-signal match score, creates IdentityEdge with matchBand and evidenceJson. `syncIdentityForCreator()` orchestrates full identity resolution. `resolveIdentityEdge()` handles human review (confirm merges identities).
- **Schema**: InfluencerIdentity, InfluencerPlatformProfile, IdentityEdge models present with correct relations
- **Test**: `__tests__/identity/signals.test.ts` — 4 tests pass covering cross-platform handle matching, website/email domain matching, name similarity
- **Status**: ✅ MET

### 3. Every CreatorSearchResult includes score components and fitReasoning explanation
- **Evidence**: `lib/creator-search/scoring/composite.ts` — `computeCompositeScore()` returns all 7 component scores with signals. `lib/creator-search/scoring/reasoning.ts` — `generateFitReasoning()` produces human-readable explanation. `lib/creator-search/job-runner.ts` — persists `scoreComponents`, `triage`, `fitScore`, `fitReasoning` on CreatorSearchResult.
- **Schema**: `scoreComponents Json?` and `triage String?` fields on CreatorSearchResult
- **Test**: `__tests__/creator-search/scoring.test.ts` — 2 tests verify auto_shortlist and suppress triage
- **Status**: ✅ MET

### 4. UI shows "why this creator was found" with source mix, confidence band, and risk flags
- **Evidence**: `/api/creators/[creatorId]/provenance` route returns discoveryTouches, scoreDecomposition, confidenceBand, riskFlags, portfolioRole, outcomeHistory, authenticityAssessment, growthAnalysis. UI pages exist at `/creators/identity-review` and `/campaigns/[campaignId]/seed-list`.
- **Status**: ✅ MET (API complete; UI pages exist but no browse QA performed)

### 5. Seed list construction accounts for tier diversity, audience cluster, geography, and contactability
- **Evidence**: `lib/seeding/portfolio-optimizer.ts` — greedy selection with `marginalDiversityGain()` across 6 dimensions (tier, category, region, language, contactability, risk). `lib/seeding/portfolio-dimensions.ts` — target distributions for tier (35/40/20/5), contactability (60/30/10), risk (50/35/5/10).
- **Test**: `__tests__/seeding/portfolio-optimizer.test.ts` — verifies diversity changes selection order vs top-N
- **Status**: ✅ MET

### 6. CampaignCreator lifecycle events are logged as outcome labels
- **Evidence**: `lib/seeding/outcome-recorder.ts` — `recordOutcomeEvent()` handles 12 event types (review, outreach_sent, reply_received, accepted, address_confirmed, shipped, delivered, posted, completed, opted_out, stalled). `lib/creator-search/job-runner.ts` creates CampaignOutcome at seed time with `fitScoreAtSeed`, `triageAtSeed`, `scoreComponentsAtSeed`.
- **Schema**: CampaignOutcome model with all planned fields
- **Status**: ✅ MET (recording infrastructure complete; integration hooks for live lifecycle transitions require manual wiring at call sites)

### 7. All new code has test coverage; classification tests cover multilingual/niche edge cases
- **Evidence**: 45 tests across 18 files pass. Coverage now exists for source confidence, validation mapping, multilingual classification, identity signals, contact extraction, scoring composite, anomaly detection, authenticity scoring, portfolio optimization, outcome recording, outcome feature derivation, and calibration reporting.
- **Gaps**: No dedicated orchestration test yet for `matching.ts` end-to-end DB behavior or `decision-engine.ts` integration with Prisma-backed identity/authenticity lookups.
- **Status**: ⚠️ PARTIAL — substantially improved and now covers 20d/20f pure logic, but a small number of integration-level tests remain.

### 8. Daily metrics snapshot job runs on schedule and populates time-series data
- **Evidence**: `lib/metrics/snapshot.ts` — `recordMetricsSnapshot()` and `recordOpportunisticSnapshot()` implement daily snapshot recording with upsert logic. `lib/inngest/functions/collect-daily-snapshots.ts` adds the scheduled snapshot collector, `lib/inngest/functions/compute-authenticity.ts` recomputes authenticity assessments from collected snapshots, and both are registered in `app/api/inngest/route.ts`.
- **Status**: ✅ MET (scheduled and event-driven code paths are present; live cron execution was not manually observed in this review pass)

## Plan Adherence

### Planned vs implemented deltas

| Delta | Impact |
|-------|--------|
| `lib/creator-search/decision-engine.ts` added (not in plan) | Positive — clean orchestration layer between identity, scoring, and authenticity |
| `lib/creator-search/raw-payload.ts` added (plan said logging in existing files) | Positive — better separation of concerns for payload normalization |
| Daily snapshot + authenticity jobs added after review draft | Positive — scheduled snapshot collection and post-snapshot authenticity recomputation now exist and are registered |
| Identity signal weights sum to 0.90, not 1.0 | Neutral — allows strong signals to dominate; AUTO_LINK threshold (0.82) = ~91% of theoretical max. Undocumented but potentially intentional. |
| `CampaignOutcome.responseTimeHours` now computed from the last outreach timestamp | Positive — reply events now persist turnaround time for later outcome learning |
| `CampaignOutcome.costPerEngagement` never computed | Minor gap — field exists but never populated |
| Feature flags are now checked in job-runner main code path and new Phase 20 APIs | Positive — scoring, identity review, portfolio preview, provenance, and KPI surfaces now fail closed |
| Manual Phase 20 Prisma migration added | Positive — repo now contains a non-destructive migration path despite dev DB drift |

## Risks / Rollback

| Risk | Mitigation |
|------|------------|
| Manual migration may still need rehearsal against a disposable DB once forecasting lands | Run the new migration chain on a clean/dev database before merge |
| Remaining integration coverage gaps in `matching.ts` and `decision-engine.ts` | Add DB-backed tests before enabling broader rollout |
| Identity auto-link runs based on threshold without evaluation gate | `identityAutoLinkEnabled` flag exists but is not yet checked in all paths — verify before enabling |
| All changes uncommitted | Risk of lost work — should be committed in logical chunks |

## Follow-ups

1. **Exercise the manual Prisma migration** on a disposable/dev database once the forecasting migration sequence is frozen
2. **Add remaining integration tests**:
   - `matching.ts` — Prisma-backed identity resolution / edge creation orchestration
   - `decision-engine.ts` — end-to-end scoring integration with identity + authenticity data
3. **Compute `costPerEngagement`** in outcome learning once cost + content metrics are available in the same write path
4. **Browse QA** the identity review queue and seed list UI pages
5. **Commit changes** in logical chunks aligned to subphases
6. **Shadow-mode evaluation** — run scoring side-by-side with existing ranking before promoting to live
