# Phase 14 — Creator Validation, Cache-First Discovery, and Background Job UX

## Original User Request (verbatim)
create $phase-plan

## Purpose
Turn creator discovery, import, and campaign-add flows into a validation-first system that only admits real Instagram creators, backfills to the requested valid count for discovery jobs, and runs in the background without locking operators out of the platform.

## Context
- Current repo state already has creator search, creator import, campaign add, `CreatorSearchJob`, `CreatorSearchResult`, and a live Crawlee-based follower refresh script at `apps/web/scripts/refresh-instagram-followers.ts`.
- Current product gaps confirmed in repo:
  - `POST /api/campaigns/[campaignId]/search` still performs the full search synchronously after creating a job record.
  - the creators-page search modal blocks with a “searching creators via apify” state instead of handing work off to a background job surface.
  - `Creator.avgViews` exists in schema/UI, but current discovery/import flows do not derive it from Instagram.
  - existing creator/campaign data can still contain invalid or stale Instagram handles and metrics.
- Locked product decisions from this conversation:
  - a creator is valid only if the Instagram profile resolves, the handle exists, follower count is greater than zero, and that follower count is inside the active min/max follower range.
  - `avgViews` is informational and is not a validity gate.
  - `avgViews` must be defined as the average of the latest 12 reels/video posts, and the UI should state that definition.
  - discovery/search flows must top up until the requested valid target is met, using brand cache first and then fresh search, with a hard ceiling of `3x` the requested target.
  - manual explicit imports validate and drop invalid creators, but do not auto-top-up.
  - already-saved invalid creators are marked invalid and hidden by default; they are only auto-removed from draft-ready campaign queues that have no downstream activity.
  - background discovery jobs must be visible in a global jobs tray with progress + ETA, while the rest of the platform remains usable.

## Skills Available for Implementation
- `find-local-skills`: not exposed as an invokable tool in this session. Fallback: manual selection from the installed skill catalog already present in the environment.
- `find-skills`: not exposed as an invokable tool in this session. Fallback: plan only with confirmed local skills already available in-session.
- Selected implementable skills:
  - `backend-development`
  - `database-schema-designer`
  - `javascript-typescript`
  - `react-dev`
  - `browser-automation`
  - `playwright-testing`
  - `qa-test-planner`
  - `context7-docs`
  - `requirements-clarity`

## Concurrent Phases

| Phase | Status | Overlap | Coordination |
|-------|--------|---------|--------------|
| Phase 13 | Complete | Creators, campaign discovery, production cutover, follower-count cleanup | Treat Phase 13 code as the current baseline. Do not revert the live follower-refresh script or the creator-data cleanup behavior while implementing this phase. |
| Phase 9 | Historical implementation plan | Creator search worker, job orchestration, review/import flow | Use it as architectural background only. Current repo behavior is the source of truth. |

## Objectives
* [x] Add one shared Instagram preflight validator for every creator ingress path.
* [x] Convert discovery/search to true background jobs with cache-first refill and shortfall handling.
* [x] Remove invalid creators from default platform flows without hard-deleting valuable downstream history.
* [x] Add a non-blocking jobs tray and local progress surfaces so operators can keep using the platform during discovery.
* [x] Populate validated `followerCount` and `avgViews` consistently in the creator database and campaign surfaces.

## Constraints
- Validation must use live Instagram page data, not only imported third-party counts.
- Valid discovery candidates must satisfy the active follower-range filter before they are attached to campaigns or shown as selectable results.
- Search/discovery top-up must stop at `3x` the requested target and complete as `completed_with_shortfall` if the target still is not met.
- Manual explicit imports validate only and do not auto-refill from cache or fresh search.
- Valid overflow is stored in the existing brand creator database as reusable cache; no separate cache table should be introduced unless implementation proves it necessary.
- Invalid saved creators are marked and hidden by default; no hard-delete by default.
- Background search UX must not block the creators page, campaign page, or the rest of the authenticated shell.
- Proxy rotation must be configured via `CRAWLEE_PROXY_URLS` env var before validation runs at scale. Validation without proxies is limited to ~20-30 creators per batch before Instagram blocking.
- avgViews enrichment is decoupled from the validity check — it runs as a separate background job and must never block or delay validation results.

## Success Criteria
- [x] All creator ingress paths either save validated creators or reject them before they enter creator/campaign lists.
- [x] Discovery jobs return immediately, progress in the background, and surface progress + ETA in a global jobs tray.
- [x] Campaign discovery attaches exactly the requested valid count when enough valid creators exist; otherwise it ends with an explicit shortfall result.
- [x] Valid overflow creators are retained in the brand cache for reuse on later discovery runs.
- [x] Invalid saved creators disappear from default creators/campaign discovery lists and are only retained where downstream campaign activity requires history.
- [x] `followerCount` and `avgViews` shown in creators/campaign surfaces are validated values, not raw imported guesses.

## Repo Reality Check (RED TEAM)

- What exists today:
  - `Creator` model (`apps/web/prisma/schema.prisma`) — now has `validationStatus`, `lastValidatedAt`, and `lastValidationError` in addition to `followerCount`, `avgViews`, and `instagramHandle`.
  - `CreatorSearchJob` model — now has `requestedCount`, `candidateCount`, `validatedCount`, `invalidCount`, `cachedCount`, `progressPercent`, `etaSeconds`, `startedAt`, and `finishedAt`. `status` remains a String field, so `completed_with_shortfall` can be introduced without an enum migration.
  - `CreatorSearchResult` model — now has `validationStatus`, `validationError`, `validatedFollowerCount`, and `validatedAvgViews` alongside the existing discovery/scoring fields.
  - `CreatorProfile` model (`:494-514`) — complete, no gaps.
  - Campaign search route: `apps/web/app/api/campaigns/[campaignId]/search/route.ts` — enqueue-only; creates a `CreatorSearchJob`, stores the unified query, and returns `{ jobId, status: "queued", requestedCount }`.
  - Creator search route: `apps/web/app/api/creators/search/route.ts` — enqueue-only; stores the unified query and returns `{ jobId, status: "queued", requestedCount }`.
  - Job poll route: `apps/web/app/api/creators/search/[jobId]/route.ts` — now returns the serialized progress contract plus selectable results when the job is terminal.
  - Job list route: `apps/web/app/api/creators/search/jobs/route.ts` — returns active/recent jobs for the authenticated brand.
  - Instagram scraping: `apps/web/lib/instagram/validator.ts` exposes the shared Crawlee validator, `apps/web/lib/inngest/functions/creator-avg-views-enrichment.ts` handles background avg-view enrichment, and `apps/web/lib/inngest/functions/creator-validation-cleanup.ts` runs the nightly sweep.
  - CSV import: `apps/web/app/api/creators/import/route.ts` validates each handle before create/update and enqueues avg-view enrichment for accepted creators.
  - Campaign add creator: `apps/web/app/api/campaigns/[campaignId]/creators/route.ts` rejects invalid creators and validates inline handle creation before save.
  - Campaign import page: `apps/web/app/(platform)/campaigns/[campaignId]/import/page.tsx` (bulk select from brand creators).
  - Background jobs: Inngest now powers unified creator search, avg-view enrichment, and nightly cleanup.
  - Discovery orchestration lives in `apps/web/lib/creator-search/orchestrator.ts` and reuses fresh validated creators from the brand cache before new source fetches.
  - The authenticated shell now has a persistent discovery jobs tray in `apps/web/components/creator-search-jobs-tray.tsx`.
- What the plan assumes:
  - 12 new schema fields across Creator + CreatorSearchJob + CreatorSearchResult — **all need migration** (14a).
  - `status` field is a String, not a Prisma enum — adding `completed_with_shortfall` is trivial string value, no enum migration needed.
  - avgViews extraction from Instagram reels exists — **IT DOES NOT**. The current script only extracts follower counts. Reel/video view scraping is net-new functionality.
  - A unified async background job pattern — **TWO different patterns exist** today (synchronous Collabstr pipeline for campaigns, async Inngest for Apify creator search). 14c must reconcile both.
- Verified touch points:
  - `sanitizeFollowerCount` → `apps/web/lib/creators/follower-count.ts` ✓
  - `deriveBrandICP` → `apps/web/lib/brands/icp.ts` ✓
  - `CREDIT_COSTS`, `debit`, `getBalance` → `apps/web/lib/credits` ✓
  - `inngest` → `apps/web/lib/inngest/client.ts` ✓
  - `extractInstagramFollowerCountFromHtml` → `apps/web/lib/instagram/profile-html.ts` ✓
  - `isInstagramProfileBlocked` → `apps/web/lib/instagram/profile-html.ts` ✓
  - Collabstr dataset path → `scripts/collabstr-influencers.jsonl` ✓
  - Fly worker config → `CREATOR_SEARCH_WORKER_BASE_URL`, `CREATOR_SEARCH_WORKER_TOKEN` env vars ✓

## Skill Feasibility (RED TEAM)

- Critical skill check:
  - `backend-development` → available
  - `database-schema-designer` → available (as `database-design`)
  - `javascript-typescript` → available
  - `react-dev` → available
  - `browser-automation` → available
  - `playwright-testing` → available
  - `qa-test-planner` → available
  - `context7-docs` → available
  - `requirements-clarity` → available
  - `frontend-design` → available (useful for 14e jobs tray UI)
  - `code-refactoring` → available (useful for 14c async refactor)
- Missing but required:
  - `find-local-skills` / `find-skills` → not invokable in this env; fallback: use session skill catalog (already done above)

## RED TEAM Findings (Gaps / Weak Spots)

### Highest-risk failure modes

1. **avgViews scraping is net-new and decoupled from validation** → **RESOLVED**: The current script only extracts follower counts. avgViews enrichment (visiting 12 reels per creator) is entirely new Playwright code. **Decision:** Decoupled — validator only checks profile existence + followerCount (one page load). avgViews enrichment runs as a separate Inngest job (`creator-validation/enrichment-requested`) after validation completes. avgViews=null is acceptable. Separate timeout budget: `MAX_REEL_SCRAPE_MS = 5000` per reel, `MAX_ENRICHMENT_TIME_MS = 300000` (5 min) per creator.

2. **Two search architectures must be unified** → Campaign search (`searchCreatorsForCampaign` in `lib/workers/creator-search.ts`) is a synchronous 927-line pipeline (Collabstr dataset → AI scoring → persist → return). Creator search is async via Inngest. 14c says "make both enqueue-only" but doesn't specify which background infrastructure to use. **Fix:** 14c must explicitly decide: (a) convert the campaign search to also use Inngest events, or (b) move both into a shared worker function called from Inngest. The Fly worker for AI scoring must remain but be called FROM the Inngest function, not from the API route.

3. **Phase 13's apify double-fire guard may be lost during async refactor** → Commit `d8e53f1` added guards against duplicate Inngest job firing and threshold-aware borderline scoring. 14c's async refactor must preserve these guards. **Fix:** 14c must explicitly list Phase 13 behaviors to preserve: (a) apify double-fire guard, (b) borderline scoring with `BORDERLINE_WINDOW`, (c) approval mode branching (recommend vs auto), (d) InterventionCase creation for borderline creators, (e) credit debit flow.

### Missing or ambiguous requirements

4. **Cache staleness threshold undefined** → "Pull valid cached creators first" (14c) doesn't define how fresh a cached creator's validation must be. A creator validated 6 months ago may no longer be valid. **Fix:** Add `CACHE_VALIDITY_HOURS` constraint (suggest 72h default). Cached creators with `lastValidatedAt` older than this threshold are re-validated before reuse.

5. **Data precedence rule missing** → When a creator has an Apify-sourced `followerCount` (from initial discovery) and then gets validated with a different live Instagram count, which value wins? The plan says "reuse `followerCount` and `avgViews` as the validated values shown in UI" implying overwrite. **Fix:** Make explicit: "After validation, `Creator.followerCount` is overwritten with the live Instagram value. The Apify-sourced count is only used for initial discovery filtering before validation."

6. **Job-list API route missing from 14a contract** → 14e needs a global jobs tray that lists active/recent discovery jobs, but 14a's route payload updates don't define a `GET /api/creators/search/jobs` route. **Fix:** Add to 14a contract: `GET /api/creators/search/jobs` returns `{ jobs: [{ jobId, status, requestedCount, validatedCount, invalidCount, progressPercent, etaSeconds, startedAt, finishedAt, campaignId? }] }` filtered by brandId.

7. **Credit model for validation unclear** → Current search debits credits for AI fit scoring (`CREDIT_COSTS.ai_fit_score`). Does Instagram validation (Playwright scraping) also cost credits? If validation happens on every import and every discovery result, costs could increase significantly. **Fix:** Decide in 14a whether validation is a credit-consuming operation or an infrastructure cost. Current assumption: validation is infrastructure (no credit debit), but document this explicitly.

### Repo mismatches (fix the plan)

8. **Context section partially inaccurate** → "POST /api/campaigns/[campaignId]/search still performs the full search synchronously after creating a job record" — partially right. It creates the job record inline (not before), runs the full pipeline synchronously, then returns 202 with `status: "complete"`. The route does NOT "create a job record then search" — it searches and creates the job record as part of the search. **Impact:** Low, but the executing agent should understand the actual flow. The campaign route generates a UUID jobId inline, creates the job record with `status: "running"`, does all work, then updates to `status: "completed"`.

9. **Missing existing search result fields** → `CreatorSearchResult` already has `engagementRate`, `fitScore`, `fitReasoning` — these don't need to be added. 14a should only add the validation-specific fields (`validationStatus`, `validationError`, `validatedFollowerCount`, `validatedAvgViews`).

### Performance / timeouts

10. **No per-creator validation timeout** → Crawlee/Playwright page loads can hang on Instagram (login walls, challenges, slow CDN). **Fix:** Add `VALIDATION_TIMEOUT_MS = 120000` (2 min) per creator, `MAX_REEL_SCRAPE_MS = 5000` per reel. If followerCount extraction fails, mark as `invalid` with error `timeout`. If avgViews reel scraping fails, set `avgViews = null` (non-fatal).

11. **No batch validation budget** → A discovery job requesting 50 valid creators with 3x ceiling = 150 candidates to validate. At 2 min each worst case, that's 5 hours. **Fix:** Add `MAX_VALIDATION_BATCH_TIME_MS = 1800000` (30 min). If the batch times out, complete as `completed_with_shortfall` with whatever valid creators were found.

12. **Instagram blocking mid-batch** → **MITIGATED** by proxy setup + Crawlee anti-detection. Strategy: (a) Crawlee session pool with `useFingerprints: true`, `persistCookiesPerSession: true`, (b) session rotation after 5-8 profiles per session (`maxAgeSecs: 300`), (c) adaptive delays (base 600-1800ms, increase 2x on block, decrease to base on success), (d) referer header `https://www.instagram.com/`, (e) proxy rotation via `CRAWLEE_PROXY_URLS`. Circuit breaker remains: 5 consecutive blocks → pause 5 min, rotate session/proxy, retry. 3 pause cycles → `completed_with_shortfall`.

### Security / permissions

13. **Validation routes must enforce brand scoping** → All job queries and creator modifications must be scoped to the authenticated user's brand. The existing search routes already do this via `brandMembership` lookup. **Fix:** Ensure the new job-list route (`GET /api/creators/search/jobs`) also enforces brand scoping.

### Testing / validation

14. **No integration test for the top-up loop** → The cache-first → fresh search → validate → top-up loop is the core behavior change. **Fix:** 14e must include a test that: (a) seeds 3 valid cached creators, (b) requests 5, (c) verifies 3 come from cache and 2 from fresh search, (d) verifies all 5 are validated, (e) verifies valid overflow is retained.

15. **No test for shortfall completion** → **Fix:** 14e must include a test that: (a) requests 10 creators, (b) only 4 valid exist after 3x ceiling, (c) job completes as `completed_with_shortfall` with `validatedCount=4`.

### Multi-agent coordination

16. **Phase 13 code is the baseline** → Phase 13 is complete (committed). No uncommitted changes from other agents. Only `docs/planning/phase-14/` is untracked. No active concurrent work detected.

17. **File overlap with Phase 13** → Phase 14 will modify files last touched by Phase 13:
    - `apps/web/scripts/refresh-instagram-followers.ts` (14b will refactor into shared validator)
    - `apps/web/lib/workers/creator-search.ts` (14c will make async)
    - `apps/web/app/api/campaigns/[campaignId]/search/route.ts` (14c will make enqueue-only)
    - `apps/web/app/api/creators/import/route.ts` (14d will add validation)
    - Coordination: Phase 13 is committed and stable. Read current file state before modifying.

## Assumptions (Agent)

- `CreatorSearchJob.status` is a String field, not a Prisma enum — adding `completed_with_shortfall` requires no enum migration, just using the string value. (confidence ~95%)
  - Mitigation: Verified in schema at line 559: `status String @default("pending") // pending | running | completed | failed | paused`
- Validation is an infrastructure cost, not a credit-consuming operation — operators should not be charged credits for checking if creators are real. (confidence ~85%)
  - Mitigation: If this is wrong, add `CREDIT_COSTS.instagram_validation` and debit in the validator.
- avgViews scraping can be decoupled from the validity check — validate followerCount first (fast), then optionally enrich avgViews as a secondary pass. (confidence ~92%)
  - Mitigation: This matches the plan's rule that avgViews is non-fatal. If the product team wants avgViews gated, change the validator to block on it.
- The Fly worker for AI fit scoring remains separate from the Instagram validator — the validator checks if a creator is real/valid, the worker scores brand fit. These are different concerns. (confidence ~95%)
  - Mitigation: If the product team wants fit scoring integrated into validation, the validator interface expands.
- 72-hour cache validity default is reasonable — re-validate cached creators whose `lastValidatedAt` is older than 72h. (confidence ~80%)
  - Mitigation: Make this configurable via env var `CACHE_VALIDITY_HOURS`.
- Crawlee anti-detection (session pool, fingerprints, cookie persistence) is sufficient for Instagram stealth when combined with proxy rotation. (confidence ~90%)
  - Mitigation: If detection rate is still high, add playwright-extra stealth plugin or switch to residential proxy provider with built-in fingerprinting.
- Proxy provider setup is a configuration step, not a development step — requires env var `CRAWLEE_PROXY_URLS` and a subscription to a residential proxy service. (confidence ~95%)
  - Mitigation: If proxy setup is more complex, add a dedicated 14b-pre step for infrastructure configuration.

## Phase Summary (running)
- 2026-03-09 22:53 EDT — Completed 14a schema/API groundwork for creator validation and job progress, including Prisma fields, shared serializers, and `GET /api/creators/search/jobs`. Campaign discovery remains synchronous until 14c. (files: `apps/web/prisma/schema.prisma`, `apps/web/lib/creator-search/job-payload.ts`, `apps/web/app/api/creators/search/route.ts`, `apps/web/app/api/creators/search/[jobId]/route.ts`, `apps/web/app/api/creators/search/jobs/route.ts`, `apps/web/lib/inngest/functions/apify-creator-search.ts`, `apps/web/lib/inngest/functions/creator-search.ts`, `apps/web/lib/inngest/functions/run-automation.ts`, `apps/web/lib/workers/creator-search.ts`, `apps/web/__tests__/creator-search/job-payload.test.ts`)
- 2026-03-09 22:58 EDT — Completed 14b validator groundwork by promoting the follower-refresh scraper into `apps/web/lib/instagram/validator.ts`, extending HTML parsing for view-count/video-url extraction, and wiring validation metadata persistence into the refresh CLI. (files: `apps/web/lib/instagram/validator.ts`, `apps/web/lib/instagram/profile-html.ts`, `apps/web/scripts/refresh-instagram-followers.ts`, `apps/web/__tests__/instagram/profile-html.test.ts`)
- 2026-03-09 23:08 EDT — Partially completed 14c/14d by moving campaign discovery onto background jobs, validating both campaign and Apify discoveries before persistence, validating manual imports and inline campaign adds, and hiding invalid creators from the default creators surfaces. Cache-first reuse, invalid queue cleanup, and the jobs-tray UX remain open. (files: `apps/web/app/api/campaigns/[campaignId]/search/route.ts`, `apps/web/lib/inngest/functions/creator-search.ts`, `apps/web/lib/inngest/functions/apify-creator-search.ts`, `apps/web/lib/workers/creator-search.ts`, `apps/web/app/(platform)/campaigns/[campaignId]/discover/page.tsx`, `apps/web/app/(platform)/campaigns/[campaignId]/_components/TriggerSearchButton.tsx`, `apps/web/app/api/creators/import/route.ts`, `apps/web/app/api/campaigns/[campaignId]/creators/route.ts`, `apps/web/app/api/creators/route.ts`, `apps/web/app/(platform)/creators/import/page.tsx`, `apps/web/app/(platform)/creators/page.tsx`, `apps/web/package.json`, `apps/web/package-lock.json`)
- 2026-03-10 00:00 EDT — Closed the remaining 14c/14d/14e gaps by switching the unified discovery executor to cache-first validated candidates, persisting valid overflow without attaching it, adding the global jobs tray and local creators-page background job banner, shipping the nightly cleanup + manual validation sweep entrypoint, and wiring avg-view enrichment as a background follow-up event. (files: `apps/web/lib/creator-search/orchestrator.ts`, `apps/web/lib/inngest/functions/creator-search.ts`, `apps/web/lib/creators/validation-policy.ts`, `apps/web/lib/creators/validation-ops.ts`, `apps/web/lib/creators/validation-sweep.ts`, `apps/web/lib/inngest/functions/creator-validation-cleanup.ts`, `apps/web/lib/inngest/functions/creator-avg-views-enrichment.ts`, `apps/web/components/creator-search-jobs-tray.tsx`, `apps/web/app/(platform)/layout.tsx`, `apps/web/app/(platform)/creators/page.tsx`, `apps/web/app/(platform)/campaigns/[campaignId]/discover/page.tsx`, `apps/web/app/(platform)/campaigns/[campaignId]/import/page.tsx`, `apps/web/scripts/validate-creators.ts`)

## Open Questions (Need Human Input) — RESOLVED

- [x] **Deployment order:** Strictly sequential 14a → 14b → 14c → 14d → 14e. Handoff sections imply this; confirmed as default.

- [x] **Campaign search validation scope:** YES, all ingress paths validate — including Collabstr-sourced campaign creators. Every creator must pass live Instagram validation before entering creator/campaign lists.

- [x] **Proxy infrastructure:** No proxies available today. Proxy setup (BrightData/Oxylabs residential proxies) will be included as a step in Phase 14. Use Crawlee's built-in anti-detection infrastructure (session pool, fingerprinting, cookie persistence, adaptive delays) combined with proxy rotation to make scraping undetectable. Keep 3x ceiling since proxies will be available.

- [x] **avgViews handling:** Decoupled from validation. Validate followerCount first (one page load per creator). Enrich avgViews as a separate optional background pass via Inngest event `creator-validation/enrichment-requested`. avgViews=null is acceptable.

## Subphase Index
* a — Extend schema and job contracts for validation state, progress, and shortfall tracking
* b — Build the shared Instagram validator for live follower counts and average views
* c — Refactor discovery/search into cache-first background jobs with top-up logic
* d — Apply validation to manual import/add flows and handle saved invalid creators safely
* e — Ship the global jobs tray, non-blocking discovery UX, and full verification coverage
