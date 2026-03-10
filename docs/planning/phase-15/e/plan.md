# Phase 15e — Backfill, QA, Rollout, and Phase-Overlap Cutover Rules

## Focus
Verify the unified discovery system end to end, backfill canonical category/provenance gaps on existing data where needed, and make Phase 15 the explicit canonical planning track for discovery work.

## Inputs
- Root phase contract: `docs/planning/phase-15/plan.md`
- Outputs from 15a through 15d
- Existing data surfaces:
  - current creator rows
  - current search jobs and search results
  - existing Collabstr-derived creator data
  - current grouped-category automation configs from Phase 13
- Overlapping planning context:
  - `docs/planning/phase-14/*`

## Skills Available for This Subphase
- `find-local-skills`: unavailable (index path missing). Fallback: manual skill selection.
- `find-skills`: unavailable (symlink target missing). Fallback: manual skill selection.
- Planned invocations:
  - `qa-test-planner` — available
  - `playwright-testing` — available
  - `skill-oracle` — available (but may not add value beyond manual skill selection in this environment)

## Work
1. Define backfill scope for existing creators:
   - canonical category assignment where only source-native category exists
   - provenance rows for known historical sources where reconstructable
2. Define verification coverage with specific test strategies:
   - `collabstr` only — seed the `Creator` table with `discoverySource: "collabstr"` test fixtures, verify DB query returns candidates with `primarySource: "collabstr"` and correct canonical category (**LOCKED**: DB-backed, not file-based)
   - `apify_search` only — mock `apify~instagram-search-scraper` actor response (**LOCKED**: replaces deprecated `apify/instagram-hashtag-scraper`), verify candidates are returned with `primarySource: "apify_search"` and handle normalization
   - both sources on — verify cross-source deduplication by normalized handle, verify global limit is respected after merge, verify provenance records both sources
   - approved-seed following enabled — verify seed pool query uses `CampaignCreator.reviewStatus = "approved"` scoped to campaign (**LOCKED**: CampaignCreator-approved definition), verify depth-1 only, verify private accounts are skipped, verify dedup against other lanes
   - keyword-email enrichment enabled — verify emails are attached only after profile enrichment, verify email-only results don't bypass scoring
   - import preserving provenance — verify `Creator.discoverySource` is set correctly, verify provenance rows are created, verify `CreatorSearchResult.source` is set
   - automation execution — verify old-shape config backward compat, verify unified query shape works, verify the orchestrator (not the dual listeners) handles the job
   - regression: verify existing `/creators` search and campaign search still work if no sources are explicitly selected (default both)
3. Define cutover rules:
   - Phase 15 becomes the canonical discovery roadmap
   - Phase 14 remains historical draft context only
   - Phase 13 remains the baseline runtime surface from which implementation starts
4. Add rollout notes and operator-facing checks for source-selection correctness and result provenance visibility.
5. Define automation config migration script:
   - One-time backfill: convert all `Automation.config` blobs from `{ categories: { apify, collabstr } }` to `UnifiedDiscoveryQuery` shape
   - Idempotent: re-running the script on already-migrated configs is a no-op
   - Validation: after migration, all automation configs must pass `UnifiedDiscoveryQuery` schema validation
6. Define Prisma migration strategy:
   - Schema changes from 15a (provenance model, `CreatorSearchJob.campaignId`, `CreatorSearchResult.source`) require `npx prisma db push` or `npx prisma migrate dev`
   - Rollback: document how to revert the schema changes if the phase is abandoned mid-implementation
   - Backfill: existing `CreatorSearchResult` rows get `source: null` (nullable) — no data loss

## Validation (RED TEAM)

- All test scenarios from Work step 2 pass
- Automation config migration script is idempotent (running twice produces same result)
- Prisma schema validates: `npx prisma validate` passes
- Database migration applies cleanly: `npx prisma db push` succeeds on the current database
- No existing test suites regress after the schema changes
- Phase 14 plans are preserved on disk (not deleted or overwritten)

## Output
A verified, cutover-ready planning package that includes explicit test coverage and coordination rules for overlapping discovery phases.

## Handoff
Phase 15 closes when the on-disk plan, subphase package, and rollout notes are ready for execution against the current repo baseline.

## Assumptions / Open Questions (RED TEAM)

- Assumption: Phase 14 remains on disk as historical context and is NOT deleted or merged into Phase 15 (confidence ~95%).
- Assumption: Backfill of canonical category for existing creators uses the same rule-first + LLM-fallback classification as new discovery (confidence ~90%).
- Assumption: `npx prisma db push` is the migration strategy (not `prisma migrate dev`) since this is a planning/development phase, not production migration (confidence ~80%). Production migration strategy should be documented separately.
