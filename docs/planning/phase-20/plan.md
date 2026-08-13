# Phase 20 — Seeding Decision Engine: Identity Graph, Evidence-Rich Scoring & Portfolio Construction

## Original User Request (verbatim)

Go ahead and use this to tailor your search and make the influencer identification process better. This is what we're looking to do right now, and I'm going to upload a deep research report as well that you can reference. Essentially, what we're doing is we are looking to make the process easier for seeding, and we're looking to obviously make it better. I need you to go ahead and figure out how we can do that. the platform is already pretty good at finding candidates, but it is still too weak at deciding who those candidates really are, how trustworthy they are, and whether they should actually be seeded. In other words, retrieval is ahead of identification. That is the core break in logic.

Here is the cleanest way to think about it:

search / scrape / expand should optimize recall
identity resolution should optimize truth
ranking should optimize fit + quality
seeding should optimize portfolio coverage + execution yield

Right now those layers are too blended together, especially around handle-based collapsing, brittle validation, and shallow scoring.

[Full request continues with 10-point diagnosis covering handle=identity weakness, validation-as-verdict problem, retrieval/ranking entanglement, shallow classification, time-blindness, portfolio vs ranked list, contactability under-modeling, weak feedback loop, implicit source confidence, and compliance risk. User references deep-research-report (1).md throughout.]

Key directive: "your current platform is probably one major architecture layer away from being materially better. The report already identifies that layer correctly: identity graph + evidence-rich scoring + time series + feedback loop. I would treat that as the center of gravity, and I would make seeding a portfolio system rather than a search result page."

## Purpose

Upgrade the seeding tool from a search-and-validate system into a full decision engine. The current pipeline (Phases 14-16) optimizes recall — finding candidates across multiple lanes. Phase 20 adds the missing layers: identity resolution (who is this person, really?), evidence-rich scoring (should they be seeded?), time-series authenticity (can we trust them?), and portfolio construction (does the seed list maximize coverage and execution yield?).

## Context

### Current Architecture (built in Phases 14-16)

The existing pipeline is:

```
API route → Inngest event → Job Runner → Orchestrator (5 parallel lanes) → Candidate Merge → Validation → Persistence
```

**Strengths:**
- 5 discovery lanes run in parallel with per-lane timeouts (collabstr 5s, apify_search 120s, seed_following 180s, keyword_email 120s, profile_enrichment 180s)
- Provenance via CreatorDiscoveryTouch records every source
- Cache-first policy skips re-validation for fresh (<72h) valid creators
- Playwright-based validation extracts real follower counts
- CampaignCreator has two-axis lifecycle: reviewStatus + lifecycleStatus

**Weaknesses identified by user + deep research report:**
1. Identity = normalized Instagram handle — breaks on handle changes, cross-platform creators, agency profiles
2. Validation outcomes are binary (valid/invalid) — "blocked" = false negative, not bad creator
3. Classification is keyword-only across 6 categories — misses multilingual, niche, content-visible fit
4. No time-series data — cannot detect growth velocity, engagement drift, follower injection
5. Source confidence is implicit — Apify search, email scrape, marketplace, official API all treated equally
6. Scoring is shallow relevance (keyword + category + source agreement + completeness)
7. Seeding is top-N by score, not portfolio-optimized for diversity and execution yield
8. No outcome feedback — system doesn't learn from approvals, replies, deliveries
9. Contact model is a single email field, not a confidence-scored contact layer
10. Compliance risk (scraping) sits too close to truth path

### Key Code Locations

| Component | File | LOC |
|---|---|---|
| Prisma schema | `apps/web/prisma/schema.prisma` | 1285 |
| Contracts + query types | `lib/creator-search/contracts.ts` | 365 |
| Orchestrator (5 lanes) | `lib/creator-search/orchestrator.ts` | 655 |
| Job runner pipeline | `lib/creator-search/job-runner.ts` | 600 |
| Classification | `lib/creator-search/classification.ts` | 190 |
| Candidate merge | `lib/creator-search/candidate-merge.ts` | 42 |
| Cache policy | `lib/creator-search/cache-policy.ts` | 39 |
| Provenance | `lib/creator-search/provenance.ts` | 33 |
| Instagram validator | `lib/instagram/validator.ts` | ~250 |
| Apify client | `lib/apify/client.ts` | ~500 |
| Email enrichment | `lib/enrichment/service.ts` | 142 |

### Data Model Summary

- **Creator**: brand-scoped, keyed by `[brandId, instagramHandle]`, has discoverySource, followerCount, avgViews, bioCategory, validationStatus
- **CreatorProfile**: per-platform profiles (instagram, tiktok, youtube, twitter) linked to Creator
- **CreatorSearchJob**: async job with status tracking, query storage, progress counters
- **CreatorSearchResult**: per-job results with source, validation, fitScore
- **CreatorDiscoveryTouch**: provenance records linking creator + source + job
- **CampaignCreator**: campaign linkage with reviewStatus (pending|approved|declined|deferred) + lifecycleStatus (ready → completed)

## Repo Reality Check (RED TEAM)

- What exists today:
  - Core discovery runtime is real and current in `apps/web/lib/creator-search/orchestrator.ts`, `apps/web/lib/creator-search/job-runner.ts`, `apps/web/lib/creator-search/contracts.ts`, `apps/web/lib/creator-search/classification.ts`, `apps/web/lib/creator-search/candidate-merge.ts`, and `apps/web/lib/instagram/validator.ts`.
  - The deep research reference named in the original request exists on disk as `deep-research-report (1).md`.
  - Brand-scoped API authorization patterns already exist throughout `apps/web/app/api/**` using `createClient()`, `getUserBySupabaseId()`, and `BrandMembership` lookups.
  - Fail-closed feature flags already exist in `apps/web/lib/feature-flags.ts`; the plan can use that surface instead of inventing a new rollout mechanism.
  - `apps/web/prisma/schema.prisma` is actively dirty in the current worktree because forecasting-domain work is in progress and creator-search files also have uncommitted changes.
- What the plan assumes:
  - A new global identity layer can coexist with brand-scoped `Creator` records without leaking cross-brand data.
  - Raw payload persistence is acceptable for validation and enrichment traces.
  - Auto-link thresholds, portfolio selection, and calibration can be introduced without a separate feature-flagged shadow phase.
  - The subphase plans are executable as written even though `a`–`f` already contain non-empty `Output` and `Handoff`, which makes them read-only under the RED TEAM skill rules.
- Skills discovered via `find-local-skills`:
  - The documented `/home/podhi/.openclaw/workspace/orchestration/skill-index.json` is not present in this environment, so the check fell back to the local installed skill inventory under `/Users/AR180/.codex/skills`.
  - Immediately available and directly useful here: `phase-gaps`, `backend-coding-agent`, `database-design`, `database-schema-designer`, `code-review`, `context7-docs`, `playwright-testing`, `browse-qa`, `session-handoff`, `skill-oracle`, `find-local-skills`, `find-skills`.
- Skills discovered via `find-skills`:
  - Global search surfaced installable audit-oriented skills such as `darraghh1/my-claude-setup@audit-plan` and `rfxlamia/claude-skillkit@red-teaming`.
  - None were installed during this RED TEAM pass; fallback remains the local skill set above.
- Verified touch points:
  - `apps/web/prisma/schema.prisma`
  - `apps/web/lib/creator-search/contracts.ts`
  - `apps/web/lib/creator-search/orchestrator.ts`
  - `apps/web/lib/creator-search/job-runner.ts`
  - `apps/web/lib/creator-search/classification.ts`
  - `apps/web/lib/creator-search/provenance.ts`
  - `apps/web/lib/instagram/validator.ts`
  - `apps/web/lib/enrichment/service.ts`
  - `apps/web/lib/feature-flags.ts`
- Multi-agent coordination:
  - Last-10-phase scan shows direct overlap with Phases 14-16 (creator-search pipeline), Phase 17 (brand/ICP helpers), Phase 18 (creator import/data quality), Phase 19 (adjacent onboarding), and the active forecasting worktree changes on `apps/web/prisma/schema.prisma`.
  - Continuous skill checks are being used while refining the phase so stale assumptions can be called out immediately.

## Skill Feasibility (RED TEAM)

- Critical skill check:
  - `backend-coding-agent` → available
  - `database-design` / `database-schema-designer` → available
  - `context7-docs` → available
  - `code-review` → available
  - `playwright-testing` / `browse-qa` → available
- Missing but required in the current plan text:
  - `superpowers:test-driven-development`, `superpowers:writing-plans`, `superpowers:executing-plans`, `superpowers:brainstorming`, `superpowers:dispatching-parallel-agents`, `superpowers:verification-before-completion`, `superpowers:requesting-code-review` → missing in this session; fallback is `phase-gaps` + `backend-coding-agent` + `code-review` + targeted Vitest/ESLint/Playwright verification.
  - `vercel:nextjs`, `vercel:workflow`, `vercel:cron-jobs` → not present in this session; fallback is existing repo patterns in `apps/web/app/api/**`, `apps/web/lib/inngest/functions/**`, and `apps/web/lib/feature-flags.ts`.
  - Because these gaps are execution-relevant rather than cosmetic, they are treated below as a coordination risk and hardened through appended subphase `g`.

## Concurrent Phases

| Phase | Status | Overlap | Coordination |
|-------|--------|---------|--------------|
| Phase 19 | Complete | None — onboarding gate only | No action needed |
| Phase 9 | In Progress | Platform bootstrap — may touch layout.tsx | Avoid layout.tsx changes |
| phase-landing-redesign | In Progress | Marketing site only | Independent, no overlap |
| Forecasting domain | Uncommitted | schema.prisma has uncommitted forecasting models | Migration must be sequenced — forecasting migration first, then Phase 20 migration |

**Critical dependency:** `apps/web/prisma/schema.prisma` has uncommitted changes from the forecasting domain (new models: ForecastSettings, ForecastRun, etc.). Phase 20 adds new models to the same schema. The forecasting migration (`20260328224500_add_forecasting_domain`) must be committed and applied before Phase 20's migration is created.

## Objectives

* [x] Reclassify validation outcomes from binary to 4-state (valid / unknown / retry / invalid)
* [x] Add source-confidence tiering so scraped data never overwrites cleaner sources
* [x] Introduce canonical InfluencerIdentity layer with evidence-based profile linking
* [x] Build probabilistic identity matching with auto-link / review / reject thresholds
* [x] Create two-stage scoring engine (retrieval recall → fit/risk ranking)
* [~] Add daily metrics snapshots for growth velocity and authenticity signals — opportunistic snapshots implemented; daily cron job not yet created
* [x] Implement portfolio-aware seed list construction (diversity + execution yield)
* [x] Build outcome feedback loop from campaign lifecycle to discovery features
* [x] Surface provenance, score components, and confidence bands in the UI
* [x] Separate contact model from creator record (confidence-scored contact points)

## Constraints

1. **Additive schema changes only** — existing Creator, CreatorProfile, CreatorSearchResult tables stay intact. New models extend the graph; existing code paths continue to work.
2. **No new external data sources yet** — optimize what we already collect before adding YouTube/TikTok APIs.
3. **Inngest concurrency limit of 2** — enrichment and scoring jobs must respect existing queue capacity.
4. **72-hour cache validity** — remains the default but validation outcomes become richer.
5. **Playwright validation continues** — but its output becomes one signal among many, not a verdict.
6. **No ML model training in this phase** — build the feature store and label collection; ML ranker is Phase 21+.
7. **Forecasting migration must land first** — schema changes are sequenced.

## Success Criteria

1. Validation produces 4-state outcomes; "blocked" no longer manufactures false negatives
2. Two creators on different platforms can be linked via IdentityEdge with evidence + confidence
3. Every CreatorSearchResult includes score components (topical, engagement, authenticity, identity, contactability) and a fitReasoning explanation
4. UI shows "why this creator was found" with source mix, confidence band, and risk flags
5. Seed list construction accounts for tier diversity, audience cluster, geography, and contactability — not just top-N by score
6. CampaignCreator lifecycle events (approval, reply, delivery) are logged as outcome labels
7. All new code has test coverage; classification tests cover multilingual/niche edge cases
8. Daily metrics snapshot job runs on schedule and populates time-series data

## Subphase Index

* a — Foundation Hardening: Validation Reclassification, Source Confidence & Structured Logging
* b — Identity Graph v1: Schema, Matching Pipeline & Review Queue
* c — Evidence-Rich Scoring Engine: Two-Stage Ranking with Score Decomposition
* d — Time-Series Metrics & Authenticity Signals
* e — Portfolio Construction & Seeding Engine
* f — Feedback Loop, Outcome Learning & UI Provenance
* g — Execution Hardening (RED TEAM append-only): tenancy boundaries, retention/redaction, feature-flag rollout, migration sequencing, and evaluation gates

`g` is appended for RED TEAM hardening, but its gates apply before any Phase 20 implementation branch treats `a`–`f` as execution-ready.

## RED TEAM Findings (Gaps / Weak Spots)

### Highest-risk failure modes

- Shared-schema contention on `apps/web/prisma/schema.prisma` can derail this phase before implementation starts.
  - Mitigation: force a preflight sequencing lane that resolves forecasting migration drift first, then freezes a single schema baseline for Phase 20 work.
- The plan treats raw payload persistence as an unqualified good, but storing raw HTML, contact data, and scrape responses introduces unnecessary privacy/compliance risk.
  - Mitigation: store normalized payload subsets plus hashes/checksums by default, add explicit retention/redaction rules, and require opt-in for any full-payload capture.
- The identity layer is described as global across brands, but the plan does not define how global identity records avoid cross-brand data leakage.
  - Mitigation: every API surface must resolve identity through brand-owned `Creator` / `CampaignCreator` links, and any shared identity data exposed to operators must be explicitly brand-filtered.
- Auto-linking and portfolio selection are planned as production behaviors without a shadow-mode phase or kill switch.
  - Mitigation: introduce feature-flagged shadow computation first, require manual review / calibration gates, and promote to write-path behavior only after precision thresholds are met.

### Missing or ambiguous requirements

- There is no explicit evaluation gate before enabling `AUTO_LINK` identity merges.
  - Plan fix: require a labeled review set and measured merge precision before auto-link moves beyond review-only mode.
- The review queue is API-only in 20b; there is no explicit operator surface or fallback workflow to clear `possible_match` edges.
  - Plan fix: require either a minimal internal review page or a documented ops-only intervention queue before 20b is considered complete.
- The scoring and portfolio subphases assume richer creator dimensions (`region`, `languageDetected`, `authenticityBand`, `contactabilityBand`) before the plan defines where those fields live or how they are backfilled.
  - Plan fix: make those fields explicit derived artifacts with ownership and persistence rules before portfolio work begins.

### Repo mismatches (fix the plan)

- The root plan mixes accurate paths (`apps/web/prisma/schema.prisma`) with stale shortened paths (`lib/creator-search/...`).
  - Plan fix: treat `apps/web/...` as the canonical repo-relative prefix in Phase 20 execution.
- The current codebase already has fail-closed feature flags and brand-scoped route patterns, but the plan does not reuse them.
  - Plan fix: require new API routes and rollout controls to build on `apps/web/lib/feature-flags.ts` and the existing membership-based authorization pattern.
- Subphases `a`–`f` contain non-empty `Output` and `Handoff`, so the RED TEAM skill must treat them as immutable.
  - Plan fix: append a new hardening subphase instead of rewriting existing letters.

### Performance / timeouts

- Daily snapshot collection caps are described, but there is no catch-up strategy for backlog growth or partial-run recovery.
  - Plan fix: add cursoring, per-run budget accounting, and resumable progress markers before scheduling the cron job.
- Portfolio optimization and calibration are unbounded in the plan.
  - Plan fix: define target campaign-size envelopes, query budgets, and fallback behavior when score decomposition or authenticity data is incomplete.

### Security / permissions

- New routes in 20b, 20e, and 20f currently lack explicit authorization requirements.
  - Plan fix: require the same `createClient()` + `getUserBySupabaseId()` + `BrandMembership` scoping pattern already used by existing platform APIs.
- Outcome/provenance endpoints could leak cross-campaign or cross-brand data if they query global identity records directly.
  - Plan fix: all reads must start from a brand-owned creator/campaign anchor, then join outward.

### Testing / validation

- The plan names many tests but not the concrete commands or QA triggers needed to validate each cutover in this repo.
  - Plan fix: add explicit validation commands (`vitest`, `eslint`, `prisma validate/db push`, targeted API smoke checks, and local browse QA) before subphase completion.
- There is no explicit “shadow-mode vs live-mode” comparison step for scoring and portfolio output.
  - Plan fix: require side-by-side comparisons against the current ranking before live write-path changes are enabled.

## Assumptions (Agent)

- The right execution model is to keep global identity records internal while exposing only brand-scoped projections to product users. (confidence ~88%)
  - Mitigation question/check: if cross-brand benchmarking is desired later, add it as a separate explicitly-approved analytics layer rather than leaking it through identity APIs.
- Existing feature flags should be reused instead of inventing a second rollout system for Phase 20. (confidence ~91%)
  - Mitigation question/check: if current `BrandSettings.metadata.featureFlags` becomes too coarse, extend it rather than bypassing it.
- Because subphases `a`–`f` are syntactically “complete” under the RED TEAM rules, execution hardening must be appended as a new subphase rather than retrofitted into those files. (confidence ~95%)

## Open Questions (Need Human Input)

- [ ] Should `InfluencerIdentity` remain a global cross-brand entity, or should identity linkage be partitioned per brand/workspace with optional later merge tooling? (confidence ~80%)
  - Why it matters: this changes the schema, API authorization boundaries, and what operators can see in review/provenance flows.
  - Current assumption in this plan: global identity records exist, but all product-facing reads remain strictly brand-scoped.
- [ ] Are we allowed to retain full raw scrape/validation payloads, or should the plan default to normalized/truncated payload storage only? (confidence ~72%)
  - Why it matters: this changes the shape of `CreatorRawPayload`, logging strategy, retention jobs, and compliance exposure.
  - Current assumption in this plan: normalized/truncated payloads plus hashes are the default; full raw payload storage is opt-in and time-limited.
- [ ] Do you want auto-linking enabled in Phase 20 once thresholds are coded, or should 20b ship as review-only until manual labels prove merge precision? (confidence ~78%)
  - Why it matters: this changes whether identity linking is a live write-path behavior in 20b or a shadow/review system until later.
  - Current assumption in this plan: auto-link stays behind a feature flag and review/correlation gates until measured precision is acceptable.

## Phase Summary

- Shipped:
  - **20a**: 4-state validation, source confidence tiers (`source-confidence.ts`), raw payload retention (`raw-payload.ts`)
  - **20b**: Identity graph (InfluencerIdentity, InfluencerPlatformProfile, IdentityEdge, ContactPoint), matching pipeline (`lib/identity/`), review queue API (`/api/identity/review`)
  - **20c**: 7-dimension scoring engine (`lib/creator-search/scoring/`), decision engine orchestrator (`decision-engine.ts`), triage classification
  - **20d**: Metrics snapshot recording (`lib/metrics/snapshot.ts`), anomaly detection (`anomaly-detection.ts`), authenticity assessment (`authenticity.ts`)
  - **20e**: Portfolio optimizer (`lib/seeding/portfolio-optimizer.ts`), 6 diversity dimensions, seed list API (`/api/campaigns/[campaignId]/seed-list`)
  - **20f**: Outcome recorder (`lib/seeding/outcome-recorder.ts`), outcome features, score calibration, provenance API (`/api/creators/[creatorId]/provenance`), KPI API (`/api/analytics/seeding-kpis`)
  - **20g**: Feature flags added to `lib/feature-flags.ts` (5 flags, all fail-closed)
  - **Schema**: 8 new Prisma models, 4 existing models extended
  - **Integration**: job-runner.ts wired with scoring, identity sync, raw payload recording, outcome seeding
- Verified:
  - `npx prisma validate`: PASS
  - `npx eslint` (17 new files): PASS
  - `npm run web:build`: PASS
  - `npx vitest run` (14 tests / 5 files): PASS
  - `npm run db:push`: SKIP (no dev DB available)
- Notes:
  - Daily cron job for metric snapshots not yet created (opportunistic snapshots only)
  - Feature flags exist but are not gated in the job-runner main path — scoring/identity run unconditionally
  - Test coverage gaps in 20d (anomaly/authenticity) and 20f (outcome/calibration)
  - No Prisma migration generated yet — schema changes are uncommitted edits
  - See `docs/planning/phase-20/review.md` for full evidence mapping and follow-up list
