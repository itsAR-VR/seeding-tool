# n8n Parity Gaps — Seed Scale Platform

## Summary

The Seed Scale platform (phases 9a–9f) covers the core seeding lifecycle well: creator approval, email outreach with follow-ups, AI reply classification, address extraction, Shopify draft order creation, fulfillment tracking, reminders, mentions via Instagram webhooks, and interventions. However, six functional gaps exist between the n8n workflows and the platform build. Three are high-risk for pilot launch (Unipile Instagram DMs, 17track delivery tracking, creator discovery pipeline). Two are medium-risk (cost tracking, Refunnel mention tracking). One is low-risk but needs validation (Shopify order type divergence).

---

## Aligned (covered by 9a–9f)

- **Email outreach + 5-step follow-up cadence** — 9e builds Gmail send + Inngest-based follow-up scheduling, matching AC-2's behavior
- **AI reply classification + address extraction** — 9e's `inbox/ai.ts` matches AC-3/4's OpenAI-based reply parsing and address extraction
- **Shopify order creation** — 9f's `lib/shopify/orders.ts` creates draft orders (with one-order guard), matching AC-3/4's order creation
- **Gmail reply ingestion** — 9e's Gmail webhook + pub/sub ingest matches AC-3/4's Gmail trigger
- **Creator approval queue** — 9e's review endpoint and UI match the Airtable approval flow
- **Mention detection via Instagram webhooks** — 9f's mentions ingestion via Instagram webhook matches AC-7/8/9's webhook-based story mention detection
- **Post-delivery reminder emails** — 9f's reminder scheduling + send matches AC-7/8/9's delivery-based email reminders
- **Fulfillment/delivery status from Shopify** — 9f handles Shopify fulfillment webhooks
- **Error handling with Discord/Slack notifications** — Platform uses InterventionCase instead (better pattern)
- **Airtable → Postgres migration** — All Airtable CRUD is replaced by Prisma/Postgres models
- **Google Sheets → Postgres migration** — All Google Sheets state management is replaced by platform DB

---

## Gap 1: Unipile Instagram DMs

### n8n behavior
The `[AC] Message System [Draft]` workflow uses **Unipile** (a unified messaging API) to send Instagram DMs to creators:

1. **Reads approved usernames** from a Google Sheet ("Send Message Approved")
2. **Looks up the Instagram provider ID** via `GET https://api11.unipile.com:14124/api/v1/users/{username}` (Bearer auth)
3. **Searches for existing chat** using cursor-based pagination through `GET /api/v1/chats?account_id={id}` matching on `provider_messaging_id`
4. **Sends to existing chat** via `POST /api/v1/chats/{chatId}/messages` OR **creates new chat** via `POST /api/v1/chats` with the provider ID
5. **Rate limiting**: Enforces 20 DMs/day per account via a Google Sheets counter (the "Controller" sheet tracks a `Locked` counter; when it hits 20, the workflow pauses with a 15-minute wait between batches)
6. **Lock/unlock pattern**: Uses a `Locked` flag in the Controller sheet to prevent concurrent runs
7. Also handles a **webhook path** for receiving email data from DM conversations and syncing back to Airtable

### Platform status: **Missing**

The platform has no Unipile integration, no Instagram DM send capability, and no DM-specific rate limiting.

### Risk: **HIGH** — Instagram DMs are a primary outreach channel alongside email. Mo's team actively uses this for creators who don't respond to email or don't have public email addresses.

### Recommendation: **Build in 9g** — Add Unipile DM send capability as a parallel outreach channel. This is pilot-critical because many creators are DM-first.

### Implementation notes
- Unipile API base: `https://api11.unipile.com:14124`
- Auth: Bearer token (store as `ProviderCredential` with `provider: "unipile"`)
- Key operations: lookup user by username, find/create chat, send message
- Rate limit: 20 DMs/day per account (enforce via DB counter on `SendingMetric` or a new `DmSendingMetric`, reset daily via cron)
- Reuse existing `ConversationThread` + `Message` models with `channel: "instagram_dm"` variant
- Needs new API route: `POST /api/inbox/[threadId]/send-dm`
- The webhook ingest path (email extraction from DM conversations) can be deferred post-pilot since it's a secondary data capture flow

---

## Gap 2: 17track Delivery Tracking

### n8n behavior
The `Delivery Bot` workflow integrates with **17track** for package tracking:

1. **Google Sheets Trigger** watches for new tracking numbers added to the "Influencer PR" sheet
2. **Registers tracking number** via `POST https://api.17track.net/track/v2/register` with the tracking number
3. **Receives push updates** via webhook at `/17track/update` when shipment status changes
4. **Processes delivery status**: Checks if `shipment_status === "delivered"` and updates the Google Sheet
5. Also receives **Shopify fulfillment-created webhooks** (separate trigger) and updates delivery dates

### Platform status: **Partially covered**

9f handles Shopify fulfillment webhooks, which provides tracking numbers and basic fulfillment events. However, the platform does **not** register tracking numbers with 17track and does **not** receive granular delivery status updates from 17track.

### Risk: **MEDIUM** — Shopify fulfillment webhooks provide basic "fulfilled" and sometimes "delivered" status, but 17track provides more granular tracking (in-transit, out-for-delivery, delivered, exception). The gap matters for: (a) knowing exact delivery date for reminder timing, (b) detecting delivery exceptions. However, Shopify's own delivery webhooks may be sufficient if the carrier integration is set up.

### Recommendation: **Defer to post-pilot** — Start with Shopify fulfillment/delivery webhooks only. If delivery date accuracy is insufficient for reminder timing, add 17track registration as a follow-up. The Shopify webhook path is already built in 9f.

### Implementation notes (if built later)
- 17track API: `POST /track/v2/register` to register, webhook push for updates
- Would need: `ProviderCredential` for 17track API key, webhook endpoint at `/api/webhooks/17track/route.ts`
- Map 17track statuses to `FulfillmentEvent` records
- Estimated effort: 1-2 days

---

## Gap 3: Creator Discovery (PhantomBuster + Apify Pipeline)

### n8n behavior
The `[AC] (1) Instagram Following [PROD]` workflow implements a multi-stage creator discovery pipeline:

1. **PhantomBuster "Instagram Following" agent** (ID: `4649961938723340`) — scrapes the following list of seed accounts. Accepts a Google Sheets URL with seed accounts and extracts usernames at 10 profiles per launch. Uses a browser session cookie for authentication.
2. **Polls PhantomBuster output** via `getOutput` API, waits for completion with status checks
3. **Downloads CSV result** from PhantomBuster's output URL
4. **Filters by date** (today only) to avoid reprocessing
5. **Saves to Google Sheets** (temp scraping sheet) for deduplication
6. **Apify "Instagram Profile Scraper"** (task ID: `RG0WtfH5V3Cpx8X9o`) — enriches each username with full profile data (followers count, bio, posts, video views)
7. **Filters by follower count** (configurable via `$vars.Instagram_min_followers` / `$vars.Instagram_max_followers`)
8. **Calculates average video views** with detailed per-user stats
9. **Filters by average views threshold**
10. **OpenAI bio analysis** — classifies creator category from bio text
11. **Extracts email from bio**
12. **Deduplicates against existing Airtable records**
13. **Saves qualified creators** to Airtable's "Instagram Influencers" table
14. **Notifies via Slack + Discord** with batch completion stats
15. Uses a **Controller sheet** lock pattern to prevent concurrent runs (same pattern as DM workflow)

### Platform status: **Partially covered**

9g plans to build a Playwright-based creator search worker against Meta Creator Marketplace. This is a fundamentally **different approach** than n8n's PhantomBuster + Apify chain:
- n8n: Discovers via seed account following lists → enriches via profile scraping → AI-categorizes
- Platform: Searches Meta Creator Marketplace by criteria → returns results

### Risk: **MEDIUM** — The platform's Meta Creator Marketplace approach may actually be superior (structured search vs. following-list scraping). However:
- The PhantomBuster pipeline discovers "organic" creators via social graph traversal, which finds creators that keyword search misses
- The Apify enrichment provides detailed engagement metrics (avg video views) that Marketplace may not surface
- The n8n pipeline is battle-tested and running in production

### Recommendation: **9g proceeds as planned with Meta Creator Marketplace worker**. The PhantomBuster/Apify pipeline is a *different discovery strategy*, not a gap in the same strategy. Both approaches should eventually coexist. For pilot: the Marketplace worker + CSV import + manual add covers the critical path. The PhantomBuster/Apify strategy can run in parallel via n8n during the transition, or be added as a second worker type post-pilot.

### Implementation notes (if built later)
- Would be a second worker type alongside the Playwright Marketplace worker
- Needs PhantomBuster API credentials + Apify API credentials as `ProviderCredential`
- Would feed into the same `CreatorSearchResult` → approval queue pipeline
- The Apify enrichment step (follower count, avg views, bio analysis) could be extracted into a reusable "creator enrichment" service

---

## Gap 4: Shopify Order Type Divergence

### n8n behavior
AC-3/4 creates orders via `n8n-nodes-base.shopify` node's **direct order creation** (the `Create an order` node).

### Platform behavior
9f's `lib/shopify/orders.ts` creates a **draft order → completes it** (two-step pattern with 100% discount).

### Risk: **LOW** — The draft order pattern is actually the *correct* approach for seeding because:
- Draft orders allow applying a 100% discount without needing a discount code
- Draft orders are idempotent (can be created without immediately committing)
- Draft orders show clearly in Shopify admin as gifted/seeding orders
- The n8n direct order approach likely requires workarounds for the $0 price

### Recommendation: **No action needed** — The platform's draft order approach is superior. Validate during pilot that the Shopify store's fulfillment workflows handle completed draft orders the same as regular orders (fulfillment triggers, tracking number assignment, webhook events).

---

## Gap 5: Cost Tracking (COGS)

### n8n behavior
The `[AC] Costs COGS + Tools - Seeding Orders` workflow:

1. **Configures** variant ID and tag filter for seeding orders
2. **Queries Shopify GraphQL API** (`POST /admin/api/2024-10/graphql.json`) for orders matching the seeding tag
3. **Calculates costs** per order: iterates through orders, matches target variant ID, extracts order details
4. **Reads tool costs** from Google Sheets ("Cost Tools" tab)
5. **Updates Airtable** "Cost" table with calculated COGS data

This provides Mo with visibility into total seeding spend (product COGS + tool costs per period).

### Platform status: **Missing**

The `CostRecord` model exists in the schema (from Phase 8), but 9f's plan explicitly defers cost sync: *"if cost sync is implemented here, wire CostRecord; if deferred, explicitly document it as non-blocking."*

### Risk: **MEDIUM** — Cost tracking is important for business visibility but does not block the seeding operational loop. Mo needs this for ROI analysis and budget management, but it can be backfilled from Shopify data at any time.

### Recommendation: **Defer to post-pilot** — The CostRecord model exists. Building the Shopify GraphQL query + aggregation can happen after the operational loop is validated. For pilot, Mo can continue using the n8n workflow for cost reporting while the platform handles operations.

### Implementation notes (if built later)
- Cron job: queries Shopify GraphQL for orders with seeding tag
- Calculates COGS per order (variant cost × quantity)
- Persists to `CostRecord` table
- Dashboard widget for total spend/period
- Estimated effort: 1-2 days

---

## Gap 6: Mention Tracking via Slack/Refunnel

### n8n behavior
The `Refunnel tracker` workflow:

1. **Slack Trigger** — listens to a Slack channel where Refunnel (a third-party mention monitoring service) posts notifications about brand mentions
2. **Parses Slack message** — recursively extracts all strings from Slack payload, strips `<url|text>` formatting, extracts: handle, platform (Instagram/TikTok), link, and text fields
3. **Routes by platform** (Instagram vs other)
4. **Matches mentions to existing creators** in the "Influencer PR" Google Sheet
5. **Updates "Content Pushers"** sheet — tracks creator posting activity, counts mentions
6. **Handles new vs existing** creators — creates new rows for unknown creators, updates existing rows for known ones

This is a *separate mention source* from the Instagram webhook-based mention detection in AC-7/8/9. Refunnel monitors for brand mentions across platforms via a commercial service, while the Instagram webhook catches story mentions and tags directly.

### Platform status: **Partially covered**

9f implements Instagram webhook-based mention detection (story mentions, tags). The Refunnel/Slack integration is a *supplementary* mention source that catches mentions the Instagram API misses (feed posts, reels, TikTok, etc.).

### Risk: **LOW-MEDIUM** — The Instagram webhook covers the most important mention type (story mentions with @tags). Refunnel provides broader coverage but is a third-party service dependency. For pilot, Instagram webhooks are likely sufficient.

### Recommendation: **Defer to post-pilot** — Instagram webhook mentions cover the critical path. Add a generic "external mention ingest" webhook endpoint later that could receive data from Refunnel, Slack, or other sources. The `MentionAsset` model already supports `platform` and `mediaUrl` fields that would work for multi-platform mentions.

### Implementation notes (if built later)
- Generic webhook endpoint: `POST /api/webhooks/mentions/external`
- Accepts: `{ platform, handle, url, text, detectedAt }`
- Matches to existing `Creator` by handle/username
- Creates `MentionAsset` with `source: "refunnel"` or similar
- Could also accept direct Slack webhook integration
- Estimated effort: 1 day

---

## Gap 7: Instagram Tag Counting via Graph API Polling

### n8n behavior
Within the `[AC] (7) (8) (9) Mentions` workflow, there's a scheduled job that:

1. **Queries Instagram Graph API** (`GET /{user_id}/tags?fields=...`) to get all posts the brand account is tagged in
2. **Matches tagged posts against known creators** from Airtable
3. **Updates tag counts** per creator
4. **Creates "Posts Mentions"** records in Airtable for each matched tag

This is distinct from the webhook-based story mention detection — it uses polling to catch feed post tags that may not fire webhooks.

### Platform status: **Partially covered**

9f's Instagram webhook handles `story_mention` events. Feed post tags may or may not fire webhooks depending on Instagram API configuration. The Graph API polling approach is a safety net.

### Risk: **LOW** — The webhook approach catches real-time mentions. The polling approach is a supplementary safety net. For pilot, webhooks should be sufficient; polling can be added if mention counts seem low.

### Recommendation: **Defer to post-pilot** — Add a cron-based Graph API poll as a mention reconciliation job if webhooks prove unreliable.

---

## Decision Required from Mo

1. **Unipile Instagram DMs** — Is DM outreach required for pilot launch, or can it be added post-launch? If required, it should be folded into 9g. If DMs can wait, email-only outreach is sufficient for pilot.

2. **PhantomBuster/Apify pipeline** — Can the n8n discovery pipeline continue running alongside the platform during pilot? If yes, 9g's Marketplace worker is sufficient for pilot. If the n8n pipeline must be shut down before pilot, we need a migration plan.

3. **17track vs Shopify delivery tracking** — Is the granular tracking data from 17track critical for pilot operations, or can we start with Shopify fulfillment webhooks and add 17track later?

---

## 9g Impact

### Should be folded into 9g scope
- **Unipile Instagram DMs** (Gap 1) — IF Mo confirms DMs are pilot-critical. This is the only high-risk gap. See `docs/planning/phase-9/g/unipile-spec.md` for implementation spec.

### Explicitly deferred to post-pilot
- **17track delivery tracking** (Gap 2) — Shopify webhooks cover the critical path
- **PhantomBuster/Apify discovery** (Gap 3) — Different strategy, n8n can continue in parallel
- **Cost tracking / COGS** (Gap 5) — Business intelligence, not operational blocker
- **Refunnel/Slack mention tracking** (Gap 6) — Instagram webhooks cover primary path
- **Instagram Graph API tag polling** (Gap 7) — Safety net, not critical for pilot

### No action needed
- **Shopify order type divergence** (Gap 4) — Platform's draft order pattern is superior; validate during pilot only
