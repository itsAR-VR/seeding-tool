# Phase 9f — Completion

## Status: COMPLETE ✅

**Commit:** `feat(9f): Shopify orders, fulfillment webhooks, reminder loops, mention attribution, interventions, consent suppression`
**Build:** `npm run web:build` — PASS (zero errors)

## What Was Built

### 1. Shopify Order Creation (`apps/web/lib/shopify/`)
- **`client.ts`** — `getShopifyClient(brandId)`: decrypts Admin API access token from `ProviderCredential` (provider="shopify"), resolves store domain from `BrandConnection`, returns configured REST API client
- **`orders.ts`** — `createDraftOrder(brandId, creatorId, campaignId)`:
  - Fetches confirmed `ShippingAddressSnapshot` (isActive + confirmedAt not null)
  - Fetches gifted product/variant from campaign's `CampaignProduct` → `BrandProduct`
  - Creates draft order with 100% discount ($0 gift)
  - Completes draft order via Shopify API
  - Persists `ShopifyOrder` row with shopifyOrderId, shopifyOrderNumber, status="created"
  - Updates `CampaignCreator.lifecycleStatus = "order_created"`
  - One-order-per-campaign-creator guard enforced
- **API:** `POST /api/campaigns/[campaignId]/creators/[creatorId]/order` — human-initiated order creation; creates Intervention on failure

### 2. Shopify Webhook Handler (`apps/web/app/api/webhooks/shopify/route.ts`)
- HMAC signature verification using `SHOPIFY_WEBHOOK_SECRET`
- Routes by `X-Shopify-Topic`:
  - `orders/create` — upsert ShopifyOrder status to "processing"
  - `orders/fulfilled` — update to "shipped", update lifecycle, emit `shopify/order.fulfilled` Inngest event
  - `orders/updated` — sync status changes (cancelled, fulfilled, paid)
  - `fulfillments/create` — create/update `FulfillmentEvent` with tracking number + carrier
  - `fulfillments/update` — update tracking info, detect delivery → update order + lifecycle, emit `shopify/fulfillment.updated`
- All handlers idempotent via `WebhookEvent` dedupe on external ID
- Brand resolution by `X-Shopify-Shop-Domain` header
- Always returns 200 to prevent Shopify retries

### 3. Reminder System (`apps/web/lib/inngest/functions/`)
- **`reminders.ts`** — `scheduleReminders` Inngest function on `shopify/order.fulfilled`:
  - Fetches `BrandSettings.defaultFollowUpDays` and `maxFollowUps` (never hardcoded)
  - Creates `ReminderSchedule` records for each reminder
  - Uses `step.sleep()` for Inngest-managed delays
  - Before each reminder: checks lifecycle status (skip if posted/completed/opted_out) and checks for `MentionAsset` existence
  - Emits `reminder/send` events
- **`mention-check.ts`** — `handleReminderSend` Inngest function on `reminder/send`:
  - Checks `MentionAsset` for creator → if found, updates lifecycle to "posted" and cancels remaining reminders
  - Checks suppression before sending (mandatory)
  - Looks up reminder `OutreachTemplate` (type="reminder")
  - Sends via Gmail send path from 9e
  - Creates Intervention on failure (no template, send failure)

### 4. Mention Attribution (`apps/web/lib/mentions/attribution.ts`)
- `attributeMention(mentionAssetId, campaignCreatorId)` — links mention to creator, updates lifecycle to "posted", cancels pending reminders
- `createAndAttributeMention(params)` — creates MentionAsset with dedupe by platform+mediaUrl, then attributes
- **API:** `GET /api/mentions?campaignId=xxx` — list mentions for a campaign; `POST /api/mentions` — manual attribution or creation
- **UI:** `/campaigns/[campaignId]/mentions` — client-side mentions view with form to add mentions, platform badges, engagement stats, view links

### 5. Intervention Management (`apps/web/lib/interventions/service.ts`)
- `listInterventions(brandId, filters)` — filtered list with priority + date ordering
- `resolveIntervention(id, resolution, resolvedBy)` — marks resolved with timestamp
- `createIntervention(payload)` — creates new intervention case
- **API:**
  - `GET /api/interventions?status=open&type=...&priority=...` — list with filters
  - `POST /api/interventions` — create new intervention
  - `PATCH /api/interventions/[id]` — resolve or update status
- **UI:** `/interventions` — intervention queue with:
  - Type badges (🔒 Captcha, 🔑 Auth Failure, 📦 Order Failed, ❓ Reply Unclear, 👀 Manual Review)
  - Priority and status badges with color coding
  - Filter tabs (open, in_progress, resolved, all)
  - Inline resolution form
- Added to sidebar navigation (🚨 Interventions)

### 6. Consent Suppression (`apps/web/lib/compliance/suppression.ts`)
- `isSuppressed(email)` — checks `Creator.optedOut` field for normalized email
- `addSuppression(email, reason)` — sets `Creator.optedOut=true` + `optOutDate`, updates all linked `CampaignCreator.lifecycleStatus` to "opted_out"
- `generateUnsubscribeToken(email)` / `verifyUnsubscribeToken(email, token)` — HMAC-based token generation/verification using `APP_ENCRYPTION_KEY`
- `SuppressedRecipientError` — custom error thrown when sending to suppressed recipient
- **Gmail send path updated:** `sendEmail()` now checks `isSuppressed(params.to)` before any send operation
- **Unsubscribe webhook:** `GET /api/webhooks/unsubscribe?email=xxx&token=xxx` — public endpoint (no auth), verifies HMAC token, calls `addSuppression`, returns plain text confirmation

### 7. Orders UI (`apps/web/app/(platform)/campaigns/[campaignId]/orders/page.tsx`)
- Table of ShopifyOrders: creator name, order ID/number, status badge, tracking (carrier + number), date
- "Ready to Order" section for creators in `address_confirmed` state with "Place Order" button
- Status color coding (created → blue, processing → yellow, shipped → indigo, delivered → green, cancelled → red)
- Updated creators API to include `shopifyOrder` with `fulfillmentEvents`

## Invariants Enforced

1. **`// INVARIANT: Suppressed recipients never receive email — checked before every send`**
   - Enforced in: `gmail/send.ts` (pre-send check), `mention-check.ts` (pre-reminder check)
   - `SuppressedRecipientError` thrown, Intervention created instead of sending

2. **`// INVARIANT: All Shopify webhook handlers are idempotent — upsert by external ID`**
   - Enforced in: `webhooks/shopify/route.ts` — all 5 handlers use `WebhookEvent` dedupe + `upsert` operations
   - Fulfillment events upserted by `externalEventId`
   - Orders matched by `shopifyOrderId`

3. **`// INVARIANT: Reminder cadence uses BrandSettings values, never hardcoded`**
   - Enforced in: `reminders.ts` (reads `defaultFollowUpDays`, `maxFollowUps` from BrandSettings)
   - Enforced in: `mention-check.ts` (reads `maxFollowUps` from BrandSettings)

## Files Changed (20 files, ~2660 lines)

### New files (16):
- `apps/web/lib/shopify/client.ts` — Shopify API client
- `apps/web/lib/shopify/orders.ts` — draft order creation + completion
- `apps/web/lib/compliance/suppression.ts` — suppression service
- `apps/web/lib/inngest/functions/reminders.ts` — reminder scheduler
- `apps/web/lib/inngest/functions/mention-check.ts` — reminder send handler
- `apps/web/lib/mentions/attribution.ts` — mention attribution service
- `apps/web/lib/interventions/service.ts` — intervention CRUD service
- `apps/web/app/api/webhooks/shopify/route.ts` — Shopify webhook handler
- `apps/web/app/api/webhooks/unsubscribe/route.ts` — unsubscribe endpoint
- `apps/web/app/api/campaigns/[campaignId]/creators/[creatorId]/order/route.ts` — order creation API
- `apps/web/app/api/mentions/route.ts` — mentions API
- `apps/web/app/api/interventions/route.ts` — interventions list/create API
- `apps/web/app/api/interventions/[id]/route.ts` — intervention resolve API
- `apps/web/app/(platform)/campaigns/[campaignId]/orders/page.tsx` — orders UI
- `apps/web/app/(platform)/campaigns/[campaignId]/mentions/page.tsx` — mentions UI
- `apps/web/app/(platform)/interventions/page.tsx` — interventions queue UI

### Modified files (4):
- `apps/web/lib/gmail/send.ts` — added suppression check before every send
- `apps/web/app/api/inngest/route.ts` — registered new Inngest functions
- `apps/web/app/api/campaigns/[campaignId]/creators/route.ts` — include shopifyOrder in response
- `apps/web/app/(platform)/layout.tsx` — added Interventions to sidebar nav
