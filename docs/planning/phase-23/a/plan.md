# Phase 23a — Address-to-Order Automation Pipeline

## Focus

Wire the address confirmation step to automatic Shopify draft order creation. Currently `process-reply.ts` extracts addresses and creates `ShippingAddressSnapshot` with `isActive: false`, and `createDraftOrder()` in `lib/shopify/orders.ts` exists but is never triggered automatically.

Deep sweep confidence: **92%** — all building blocks exist. Corrected for 2 CRITICAL parameter issues and 5 HIGH validation gaps.

## Deep Sweep Corrections Applied

- **CRITICAL**: `OutcomeEvent` union has no `order_created` variant — must add + schema migration
- **CRITICAL**: `createDraftOrder()` takes `creatorId` not `campaignCreatorId` — must resolve from CampaignCreator
- **HIGH**: Feature flag `shopifyOrderEnabled` must be checked in Inngest function
- **HIGH**: No lifecycle guard — can approve for `opted_out` creators
- **HIGH**: No Shopify connection pre-validation in API
- **HIGH**: No campaign product pre-validation in API
- **HIGH**: `process-reply.ts` sets `address_confirmed` before human approval (pre-existing)
- **MEDIUM**: `snapshotId` needed in request body (multiple snapshots possible)
- **MEDIUM**: Event count test will break (expects 10, becomes 11)

## Inputs

- Phase 22 output: typed Inngest events, RBAC guards, credit enforcement patterns
- Phase 24a output: shared `lib/gmail/token.ts` (extraction must land first)
- `lib/inngest/functions/process-reply.ts:74-93` — creates ShippingAddressSnapshot with `isActive: false`
- `lib/shopify/orders.ts` — complete `createDraftOrder(brandId, creatorId, campaignId)` (164 lines)
- `lib/seeding/outcome-recorder.ts` — `recordOutcomeEvent()` — missing `order_created` variant
- Deep sweep findings at `docs/planning/phase-23/deep-sweep-findings.md`

## Skills Available for This Subphase

- `backend-coding-agent` — API endpoint, Inngest function, schema migration
- `context7-docs` — Shopify draft order API, Inngest function patterns
- `code-review` — post-implementation

## Work

### 0. PREREQUISITE: Add `order_created` Outcome Type

**File**: `apps/web/lib/seeding/outcome-recorder.ts`
- Add `{ type: "order_created" }` to `OutcomeEvent` union
- Add corresponding `buildOutcomePatch` and `buildOutcomeCreatePatch` switch cases

**File**: `apps/web/prisma/schema.prisma`
- Add `orderCreatedAt DateTime?` to `CampaignOutcome` model
- Run `npx prisma migrate dev --name add-order-created-outcome`

### 1. Add `shipping/address.approved` Event Type

**File**: `apps/web/lib/inngest/events.ts`

```ts
"shipping/address.approved": {
  data: {
    snapshotId: string;
    campaignCreatorId: string;
    brandId: string;
    campaignId: string;
  };
};
```

**File**: `apps/web/__tests__/config/inngest-events.test.ts`
- Update expected count from 10 to 11
- Add `"shipping/address.approved"` to expected events array

### 2. New API Route: Approve Address

**File**: `apps/web/app/api/campaigns/[campaignId]/creators/[creatorId]/approve-address/route.ts`

Validations (in order):
1. `getAuthorizedCampaign()` + `requireWriteAccess()` — RBAC
2. Validate request body has `snapshotId` (Zod schema)
3. Load `CampaignCreator` — verify `lifecycleStatus` is `"replied"` or `"address_confirmed"` (reject `opted_out`, `stalled`, `completed`)
4. Load `ShippingAddressSnapshot` by `snapshotId` — verify belongs to this `campaignCreatorId`
5. Pre-validate Shopify: check `BrandConnection` with `provider="shopify"` exists
6. Pre-validate product: check at least one `CampaignProduct` with `shopifyVariantId` exists
7. Set `isActive: true`, `confirmedAt: new Date()`, `confirmedBy: user.id`
8. Fire `inngest.send({ name: "shipping/address.approved", data: { snapshotId, campaignCreatorId, brandId, campaignId } })`
9. Return 200

Error responses: 403 (RBAC), 400 (missing snapshotId), 409 (wrong lifecycle), 404 (snapshot not found), 422 (no Shopify connection or no product configured)

### 3. New Inngest Function: Create Order from Approved Address

**File**: `apps/web/lib/inngest/functions/create-order-from-address.ts`

Trigger: `{ event: "shipping/address.approved" }`
Config: `{ retries: 3, concurrency: { limit: 5 } }` (Shopify rate limit protection)

Steps:
1. Load `ShippingAddressSnapshot` — verify `isActive: true` and `confirmedAt` set
2. Load `CampaignCreator` with creator relation
3. Check feature flag: `getFeatureFlags(brandId).shopifyOrderEnabled` — if false, return early (expected)
4. Check idempotency: if `CampaignCreator` already has `ShopifyOrder`, return success (no intervention)
5. Call `createDraftOrder(event.data.brandId, campaignCreator.creatorId, event.data.campaignId)` — note: pass `creatorId` NOT `campaignCreatorId`
6. On success: `recordOutcomeEvent({ type: "order_created", campaignCreatorId, brandId })`
7. On Shopify error: create `InterventionCase` with priority `"high"`, details including error message

### 4. Register Function

**File**: `apps/web/app/api/inngest/route.ts`
- Import and add `createOrderFromAddress` to the serve function array

### 5. Tests

- Test: approve with valid data returns 200, fires event
- Test: approve with wrong lifecycle (opted_out) returns 409
- Test: approve without Shopify connection returns 422
- Test: approve without campaign product returns 422
- Test: double-approve returns 200 (idempotent, no duplicate order)
- Test: Inngest function creates order and records outcome
- Test: Inngest function with `shopifyOrderEnabled: false` returns early
- Test: Inngest function with existing order returns success (no duplicate)

## Output

Completed 2026-04-07.

### Files Modified
- `lib/seeding/outcome-recorder.ts` — Added `order_created` to `OutcomeEvent` union + both switch cases
- `prisma/schema.prisma` — Added `orderCreatedAt DateTime?` to `CampaignOutcome`
- `lib/inngest/events.ts` — Added `shipping/address.approved` event type (11 total)
- `app/api/inngest/route.ts` — Registered `createOrderFromAddress` function
- `__tests__/config/inngest-events.test.ts` — Updated to expect 11 events + shape test

### Files Created
- `prisma/migrations/20260407120000_add_order_created_outcome/migration.sql` — Schema migration
- `app/api/campaigns/[campaignId]/creators/[creatorId]/approve-address/route.ts` — API endpoint with full validation chain (RBAC, feature flag, lifecycle, snapshot ownership, Shopify connection, campaign product)
- `lib/inngest/functions/create-order-from-address.ts` — Inngest function with retry (3), concurrency (5), idempotency guard, feature flag check, outcome recording, intervention on failure
- `__tests__/api/approve-address/route.test.ts` — 10 tests covering all validation paths
- `__tests__/inngest/create-order-from-address.test.ts` — 5 tests covering success, feature flag, idempotency, invalid snapshot, Shopify error

### Build Status
- `npx tsc --noEmit`: PASS (1 pre-existing error in `classification.test.ts` unrelated to this phase)
- `npm run build`: PASS
- Tests: 27/27 passing

### Deep Sweep Corrections Applied
- [x] `OutcomeEvent` union extended with `order_created` + `orderCreatedAt` schema migration
- [x] `createDraftOrder()` called with `campaignCreator.creatorId`, NOT `campaignCreatorId`
- [x] Feature flag `shopifyOrderEnabled` checked in BOTH API endpoint AND Inngest function
- [x] Lifecycle guard: only `replied` or `address_confirmed` allowed (rejects `opted_out`, `stalled`, `completed`)
- [x] Shopify connection pre-validated in API (checks `BrandConnection` status = `connected`)
- [x] Campaign product pre-validated in API (requires `shopifyVariantId` present)
- [x] `snapshotId` accepted in request body (handles multiple snapshots per creator)
- [x] `inngest-events.test.ts` updated to expect 11 events

## Handoff

Phase 23b (Integration Tests) tests this pipeline end-to-end. Tests should mock `@/lib/gmail/token` (Phase 24a's shared module) for send pipeline tests.
