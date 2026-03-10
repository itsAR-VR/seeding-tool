# Phase 15d — Implement Approved-Seed Following and Supplemental Keyword-Email Enrichment

## Focus
Bring the strongest part of the legacy n8n workflow into the platform by making approved-seed graph traversal a first-class optional lane, then layer supplemental keyword-email enrichment on top of it.

## Inputs
- Root phase contract: `docs/planning/phase-15/plan.md`
- Outputs from 15a through 15c
- User-supplied legacy pipeline summary for `[AC] (1) Instagram Following [PROD]`
- Current platform approval state:
  - approved creators
  - campaign creators with `reviewStatus = approved`

## Skills Available for This Subphase
- `find-local-skills`: unavailable (index path missing). Fallback: manual skill selection.
- `find-skills`: unavailable (symlink target missing). Fallback: manual skill selection.
- Planned invocations:
  - `backend-development` — available
  - `browser-automation` — available (NOTE: used for Crawlee context, not direct Playwright browser automation in this subphase)
  - `llm-application-dev` — available

## Work
1. Define the approved-seed pool:
   - creators already approved by the brand
   - optionally campaign-approved creators when relevant to the requesting campaign
2. Implement depth-1 following traversal using the supplied no-cookie following actor.
3. Set safe defaults:
   - `seedExpansion.enabled = false`
   - `maxSeedsPerRun = 5`
   - `maxFollowingPerSeed = 100`
4. Enrich every followed handle with the profile scraper before classification or scoring.
5. Reuse the same filter and fit-scoring pipeline as all other discovery lanes.
6. Implement keyword-email enrichment as a supplemental lane:
   - run against the same query terms
   - attach emails to matched handles where possible
   - do not allow email-only results to bypass profile enrichment or fit scoring
7. Specify rate limiting and error handling for the following scraper:
   - `datadoping~instagram-following-scraper` is a third-party actor — handle actor failures, timeouts, and rate limits gracefully
   - If a seed account is private or has no followings, skip without failing the entire lane
   - Log per-seed metrics: followings fetched, profiles enriched, candidates passed filters
8. Define how approved-seed pool is queried:
   - **LOCKED**: Approved creators = creators with at least one `CampaignCreator` record where `reviewStatus = "approved"`, scoped to the requesting campaign's context
   - Query: `prisma.campaignCreator.findMany({ where: { campaignId, reviewStatus: "approved" }, include: { creator: true } })`
   - Campaign-scoped: the seed pool is always scoped to the requesting campaign — only that campaign's approved creators are used as seeds
9. Ensure keyword-email results are always profile-enriched before entering the scoring pipeline:
   - `scraper-mind~instagram-email-scraper` returns emails + handles but NOT full profile data
   - Each handle must go through the profile scraper before classification or fit scoring
   - This is an invariant, not optional

## Validation (RED TEAM)

- Approved-seed following with `seedExpansion.enabled = false` (default) produces zero following results (the lane is skipped)
- Approved-seed following with `enabled = true` and `maxSeedsPerRun = 5` processes exactly 5 seeds (or fewer if fewer approved creators exist)
- Private or unavailable seed accounts are skipped without failing the orchestrator
- Keyword-email results without profile enrichment are rejected (never scored or ranked)
- Following-discovered handles are deduped against results from other lanes before profile enrichment (avoid redundant API calls)

## Output
A platform-native graph-traversal discovery lane that replaces the external PhantomBuster dependency for this strategy and shares the same scoring/dedupe logic as the rest of discovery.

## Handoff
Phase 15e verifies the combined system, defines rollout rules, and documents how this phase supersedes the overlapping Phase 14 draft.

## Assumptions / Locked Decisions (RED TEAM)

- **LOCKED**: "Approved creator" = a `Creator` row that has at least one `CampaignCreator` record with `reviewStatus = "approved"`, scoped to the requesting campaign. This is the seed pool definition.
- Assumption: `datadoping~instagram-following-scraper` does not require Instagram cookies/authentication (the plan says "no-cookie following actor") (confidence ~85%). If it does require auth, the entire seed following lane needs a credential management strategy.
- Open question: Is there a cost ceiling for the following scraper? With 5 seeds × 100 followings = 500 handles, each needing profile enrichment, that's 500 Apify profile scraper calls per run (confidence ~70%). Current assumption: the `maxFollowingPerSeed = 100` default is the cost control, but an explicit Apify compute budget should be defined.
