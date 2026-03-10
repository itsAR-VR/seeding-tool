# Phase 14e — Ship the Jobs Tray UX and Verify the End-to-End Flow

## Focus
Make discovery visibly non-blocking in the product, explain metric definitions clearly, and verify the full validation/top-up behavior with automated coverage.

## Inputs
- Root phase contract: `docs/planning/phase-14/plan.md`
- Outputs from 14a-14d
- Current blocking creators-page search modal and campaign discovery button behavior

## Skills Available for This Subphase
- `find-local-skills` output: unavailable in this session; fallback is manual local-skill selection.
- `find-skills` output: unavailable in this session; fallback is installed-skill-only planning.
- Planned invocations:
  - `react-dev`
  - `frontend-design`
  - `playwright-testing`
  - `qa-test-planner`

## Work
1. Replace blocking search UX with:
   - global jobs tray showing active/recent discovery jobs
   - progress bar
   - ETA
   - requested/validated/invalid/cached counts
   - deep links back to results/review
2. Add local status surfaces on creators/campaign pages so operators can see job state without opening a modal.
3. Remove blocking copy like “searching creators via apify”.
4. Add explicit UI copy for `avgViews`: “average of the latest 12 reels/video posts”.
5. Verify:
   - starting discovery does not lock the page
   - operators can navigate elsewhere while job continues
   - job finishes with either `completed` or `completed_with_shortfall`
   - only valid creators appear as selectable/importable
   - campaign receives the correct valid count and valid overflow is retained in cache

## Validation (RED TEAM)
- `cd apps/web && npm run db:generate`
- `set -a && source ./.env.local && set +a && cd apps/web && npm run db:push`
- `cd apps/web && npx vitest run __tests__/creators/validation-policy.test.ts __tests__/creator-search/classification.test.ts __tests__/creator-search/job-payload.test.ts __tests__/instagram/profile-html.test.ts`
- `cd apps/web && npm run lint`
- `set -a && source ./.env.local && set +a && cd apps/web && npm run build`

## Output
- The authenticated shell now shows a persistent discovery jobs tray, and both campaign discovery and creators search expose local progress without blocking the rest of the platform.
- Avg Views copy is explicit in the creator-facing surfaces, and the repo now has automated coverage for validation policy + cache/merge helpers plus passing build/lint/typecheck evidence.

## Handoff
Phase 14 is complete. The remaining next-step work belongs to the newer discovery-scope phases, not this stabilization/validation phase.

## Progress This Turn (Terminus Maximus)
- Work done:
  - Added the global discovery jobs tray to the platform shell.
  - Closed the creators-page blocking search behavior by moving progress into a page-level banner and letting the modal close after queueing.
  - Added avg-view explanatory copy to creator-facing tables.
  - Added a dedicated creator validation sweep CLI plus nightly Inngest cleanup.
  - Finished cache-first validated discovery execution on the unified orchestrator path.
- Commands run:
  - `cd apps/web && npm run db:generate` — pass
  - `set -a && source ./.env.local && set +a && cd apps/web && npm run db:push` — pass
  - `cd apps/web && npx vitest run __tests__/creators/validation-policy.test.ts __tests__/creator-search/classification.test.ts __tests__/creator-search/job-payload.test.ts __tests__/instagram/profile-html.test.ts` — pass (19 tests)
  - `cd apps/web && npm run lint` — pass with existing repo warnings only
  - `set -a && source ./.env.local && set +a && cd apps/web && npm run build` — pass
- Blockers:
  - None for 14e.
- Next concrete steps:
  - Write the phase review and capture the final evidence.
