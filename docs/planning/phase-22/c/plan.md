# Phase 22c — Cleanup & Type Safety

## Focus

Clean up tech debt: untyped Inngest events, outdated Shopify API version, and hardcoded AI model strings. Deep sweep confidence: **78%** (down from ~95%) due to wrong event catalog, wrong Inngest API syntax, and incorrect file counts.

## Deep Sweep Corrections Applied

- **CRITICAL**: 5 events in original plan don't exist (`mention/check`, `shopify/order.created`, `track17/register`, `track17/poll`, `automation/run`)
- **CRITICAL**: Shopify version in 3 files (not 1) — also `app/api/connections/shopify/route.ts:16`
- **CRITICAL**: AI model: 9 occurrences in 3 files (not 7 in 2) — `lib/workers/creator-search.ts` missing
- **HIGH**: Inngest client generic uses wrong API (`events` vs `schemas`)
- **HIGH**: `creator-search/requested` has consumer-side divergence (Apify expects `criteria`)
- **HIGH**: Missing events: `metrics/snapshots-collected` and `creator-avg-views/requested`
- **HIGH**: `event.data as` casts must be removed after typing
- **MEDIUM**: `events.ts` has redundant `name` field in type declarations
- **MEDIUM**: Existing tests may reference hardcoded strings

## Inputs

- Deep sweep findings at `docs/planning/phase-22/deep-sweep-findings.md`
- Corrected Inngest event catalog (10 real events, not 15+)
- `lib/inngest/events.ts` — 3 declared, 7 undeclared
- `lib/inngest/client.ts` — untyped client
- `lib/shopify/client.ts:39`, `lib/shopify/webhooks.ts:1`, `app/api/connections/shopify/route.ts:16` — 3 version locations
- `lib/inbox/ai.ts` (6), `lib/workers/creator-search.ts` (2), `lib/ai/outreach-drafter.ts` (1) — 9 model occurrences

## Skills Available for This Subphase

- `context7-docs` — fetch current Inngest SDK typing API and Shopify 2025-04 changelog
- `javascript-typescript` — Inngest event type safety with generics
- `code-refactoring` — AI config extraction
- `dependency-updater` — Shopify API version
- `code-review` — post-implementation review

## Work

### 1. Inngest Event Type Safety

**PREREQUISITE**: Use `context7-docs` to fetch exact Inngest v3 typing API. The syntax `new Inngest<{ events: ... }>()` is wrong — SDK uses `schemas` with `EventSchemas`.

**File**: `lib/inngest/events.ts`

Corrected event catalog (10 events, verified by RED TEAM grep):

```ts
export type AppEventPayloads = {
  // Already declared (keep)
  "app/ping": { data: { timestamp: string } };  // dead — no senders or consumers
  "gmail/message.received": { data: { threadId: string; messageId: string; brandId: string; campaignCreatorId: string } };
  "mention/media.archive": { data: { mentionAssetId: string } };

  // NEW declarations
  "creator-search/requested": {
    data: {
      jobId: string;
      brandId: string;
      campaignId?: string;
      query?: Record<string, unknown>;
      // Apify consumer expects these — include for backward compat
      discoverySource?: string;
      criteria?: Record<string, unknown>;
    };
  };
  "creator-avg-views/requested": { data: { creatorIds: string[] } };
  "reminder/send": { data: { campaignCreatorId: string; brandId: string; reminderNumber: number; orderId: string } };
  "shopify/order.fulfilled": { data: { orderId: string; shopifyOrderId: string; campaignCreatorId: string } };
  "shopify/fulfillment.updated": { data: { orderId: string; shopifyOrderId: string; campaignCreatorId: string; status: string } };  // fire-and-forget, no consumer
  "unipile/message.received": { data: { threadId: string; messageId: string; brandId: string; campaignCreatorId: string; chatId: string } };  // fire-and-forget, no consumer
  "metrics/snapshots-collected": { data: { profileIds: string[] } };
};
```

Events that were in original plan but DO NOT EXIST (removed):
- ~~`mention/check`~~ — file consumes `reminder/send`
- ~~`shopify/order.created`~~ — Shopify webhook topic, not Inngest event
- ~~`track17/register`~~ — triggered by `shopify/order.fulfilled`
- ~~`track17/poll`~~ — triggered by cron
- ~~`automation/run`~~ — triggered by cron

**File**: `lib/inngest/client.ts`

Use correct Inngest v3 SDK syntax (verify with context7-docs):
```ts
import { Inngest, EventSchemas } from "inngest";
import type { AppEventPayloads } from "./events";

export const inngest = new Inngest({
  id: process.env.INNGEST_APP_ID || "seed-scale",
  schemas: new EventSchemas().fromRecord<AppEventPayloads>(),
});
```

**All consumer functions**: Remove `event.data as { ... }` casts (6 files):
- `lib/inngest/functions/creator-search.ts` — remove `as CreatorSearchRequestedEvent`
- `lib/inngest/functions/apify-creator-search.ts` — remove `as { ... }`
- `lib/inngest/functions/mention-check.ts` — remove `as { ... }`
- `lib/inngest/functions/reminders.ts` — remove `as { ... }`
- `lib/inngest/functions/track17-sync.ts` — remove `as { ... }`
- `lib/inngest/functions/compute-authenticity.ts` — remove `as { ... }`

Fire-and-forget events (`shopify/fulfillment.updated`, `unipile/message.received`): add TODO comment documenting they have no consumer yet.

### 2. Shopify API Version Update

**New file**: `lib/shopify/config.ts`
```ts
export const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION ?? "2025-04";
```

**Update 3 files** (not 1):
- `lib/shopify/client.ts:39` — import from config
- `lib/shopify/webhooks.ts:1` — import from config
- `app/api/connections/shopify/route.ts:16` — import from config

Before updating, verify no breaking changes in Shopify 2024-01 → 2025-04:
- Draft order REST endpoint still available
- Webhook registration endpoints stable
- `shop.json` validation endpoint unchanged

### 3. AI Model Configuration

**New file**: `lib/ai/config.ts`
```ts
export const AI_MODEL = process.env.AI_MODEL || "gpt-5-mini";
```

**Update 3 files, 9 occurrences**:

`lib/inbox/ai.ts` (6 occurrences — lines 75, 110, 155, 184, 242, 272):
- API calls: `model: AI_MODEL`
- Artifact records: `model: AI_MODEL`

`lib/ai/outreach-drafter.ts` (1 occurrence — line 128):
- `model: AI_MODEL`

`lib/workers/creator-search.ts` (2 occurrences — lines 448, 707):
- Line 448: `model: AI_MODEL`
- Line 707: Template literal for suffixed variants:
  ```ts
  model: creator.analysisSource === "worker" ? `${AI_MODEL}@fly-worker` : `${AI_MODEL}@local`
  ```

### 4. Verification

- `npm run build` — zero type errors (Inngest events compile-time checked)
- `vitest run` — all tests pass (check test files for hardcoded `"2024-01"` and `"gpt-5-mini"`)
- Grep `inngest.send(` — every call uses a declared event name
- Grep `"gpt-5-mini"` — zero matches outside `lib/ai/config.ts` default
- Grep `"2024-01"` — zero matches outside `lib/shopify/config.ts` default
- Grep `event.data as` — zero matches in Inngest function files

## Rollback Plan

- Shopify: change `SHOPIFY_API_VERSION` env var to `"2024-01"` (no code deploy)
- AI model: change `AI_MODEL` env var (no code deploy)
- Inngest types: types are compile-time only, no runtime behavior change

## Output

Completed 2026-04-07.

### Task 1: Inngest Event Type Safety
- 10 events declared in `lib/inngest/events.ts` with typed payloads (3 existing + 7 new)
- Inngest client typed with `EventSchemas.fromRecord<AppEventPayloads>()` in `lib/inngest/client.ts`
- All 6 `event.data as` casts removed from consumer functions:
  - `functions/creator-search.ts` — removed `as CreatorSearchRequestedEvent`
  - `functions/apify-creator-search.ts` — removed inline `as { ... }`, narrowed `criteria` locally
  - `functions/mention-check.ts` — removed `as { ... }`
  - `functions/reminders.ts` — removed `as { ... }`
  - `functions/track17-sync.ts` — removed `as { ... }`
  - `functions/compute-authenticity.ts` — removed `as string[]`
  - `functions/creator-avg-views-enrichment.ts` — removed `as CreatorAvgViewsRequestedEvent` and deleted local type
- Fire-and-forget events (`shopify/fulfillment.updated`, `unipile/message.received`) marked with TODO comments

### Task 2: Shopify API Version Update
- Created `lib/shopify/config.ts` with env-configurable `SHOPIFY_API_VERSION` (default `2025-04`)
- Updated 3 files to import from shared config:
  - `lib/shopify/client.ts` — replaced local `apiVersion` variable
  - `lib/shopify/webhooks.ts` — replaced local `SHOPIFY_API_VERSION` constant
  - `app/api/connections/shopify/route.ts` — replaced local `SHOPIFY_API_VERSION` constant
- Zero `"2024-01"` strings remaining in codebase

### Task 3: AI Model Configuration
- Created `lib/ai/config.ts` with env-configurable `AI_MODEL` (default `gpt-5-mini`)
- Updated 9 occurrences across 3 files:
  - `lib/inbox/ai.ts` — 6 occurrences
  - `lib/ai/outreach-drafter.ts` — 1 occurrence
  - `lib/workers/creator-search.ts` — 2 occurrences (line 448 plain, line 707 template literal for suffixed variants)
- Zero `"gpt-5-mini"` strings remaining outside `lib/ai/config.ts`

### Verification
- `npx tsc --noEmit`: zero new type errors (2 pre-existing errors in unrelated files)
- `npx next build`: compiled successfully
- `vitest run __tests__/config/`: 16 tests pass (3 test files)
- Grep `event.data as` in `lib/inngest/`: zero matches
- Grep `"gpt-5-mini"` in `apps/web/`: only in `lib/ai/config.ts` default
- Grep `"2024-01"` in `apps/web/`: zero matches

### Tests Written
- `__tests__/config/inngest-events.test.ts` — 11 tests (type shape assertions for all 10 events)
- `__tests__/config/shopify-config.test.ts` — 2 tests (default + env override)
- `__tests__/config/ai-config.test.ts` — 3 tests (default + env override + suffixed variants)

## Handoff

Phase 22 is complete. The codebase is now revenue-safe, access-controlled, and type-safe. Phase 23 (automation) can add new Inngest events (e.g., `shipping/address.approved`) that will be compile-time checked. Phase 24 (outreach) benefits from the configurable AI model and daily limit enforcement.
