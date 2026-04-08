# Phase 26 — Platform Expansion

## Original User Request (verbatim)

I'm not sure if email outreach works and all the platforms are connected. I just want it to look good, work, not be clunky, and be intelligently designed.

## Purpose

Expand the platform beyond its current Instagram-email-only footprint. Enhance mention detection, add multi-platform validation, and build a campaign analytics dashboard.

## Context

The Instagram Graph API client (`lib/instagram/client.ts`, 356 lines) is fully implemented with tagged media, mentioned media, insights, and token refresh. The mention poll Inngest function exists AND already wires to the CampaignCreator lifecycle via `createAndAttributeMention()` → `attributeMention()` which updates `lifecycleStatus` to `"posted"` and calls `recordOutcomeEvent()`.

### Deep Sweep Corrections (2026-04-08)

- **26a premise was WRONG**: The plan assumed mention detection was NOT linked to lifecycle updates. In fact, `attribution.ts` already handles this. 26a is rescoped to: pagination, token refresh, feature flagging, testing.
- **26b scope is 3x larger than planned**: 29 files reference `instagramHandle`. `UnifiedDiscoveryPlatform` is a literal `"instagram"`, not a union. Schema migration + type migration required as prerequisite subphase.
- **26c page is NOT minimal**: The existing analytics page is 301 lines with summary cards, lifecycle funnel, engagement metrics, and cost overview. 26c is rescoped as ENHANCEMENT, not rebuild.
- **Real-time inbox DEFERRED** to separate phase (WebSocket impossible on serverless, SSE limited by timeouts).
- **@mention detection DESCOPED** from 26a (requires Instagram webhook subscription, not API polling).

### Deep Sweep Confidence (Post-Correction)

| Subphase | Before | After | Key Risk |
|----------|--------|-------|----------|
| 26a Mention Enhancement | 75% | **85%** | Token refresh + pagination are well-scoped; @mentions descoped |
| 26b Multi-Platform | 60% | **72%** | 29-file instagramHandle blast radius is the single highest-risk item |
| 26c Analytics Dashboard | 85% | **88%** | Enhancement of existing 301-line page; needs recharts dependency |

### Dependencies

- Phase 26a MUST precede 26b (26a uses `instagramHandle`, 26b may migrate it)
- Phase 26c should follow 26a (needs mention data for analytics accuracy)
- Phase 26b is independent of 26c but 26c benefits from multi-platform data

### Cross-Cutting Concerns

- **Prisma migration serialization**: All subphases touch schema. Only one should have an uncommitted migration at a time.
- **Inngest route registration**: Each subphase adds functions. Additive-only (array append).
- **Feature flags**: All new features gated via per-brand `FeatureFlags` pattern.

## Skills Available for Implementation

- `backend-coding-agent` — mention attribution, analytics aggregation, validation framework
- `frontend-coding-agent` — analytics dashboard, recharts
- `architect` — multi-platform validation architecture
- `tdd-guide` — comprehensive test coverage
- `code-review` — post-implementation

## Objectives

* [ ] Instagram mention detection enhanced: pagination, token refresh, feature flag
* [ ] @mention detection descoped — documented as known gap (requires webhook)
* [ ] Multi-platform validation framework with TikTok via Apify
* [ ] Campaign analytics dashboard enhanced with charts, conversion rates, CSV export

## Constraints

- Instagram API rate limit: 200 calls/user/hour — pagination capped at 5 pages/brand/cycle
- No @mention detection via polling (requires webhook — separate future phase)
- Keep Playwright worker for Instagram validation alongside API enrichment
- Multi-platform validation: TikTok first (largest adjacent platform)
- `instagramHandle` NOT removed — backward-compatible addition of `tiktokHandle` only

## Success Criteria

1. Token refresh cron prevents Instagram auth failures (60-day expiry handled)
2. Mention poll paginates (no missed tags for active brands)
3. TikTok validation via Apify returns follower counts through `PlatformValidator` interface
4. Campaign funnel shows all 11 lifecycle stages with conversion rates
5. Creator leaderboard ranked by mention engagement
6. CSV export of analytics data

## Subphase Index

* a — Instagram Mention Enhancement (pagination, token refresh, feature flag, testing)
* b — Multi-Platform Validation Framework (schema migration + abstract interface + TikTok)
* c — Campaign Analytics Dashboard Enhancement (recharts, conversion rates, leaderboard, CSV)

## Execution Order

1. **26a** first — enhances existing Instagram infrastructure, prerequisite for 26b
2. **26b** second — schema migration + validation abstraction (highest risk)
3. **26c** last — reads from all upstream systems, purely additive
