# Phase 26a — Instagram Mention Attribution

## Focus

Wire the existing Instagram Graph API client and mention poll to the CampaignCreator lifecycle. When a creator tags/mentions the brand, their status should update to `posted` with engagement metrics.

## Inputs
- `apps/web/lib/instagram/client.ts` (356 lines) — `getTaggedMedia()`, `getMentionedMedia()`, `getMediaInsights()`
- `apps/web/lib/inngest/functions/instagram-mention-poll.ts` (295 lines) — polls every 15 minutes
- `apps/web/lib/mentions/` — `createAndAttributeMention()` exists
- `MentionAsset` model — stores post/story/reel with engagement metrics
- Gap: mentions detected but not linked to CampaignCreator lifecycle updates

## Skills Available for This Subphase
- `backend-coding-agent` — lifecycle wiring, attribution logic
- `context7-docs` — Instagram Graph API mention endpoints
- `code-review` — post-implementation

## Work

### 1. Wire Mention Detection to Lifecycle

When `instagram-mention-poll.ts` detects a new mention:
- Match the mentioning creator to a `CampaignCreator` (by Instagram handle)
- If matched: update `lifecycleStatus` to `"posted"`
- Record outcome event: `recordOutcomeEvent({ type: "posted", ... })`
- Store engagement metrics on `MentionAsset`

### 2. Add `@mentions` Detection

Currently only tagged media is polled. Add `getMentionedMedia()` call to the poll function.

### 3. Instagram Token Refresh Cron

Long-lived tokens expire after 60 days. Add Inngest cron that:
- Checks token age for all connected Instagram accounts
- Refreshes tokens approaching expiry (< 7 days remaining)
- Creates InterventionCase if refresh fails

### 4. Tests
- Test: mention detected → CampaignCreator status updated to `posted`
- Test: unmatched mention (unknown creator) is stored but doesn't update lifecycle
- Test: engagement metrics stored on MentionAsset
- Test: token refresh cron refreshes near-expiry tokens

## Output
- Mentions automatically update campaign lifecycle
- Both tags and @mentions detected
- Token refresh prevents auth failures
- Outcome events recorded for calibration (Phase 25b)

## Handoff
Subphase b (Multi-Platform Validation) adds TikTok/YouTube alongside Instagram.
