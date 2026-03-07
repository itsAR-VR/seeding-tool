# Phase 9h — Completion

## Status: COMPLETE ✅

**Build:** `npm run web:build` — PASS (zero errors)
**Tests:** 24/24 passing (vitest)

## What Was Built

### 1. Replay Fixtures + Contract Tests (`apps/web/__tests__/webhooks/`)

**stripe.test.ts** — 8 tests
- `checkout.session.completed` → Organization update + Subscription upsert
- `customer.subscription.updated` → status sync (active, past_due)
- `customer.subscription.deleted` → status = "canceled"
- `invoice.payment_failed` → status = "past_due"
- Duplicate event → webhook log still created (Stripe handler doesn't dedupe by event ID)
- Invalid signature → 400

**shopify.test.ts** — 9 tests
- `orders/create` → ShopifyOrder status = "processing"
- `orders/fulfilled` → status = "shipped" + lifecycle update
- `orders/updated` → cancelled_at → "cancelled"
- `fulfillments/create` → FulfillmentEvent upsert with tracking
- `fulfillments/update` → delivery detection + lifecycle
- Idempotency: already-processed webhook → skip
- Invalid HMAC → 401

**gmail.test.ts** — 7 tests
- Valid push → Message row created
- `// INVARIANT: Message dedupe on externalId` — duplicate = 0 new rows
- `// INVARIANT: OpenAI failures → Interventions` — AI fail = Intervention, no 500
- `// INVARIANT: AI drafts never auto-sent` — AIDraft.status = "draft"
- No brand resolution → processed=0
- Empty Pub/Sub data → processed=0

All tests use mocked Prisma — no live DB required.

### 2. Playwright E2E (`apps/web/e2e/`)

4 spec files:
- `onboarding.spec.ts` — signup → brand step → connect step → dashboard
- `campaigns.spec.ts` — create campaign → view detail
- `creators.spec.ts` — import CSV → verify creator → add to campaign
- `inbox.spec.ts` — thread list → thread detail → draft review UI

All marked with `test.skip` requiring `SUPABASE_E2E_ENABLED=1` env var.
Playwright config extended (not replaced) with `e2e-platform` project.

### 3. Observability

**`lib/logger.ts`** — Structured JSON logger with timestamp/level/event/context.

**`lib/sentry.ts`** — Sentry init stub (graceful no-op when no DSN).

**`instrumentation.ts`** — Next.js 15 instrumentation hook wiring Sentry init.

**Log calls added to 3 highest-risk paths:**
- Gmail ingest handler: receive, classify_inline, classified, low_confidence, fatal
- Shopify webhook handler: received, idempotency_hit, processing_error
- AI draft pipeline: classify.attempt, classify.failed, draft.failed, no_api_key

**`app/(platform)/admin/health/page.tsx`** — Server component health dashboard:
- Stuck CampaignCreators (>72h, not closed)
- Open InterventionCases count + list
- Failed WebhookEvents in last 24h
- Stale AI Drafts (>48h in "draft" status)
- Added to sidebar navigation (🏥 Health)

### 4. Migration Tooling (`apps/web/scripts/migrate-airtable.ts`)

- Accepts JSON export of Airtable records
- Maps Airtable status → platform lifecycleStatus:
  - Pending→ready, Contacted→outreach_sent, Address Received→address_received
  - Order Placed→order_placed, Shipped→shipped, Delivered→delivered
  - Posted→mentioned, Closed/Rejected→closed
- `--dry-run` mode: logs what would happen, inserts nothing
- Real run: upserts Creator by instagramHandle, creates CampaignCreator
- Output: `{ created, updated, skipped, errors[] }`

### 5. Feature Flags + Rollback Switches

**`lib/feature-flags.ts`** — Per-brand feature flag system:
- 4 flags: `aiReplyEnabled`, `unipileDmEnabled`, `shopifyOrderEnabled`, `reminderEmailEnabled`
- Stored in `BrandSettings.metadata` JSON field (new column added)
- **Fail-CLOSED**: if read fails, all flags default to `false`

**`app/api/settings/feature-flags/route.ts`** — GET/PATCH endpoints

**`app/(platform)/settings/feature-flags/page.tsx`** — Toggle UI (admin-only)

**4 guarded paths:**
- AI draft creation (`process-reply.ts` + `gmail/webhook`): disabled → creates Intervention
- Unipile DM send (`inbox/[threadId]/send-dm`): disabled → 403
- Shopify order creation (`campaigns/[campaignId]/creators/[creatorId]/order`): disabled → 403
- Reminder email send (`mention-check.ts`): disabled → skipped silently

### 6. Pilot Runbook (`docs/runbooks/pilot-cutover.md`)

- Pre-launch checklist (all env vars, webhook registrations, auth config)
- Rollout procedure: import Airtable → verify → enable flags one by one → monitor
- Rollback procedure: set all flags to false → check interventions → audit
- Incident response playbooks for AI auto-send, duplicate orders, rate limits

## Schema Changes

- `BrandSettings.metadata` (`Json?`) — added for feature flags storage

## Test Coverage Summary

| Suite | Tests | Status |
|-------|-------|--------|
| Stripe webhook | 8 | ✅ Pass |
| Shopify webhook | 9 | ✅ Pass |
| Gmail webhook | 7 | ✅ Pass |
| **Total** | **24** | **✅ All pass** |
| Playwright E2E | 4 specs | Created (skip-gated) |

## Residual Risks

1. **Stripe test mocking** — Tests mock `constructEvent` which means real signature validation is not tested in unit tests. Integration test recommended.
2. **Feature flag cache** — Flags are read on every request. For high traffic, consider caching with TTL.
3. **Migration script** — Airtable field name flexibility depends on actual export format. May need adjustment per export.
4. **Inline AI processing** — The Gmail webhook inline path (when Inngest is not configured) has more complex nesting due to the feature flag guard. Refactoring into a shared function would improve maintainability.

## Human Actions Needed Before Pilot

1. **Sentry account** — Create Sentry project, set `SENTRY_DSN` env var in Vercel
2. **OpenAI API key** — Set `OPENAI_API_KEY` in Vercel production env
3. **Airtable export** — Export Kalm's Instagram Influencers table as JSON array
4. **Run migration** — Execute `migrate-airtable.ts` with `--dry-run` first
5. **Webhook registration** — Register Stripe, Shopify, Gmail push endpoints
6. **Google OAuth** — Add test user to OAuth consent screen if in testing mode
7. **Database migration** — Run `prisma migrate deploy` for the new `metadata` column
8. **Feature flags** — All start disabled; enable one at a time per runbook
