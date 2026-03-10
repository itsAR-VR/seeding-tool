# Phase 14b — Build the Shared Instagram Validator

## Focus
Create one reusable Instagram preflight validator that confirms creator existence and derives validated `followerCount` and `avgViews` from live Instagram pages.

## Inputs
- Root phase contract: `docs/planning/phase-14/plan.md`
- Output from 14a: schema/contract additions for validation state and validated metrics
- Existing script baseline: `apps/web/scripts/refresh-instagram-followers.ts`

## Skills Available for This Subphase
- `find-local-skills` output: unavailable in this session; fallback is manual local-skill selection.
- `find-skills` output: unavailable in this session; fallback is installed-skill-only planning.
- Planned invocations:
  - `browser-automation`
  - `backend-development`
  - `javascript-typescript`
  - `context7-docs`

## Work
1. Promote the current follower refresh logic into a shared validator service used by jobs and imports.
2. Validator behavior:
   - resolve the Instagram profile page
   - extract live `followerCount`
   - visit the latest 12 reels/video posts and compute `avgViews`
   - classify creators as `valid` or `invalid`
3. Validity rules:
   - valid only if profile resolves, handle exists, `followerCount > 0`, and `followerCount` is inside the active follower-range filter
   - `avgViews` may be `null` and must not invalidate a creator
4. Anti-blocking defaults:
   - low concurrency
   - session pool
   - cookie persistence
   - browser fingerprints
   - optional proxy support via env
5. Failure classification:
   - missing profile / moved handle
   - blocked / login wall
   - zero followers
   - out_of_range
   - no recent video posts (non-fatal; `avgViews = null`)

## RED TEAM Refinements

### avgViews Decoupling (user-confirmed decision)
- Validator only extracts: profile existence, handle validity, followerCount (one page load per creator)
- avgViews enrichment is a SEPARATE Inngest job:
  - Triggered after validation completes via event `creator-validation/enrichment-requested`
  - Visits latest 12 reels/video posts, computes average views
  - Updates `Creator.avgViews` when done
  - Failure → `avgViews = null` (non-fatal, no retry needed)
  - Separate timeout budget: `MAX_REEL_SCRAPE_MS = 5000` per reel, `MAX_ENRICHMENT_TIME_MS = 300000` (5 min) per creator
- Work item 2 above ("visit the latest 12 reels/video posts") moves to the enrichment job, NOT the validator

### Crawlee Anti-Detection Hardening
Reuse existing patterns from `apps/web/scripts/refresh-instagram-followers.ts` and add:
- `useSessionPool: true` + `persistCookiesPerSession: true` (already in existing script)
- `useFingerprints: true` — Crawlee v3.16 randomized browser fingerprints (already in existing script)
- `ProxyConfiguration` with `CRAWLEE_PROXY_URLS` env var (already in existing script)
- **NEW:** Session rotation: `maxAgeSecs: 300` (5 min), rotate after 5-8 profile requests per session
- **NEW:** Adaptive delays: base 600-1800ms, increase 2x on blocked response, decrease to base on success
- **NEW:** Referer header: `https://www.instagram.com/` to simulate click-through navigation
- **NEW:** User-Agent rotation via Crawlee's fingerprint generator
- **NEW:** Circuit breaker: 5 consecutive blocks → pause 5 min, rotate session/proxy, retry. 3 pause cycles → complete as `completed_with_shortfall`
- Mark sessions bad via `session.markBad()` on block detection (already in existing script)

### Proxy Setup Step
- Document required env var: `CRAWLEE_PROXY_URLS` (comma-separated list of residential proxy URLs)
- If `CRAWLEE_PROXY_URLS` is not set, log warning and proceed with direct connections (limited to ~20-30 creators before blocking)
- Recommend residential proxy provider (BrightData, Oxylabs) for Instagram scraping

### Performance Budgets
- `VALIDATION_TIMEOUT_MS = 120000` (2 min) per creator for followerCount extraction
- If followerCount extraction fails → mark as `invalid` with error `timeout`
- `MAX_VALIDATION_BATCH_TIME_MS = 1800000` (30 min) total batch budget
- If batch times out → complete as `completed_with_shortfall`

### Existing Code to Reuse
- `extractInstagramFollowerCountFromHtml()` from `apps/web/lib/instagram/profile-html.ts`
- `isInstagramProfileBlocked()` from `apps/web/lib/instagram/profile-html.ts`
- `sanitizeFollowerCount()` from `apps/web/lib/creators/follower-count.ts`
- PlaywrightCrawler + ProxyConfiguration pattern from `apps/web/scripts/refresh-instagram-followers.ts`

## Validation (RED TEAM)
- `cd apps/web && npx vitest run __tests__/instagram/profile-html.test.ts __tests__/creator-search/job-payload.test.ts`
- `cd apps/web && npx tsc -p tsconfig.json --noEmit`
- `cd apps/web && npm run lint -- 'lib/instagram/profile-html.ts' 'lib/instagram/validator.ts' 'scripts/refresh-instagram-followers.ts' '__tests__/instagram/profile-html.test.ts' '__tests__/creator-search/job-payload.test.ts'`

## Output
- `apps/web/lib/instagram/validator.ts` now provides a reusable Crawlee-backed validator with session pooling, cookie persistence, fingerprints, optional proxy rotation, follower-range checks, and optional `avgViews` enrichment for the latest 12 video posts.
- `apps/web/lib/instagram/profile-html.ts` now extracts video permalinks, post view counts, and missing-profile signals in addition to follower counts and block detection.
- `apps/web/scripts/refresh-instagram-followers.ts` now calls the shared validator and persists creator validation state (`validationStatus`, `lastValidatedAt`, `lastValidationError`) plus optional avg-view metrics.

## Handoff
14c should call the shared validator instead of re-implementing Instagram scraping inside the campaign or Apify search pipelines. The shared validator now exposes the exact error codes and metrics the background-job refactor needs.

## Progress This Turn (Terminus Maximus)
- Work done:
  - Added `apps/web/lib/instagram/validator.ts` as the shared validation service.
  - Refactored the follower-refresh script to call the shared validator and persist validation metadata.
  - Extended the HTML parser to detect missing Instagram profiles, recent video URLs, and per-post view counts.
  - Added parser coverage for follower counts, view counts, video URL extraction, and missing-profile detection.
- Commands run:
  - `cd apps/web && npx vitest run __tests__/instagram/profile-html.test.ts __tests__/creator-search/job-payload.test.ts` — pass (12 tests)
  - `cd apps/web && npx tsc -p tsconfig.json --noEmit` — pass
  - `cd apps/web && npm run lint -- 'lib/instagram/profile-html.ts' 'lib/instagram/validator.ts' 'scripts/refresh-instagram-followers.ts' '__tests__/instagram/profile-html.test.ts' '__tests__/creator-search/job-payload.test.ts'` — pass with existing repo warnings only
- Blockers:
  - None for 14b.
- Next concrete steps:
  - Convert the synchronous campaign discovery path into a true queued Inngest job that reuses `validateInstagramCreators`.
  - Preserve the existing Phase 13 campaign-search scoring/approval behavior while moving execution off the request thread.
