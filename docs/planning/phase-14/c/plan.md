# Phase 14c — Refactor Discovery into Cache-First Background Jobs

## Focus
Convert discovery/search into true background jobs that validate candidates, top up to the requested valid target, and preserve valid overflow in the creator cache.

## Inputs
- Root phase contract: `docs/planning/phase-14/plan.md`
- Output from 14a: job/progress contract
- Output from 14b: shared Instagram validator
- Current search flows: creators-page search and campaign discovery

## Skills Available for This Subphase
- `find-local-skills` output: unavailable in this session; fallback is manual local-skill selection.
- `find-skills` output: unavailable in this session; fallback is installed-skill-only planning.
- Planned invocations:
  - `backend-development`
  - `javascript-typescript`
  - `browser-automation`

## Work
1. Make `POST /api/campaigns/[campaignId]/search` and `POST /api/creators/search` enqueue-only.
2. Move actual shortlist/scoring/validation/import work into a true worker/background path.
3. Discovery execution order:
   - pull valid cached creators first
   - fetch fresh raw candidates only for the remaining gap
   - validate candidates until requested valid target is met or `3x` raw ceiling is exhausted
4. Campaign attachment rules:
   - attach only the first `N` valid creators to the requesting campaign
   - persist valid overflow in the brand creator DB cache without attaching it to the campaign
   - persist invalid results for audit/debug, but do not expose them as selectable
5. Completion rules:
   - `completed` when requested valid target is met
   - `completed_with_shortfall` when ceiling is hit before target
   - poll/list APIs return requested/validated/invalid/cached counts, progress, ETA, and final result availability

## RED TEAM Refinements

### Collabstr Pipeline Must Also Validate (user-confirmed decision)
- `searchCreatorsForCampaign()` in `apps/web/lib/workers/creator-search.ts` (927 lines) must become async AND include Instagram validation
- Current flow: load Collabstr dataset → shortlist → AI score → persist → return
- New flow: load dataset → shortlist → AI score → **validate via Instagram** → persist only valid → return
- Validation happens AFTER AI scoring (no point validating creators that fail fit scoring)
- Both campaign search and creator search must use Inngest for async execution

### Phase 13 Behaviors to Preserve During Refactor
These behaviors from `lib/workers/creator-search.ts` MUST be carried into the async Inngest function:
- Apify double-fire guard (commit `d8e53f1`)
- Borderline scoring with `BORDERLINE_WINDOW = 0.15`
- Approval mode branching (recommend vs auto) from `fetchApprovalMode()`
- `InterventionCase` creation for borderline creators in recommend mode
- Credit debit flow (`CREDIT_COSTS.collabstr_search`, `CREDIT_COSTS.ai_fit_score`, `CREDIT_COSTS.creator_search`)
- `AIArtifact` audit trail for every approval decision via `storeApprovalArtifact()`
- Brand persona context forwarding via `fetchBrandPersona()`
- Fly worker scoring fallback to local OpenAI scoring

### Job-List Route (missing from 14a, needed by 14e)
- Add `GET /api/creators/search/jobs` returning active/recent jobs for the global tray
- Response: `{ jobs: [{ jobId, status, requestedCount, validatedCount, invalidCount, progressPercent, etaSeconds, startedAt, finishedAt, campaignId? }] }`
- Filtered by authenticated user's brandId

### Cache Staleness
- `CACHE_VALIDITY_HOURS = 72` (configurable via env var)
- Cached creators with `lastValidatedAt` older than this threshold are re-validated before reuse
- "Cache" = existing Creator records with `validationStatus = 'valid'` for the brand

### Data Precedence
- After validation, `Creator.followerCount` is overwritten with the live Instagram value
- Apify-sourced count is only used for initial discovery filtering before validation
- `CreatorProfile.followerCount` is also updated to match

## Validation (RED TEAM)
- `cd apps/web && npx tsc -p tsconfig.json --noEmit`
- `cd apps/web && npx vitest run __tests__/instagram/profile-html.test.ts __tests__/creator-search/job-payload.test.ts`
- `set -a && source ./.env.local && set +a && cd apps/web && npm run build`
- `cd apps/web && npm run lint -- 'app/api/campaigns/[campaignId]/search/route.ts' 'app/(platform)/campaigns/[campaignId]/discover/page.tsx' 'app/(platform)/campaigns/[campaignId]/_components/TriggerSearchButton.tsx' 'app/(platform)/creators/page.tsx' 'lib/inngest/functions/creator-search.ts' 'lib/inngest/functions/apify-creator-search.ts' 'lib/workers/creator-search.ts' 'lib/instagram/validator.ts' 'scripts/refresh-instagram-followers.ts'`

## Output
- Unified discovery now returns cache-first candidate sets, validates them before persistence, and records `cachedCount`, `validatedCount`, `invalidCount`, and `completed_with_shortfall` correctly on `CreatorSearchJob`.
- Campaign discovery and standalone creator search both run fully in the background and only expose selectable valid creators through the job poll routes.
- Valid overflow is kept in the brand creator cache without being attached to the campaign.

## Handoff
14d reuses the same validation policy and cleanup helpers for manual imports, inline creator adds, and the nightly sweep.

## Progress This Turn (Terminus Maximus)
- Work done:
  - `POST /api/campaigns/[campaignId]/search` is now enqueue-only: it creates a pending `CreatorSearchJob`, emits `creator-search/requested`, and returns `{ jobId, status: "queued", requestedCount }`.
  - `apps/web/lib/inngest/functions/creator-search.ts` now executes queued non-Apify campaign searches in the background by calling `runCampaignCreatorSearchJob(...)` instead of stopping after job creation.
  - `apps/web/lib/workers/creator-search.ts` now validates scored Instagram handles before persistence, records validation metadata in `CreatorSearchResult`, widens raw analysis to the `3x` ceiling, and only attaches the first requested valid creators while keeping valid overflow persisted in the brand creator DB.
  - `apps/web/lib/inngest/functions/apify-creator-search.ts` now validates Apify discoveries before persistence and marks jobs as `completed_with_shortfall` when fewer valid creators survive than requested.
  - Campaign discovery UI now treats the response as a queued background job instead of a synchronous “search complete” result, and the creators page polling path now handles `completed_with_shortfall`.
- Commands run:
  - `cd apps/web && npx tsc -p tsconfig.json --noEmit` — pass
  - `cd apps/web && npx vitest run __tests__/instagram/profile-html.test.ts __tests__/creator-search/job-payload.test.ts` — pass (12 tests)
  - `set -a && source ./.env.local && set +a && cd apps/web && npm run build` — pass
  - `cd apps/web && npm run lint -- 'app/api/campaigns/[campaignId]/search/route.ts' 'app/(platform)/campaigns/[campaignId]/discover/page.tsx' 'app/(platform)/campaigns/[campaignId]/_components/TriggerSearchButton.tsx' 'app/(platform)/creators/page.tsx' 'lib/inngest/functions/creator-search.ts' 'lib/inngest/functions/apify-creator-search.ts' 'lib/workers/creator-search.ts' 'lib/instagram/validator.ts' 'scripts/refresh-instagram-followers.ts'` — pass with existing repo warnings only
- Blockers:
  - None for 14c.
- Next concrete steps:
  - Reuse the same validation policy in the dedicated cleanup job and the manual validation CLI.
  - Finish the operator-facing jobs tray and creators-page local status UI in 14e.
