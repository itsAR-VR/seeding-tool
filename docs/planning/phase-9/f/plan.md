# Phase 9f — Implement Shopify ordering, reminders, mentions, interventions, and consent suppression

## Focus
Complete the gifting lifecycle after address confirmation: Shopify order creation, fulfillment/delivery updates, reminder loops, mention attribution, intervention management, and opt-out/unsubscribe enforcement.

## Inputs
- `docs/planning/phase-9/plan.md`
- `docs/planning/phase-9/e/plan.md`
- `docs/planning/phase-8/finalplan.md`
- `docs/planning/phase-8/c/integrations.md`
- `docs/planning/phase-8/d/product-surfaces.md`
- `docs/planning/phase-8/e/rollout.md`
- `apps/web/prisma/schema.prisma`

## Skills Available for This Subphase
- `find-local-skills` output: unavailable on this machine (missing local index); fallback to manual skill selection.
- `find-skills` output: unavailable on this machine; fallback to confirmed local skills only.
- Planned invocations:
  - `backend-development`
  - `context7-docs`
  - `frontend-design`
  - `react-dev`
  - `javascript-typescript`

## Work

### 1. Implement Shopify order creation path
- build the order-create service against confirmed address snapshots and campaign product mappings
- persist `ShopifyOrder`
- enforce the one-order-per-campaign-creator guard
- write admin URL and external identifiers

### 2. Implement Shopify webhook handling
- fulfillment updates
- delivery updates
- replay-safe normalization via `WebhookEvent`
- append-only `FulfillmentEvent` history

### 3. Implement reminders
- post-delivery reminder schedule
- send path for reminder jobs
- suppression when posted/mentioned
- stop conditions after configured windows

### 4. Implement mentions ingestion
- webhook and/or poll-backed mention normalization
- `MentionAsset` persistence
- post/history count updates
- orphan mention visibility
- storage-degrade behavior without silently dropping mentions

### 5. Implement interventions queue and recovery actions
- create intervention cases from:
  - order failures
  - address ambiguity
  - mention failures
  - no-email/unresponsive policies
  - delivery failures
- intervention queue UI
- assign/resolve/retry linked work

### 6. Implement consent suppression
- public unsubscribe route
- token validation
- `optedOutAt` updates
- suppression of outreach, follow-ups, and reminders
- creator/profile visibility of opt-out state

### 7. Decide pilot treatment of cost sync
- if cost sync is implemented here, wire `CostRecord`
- if deferred, explicitly document it as non-blocking and keep lifecycle work independent of it

### 8. Validation
- `npm run web:build` (from repo root)
- targeted provider-handler tests for Shopify and mentions
- targeted Playwright or equivalent flow for:
  - confirm address -> create order
  - process delivery -> schedule reminder
  - ingest mention -> suppress reminder / update status
  - unsubscribe -> verify future sends suppressed

## Validation (RED TEAM)
- Shopify order creation must be tested with a real test store (Shopify Partner development store)
- One-order-per-campaign-creator guard must be tested: attempt to create order twice, verify second is no-op
- Unsubscribe route must be public (no auth) and handle invalid/expired tokens gracefully
- Mention dedupe must be tested: replay same mention webhook, verify no duplicate MentionAsset
- Reminder suppression must be tested: create mention for a creator with an open reminder, verify reminder is cancelled
- Intervention cases must include enough context for an operator to understand what failed and retry

## Output
- The platform supports the full gifting lifecycle from address confirmation through order, delivery, reminder, mention, intervention, and opt-out handling.
- The pilot-critical post-outreach behavior exists in code rather than only in planning docs.

## Handoff
Phase 9g should build the separate creator-search worker and integrate it back into campaigns/creator review now that the main lifecycle foundation is in place.
