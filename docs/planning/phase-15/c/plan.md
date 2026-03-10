# Phase 15c — Migrate Manual Search, Campaign Search, and Automations onto the Unified Engine

## Focus
Replace the current split discovery entrypoints so `/creators`, campaign discovery, and scheduled automations all execute the same orchestrator and preserve mixed-source metadata correctly.

## Inputs
- Root phase contract: `docs/planning/phase-15/plan.md`
- Outputs from 15a and 15b
- Existing surfaces:
  - `apps/web/app/(platform)/creators/page.tsx`
  - `apps/web/app/api/creators/search/route.ts`
  - `apps/web/app/api/creators/search/[jobId]/route.ts`
  - `apps/web/app/api/campaigns/[campaignId]/search/route.ts`
  - `apps/web/app/api/automations/route.ts`
  - `apps/web/lib/inngest/functions/run-automation.ts`

## Skills Available for This Subphase
- `find-local-skills`: unavailable (index path missing). Fallback: manual skill selection.
- `find-skills`: unavailable (symlink target missing). Fallback: manual skill selection.
- Planned invocations:
  - `javascript-typescript` — available
  - `backend-development` — available
  - `playwright-testing` — available

## Work
1. Replace the Apify-only `/creators` search modal with a unified-source discovery modal:
   - default `collabstr` + `apify_search`
   - optional `approved_seed_following`
   - keywords + canonical categories
   - optional location and threshold filters
2. Convert campaign discovery from synchronous to async:
   - Current: `POST /api/campaigns/[campaignId]/search` calls `searchCreatorsForCampaign()` synchronously (work completes before 202 response)
   - Target: Create `CreatorSearchJob` with `campaignId` field, fire Inngest event to the unified orchestrator, return `{ jobId }` immediately
   - Add `GET /api/campaigns/[campaignId]/search/[jobId]` polling endpoint (same pattern as `/api/creators/search/[jobId]`)
   - The `searchCreatorsForCampaign()` function in `apps/web/lib/workers/creator-search.ts` becomes the orchestrator's Collabstr lane logic, not the entrypoint
3. Migrate automation configs to unified query:
   - Current: `run-automation.ts` stores `config.categories: { apify: string[], collabstr: string[] }` and derives a single hashtag via `toHashtag(config.categories?.apify?.[0])`
   - Target: `config` contains a full `UnifiedDiscoveryQuery` (sources, keywords, canonicalCategories, limit, filters)
   - **LOCKED — Search actor replacement**: `config.hashtag` → `config.search` + `config.searchType` mapping for the `apify~instagram-search-scraper` (replaces `apify/instagram-hashtag-scraper`)
   - Migration: write a one-time backfill script that converts existing automation configs to the unified shape
   - Backward-compat adapter: if an automation config still has old-shape `categories`, convert it on-the-fly at run time during a transition period
4. Remove backend execution drift:
   - no more grouped categories stored but ignored
   - no more automation runs that always dispatch only Apify
5. Update poll/list result payloads so mixed-source results expose:
   - source badges
   - provenance-ready IDs
   - canonical category
   - raw source category
   - email and avg views when available
6. Update import behavior so search-result import no longer hardcodes `discoverySource: "apify"`.
7. Remove or consolidate the dual Inngest listener pattern:
   - Delete or refactor `apps/web/lib/inngest/functions/apify-creator-search.ts` — its logic moves into the orchestrator's Apify lane
   - Delete or refactor `apps/web/lib/inngest/functions/creator-search.ts` — its logic moves into the orchestrator's Collabstr lane
   - The unified orchestrator becomes the ONLY handler for discovery events
8. Update the `POST /api/creators/search` route to accept `UnifiedDiscoveryQuery` (sources, keywords, categories) instead of the current `{ searchMode, hashtag, usernames, limit, platform }` shape. The unified query uses `apify~instagram-search-scraper` under the hood (**LOCKED**: replaces the deprecated hashtag scraper).

## Validation (RED TEAM)

- Campaign search returns `{ jobId }` immediately and completes in the background (no more synchronous blocking)
- `GET /api/creators/search/[jobId]` and `GET /api/campaigns/[campaignId]/search/[jobId]` both return correct progress/results
- Existing automations with old-shape configs still execute correctly during transition (backward-compat adapter works)
- The dual Inngest listener functions are removed or consolidated — only the unified orchestrator handles `"creator-search/requested"`
- Import from search results correctly sets `discoverySource` based on the source lane, not hardcoded `"apify"`
- Source badges render correctly in the UI for mixed-source result lists

## Output
All discovery-facing product entrypoints use the same runtime contract and source selection behaves the same in UI and execution.

## Handoff
Phase 15d adds the approved-seed graph-traversal lane and the supplemental keyword-email lane on top of the now-unified product/runtime entrypoints.

## Assumptions / Open Questions (RED TEAM)

- Assumption: The campaign search polling endpoint reuses the same `CreatorSearchJob` model and status flow as `/creators` search (confidence ~95%).
- Assumption: Old automation configs are migrated via a one-time backfill script, with a runtime adapter as fallback during transition (confidence ~85%).
- **LOCKED**: `/api/creators/search` keeps a backward-compat adapter for the old `{ searchMode, hashtag, usernames }` request body while also accepting the unified query shape directly.

## Progress This Turn (Terminus Maximus)
- Work done:
  - Removed the competing Apify listener from `apps/web/app/api/inngest/route.ts`; only `handleCreatorSearch` is now registered for `"creator-search/requested"`.
  - Replaced `apps/web/lib/inngest/functions/creator-search.ts` with a unified job runner that:
    - loads the normalized query from `CreatorSearchJob.query`
    - calls `orchestrateUnifiedDiscovery()`
    - persists `CreatorSearchResult` rows with source metadata
    - attaches campaign-bound candidates to the review queue
  - Added `GET /api/campaigns/[campaignId]/search/[jobId]` polling.
  - Updated creator search, campaign search, and automation dispatch to send the unified query payload.
  - Patched `/creators` import selection to use `primarySource/source` instead of hardcoding `"apify"`.
  - Merged the overlapping `/creators` discovery modal onto the unified query shape:
    - grouped category picker
    - source toggles
    - keywords + location + follower-range filters
    - mixed-source result badges
  - Simplified the campaign page trigger button to route operators into the dedicated discovery screen instead of maintaining a second partially overlapping query dialog.
  - Rebuilt the campaign discovery page around the unified query shape with category/source selection and background job polling.
  - Adopted the overlapping validation/job infrastructure that committed discovery code already depended on:
    - `apps/web/lib/instagram/validator.ts`
    - `apps/web/app/api/creators/search/jobs/route.ts`
    - validation-aware creator import/add/list flows
- Commands run:
  - `npx vitest run __tests__/creator-search/*.test.ts __tests__/instagram/profile-html.test.ts` — pass (21 tests)
  - `npx eslint <15c + validation files>` — pass with one `@next/next/no-img-element` warning in `apps/web/app/(platform)/creators/page.tsx`
  - `set -a && source ../../.env.local && source .env.local && npm run build` — pass
- Blockers:
  - Campaign/manual search are now unified at the backend job layer, but fit scoring is still stronger in the legacy `lib/workers/creator-search.ts` path than in the new orchestrator ranking.
  - The validation infrastructure and jobs route are currently only in the working tree; they need to be committed so the repo remains buildable from git state alone.
- Next concrete steps:
  - Commit the merged UI/runtime + validation infrastructure checkpoint.
  - Move shared fit scoring out of `lib/workers/creator-search.ts` so the orchestrator produces one ranking surface for all sources.
  - Add the automation backfill script promised in this subphase for older configs without `config.query`.
