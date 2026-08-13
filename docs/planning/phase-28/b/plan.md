# Phase 28b — Database Indexes: brandId + status

## Focus

Add missing indexes on `brandId` and `status` columns across the schema. Every multi-tenant query filters by `brandId` — without indexes these are full-table scans that will degrade as data grows.

Confidence: **95%**

## Work

### 1. Add `brandId` Indexes (11 models)

**File**: `apps/web/prisma/schema.prisma`

Add `@@index([brandId])` to these 11 models:
- BrandMembership, OutreachTemplate, BrandProduct
- SendingMetric, Campaign, ConversationThread
- InterventionCase, WebhookEvent, BackgroundJob
- AiPersona, Automation

The remaining 9 models from the original list are already covered by `@unique` or compound indexes with `brandId` as the first field (Postgres uses the left-prefix of compound indexes, making standalone indexes redundant).

### 2. Add `status` Indexes (6 justified models)

Add `@@index([status])` to:
- BrandConnection, Campaign, ConversationThread
- InterventionCase, ReminderSchedule, AIDraft

Removed from list:
- Subscription, ShopifyOrder, FulfillmentEvent: never filter by status in WHERE clauses
- WebhookEvent, BackgroundJob: already have compound indexes covering status -- standalone adds marginal value (optional)
- CampaignHealthSnapshot: future-proofing only -- kept as optional note but not in required list

### 3. Run Migration

```bash
npx prisma migrate dev --name add-missing-indexes
```

This is a non-destructive migration (indexes only, no data changes). Safe to run without data migration concerns.

### 4. Verify

```bash
npx prisma generate
npx tsc --noEmit
```

## Deep Sweep Corrections Applied

- [x] HIGH: Only 11 models actually need brandId index (not 20). 9 already covered by `@unique` or compound indexes with brandId as first field.
- [x] MEDIUM: 3 models in status index list (Subscription, ShopifyOrder, FulfillmentEvent) never filter by status in WHERE clauses. Removed from status index list.
- [x] MEDIUM: WebhookEvent and BackgroundJob already have compound indexes covering status -- standalone adds marginal value. Marked as optional.
- [x] LOW: CampaignHealthSnapshot status index is future-proofing -- kept as optional note.

brandId index list updated to exactly 11 models. Status index list updated to exactly 6 justified models.

## Tests

- Verify: `npx prisma validate` passes
- Verify: migration SQL contains only CREATE INDEX statements (no ALTER TABLE column changes)

## Output

- Validated that the required `brandId` and `status` indexes from this lane are already present in `apps/web/prisma/schema.prisma`.
- Confirmed the schema is currently healthy without further index edits:
  - `BrandMembership`, `OutreachTemplate`, `BrandProduct`, `SendingMetric`, `Campaign`, `ConversationThread`, `InterventionCase`, `WebhookEvent`, `BackgroundJob`, `AiPersona`, and `Automation` already have `@@index([brandId])`
  - `BrandConnection`, `Campaign`, `ConversationThread`, `AIDraft`, `ReminderSchedule`, and `InterventionCase` already have `@@index([status])`
- Verification:
  - `cd apps/web && npx prisma validate`
