# Phase 27b — Lifecycle Terminals + Delivered Outcome

## Focus

Add the missing lifecycle terminal transitions (`stalled`, `completed`) and the missing `deliveredAt` outcome event. Without these, the learning loop never closes — creators sit in `"delivered"` or `"posted"` forever, and the calibration system has no completion data.

Confidence: **90%**

## Deep Sweep Corrections Applied

- [x] CRITICAL: Fix `recordOutcomeEvent` call signature — plan had `recordOutcomeEvent({ type: "delivered", campaignCreatorId, campaignId, creatorId })` but actual API is `recordOutcomeEvent({ campaignCreatorId, event: { type: "delivered" } })`. Fix in all code snippets.
- [x] CRITICAL: Track17 push webhook (`app/api/webhooks/track17/route.ts:136`) ALREADY calls `recordOutcomeEvent({campaignCreatorId, event: {type: "delivered"}})`. Only 2 gaps exist: Track17 polling cron and Shopify fulfillment webhook. Update plan to reflect this.
- [x] HIGH: Race condition between stalled cron and late mention detection. Fix: stalled cron must re-verify no MentionAsset exists inside a Prisma transaction before committing status change.
- [x] HIGH: Track17 polling cron performs 3+ separate Prisma calls without transaction for delivered cascade. Wrap in `prisma.$transaction()`.
- [x] HIGH: `reminderWindowDays` already exists as first-class column on BrandSettings (default 14). Use this instead of `metadata.stalledAfterDays`. Do NOT add a new JSON key.
- [x] HIGH: "No pending reminders" check is unreliable — `mention-check.ts` marks ALL pending rows as "sent" at once, so zero pending doesn't mean workflow finished. Instead check: all ReminderSchedule records are in terminal state (`sent`, `cancelled`, `suppressed`) AND the count equals `BrandSettings.maxFollowUps`.
- [x] MEDIUM: Guard `recordOutcomeEvent` calls with try/catch in Track17 polling cron to prevent one failure from killing the entire batch.
- [x] MEDIUM: Check `campaignCreatorId` is non-null before calling `recordOutcomeEvent` (ShopifyOrder.campaignCreatorId is nullable).

## Inputs

- `apps/web/lib/seeding/outcome-recorder.ts` — already supports `type: "delivered"`, `"stalled"`, `"completed"`
- `apps/web/lib/inngest/functions/track17-sync.ts` — delivery path 1 (Track17 polling)
- `apps/web/app/api/webhooks/track17/route.ts` — delivery path 2 (Track17 push webhook) — **already calls recordOutcomeEvent for delivered**
- `apps/web/app/api/webhooks/shopify/route.ts` — delivery path 3 (Shopify fulfillment webhook)
- `apps/web/lib/mentions/attribution.ts` — sets lifecycle to `"posted"` (trigger point for completed)
- `apps/web/lib/inngest/functions/reminders.ts` — schedules reminders after fulfillment
- `apps/web/prisma/schema.prisma` — `ReminderSchedule`, `MentionAsset`, `CampaignOutcome`, `CampaignCreator`, `BrandSettings.reminderWindowDays`

## Skills Available

- `backend-coding-agent`, `tdd-guide`, `code-review`

## Work

### 1. Add Delivered Outcome Event — Track17 Polling Cron (gap #1)

**File**: `apps/web/lib/inngest/functions/track17-sync.ts`

After setting `lifecycleStatus: "delivered"`, wrap the delivered cascade in a transaction and add outcome event recording with error guard:

```ts
await prisma.$transaction(async (tx) => {
  await tx.campaignCreator.update({
    where: { id: cc.id },
    data: { lifecycleStatus: "delivered" },
  });
  // ... any other updates in the delivery cascade
});

// Guard: campaignCreatorId could theoretically be null in edge cases
if (cc.id) {
  try {
    await recordOutcomeEvent({
      campaignCreatorId: cc.id,
      event: { type: "delivered" },
    });
  } catch (err) {
    console.error(`[track17-sync] Failed to record delivered outcome for ${cc.id}:`, err);
    // Don't throw — one failure must not kill the entire polling batch
  }
}
```

Note: Track17 push webhook (`app/api/webhooks/track17/route.ts:136`) already calls `recordOutcomeEvent` correctly. No change needed there.

### 2. Add Delivered Outcome Event — Shopify Fulfillment Webhook (gap #2)

**File**: `apps/web/app/api/webhooks/shopify/route.ts`

In `handleFulfillmentUpdate()` after setting lifecycle to `"delivered"`, add outcome event with null guard:

```ts
if (order.campaignCreatorId) {
  await recordOutcomeEvent({
    campaignCreatorId: order.campaignCreatorId,
    event: { type: "delivered" },
  });
}
```

The `campaignCreatorId` null guard is required because `ShopifyOrder.campaignCreatorId` is nullable in the schema.

### 3. Stalled Detection Cron

**New file**: `apps/web/lib/inngest/functions/stalled-detection.ts`

Daily cron (`0 5 * * *` — 5 AM UTC):

1. Query all `CampaignCreator` where:
   - `lifecycleStatus = "delivered"`
   - Last reminder was sent > `BrandSettings.reminderWindowDays` ago (first-class column, default 14 — do NOT use `metadata.stalledAfterDays`)
2. For each candidate, **inside a Prisma transaction**, re-verify:
   - No `MentionAsset` exists for this campaignCreatorId (race condition guard against late mention detection)
   - All `ReminderSchedule` records are in terminal state (`sent`, `cancelled`, `suppressed`) AND the count equals `BrandSettings.maxFollowUps` (zero pending is unreliable because `mention-check.ts` bulk-marks rows as "sent")
3. If both checks pass inside the transaction: transition to `"stalled"`, then call `recordOutcomeEvent({ campaignCreatorId, event: { type: "stalled" } })`
4. Log count per brand

```ts
await prisma.$transaction(async (tx) => {
  // Re-verify no mention appeared since initial query
  const mentionExists = await tx.mentionAsset.findFirst({
    where: { campaignCreatorId: cc.id },
  });
  if (mentionExists) return; // Late mention detected — skip

  // Verify all reminders exhausted
  const reminderSchedules = await tx.reminderSchedule.findMany({
    where: { campaignCreatorId: cc.id },
  });
  const allTerminal = reminderSchedules.every(
    (r) => ["sent", "cancelled", "suppressed"].includes(r.status)
  );
  const remindersExhausted =
    allTerminal && reminderSchedules.length >= brandSettings.maxFollowUps;
  if (!remindersExhausted) return;

  await tx.campaignCreator.update({
    where: { id: cc.id },
    data: { lifecycleStatus: "stalled" },
  });
});

// Outside transaction — non-critical
await recordOutcomeEvent({
  campaignCreatorId: cc.id,
  event: { type: "stalled" },
});
```

### 4. Completed Transition

**File**: `apps/web/lib/mentions/attribution.ts`

After `attributeMention()` sets lifecycle to `"posted"`, emit a new event `"mention/posted.confirm"` with a 7-day delay:

**New file**: `apps/web/lib/inngest/functions/confirm-posted.ts`

Listens on: `"mention/posted.confirm"` (with `step.sleep("7d")`)
1. Re-check that lifecycle is still `"posted"` (not manually changed)
2. Verify MentionAsset still exists (not deleted)
3. Transition to `"completed"`
4. Call `recordOutcomeEvent({ campaignCreatorId, event: { type: "completed" } })`

### 5. Add Events

**File**: `apps/web/lib/inngest/events.ts`
- Add `"mention/posted.confirm"` event type with `{ campaignCreatorId, mentionAssetId }`

### 6. Register Functions

**File**: `apps/web/app/api/inngest/route.ts`
- Register `stalledDetection` and `confirmPosted`

### 7. Tests

- Test: Track17 polling cron delivery calls recordOutcomeEvent with `{ campaignCreatorId, event: { type: "delivered" } }`
- Test: Shopify webhook delivery calls recordOutcomeEvent with `{ campaignCreatorId, event: { type: "delivered" } }`
- Test: Shopify webhook with null campaignCreatorId skips recordOutcomeEvent
- Test: Track17 push webhook already has recordOutcomeEvent (no regression)
- Test: Creator delivered >14 days ago with no mentions and all reminders exhausted → stalled
- Test: Creator delivered <14 days ago → NOT stalled (too soon)
- Test: Creator delivered but has MentionAsset → NOT stalled (they posted)
- Test: Creator with non-terminal reminders → NOT stalled (still trying)
- Test: **Reminder count < maxFollowUps** → NOT stalled (not all reminders sent yet)
- Test: **Race condition**: MentionAsset created between initial query and transaction → NOT stalled
- Test: **Track17 polling batch**: one recordOutcomeEvent failure does not kill the batch
- Test: Posted creator confirmed after 7 days → completed
- Test: Posted creator manually changed to opted_out before 7 days → NOT completed
- Test: Stalled count logged per brand
- Test: **Transaction wraps delivered cascade** in Track17 polling cron

## Output

(empty — to be filled after implementation)

## Handoff

With lifecycle terminals working, the calibration loop (25b) can compute complete funnel data. The analytics dashboard (26c) shows accurate conversion rates. Campaign managers can finally close out campaigns.
