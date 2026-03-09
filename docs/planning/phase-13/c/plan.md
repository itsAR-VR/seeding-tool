# Phase 13c — Onboarding and Automation Rework

## Focus
Replace the current onboarding stub with a working discovery-setup flow that creates a live automation using grouped category selection and a free-form daily creator target.

## Inputs
- Root phase contract: `docs/planning/phase-13/plan.md`
- Output from 13b: `apps/web/lib/categories/catalog.ts` and `GET /api/categories`
- Current onboarding flow: `apps/web/app/(platform)/onboarding/page.tsx` (3-step: brand → connect[fake] → done)
- Current automation UI and API:
  - `apps/web/app/(platform)/settings/automations/page.tsx` (range slider min=10 max=100 at line 388)
  - `apps/web/app/api/automations/route.ts` (POST validates schedule, config is JSON blob)
  - `apps/web/app/api/automations/[id]/route.ts` (PATCH/DELETE)
  - `apps/web/lib/inngest/functions/run-automation.ts` (cron every 5 min, `computeNextRunAt` duplicated)
- Current onboarding API: `apps/web/app/api/onboarding/brand/route.ts` (creates Brand + Settings + Membership)
- ICP derivation: `apps/web/lib/brands/icp.ts` (`deriveBrandICP()`, `icpToSearchHints()`)

## Skills Available for This Subphase
- `find-local-skills` output: unavailable in this session; fallback is manual local-skill selection.
- `find-skills` output: unavailable in this session; fallback is installed-skill-only planning.
- Planned invocations:
  - `react-dev`
  - `javascript-typescript`
  - `backend-development`
  - `playwright-testing`
  - `qa-test-planner`

## Work
1. **Extract `computeNextRunAt` to shared module:**
   - Create `apps/web/lib/automations/schedule.ts`
   - Move the duplicated function from both `apps/web/app/api/automations/route.ts:10-24` and `apps/web/lib/inngest/functions/run-automation.ts:7-21`
   - Import in both files
2. **Rework onboarding flow** in `apps/web/app/(platform)/onboarding/page.tsx`:
   - Change from 3 steps (brand → connect → done) to 4 steps: `brand → discovery → connections → done`
   - New `DiscoveryStep` component:
     - Grouped category autocomplete/multi-select fetching from `GET /api/categories` (or importing from `lib/categories/catalog.ts`)
     - Separate `Apify` and `Collabstr` sections with group headers
     - Allow selecting from both groups at once
     - Show source labels clearly in the selection summary
   - Update progress indicator to show 4 steps instead of 3
3. **Add free-form numeric input for daily creator target** in `DiscoveryStep`:
   - Replace the concept of a slider with a `<Input type="number" min={1} step={1} />`
   - Validation contract (client-side):
     - Accept any positive integer
     - Reject zero/negative/non-integer values
     - Show a non-blocking warning when value exceeds `100` (amber text, not blocking)
     - Still allow save
4. **Wire onboarding automation creation** — on DiscoveryStep completion:
   - Call existing `POST /api/automations` directly (do NOT create a separate `/api/onboarding/automation` route — avoids duplicating auth/validation logic)
   - Payload: `{ name: "Discovery – {brandName}", type: "creator_discovery", schedule: "daily", config: { platform: "instagram", limit: dailyTarget, autoImport: true, categories: { apify: [...selected], collabstr: [...selected] }, searchMode: "hashtag", hashtag: derivedKeyword } }`
   - Use `icpToSearchHints()` from `lib/brands/icp.ts` to derive the hashtag/keyword from brand profile
5. **Extend automation config shape** — update the runner to handle categories:
   - In `apps/web/lib/inngest/functions/run-automation.ts`, extend the config type to include `categories?: { apify?: string[], collabstr?: string[] }`
   - **Backward compatibility:** If `config.categories` is absent, fall back to current hashtag/keyword behavior — existing automations must keep working
   - If `config.categories.apify` is set, use the primary Apify category as the actor task input
   - Secondary Collabstr categories are stored for metadata/narrowing but do not change the Apify search query
6. **Update Settings → Automations page** (`apps/web/app/(platform)/settings/automations/page.tsx`):
   - Replace range slider (lines 384-397) with `<Input type="number" min={1} />` for limit/dailyTarget
   - Same validation: warn on >100, always allow save
   - Add grouped category display in automation cards (show selected categories if present)
   - Add grouped category selection to the create modal
7. **Update `POST /api/automations` validation** (`apps/web/app/api/automations/route.ts`):
   - Keep `validSchedules` check for schedule field
   - Do NOT validate `config.limit` server-side beyond ensuring it's a positive integer if present
   - Accept `config.categories` as optional `{ apify?: string[], collabstr?: string[] }`

## Validation (RED TEAM)
- Onboarding shows 4-step flow with correct progress indicator
- DiscoveryStep renders grouped category autocomplete with both sections
- Free-form numeric input accepts 1, 50, 200 (with warning), rejects 0 and -5
- Completing onboarding creates an enabled automation visible in Settings → Automations
- Existing automations without categories continue to run correctly (backward compat)
- `computeNextRunAt` is imported from a single shared module in both files

## Assumptions / Open Questions (RED TEAM)
- **Assumption:** Onboarding calls `POST /api/automations` directly instead of a dedicated onboarding-automation route. (confidence ~90%)
  - Why it matters: Decoupling would allow onboarding-specific defaults, but duplication risk outweighs the benefit for this stabilization phase.
  - Current default: Direct call to existing endpoint.

## Output
- Shared `computeNextRunAt` extracted to `apps/web/lib/automations/schedule.ts` and reused by both automation routes plus the runner
- `apps/web/app/(platform)/onboarding/page.tsx` now runs a 4-step flow: `brand → discovery → connect → done`
- Discovery step fetches `/api/categories`, supports grouped multi-select, validates a free-form positive integer daily target, and creates a `creator_discovery` automation via `POST /api/automations`
- `apps/web/app/(platform)/settings/automations/page.tsx` now uses grouped category selection plus a free-form integer limit instead of the capped range slider
- `apps/web/app/(platform)/creators/page.tsx` search modal now uses the same free-form integer limit behavior
- Automation config handling now supports optional grouped categories plus derived hashtag fallback without breaking existing automations

## Handoff
13d should harden the new onboarding connections handoff and the actual provider surfaces. The connect step now links to `/settings/connections`, but Gmail/Shopify status and sync/error handling still need the deeper work scoped in 13d.

## Progress This Turn (Terminus Maximus)
- Work done:
  - Extracted `computeNextRunAt` into `apps/web/lib/automations/schedule.ts` and imported it into `app/api/automations/route.ts`, `app/api/automations/[id]/route.ts`, and `lib/inngest/functions/run-automation.ts`.
  - Added a reusable grouped category picker component used by both onboarding and settings automations.
  - Rebuilt onboarding into 4 steps with a real discovery step that fetches grouped categories, validates a free-form daily target, and creates a discovery automation.
  - Replaced the fake connect toast with a real handoff button to `/settings/connections`.
  - Reworked the settings automations page to use free-form integer limits, grouped category selection, and category display on saved automations.
  - Replaced the capped creator-search range input in `app/(platform)/creators/page.tsx` with the same positive-integer behavior.
  - Updated automation route/server logic so creator-discovery configs can persist grouped categories and derive a hashtag fallback from brand ICP/category data.
- Commands run:
  - `npx eslint ...` on 13c files — pass with 1 pre-existing warning in `app/(platform)/creators/page.tsx` for `<img>`
  - `npm run build` — fail after compile/typecheck; current env/runtime blocker remains `DATABASE_URL is required` during page-data collection
- Blockers:
  - Full build verification is still blocked by runtime env issues in API route page-data collection, not by 13c type errors.
  - Multi-brand brand-selection assumptions still exist in the broader app; onboarding automation creation currently relies on the existing first-membership tenancy behavior.
- Next concrete steps:
  - Start 13d on Gmail/Shopify connection hardening and approval-prep docs.
  - Keep the current env/runtime build blocker documented until the relevant API routes stop requiring DB access during page-data collection.
