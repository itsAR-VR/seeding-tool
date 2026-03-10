# Phase 15b — Build the Multi-Lane Orchestrator and Normalized Candidate Pipeline

## Focus
Implement one reusable discovery orchestrator that runs the enabled lanes in parallel, normalizes candidates to handle-level records, enriches them, classifies categories, scores fit, and trims to the requested global limit.

## Inputs
- Root phase contract: `docs/planning/phase-15/plan.md`
- Output from 15a: unified query contract, provenance schema, typed actor clients
- Existing search/scoring surfaces:
  - `apps/web/lib/workers/creator-search.ts`
  - `apps/web/lib/apify/client.ts`
  - `apps/web/lib/brands/icp.ts`
  - current AI fit-scoring and approval-mode logic
- Collabstr data source: **LOCKED** as DB-backed query from the `Creator` table (`discoverySource: "collabstr"`). The Collabstr lane queries `prisma.creator.findMany({ where: { discoverySource: "collabstr", ... } })` instead of reading `scripts/collabstr-influencers.jsonl` from disk.

## Skills Available for This Subphase
- `find-local-skills`: unavailable (index path missing). Fallback: manual skill selection.
- `find-skills`: unavailable (symlink target missing). Fallback: manual skill selection.
- Planned invocations:
  - `backend-development` — available
  - `llm-application-dev` — available
  - `javascript-typescript` — available

## Work
1. Build the orchestrator entrypoint that accepts `UnifiedDiscoveryQuery` and brand/campaign context.
2. Implement lane execution for:
   - `collabstr` — DB query from Creator table (`discoverySource: "collabstr"`)
   - `apify_search` — uses `apify~instagram-search-scraper` (**LOCKED**: replaces deprecated `apify/instagram-hashtag-scraper`)
   - `profile_enrichment`
   - `approved_seed_following`
   - `apify_keyword_email` — uses `scraper-mind~instagram-email-scraper` (coexists with `express_jet/instagram-email-finder` for per-handle enrichment)
3. Normalize all candidates to a handle-level record keyed by normalized Instagram handle.
4. Deduplicate before final limit trimming.
5. Implement Collabstr classification:
   - rule-first mapping from `niche`, `bio`, `name`, and `profileDump`
   - structured-model fallback only when rule mapping is weak
   - preserve both canonical category and raw source label
6. Apply shared filters after enrichment:
   - follower range
   - avg views threshold when configured
   - category requirement when configured
   - exclude-existing creator logic
7. Apply fit scoring after normalization and enrichment so all sources compete on the same final ranking surface.
8. Define ranking priorities:
   - fit score first
   - query relevance second
   - multi-source agreement third
   - profile completeness and email presence as secondary tie-breakers
9. Explicitly deprecate the dual Inngest listener pattern:
   - Current: `apify-creator-search.ts` + `creator-search.ts` both listen on `"creator-search/requested"` with runtime guards
   - Target: the orchestrator is the SINGLE entrypoint; individual lane runners are called directly, not via competing event listeners
10. Define per-lane timeout budgets:
    - `collabstr`: 5s (DB query — **LOCKED** as DB-backed, not file scan)
    - `apify_search`: 120s (Apify actor run)
    - `profile_enrichment`: 180s (batch profile scraper)
    - `approved_seed_following`: 180s (following scraper + profile enrichment per seed)
    - `apify_keyword_email`: 120s (email scraper actor run)
11. Define Apify compute budget ceiling per discovery run to prevent cost spikes when multiple lanes run in parallel.
12. Handle deduplication edge case: same handle returned by multiple sources with conflicting data (e.g., different follower counts). Define merge priority: most-recent profile scrape wins for metrics, all sources preserved in provenance.

## Validation (RED TEAM)

- Orchestrator accepts `UnifiedDiscoveryQuery` and returns a typed candidate list
- Deduplication by normalized Instagram handle produces correct merge (test with overlapping Collabstr + Apify results)
- Per-lane timeout aborts gracefully without crashing the orchestrator or losing results from other lanes
- Collabstr classification rule-first mapping covers at least 80% of the existing Collabstr dataset without LLM fallback
- Fit scoring produces identical rankings regardless of source (test: same creator discovered via two sources should have same final fit score)
- The dual Inngest listener pattern is documented as deprecated, with a concrete removal plan for 15c

## Output
A single discovery engine that can return one merged, ranked, deduped candidate list from multiple enabled sources.

## Handoff
Phase 15c migrates all product entrypoints and surfaces to this orchestrator so the UI matches the new runtime behavior.

## Assumptions / Open Questions (RED TEAM)

- Assumption: The orchestrator runs as a single Inngest step function (not multiple chained events) to avoid the dual-listener collision pattern (confidence ~85%).
- Assumption: All Apify actor calls use the async `runs` endpoint + polling, NOT the sync `run-sync-get-dataset-items` endpoint, to avoid HTTP timeouts (confidence ~90%).
- Assumption: Profile enrichment (Apify profile scraper) is a shared step that runs AFTER lane-specific discovery, not within each lane (confidence ~85%). This avoids duplicate profile scraper calls for the same handle found in multiple lanes.

## Progress This Turn (Terminus Maximus)
- Work done:
  - Added rule-first canonical classification in `apps/web/lib/creator-search/classification.ts`.
  - Added reusable candidate merge logic in `apps/web/lib/creator-search/candidate-merge.ts`.
  - Added `apps/web/lib/creator-search/orchestrator.ts` plus `orchestrator-types.ts` with working collection/merge/filter flow for:
    - `collabstr`
    - `apify_search`
    - `approved_seed_following`
    - `apify_keyword_email`
    - shared profile enrichment
  - Added focused tests for classification + merge behavior.
- Commands run:
  - `npx vitest run __tests__/creator-search/*.test.ts` — pass (13 tests after 15b additions)
  - `npx eslint <15b files>` — pass
- Blockers:
  - None for the orchestrator module itself.
  - Live entrypoints still run the old route/worker paths; 15c must wire them to the orchestrator before Phase 15 can claim unified execution behavior.
  - Fit scoring is still sourced from the legacy campaign worker path. The 15b orchestrator currently ranks by relevance/completeness rather than the final shared AI fit score.
- Next concrete steps:
  - Move shared fit scoring out of `apps/web/lib/workers/creator-search.ts` so the orchestrator can score all lanes consistently.
  - Replace the dual Inngest listener path with one orchestrator-backed execution path.
  - Wire `/creators`, campaign search, and automations to the orchestrator in 15c.
