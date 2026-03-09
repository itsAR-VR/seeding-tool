# Phase 13b — Source-Aware Category Catalog and Creator Data Hardening

## Focus
Turn the March 1 workflow material into a canonical, source-aware category catalog and use it to clean up creator discovery/import data surfaces. Apify categories are primary; Collabstr categories are secondary and must remain visibly distinct.

## Inputs
- Root phase contract: `docs/planning/phase-13/plan.md`
- Upstream workflow source-of-truth:
  - `docs/n8n-audit-2026-03-01/workflow-node-audit.md` (nodes #20-22: Category Bio, Parse Category, Category Bio ?)
  - `docs/n8n-audit-2026-03-01/-AC-1-Instagram-Following-PROD-.json`
  - `docs/n8n-audit-2026-03-01/-AC-2-Follow-Up-Seeding-PROD-.json`
  - `docs/n8n-audit-2026-03-01/-AC-Message-System-Draft-.json`
- Existing category/facet surfaces:
  - `apps/web/app/(platform)/creators/page.tsx` — creator list
  - `apps/web/app/(platform)/campaigns/[campaignId]/page.tsx` — campaign detail with creator list
  - `apps/web/app/(platform)/campaigns/[campaignId]/import/page.tsx` — import page
  - onboarding/automation inputs to be updated in 13c
- Existing creator import/search persistence:
  - `apps/web/app/api/creators/search/route.ts` — search initiation
  - `apps/web/app/api/creators/search/[jobId]/route.ts` — job status/results
  - `apps/web/app/api/campaigns/[campaignId]/search/route.ts` — campaign-scoped search
  - `apps/web/app/api/creators/import/route.ts` — import endpoint
  - `apps/web/lib/workers/creator-search.ts` — Fly worker
  - `apps/web/components/instagram-handle-link.tsx` — profile-link renderer (used in 4 pages)
- Prisma models:
  - `Creator` (line 455): has `bioCategory String?`, `followerCount Int?`, `avgViews Int?`
  - `CreatorSearchResult` (line 576): has `followerCount Int?`, `engagementRate Float?`, `profileUrl String?`, `imageUrl String?`, `bio String?` — **missing `bioCategory`**
  - `CreatorSearchJob` (line 555): has `query Json`, `status String`, `brandId String`
- Repo reality rechecked during execution:
  - The March 1 n8n workflow defines a **5-category operator taxonomy** in the `Analyze Bio` prompt: `Beauty`, `Fitness & Workout`, `Food & Drink`, `Home & Garden`, `Fashion` (plus non-selectable `N/A`)
  - The repo does **not** currently contain `scripts/collabstr-influencers.jsonl`, so Collabstr categories cannot be regenerated from committed scrape output in this turn

## Skills Available for This Subphase
- `find-local-skills` output: unavailable in this session; fallback is manual local-skill selection.
- `find-skills` output: unavailable in this session; fallback is installed-skill-only planning.
- Planned invocations:
  - `javascript-typescript`
  - `backend-development`
  - `react-dev`
  - `code-review`
  - `qa-test-planner`

## Work
1. Extract the accepted/used Apify category inputs from the March 1 n8n audit/workflow files:
   - Parse `docs/n8n-audit-2026-03-01/-AC-1-Instagram-Following-PROD-.json` — locate the node configuration that feeds Apify actor task inputs
   - Use the `Analyze Bio` prompt as the canonical operator-facing taxonomy source, not the downstream `Category Bio` gate alone
   - **Important:** Do this extraction once at build time; do NOT parse 3.7MB JSON files at runtime
   - Canonical Apify list for this phase: `Beauty`, `Fitness & Workout`, `Food & Drink`, `Home & Garden`, `Fashion`
2. Create a static category catalog at `apps/web/lib/categories/catalog.ts`:
   - Export `APIFY_CATEGORIES: string[]` — primary operator-facing categories
   - Export `COLLABSTR_CATEGORIES: string[]` — secondary categories derived from committed scrape data when present; otherwise fall back to a documented representative set so the UI still works
   - Export `getGroupedCategories(): { apify: string[], collabstr: string[] }` — convenience function
3. Add `GET /api/categories` at `apps/web/app/api/categories/route.ts`:
   - Returns `{ apify: string[], collabstr: string[] }`
   - Auth-gated (same `getUserBySupabaseId` pattern as other routes)
   - Import from static catalog — no DB query or file parsing
4. Update creator search/import persistence so rich result data is saved when available:
   - `name`, `bio`, `imageUrl`, `profileUrl`, `engagementRate`, `followerCount` — these already exist on `CreatorSearchResult` model
   - `bioCategory` — add `bioCategory String?` to the `CreatorSearchResult` model in `apps/web/prisma/schema.prisma` (after line 586, alongside existing `bio` field). Run `npx prisma db push` or generate a migration (`npx prisma migrate dev --name add_bio_category_to_search_results`). This stores category earlier in the pipeline at search time.
   - Also populate `bioCategory` on the `Creator` model during import (Creator.bioCategory already exists at schema line 473)
   - Verify that the import flow (`apps/web/app/api/creators/import/route.ts`) copies `bioCategory` from `CreatorSearchResult` to `Creator` record
5. Remove user-facing placeholder follower counts. Audit these surfaces:
   - `apps/web/app/(platform)/creators/page.tsx` — render `followerCount ?? "—"`
   - `apps/web/app/(platform)/campaigns/[campaignId]/page.tsx` — same
   - `apps/web/app/(platform)/campaigns/[campaignId]/review/page.tsx` — same
   - `apps/web/app/(platform)/campaigns/[campaignId]/import/page.tsx` — same
6. Keep `InstagramHandleLink` as the only profile-link renderer. Verify all 4 consumer pages use `profileUrl` from persisted data when present, falling back to handle-based URL construction.

## Validation (RED TEAM)
- `GET /api/categories` returns `{ apify: [...], collabstr: [...] }` with non-empty arrays
- Category catalog source file does not import from `docs/n8n-audit-2026-03-01/` at runtime
- Creator list page shows real follower counts or `—`, never fake/placeholder numbers
- `InstagramHandleLink` renders correct links on all 4 consumer pages

## Assumptions / Open Questions (RED TEAM)
- **Assumption:** Because `scripts/collabstr-influencers.jsonl` is absent from the committed repo today, the 13b implementation should ship with a conservative static Collabstr fallback set rather than blocking the grouped-category UI. (confidence ~88%)
  - Why it matters: Without a fallback, the `collabstr` group would be empty even though 13c depends on grouped category selection working end-to-end.
  - Current default: Commit a short representative secondary list now and replace it with regenerated scrape-derived values once the JSONL is restored.

## Output
- Static grouped category catalog at `apps/web/lib/categories/catalog.ts`
  - Apify: `Beauty`, `Fitness & Workout`, `Food & Drink`, `Home & Garden`, `Fashion`
  - Collabstr: conservative fallback secondary set because the committed JSONL dataset is absent
- Auth-gated `GET /api/categories` endpoint at `apps/web/app/api/categories/route.ts`
- `CreatorSearchResult.bioCategory` added to Prisma schema plus on-disk migration `20260309133000_add_creator_search_result_bio_category`
- Rich creator import/search persistence now carries `name`, `bio`, `bioCategory`, `imageUrl`, `profileUrl`, and `engagementRate` where available
- Creator and campaign import surfaces now prefer persisted Instagram profile URLs when present, with follower counts rendered as real values or `—`

## Handoff
13c should consume `GET /api/categories` directly for onboarding and automations. The Apify group is now a stable 5-category source. The Collabstr group is a temporary fallback list and should be treated as secondary until the missing scrape dataset is restored or replaced by a dedicated catalog source.

## Progress This Turn (Terminus Maximus)
- Work done:
  - Re-ran the March 1 n8n audit and tightened the phase docs to match the real source-of-truth: the Apify-side taxonomy is the 5-category `Analyze Bio` classifier, not a large hidden runtime taxonomy.
  - Added `apps/web/lib/categories/catalog.ts` and `apps/web/app/api/categories/route.ts`.
  - Added `bioCategory` to `CreatorSearchResult` in `apps/web/prisma/schema.prisma` and created an on-disk Prisma migration.
  - Extended standalone Apify search, campaign search, poll responses, and bulk import to carry richer creator fields through the current pipeline.
  - Updated the creators table and campaign import surface to use persisted Instagram profile URLs when available.
  - Updated campaign review to show follower counts as a real value or `—`.
- Commands run:
  - `npx tsx -e "import { getGroupedCategories } from './lib/categories/catalog.ts'; ..."` — pass; confirmed non-empty grouped category payload
  - `npm run db:generate` — pass; regenerated Prisma client after schema change
  - `npx eslint ...` on touched 13b files — pass with 1 pre-existing warning in `app/(platform)/creators/page.tsx` for `<img>`
  - `npm run build` — fail after compile/typecheck; current env/runtime blocker is `DATABASE_URL is required` during page-data collection for `/api/auth/gmail/callback`
- Blockers:
  - The committed repo still does not include `scripts/collabstr-influencers.jsonl`, so the Collabstr category group is a documented fallback set instead of scrape-derived values.
  - Full build verification remains gated by environment/runtime behavior in the Gmail callback path.
- Next concrete steps:
  - Start 13c by consuming `/api/categories` in onboarding and automations.
  - Replace capped search/automation volume controls with free-form numeric inputs.
  - Keep the missing Collabstr dataset and Gmail callback build blocker tracked as cross-subphase repo issues.
