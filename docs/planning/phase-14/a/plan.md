# Phase 14a — Extend Schema and Job Contracts

## Focus
Add the database and API contract needed to track validation state, job progress, cache reuse, and shortfall outcomes before changing any discovery behavior.

## Inputs
- Root phase contract: `docs/planning/phase-14/plan.md`
- Current models: `Creator`, `CreatorProfile`, `CreatorSearchJob`, `CreatorSearchResult`
- Current routes: `POST /api/campaigns/[campaignId]/search`, `POST /api/creators/search`, `GET /api/creators/search/[jobId]`

## Skills Available for This Subphase
- `find-local-skills` output: unavailable in this session; fallback is manual local-skill selection.
- `find-skills` output: unavailable in this session; fallback is installed-skill-only planning.
- Planned invocations:
  - `database-schema-designer`
  - `backend-development`
  - `javascript-typescript`

## Work
1. Extend `Creator` with explicit validation state:
   - `validationStatus`: `unknown | valid | invalid`
   - `lastValidatedAt`
   - `lastValidationError`
   - reuse `followerCount` and `avgViews` as the validated values shown in UI
2. Extend `CreatorSearchJob` with:
   - `requestedCount`
   - `candidateCount`
   - `validatedCount`
   - `invalidCount`
   - `cachedCount`
   - `progressPercent`
   - `etaSeconds`
   - `startedAt`
   - `finishedAt`
   - status support for `completed_with_shortfall`
3. Extend `CreatorSearchResult` with:
   - `validationStatus`
   - `validationError`
   - `validatedFollowerCount`
   - `validatedAvgViews`
4. Define route payload updates:
   - search-start routes return `{ jobId, status: "queued", requestedCount }`
   - job poll route returns progress/ETA/counts and only valid selectable results
   - new job-list route returns active/recent jobs for the global tray

## Validation (RED TEAM)
- `cd apps/web && npm run db:generate`
- `set -a && source ./.env.local && set +a && cd apps/web && npm run db:push`
- `cd apps/web && npx vitest run __tests__/creator-search/job-payload.test.ts`
- `cd apps/web && npm run lint -- 'app/api/creators/search/route.ts' 'app/api/creators/search/[jobId]/route.ts' 'app/api/creators/search/jobs/route.ts' 'lib/creator-search/job-payload.ts' 'lib/inngest/functions/apify-creator-search.ts' 'lib/inngest/functions/creator-search.ts' 'lib/inngest/functions/run-automation.ts' 'lib/workers/creator-search.ts' '__tests__/creator-search/job-payload.test.ts'`

## Output
- Prisma schema now tracks creator validation state plus creator-search job progress metadata in `apps/web/prisma/schema.prisma`.
- Shared API serializers live in `apps/web/lib/creator-search/job-payload.ts`, and the search job poll/list routes now expose the phase-14 progress contract without breaking the existing synchronous campaign-search pipeline.
- Verified: Prisma client regenerated, database schema pushed, serializer tests passed, and targeted lint passed with existing repo warnings only.

## Handoff
14b should reuse the new schema fields and serializer helpers when it promotes the Crawlee follower-refresh script into a shared validator. The remaining queue-only campaign-search response change is intentionally deferred to 14c because the campaign route is still synchronous today.

## Progress This Turn (Terminus Maximus)
- Work done:
  - Added `validationStatus`, `lastValidatedAt`, and `lastValidationError` to `Creator`.
  - Added progress/count/timestamp fields to `CreatorSearchJob`.
  - Added validation payload fields to `CreatorSearchResult`.
  - Created `apps/web/lib/creator-search/job-payload.ts` for shared job/result serialization and `campaignId` extraction from job query payloads.
  - Updated the standalone creator-search start route, job poll route, automation job creation, Inngest handlers, and the synchronous campaign search worker to populate the new progress contract.
  - Added `GET /api/creators/search/jobs` and serializer coverage in `apps/web/__tests__/creator-search/job-payload.test.ts`.
- Commands run:
  - `cd apps/web && npm run db:generate` — pass
  - `set -a && source ./.env.local && set +a && cd apps/web && npm run db:push` — pass
  - `cd apps/web && npx vitest run __tests__/creator-search/job-payload.test.ts` — pass (4 tests)
  - `cd apps/web && npm run lint -- 'app/api/creators/search/route.ts' 'app/api/creators/search/[jobId]/route.ts' 'app/api/creators/search/jobs/route.ts' 'lib/creator-search/job-payload.ts' 'lib/inngest/functions/apify-creator-search.ts' 'lib/inngest/functions/creator-search.ts' 'lib/inngest/functions/run-automation.ts' 'lib/workers/creator-search.ts' '__tests__/creator-search/job-payload.test.ts'` — pass with existing repo warnings only
- Blockers:
  - None for 14a.
- Next concrete steps:
  - Build the shared Instagram validator service and shared job contract adapters in 14b.
  - Keep the synchronous campaign search path stable until 14c converts it to enqueue-only behavior.
