# Phase 26a — Instagram Mention Attribution Enhancement

## Focus

Enhance the existing mention detection system with token refresh, pagination, feature flagging, and comprehensive testing. The core lifecycle wiring (mention → `posted` status → outcome event) already works — this phase addresses the operational gaps.

Confidence: **85%** (after corrections applied)

## Deep Sweep Corrections Applied

- [x] CRITICAL: Plan premise was WRONG — `createAndAttributeMention()` in `attribution.ts` ALREADY updates `lifecycleStatus` to `"posted"` and calls `recordOutcomeEvent()`. The poll at `instagram-mention-poll.ts:146` already calls it. Work item 1 (lifecycle wiring) is already done.
- [x] HIGH: `getMentionedMedia()` requires a `mediaId` parameter — cannot enumerate mentions like tags. @mention detection requires Instagram webhook subscription, not polling. Descoped to tagged media only.
- [x] HIGH: Poll only processes first page of `getTaggedMedia()` results — misses older tagged media for active brands
- [x] HIGH: `refreshLongLivedToken()` exists in `client.ts:275` but has ZERO callers — tokens silently expire after 60 days
- [x] MEDIUM: `"reminded"` used in `findMatchingCampaignCreator` filter but never set anywhere in codebase
- [x] MEDIUM: No feature flag to disable mention polling per-brand
- [x] MEDIUM: Matching logic has false-positive risk — returns first candidate when multiple exist and no handle matches caption
- [x] LOW: No `mention/detected` or `mention/attributed` Inngest event for downstream consumers
- [x] LOW: No rate limit tracking across brands for Instagram Graph API (200 calls/user/hour)

## Inputs

- `apps/web/lib/instagram/client.ts` (356 lines) — `getTaggedMedia()`, `refreshLongLivedToken()`, rate limit detection
- `apps/web/lib/inngest/functions/instagram-mention-poll.ts` (295 lines) — polls every 15 minutes, calls `createAndAttributeMention()`
- `apps/web/lib/mentions/attribution.ts` (119 lines) — `attributeMention()` already updates lifecycle + records outcome
- `apps/web/lib/seeding/outcome-recorder.ts` — `"posted"` event type with reach/engagement
- `apps/web/prisma/schema.prisma` — `MentionAsset` model, `ProviderCredential` with `expiresAt`

## Skills Available

- `backend-coding-agent` — pagination, token refresh, feature flagging
- `tdd-guide` — comprehensive test coverage
- `code-review` — post-implementation

## Work

### 1. Add Pagination to Mention Poll

**File**: `apps/web/lib/inngest/functions/instagram-mention-poll.ts`

After `getTaggedMedia()` returns, follow `paging.next` cursor:
- Loop until no more pages OR a previously-seen `mediaUrl` is encountered (dedup via `@@unique([platform, mediaUrl])`)
- Safety cap: max 5 pages per poll cycle per brand (prevents runaway API consumption)
- Log pages fetched per brand for observability

### 2. Instagram Token Refresh Cron

**New file**: `apps/web/lib/inngest/functions/instagram-token-refresh.ts`

Daily cron (`0 4 * * *` — 4 AM UTC):
1. Query `ProviderCredential` where `provider = 'instagram'` AND `expiresAt < NOW() + 7 days` AND `isValid = true`
2. For each: call `refreshLongLivedToken()` from `client.ts`
3. Encrypt and store new token, update `expiresAt` (new 60-day window)
4. On failure: create `InterventionCase` with type `"auth_failure"`, priority `"high"`
5. On 3 consecutive failures: mark credential `isValid = false`

Register in `app/api/inngest/route.ts`.

### 3. Add Feature Flag

**File**: `apps/web/lib/feature-flags.ts`

Add `instagramMentionPollEnabled` to `FeatureFlags` interface and `DEFAULT_FLAGS` (default: `true` for existing brands).

**File**: `apps/web/lib/inngest/functions/instagram-mention-poll.ts`

Check flag at start of per-brand poll step. Skip brand if disabled.

### 4. Fix `reminded` Status Inconsistency

**File**: `apps/web/lib/inngest/functions/instagram-mention-poll.ts`

Remove `"reminded"` from `findMatchingCampaignCreator()` filter at line 257. No code ever sets this status, so it's dead logic. Keep only `["shipped", "delivered"]` (the valid statuses where a creator could have received product and posted).

### 5. Improve Attribution Matching

**File**: `apps/web/lib/inngest/functions/instagram-mention-poll.ts`

Current problem: when multiple candidates match and no handle is found in caption, the poll returns the first candidate (arbitrary attribution).

Fix:
- If single candidate: attribute (current behavior, acceptable)
- If multiple candidates and caption contains a handle match: attribute to that match (current behavior, correct)
- If multiple candidates and NO handle match: store `MentionAsset` with `campaignCreatorId` set to the most recently shipped candidate, but add `attributionConfidence: "low"` field to `MentionAsset`
- Add `attributionConfidence String? @map("attribution_confidence")` to `MentionAsset` schema (`"high"` | `"low"`)

### 6. Add Mention Events

**File**: `apps/web/lib/inngest/events.ts`

Add `mention/attributed` event to `AppEventPayloads` with `{ mentionAssetId, campaignCreatorId, attributionConfidence }`. Emit from `createAndAttributeMention()` for downstream consumers (notifications, analytics).

### 7. @Mention Detection — DESCOPED

`getMentionedMedia()` requires a `mediaId` from an Instagram webhook push. Polling for @mentions is not possible via the Graph API. Full @mention detection requires:
- Instagram webhook subscription for `mentions` field
- Webhook endpoint to receive `media_id` pushes
- Call `getMentionedMedia(mediaId)` on each push

This is a separate subphase. Document as known gap. Tagged media detection covers the primary use case.

### 8. Tests

- Test: pagination follows `paging.next` up to 5 pages
- Test: pagination stops on previously-seen mediaUrl (dedup)
- Test: token refresh cron refreshes near-expiry tokens (<7 days)
- Test: token refresh failure creates InterventionCase
- Test: 3 consecutive failures marks credential invalid
- Test: feature flag disables polling for a brand
- Test: `reminded` status removed from matching filter
- Test: multiple candidates with no handle match → attributionConfidence: "low"
- Test: mention/attributed event emitted after attribution
- Test: auth errors mark credential as invalid and connection as error (existing behavior, verify)
- Test: end-to-end: tagged media detected → MentionAsset created → lifecycleStatus "posted" → outcome event recorded

## Output

**Completed 2026-04-08**

- Mention poll pagination: follows `paging.next` up to 5 pages, stops on previously-seen mediaUrl
- Instagram token refresh cron: daily 4AM UTC, refreshes tokens <7 days from expiry, credential-scoped failure tracking
- `instagramMentionPollEnabled` feature flag (per-brand, default true, fail-closed)
- `reminded` status removed from matching filter (was dead logic)
- Attribution confidence: "high" for single candidate or handle match (with word boundary), "low" for ambiguous
- `mention/attributed` Inngest event emitted after each attribution
- Handle matching uses word boundary check (prevents `@ann` matching `@anne`)
- 13 tests pass (9 poll + 4 token refresh)

### Files Created
- `apps/web/lib/inngest/functions/instagram-token-refresh.ts` — daily cron, credential-scoped failure tracking
- `apps/web/__tests__/inngest/instagram-mention-poll.test.ts` — 9 tests
- `apps/web/__tests__/inngest/instagram-token-refresh.test.ts` — 4 tests

### Files Modified
- `apps/web/prisma/schema.prisma` — added `attributionConfidence` to MentionAsset
- `apps/web/lib/feature-flags.ts` — added `instagramMentionPollEnabled` flag
- `apps/web/lib/inngest/events.ts` — added `mention/attributed` event
- `apps/web/lib/inngest/functions/instagram-mention-poll.ts` — pagination, feature flag, attribution confidence, word boundary matching
- `apps/web/lib/mentions/attribution.ts` — `attributionConfidence` parameter
- `apps/web/app/api/inngest/route.ts` — registered `instagramTokenRefresh`

## Handoff

Phase 26b (Multi-Platform Validation) adds TikTok alongside Instagram. The token refresh cron pattern established here should be extended for any new platform credentials. The feature flag pattern ensures per-brand control.

Known gap: @mention detection (caption mentions without tags) requires Instagram webhook infrastructure — separate future phase.
