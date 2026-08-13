# Phase 27 — Make It Actually Work

## Original User Request (verbatim)

Okay, let's go ahead and make a /phase-plan out of it so you make things actually work.

## Purpose

Fix the broken plumbing so the seeding lifecycle runs end-to-end. The code exists, tests pass, build compiles — but the platform cannot complete a single creator through the full lifecycle because of dead-end events, missing lifecycle transitions, and feature flags that ship everything disabled.

This is not a feature phase. This is a "make the car actually start" phase.

## Context

### What triggered this

A full lifecycle audit (`apps/web/docs/CORE_FUNCTIONALITY.md`) traced every step of the seeding flow through the actual code and found:

1. **4 broken connections** — events emitted with no consumer, outcome events never recorded, lifecycle states that never reach terminal
2. **8 of 9 feature flags default OFF** — new brands get manual-only experience with zero automation
3. **No gap detection** — the user explicitly asked for "if delivered and NO mentions since ship date — detecting that gap"
4. **No operational visibility** — dashboard shows counts, not health

### Dependencies

- Phase 22-26 all committed (86c1fcd → 6146364)
- Phase 25c (embeddings) remains deferred at 32% confidence — not in scope
- All integration env vars need to be configured by the brand (not a code problem)

### What this phase does NOT do

- Does not add TikTok DM outreach (no messaging API exists)
- Does not add TikTok discovery lanes (separate phase)
- Does not build the setup wizard (separate phase)
- Does not add n8n integration (separate phase)

## Skills Available

- `backend-coding-agent` — Inngest functions, API endpoints, lifecycle automation
- `tdd-guide` — test coverage for new functions
- `code-review` — post-implementation review

## Objectives

* [ ] DM reply pipeline works end-to-end (classify, extract address, generate draft)
* [ ] `deliveredAt` outcome event recorded on both delivery paths
* [ ] Creators auto-transition to `"stalled"` after reminders exhausted with no post
* [ ] Creators auto-transition to `"completed"` after content confirmed
* [ ] Feature flag presets (manual/assisted/autonomous) with onboarding step
* [ ] Campaign health watchdog with dashboard traffic-light summary
* [ ] Feature flag allowlist mismatch fixed

## Constraints

- Zero breaking changes to existing flows
- All new Inngest functions must be registered in route.ts
- All new events must be typed in events.ts
- Feature flags remain fail-closed (safe defaults)
- No new external dependencies (use existing OpenAI, Inngest, Prisma)

## Success Criteria

1. A creator who replies to an Instagram DM with their address gets `ShippingAddressSnapshot` created automatically
2. A creator delivered >30 days ago with no post and no pending reminders transitions to `"stalled"`
3. A creator who posts content transitions to `"completed"` after 7-day confirmation window
4. `CampaignOutcome.deliveredAt` is populated for all delivered creators
5. A new brand selecting "Assisted" preset gets AI scoring, Shopify orders, reminders, and AI replies enabled
6. Dashboard shows green/yellow/red health indicator per campaign

## Subphase Index

| Sub | Scope | Effort | Dependencies |
|-----|-------|--------|-------------|
| a | Wire DM Reply Consumer | 1-2 days | None |
| b | Lifecycle Terminals + Delivered Outcome | 1 day | None |
| c | Feature Flag Presets + Fixes | 1 day | None |
| d | Campaign Health Watchdog | 2 days | b (needs lifecycle data) |

**a, b, c are independent — can run in parallel.**
**d depends on b (needs stalled/completed data for health metrics).**

## Execution Order

```
Parallel:  27a + 27b + 27c
Sequential: 27d (after 27b)
```

Total: ~5 days

## Deep Sweep Confidence

Post-correction confidence numbers (original → corrected):

| Sub | Scope | Original | Corrected | Key Corrections |
|-----|-------|----------|-----------|-----------------|
| a | Wire DM Reply Consumer | 90% | **88%** | Lifecycle race guard, outbound echo filter, media-only DMs, missing recordOutcomeEvent, classifier prompt channel param |
| b | Lifecycle Terminals + Delivered Outcome | 92% | **90%** | recordOutcomeEvent signature fix, Track17 push already wired, stalled cron race condition, reminderWindowDays (not metadata), reminder exhaustion check |
| c | Feature Flag Presets + Fixes | 92% | **90%** | 3 desynchronized allowlists, exclude identityAutoLinkEnabled from presets, exclude embeddingScoringEnabled (deferred), atomic applyPreset(), onboarding step append (not insert) |
| d | Campaign Health Watchdog | 88% | **85%** | SendingMetric has no campaignId (use CampaignOutcome), integration health needs both BrandConnection + ProviderCredential, reuse computeConversionRates(), InterventionCase dedup, mentionGap excludes opted_out/stalled |

All corrections verified against source code. Each subphase plan has a "Deep Sweep Corrections Applied" section with the full list of findings.
