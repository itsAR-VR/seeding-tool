# Phase 21b — Verification & Commit

## Focus

Verify the build passes after forecasting extraction, stage all Phase 20 files (excluding forecasting), and create a single commit on main.

## Inputs

- Phase 21a output: 9 cleaned files with no forecast references
- Phase 20 implementation: 18 new library files, 8 Prisma models, 6 API routes, 45 tests

## Skills Available for This Subphase

- `commit-work` — git commit best practices

## Work

### 1. Verify Build

Run from `apps/web/`:

```bash
npx prisma validate          # schema valid without forecast models
npx prisma generate          # Prisma client regenerates cleanly
npm run build                # Next.js production build succeeds
npx vitest run               # 45 tests pass
```

If any step fails, diagnose and fix before proceeding.

### 2. Stage Phase 20 Files

Stage all modified files (now clean of forecasting):

**Modified files to stage** (all under `apps/web/`):
- `prisma/schema.prisma`
- `prisma/migrations/20260330004500_add_phase20_seeding_decision_engine/migration.sql`
- `lib/creator-search/classification.ts`, `contracts.ts`, `job-runner.ts`, `candidate-merge.ts`, `cache-policy.ts`, `orchestrator.ts`, `orchestrator-types.ts`, `job-payload.ts`
- `lib/instagram/validator.ts`
- `lib/enrichment/service.ts`
- `lib/feature-flags.ts`
- `lib/categories/catalog.ts`
- `lib/inngest/functions/run-automation.ts`
- `lib/integrations/methods.ts`
- `lib/creators/validation-ops.ts`
- `lib/mentions/attribution.ts`
- `lib/outreach/send-pipeline.ts`
- `lib/workers/creator-search.ts`
- `scripts/refresh-instagram-followers.ts`
- `app/api/inngest/route.ts`
- `app/api/gmail/webhook/route.ts`
- `app/api/campaigns/[campaignId]/search/route.ts`
- `app/api/campaigns/[campaignId]/creators/[creatorId]/review/route.ts`
- `app/api/creators/search/[jobId]/route.ts`
- `app/api/webhooks/track17/route.ts`
- `app/api/settings/feature-flags/route.ts`
- `app/(platform)/layout.tsx`
- `app/(platform)/settings/page.tsx`
- `app/(platform)/settings/connections/page.tsx`
- `app/(platform)/settings/feature-flags/page.tsx`
- `app/(platform)/campaigns/[campaignId]/discover/page.tsx`
- `app/(platform)/campaigns/[campaignId]/page.tsx`
- `app/(platform)/creators/page.tsx`
- `__tests__/creator-search/classification.test.ts`
- `__tests__/creator-search/contracts.test.ts`
- `package.json`, `package-lock.json`

**New untracked files to stage** (all under `apps/web/`):
- `lib/creator-search/source-confidence.ts`, `raw-payload.ts`, `decision-engine.ts`
- `lib/creator-search/scoring/` (features.ts, composite.ts, reasoning.ts)
- `lib/identity/` (matching.ts, signals.ts, contact-extraction.ts)
- `lib/metrics/` (snapshot.ts, anomaly-detection.ts, authenticity.ts)
- `lib/seeding/` (portfolio-dimensions.ts, portfolio-optimizer.ts, portfolio-explanation.ts, outcome-recorder.ts, outcome-features.ts, score-calibration.ts)
- `lib/inngest/functions/collect-daily-snapshots.ts`, `compute-authenticity.ts`
- `app/api/identity/review/`
- `app/api/campaigns/[campaignId]/seed-list/`
- `app/api/creators/[creatorId]/provenance/`
- `app/api/analytics/seeding-kpis/`
- `app/(platform)/campaigns/[campaignId]/seed-list/`
- `app/(platform)/creators/[creatorId]/`
- `app/(platform)/creators/identity-review/`
- `__tests__/creator-search/scoring.test.ts`, `source-confidence.test.ts`, `validation-state.test.ts`
- `__tests__/identity/`
- `__tests__/metrics/`
- `__tests__/seeding/`
- `docs/planning/phase-20/` (all plan files + review.md)
- `docs/planning/phase-21/` (this plan)

**Do NOT stage:**
- `.next/` directory
- Screenshot files (`Screenshot 2026-03-10*`)
- `apps/web/lib/forecasting/` (5 files)
- `apps/web/app/(platform)/forecast/` (3 pages)
- `apps/web/app/(platform)/settings/forecast/page.tsx`
- `apps/web/app/api/forecast/` (8 routes)
- `apps/web/components/forecast-*.tsx` (4 files)
- `apps/web/__tests__/forecasting/` (4 files)
- `apps/web/__tests__/webhooks/gmail-forecast-trigger.test.ts`
- `apps/web/lib/inngest/functions/process-forecast-run.ts`
- `apps/web/prisma/migrations/20260328224500_add_forecasting_domain/`

### 3. Commit

Single commit message:

```
feat(phase-20): seeding decision engine — identity graph, scoring, portfolio, outcomes

- 4-state validation (valid/unknown/retry/invalid), source confidence tiers
- Identity graph: InfluencerIdentity, PlatformProfile, IdentityEdge, ContactPoint
- 7-dimension scoring engine with composite fit score and triage bands
- Daily metrics snapshots, growth anomaly detection, authenticity assessment
- Diversity-aware portfolio optimizer (greedy selection across 6 dimensions)
- Outcome recording across full campaign lifecycle (12 event types)
- Score calibration, provenance API, KPI dashboard API
- 5 feature flags (all fail-closed), identity review queue UI
- 45 tests, manual Prisma migration
```

### 4. Post-Commit Verification

Run `git status` to confirm:
- Only forecasting files remain as untracked
- No modified files remain
- Commit is on main

## Output

- Single commit on main containing all Phase 20 work
- Clean git status with only forecasting files as untracked leftovers

## Handoff

Phase 20 is committed. Forecasting files remain in the worktree for transfer to the separate forecasting project. Future Phase 21+ work (ML learning-to-rank, YouTube/TikTok APIs, shadow-mode evaluation) can proceed from a clean baseline.
