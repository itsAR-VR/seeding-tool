# Phase 27a — Wire DM Reply Consumer

## Focus

Create an Inngest function that consumes `unipile/message.received` events. This closes the single biggest broken connection in the platform — Instagram DM replies are currently persisted but never processed (no AI classification, no address extraction, no draft generation).

Confidence: **88%**

## Deep Sweep Corrections Applied

- [x] CRITICAL: Lifecycle race — webhook sets "replied" BEFORE consumer runs. Add forward-only lifecycle guard: consumer must only advance lifecycle forward (never regress). Use conditional WHERE clause: `lifecycleStatus IN ('outreach_sent', 'ready', 'replied')` before setting `address_confirmed`.
- [x] HIGH: AI classifier prompt says "email classifier" — wrong for DMs. Add `channel` parameter to `classifyReply()` that adjusts prompt framing ("message classifier" for DMs, removes subject references).
- [x] HIGH: No `recordOutcomeEvent` in process-reply.ts template — consumer must call `recordOutcomeEvent({ campaignCreatorId, event: { type: "reply_received", replyType: classification.intent } })` after classification.
- [x] HIGH: Outbound DM echo — Unipile webhook fires for brand's own sent messages. Consumer must filter: load Message by ID, check `direction === "inbound"` before processing. Also fix: synthetic message ID in send-dm.ts (`unipile-new-${Date.now()}`) won't match Unipile's actual ID, so dedup may fail.
- [x] MEDIUM: Media-only DM messages (images of addresses) — detect when `body` is empty but message exists, create InterventionCase with type `"media_message"` for manual review.
- [x] MEDIUM: Remove TODO comment from events.ts line 79 after implementing.

## Inputs

- `apps/web/lib/inngest/events.ts` — `"unipile/message.received"` event type (exists, line 79: "Fire-and-forget — no consumer yet. TODO")
- `apps/web/lib/inngest/functions/process-reply.ts` — Gmail reply consumer (207 lines, the exact template to mirror)
- `apps/web/lib/inbox/ai.ts` — `classifyReply()`, `extractAddress()`, `generateDraft()` (channel-agnostic)
- `apps/web/app/api/webhooks/unipile/route.ts` — webhook handler that emits the event (304 lines)
- `apps/web/prisma/schema.prisma` — `Message`, `ConversationThread`, `ShippingAddressSnapshot`, `AIDraft`, `InterventionCase`

## Skills Available

- `backend-coding-agent`, `tdd-guide`, `code-review`

## Work

### 1. Create DM Reply Processor

**New file**: `apps/web/lib/inngest/functions/process-dm-reply.ts`

Listens on: `"unipile/message.received"`

Steps (mirror `process-reply.ts` with DM-specific adaptations):
1. Load the `Message` by ID from event data
2. **Filter outbound echo**: check `direction === "inbound"` — skip if the message was sent by the brand. Unipile webhooks fire for the brand's own sent messages, so this guard is mandatory.
3. Load the `ConversationThread` with campaign, creator, brand context
4. Load recent thread messages for context (DMs are multi-turn — include last 5 messages, not just the latest)
5. **Detect media-only messages**: if `body` is empty/null but the message record exists, create `InterventionCase` with `type: "media_message"` and `reason: "DM contains media attachment (possibly address screenshot) — requires manual review"`. Return early.
6. Call `classifyReply()` with `channel: "instagram_dm"` parameter (see Work item 4)
7. **Record outcome event** after classification:
   ```ts
   await recordOutcomeEvent({
     campaignCreatorId,
     event: { type: "reply_received", replyType: classification.intent },
   });
   ```
8. If intent is `"address"`: call `extractAddress()`, create `ShippingAddressSnapshot` with `source: "ai_extracted"`. **Forward-only lifecycle guard**: update lifecycle to `"address_confirmed"` using conditional WHERE:
   ```ts
   await prisma.campaignCreator.updateMany({
     where: {
       id: campaignCreatorId,
       lifecycleStatus: { in: ["outreach_sent", "ready", "replied"] },
     },
     data: { lifecycleStatus: "address_confirmed" },
   });
   ```
   This prevents regressing a creator who is already past `address_confirmed` (e.g., `shipped`, `delivered`).
9. If intent is `"positive"`: update lifecycle to `"replied"` only if current status is `"outreach_sent"` or `"ready"` (forward-only guard).
10. If confidence < 0.7 or intent is `"negative"` or `"question"`: create `InterventionCase` for human review
11. If `aiReplyEnabled`: call `generateDraft()`, create `AIDraft` with `status: "draft"` (never auto-send)

### 2. Register Function

**File**: `apps/web/app/api/inngest/route.ts` — add `processDmReply` to functions array

### 3. Update Event Type

**File**: `apps/web/lib/inngest/events.ts` — remove the TODO comment on line 79 (`/** Fire-and-forget — no consumer yet. TODO: add consumer when needed. */`), replace with accurate doc comment (`/** Consumed by process-dm-reply — classifies DM, extracts address, generates draft. */`). Ensure payload type matches what the webhook emits.

### 4. DM-Specific Classification Tuning

**File**: `apps/web/lib/inbox/ai.ts`

Add a `channel` parameter to `classifyReply()`:

Current signature:
```ts
export async function classifyReply(
  message: { body: string; subject?: string | null },
  brandId: string,
  campaignCreatorId?: string
): Promise<ClassificationResult>
```

New signature:
```ts
export async function classifyReply(
  message: { body: string; subject?: string | null },
  brandId: string,
  campaignCreatorId?: string,
  channel: "email" | "instagram_dm" = "email"
): Promise<ClassificationResult>
```

Channel-specific prompt adjustments:
- For `"instagram_dm"`: use "message classifier" framing (not "email classifier"), remove all subject line references from the prompt, note that messages are typically shorter, may be terse address-only ("123 Main St NYC 10001"), may contain emoji/slang
- Keep the same 5 intents: positive, negative, address, question, other
- Lower the minimum word count threshold for address detection (DMs can be just an address with no greeting)

### 5. Fix Synthetic Message ID Dedup

**File**: `apps/web/lib/outreach/send-dm.ts`

The synthetic message ID (`unipile-new-${Date.now()}`) won't match the actual Unipile message ID when the webhook fires. This means dedup based on message ID will fail. Add a `correlationId` field to the `Message` record, or update the Message with the real Unipile ID from the send response if available.

### 6. Tests

- Test: DM with address text creates ShippingAddressSnapshot
- Test: DM with "not interested" classifies as negative, creates InterventionCase
- Test: Outbound DM is skipped (direction !== "inbound")
- Test: Low confidence classification creates InterventionCase
- Test: Multi-message context (last 5 messages) included in classification
- Test: Terse address-only message ("123 Main St, LA 90001") is correctly classified
- Test: aiReplyEnabled=false skips draft generation
- Test: lifecycle updated to "address_confirmed" on address extraction
- Test: duplicate message processing is idempotent
- Test: **Forward-only lifecycle guard** — creator already at "shipped" is NOT regressed to "address_confirmed"
- Test: **Forward-only lifecycle guard** — creator already at "replied" CAN advance to "address_confirmed"
- Test: **Media-only DM** (empty body) creates InterventionCase with type "media_message"
- Test: **Outbound echo filter** — brand's own sent DM is not processed as a reply
- Test: **recordOutcomeEvent** called with `{ type: "reply_received", replyType }` after classification
- Test: **Channel parameter** — classifyReply called with `channel: "instagram_dm"` (not email framing)

## Output

(empty — to be filled after implementation)

## Handoff

With the DM consumer wired, both email AND DM reply paths feed into the same downstream flow: address approval → Shopify order → shipping → delivery tracking → mention detection.
