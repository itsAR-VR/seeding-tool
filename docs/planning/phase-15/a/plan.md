# Phase 15a — Lock the Unified Discovery Contract, Provenance Schema, and Typed Actor Clients

## Focus
Define the shared discovery query, result contracts, provenance storage, and typed Apify actor wrappers before changing any runtime discovery behavior.

## Inputs
- Root phase contract: `docs/planning/phase-15/plan.md`
- Current runtime surfaces:
  - `apps/web/app/api/creators/search/route.ts`
  - `apps/web/app/api/campaigns/[campaignId]/search/route.ts`
  - `apps/web/app/api/automations/route.ts`
  - `apps/web/lib/inngest/functions/run-automation.ts`
- Current models:
  - `Creator`
  - `CreatorProfile`
  - `CreatorSearchJob`
  - `CreatorSearchResult`
- Supplied actor APIs from the user:
  - `scraper-mind~instagram-email-scraper`
  - `apify~instagram-search-scraper`
  - `apify~instagram-profile-scraper`
  - `datadoping~instagram-following-scraper`
- Existing email enrichment: `apps/web/lib/enrichment/providers/apify-email.ts` — uses `express_jet/instagram-email-finder` (different from user-supplied `scraper-mind~instagram-email-scraper`)
- Prisma schema: `apps/web/prisma/schema.prisma` — `Creator` (line 457), `CreatorSearchJob` (line 557), `CreatorSearchResult` (line 578)
- CRITICAL: `scripts/collabstr-influencers.jsonl` is gitignored and NOT in the committed repo. The Collabstr data provisioning strategy must be decided in this subphase.

## Skills Available for This Subphase
- `find-local-skills`: unavailable (index path missing). Fallback: manual skill selection.
- `find-skills`: unavailable (symlink target missing). Fallback: manual skill selection.
- Planned invocations:
  - `backend-development` — available
  - `database-design` — available
  - `openapi-to-typescript` — available
  - `requirements-clarity` — available

## Work
1. Define `UnifiedDiscoveryQuery` as the single discovery input shape for:
   - manual creator search
   - campaign creator search
   - scheduled discovery automations
2. Lock the allowed sources:
   - `collabstr`
   - `apify_search`
   - `approved_seed_following`
   - `apify_keyword_email`
3. Define canonical query fields:
   - `sources`
   - `keywords`
   - `canonicalCategories`
   - `platform`
   - `limit`
   - `location`
   - `filters` for follower range, avg views, category requirement, and exclude-existing rules
   - `seedExpansion`
   - `emailPrefetch`
4. Extend result contracts so mixed-source candidates expose:
   - `primarySource`
   - `sources[]`
   - `rawSourceCategory`
   - `canonicalCategory`
   - `email`
   - `avgViews`
   - `seedCreatorId`
   - source metadata required for audit and import
5. Add a provenance model that records every discovery touch for a creator:
   - source
   - external ID
   - search job
   - optional seed creator
   - raw source category
   - canonical category
   - metadata blob
6. Generate or hand-author typed client wrappers for ALL supplied Apify actors:
   - `apify~instagram-search-scraper` — NEW search lane (**LOCKED**: replaces `apify/instagram-hashtag-scraper`; input: `search` string + `searchType: "user"`, NOT `hashtags[]`). The existing `runInstagramHashtagScraper` in `apps/web/lib/apify/client.ts` is deprecated.
   - `apify~instagram-profile-scraper` — already wrapped in `apps/web/lib/apify/client.ts` as `runInstagramProfileScraper`; extend or reuse
   - `datadoping~instagram-following-scraper` — NEW following lane; requires cookie-free input (no-auth scraping)
   - `scraper-mind~instagram-email-scraper` — NEW keyword-email lane; input: `keywords[]`, `maxEmails`, `location`, `engine`
   - Document how `scraper-mind~instagram-email-scraper` (keyword→email discovery) differs from existing `express_jet/instagram-email-finder` (handle→email enrichment) and specify that both coexist
7. Document backward-compat rules:
   - keep `Creator.discoverySource` as the primary-source field for existing filters/UI
   - provenance is additive and becomes the canonical multi-source audit trail
8. Add `campaignId` (nullable) as a first-class field on `CreatorSearchJob` so campaign-triggered jobs are queryable without JSON parsing.
9. Add `source` field to `CreatorSearchResult` to track which lane produced each result.
10. Implement DB-backed Collabstr data provisioning: migrate `scripts/import-collabstr.ts` to write directly to the Creator table with `discoverySource: "collabstr"`. The Collabstr lane queries the DB at search time instead of reading `scripts/collabstr-influencers.jsonl` from disk. **LOCKED**: DB-backed strategy confirmed.

## Validation (RED TEAM)

- `npx prisma validate` passes after schema changes (provenance model, `campaignId`, `source` field)
- All four actor client wrappers compile and their input/output types match the OpenAPI specs in the root plan
- The `UnifiedDiscoveryQuery` type is importable from a shared location by all three entrypoints
- Backward-compat: existing `Creator.discoverySource` field is not renamed or removed
- Document: confirm the email actor disambiguation (keyword-email vs handle-email) is written down

## Output
- Locked shared discovery contract now lives in `apps/web/lib/creator-search/contracts.ts` and is written into all three ingress surfaces:
  - `apps/web/app/api/creators/search/route.ts`
  - `apps/web/app/api/campaigns/[campaignId]/search/route.ts`
  - `apps/web/app/api/automations/route.ts`
- Prisma schema now carries the Phase 15a tracking fields:
  - `CreatorSearchJob.campaignId`
  - `CreatorSearchResult.source`, `primarySource`, `sources`, `email`, `rawSourceCategory`, `seedCreatorId`
  - `CreatorDiscoveryTouch` provenance table
- Typed Apify actor clients now exist in `apps/web/lib/apify/client.ts` for:
  - `apify/instagram-search-scraper`
  - `apify/instagram-profile-scraper`
  - `datadoping/instagram-following-scraper`
  - `scraper-mind/instagram-email-scraper`
  - legacy `apify/instagram-hashtag-scraper` remains as a deprecated compatibility wrapper
- Collabstr provisioning is now DB-backed in practice:
  - `scripts/import-collabstr.ts` writes discovery touches
  - `apps/web/lib/workers/creator-search.ts` reads brand-scoped Collabstr creators from the DB and falls back to JSONL only while backfill/import catch-up continues
- Coordination conflicts documented:
  - This subphase overlapped with existing uncommitted Phase 14-era validation/job-progress work in `schema.prisma`, creator-search routes, Inngest functions, and `creator-search.ts`.
  - The merge preserved those validation fields and layered Phase 15a contract/provenance fields on top instead of reverting or reworking adjacent logic.

## Handoff
Phase 15b should consume the new contract instead of adding new ad hoc query shapes:
- Replace the remaining dual-listener/different-payload search orchestration with one multi-lane orchestrator using `UnifiedDiscoveryQuery`.
- Switch live Apify discovery from the deprecated hashtag actor to `runInstagramSearchScraper()` and add following/email lanes on top of the typed clients added here.
- Start writing canonical category values distinctly from raw source categories; 15a only preserved both fields/contracts, it did not yet normalize them.
- Remove the JSONL fallback from the Collabstr lane once imported DB coverage is confirmed.

## Progress This Turn (Terminus Maximus)
- Work done:
  - Added the shared `UnifiedDiscoveryQuery` contract, canonical category helpers, and legacy-to-unified adapters.
  - Extended Prisma for campaign-aware jobs, source-aware search results, and per-creator discovery provenance.
  - Upgraded the Apify client layer to include typed wrappers for the user-supplied search/profile/following/email actors while keeping the legacy hashtag wrapper deprecated for compatibility.
  - Updated creator search, campaign search, automations, Apify ingestion, Collabstr ingestion, and the Collabstr worker path to populate the new contract/provenance fields.
  - Added focused Vitest coverage for contract normalization, search payload serialization, and Apify mapping helpers.
- Commands run:
  - `git status --short` — pass; confirmed overlapping uncommitted discovery work and preserved it
  - `ls -dt docs/planning/phase-[0-9]* | head -10` — pass; Phase 13 and Phase 14 overlap confirmed for coordination
  - `npm run db:generate` — pass
  - `npx prisma validate` — pass
  - `npx vitest run __tests__/creator-search/*.test.ts` — pass (10 tests)
  - `npx eslint <Phase-15a files>` — pass for app files; repo-root `scripts/import-collabstr.ts` could not be linted from the `apps/web` ESLint base path
  - `set -a && source ../../.env.local && source .env.local && npm run build` — pass; confirmed the required keys live in repo-root `.env.local`, while `apps/web/.env.local` only contains `NEXT_PUBLIC_BOOKING_URL`
- Blockers:
  - None for 15a after sourcing the repo-root `.env.local` into the local build shell.
- Next concrete steps:
  - Begin 15b by replacing the current dual event listeners with a single orchestrator that consumes `UnifiedDiscoveryQuery`.
  - Migrate live Apify search execution to `apify/instagram-search-scraper` and layer following/email enrichment on top.
  - Add canonical category normalization so `rawSourceCategory` and canonical category stop mirroring each other for Collabstr imports and campaign search results.

## Assumptions / Locked Decisions (RED TEAM)

- Assumption: The canonical category taxonomy remains the 5 Apify categories + `Other` (confidence ~90%). If a broader taxonomy is wanted, it changes Work items 3-4 significantly.
- Assumption: `bioCategory` remains the canonical category field name for backward compatibility (confidence ~95%).
- **LOCKED**: Collabstr data is DB-backed — imported into the `Creator` table with `discoverySource: "collabstr"`, queried at search time. No JSONL file at runtime. This drives Work item 10.
- **LOCKED**: `apify~instagram-search-scraper` replaces `apify/instagram-hashtag-scraper` (supports both `searchType: "user"` and `"hashtag"`). Existing automation configs are migrated in 15c with `config.hashtag` → `config.search` + `config.searchType` mapping.
