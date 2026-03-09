# Integration Status Report — Seed Scale

> Generated: 2025-07-18
> Scope: `/apps/web` — audit of Apify, Shopify, Instagram/Meta, Track17, Cloudinary

---

## 1. Apify

**Integration Level: None (credentials only)**

### What Exists
- `.env.local` has `APIFY_API_TOKEN`, `APIFY_PROXY_PASSWORD`, `APIFY_USER_ID` configured
- `"apify"` is listed as a valid `discoverySource` in `app/api/creators/import/route.ts` (line 60)
- `"apify"` appears as a filter option in the Creators list page (`app/(platform)/creators/page.tsx`, line 156)

### What's Missing
- **No Apify client/SDK integration** — no `lib/apify/` directory, no API calls, no actor runs
- **No Apify npm package** in `package.json`
- **No scraping or data pipeline** — the app currently uses PhantomBuster for creator discovery (`PHANTOMBUSTER_API_KEY` in env); Apify is only recognized as a data source label during CSV import
- **No automated actor triggers** — the `lib/workers/creator-search.ts` and `lib/inngest/functions/creator-search.ts` are stubs for a future Playwright-based search worker, not Apify actors

### Files Involved
| File | Role |
|------|------|
| `app/api/creators/import/route.ts` | Accepts `"apify"` as a `discoverySource` value |
| `app/(platform)/creators/page.tsx` | Shows `"Apify"` as a filter option in the discovery source dropdown |

### Recommended Next Steps
1. Install `apify-client` npm package
2. Create `lib/apify/client.ts` with token from env
3. Build actor-based creator scraping pipeline (e.g., Instagram Profile Scraper actor) as alternative to PhantomBuster
4. Wire into `creator-search/requested` Inngest event so Apify actors can fulfill search jobs
5. Consider using Apify proxy for any browser automation tasks

---

## 2. Shopify (Kalm Wellness)

**Integration Level: Complete (production-ready for core flow)**

### What Exists

#### Per-Brand Connection System
- **Connection UI**: `app/(platform)/settings/connections/page.tsx` — full connect/disconnect Shopify card with store domain + access token form
- **Connection API**: `app/api/connections/shopify/route.ts` — GET (check status), POST (validate & save credentials), DELETE (disconnect)
- Credentials stored encrypted via `ProviderCredential` model (`provider="shopify"`) with per-brand `BrandConnection`
- Validates token against Shopify Admin API before saving

#### Shopify Client
- `lib/shopify/client.ts` — per-brand authenticated client that decrypts stored access token and constructs Admin REST API requests (v2024-01)

#### Draft Order + Fulfillment Flow
- `lib/shopify/orders.ts` — `createDraftOrder()`: creates a 100%-discounted draft order for creator gifting, completes it, persists `ShopifyOrder` row, updates `CampaignCreator.lifecycleStatus` to `"order_created"`
- Order creation gated by feature flag `shopifyOrderEnabled`
- One-order-per-campaign-creator guard (invariant)

#### Webhook Handler
- `app/api/webhooks/shopify/route.ts` — handles 5 topics:
  - `orders/create` → updates ShopifyOrder status
  - `orders/fulfilled` → marks shipped, updates lifecycle, emits Inngest event for reminder scheduling
  - `orders/updated` → syncs status changes (cancelled, processing, shipped)
  - `fulfillments/create` → creates FulfillmentEvent with tracking info
  - `fulfillments/update` → updates tracking, marks delivered, triggers delivery Inngest event
- HMAC signature verification via `SHOPIFY_WEBHOOK_SECRET`
- Full idempotency via `WebhookEvent` dedup

#### Prisma Models
- `ShopifyOrder` — tracks order lifecycle (created → processing → shipped → delivered → cancelled)
- `FulfillmentEvent` — tracking number, URL, carrier, estimated delivery

#### Tests
- `__tests__/webhooks/shopify.test.ts` — webhook handler test suite

### What's Missing
- **Product sync** — products are manually configured in campaigns (no automatic Shopify product catalog sync)
- **Multi-store support** — works per-brand, but the global `.env.local` Kalm Wellness credentials (`SHOPIFY_STORE_DOMAIN`, `SHOPIFY_ADMIN_API_TOKEN`) are fallbacks not currently used by the per-brand system
- **Inventory checking** — no stock validation before creating draft orders
- **Webhook registration automation** — webhooks must be manually configured in Shopify admin; no programmatic subscription setup
- **GraphQL migration** — uses REST API v2024-01; Shopify is deprecating REST in favor of GraphQL

### Files Involved
| File | Role |
|------|------|
| `lib/shopify/client.ts` | Per-brand authenticated Shopify Admin API client |
| `lib/shopify/orders.ts` | Draft order creation with 100% discount for gifting |
| `app/api/connections/shopify/route.ts` | Connect/disconnect/check Shopify (per-brand) |
| `app/api/webhooks/shopify/route.ts` | Webhook handler (orders + fulfillments) |
| `app/(platform)/settings/connections/page.tsx` | UI for connecting Shopify store |
| `app/(platform)/campaigns/[campaignId]/orders/page.tsx` | Orders management page |
| `app/api/campaigns/[campaignId]/creators/[creatorId]/order/route.ts` | API to trigger order creation |
| `lib/feature-flags.ts` | `shopifyOrderEnabled` flag |
| `__tests__/webhooks/shopify.test.ts` | Webhook handler tests |
| `prisma/schema.prisma` | `ShopifyOrder`, `FulfillmentEvent` models |

### Recommended Next Steps
1. Add product catalog sync (pull products/variants from connected store)
2. Add inventory check before draft order creation
3. Build webhook auto-registration on connect (subscribe to required topics programmatically)
4. Plan GraphQL migration for future-proofing
5. Clarify role of global Kalm Wellness env vars vs per-brand credentials

---

## 3. Instagram / Meta

**Integration Level: Partial (manual mentions only — no Graph API integration)**

### What Exists

#### Environment Variables
- `.env.local` has: `META_APP_ID`, `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_USERNAME`, `INSTAGRAM_USER_ID`, `INSTAGRAM_GRAPH_ID`

#### Mentions System (Manual)
- `app/(platform)/campaigns/[campaignId]/mentions/page.tsx` — UI to manually add + list mentions with platform, media URL, type (post/story/reel/video), caption
- `app/api/mentions/route.ts` — GET (list mentions for campaign), POST (create or attribute mention)
- `lib/mentions/attribution.ts` — `attributeMention()` and `createAndAttributeMention()` — links mentions to campaign creators, updates lifecycle to "posted", cancels pending reminders
- `MentionAsset` Prisma model — stores platform, mediaUrl, type, caption, engagement metrics, deduped by `[platform, mediaUrl]`

#### Instagram DMs via Unipile (3rd party)
- `lib/unipile/client.ts` + `lib/unipile/dms.ts` — sends Instagram DMs via Unipile messaging API (rate-limited: 20 DMs/day)
- `app/api/connections/unipile/route.ts` — connect Unipile credentials
- `app/api/inbox/[threadId]/send-dm/route.ts` — DM sending endpoint
- This is a **proxy service** (Unipile), not direct Instagram Graph API

#### Creator Discovery (Stub)
- `lib/workers/creator-search.ts` — stub for future Playwright-based creator search on Meta Creator Marketplace / Instagram; currently just queues an Inngest event
- `lib/inngest/functions/creator-search.ts` — creates a tracking `CreatorSearchJob` + `InterventionCase`; no actual search logic

### What Does NOT Exist (Critical Gaps)
- **No Instagram Graph API client** — despite having `INSTAGRAM_ACCESS_TOKEN` and `INSTAGRAM_GRAPH_ID` in env, there is zero code calling `graph.facebook.com` or `graph.instagram.com`
- **No Instagram OAuth flow** — no routes for brands to connect their own Instagram accounts (unlike the Gmail/Shopify OAuth flows)
- **No automated mention detection** — the mention-check Inngest function (`lib/inngest/functions/mention-check.ts`) only checks if a `MentionAsset` already exists in the DB; it does NOT scrape or poll Instagram for new mentions/tags
- **No webhook subscription** for Instagram — no `app/api/webhooks/instagram/` route
- **No social listening** — no Refunnel-style monitoring where brands connect their Instagram and the app monitors @mentions/tags
- **No Instagram connection card** on the Connections page — the page only shows Gmail, Shopify, and Unipile

### Files Involved
| File | Role |
|------|------|
| `app/api/mentions/route.ts` | CRUD for mentions (manual) |
| `lib/mentions/attribution.ts` | Link mentions to campaign creators |
| `app/(platform)/campaigns/[campaignId]/mentions/page.tsx` | UI for viewing/adding mentions |
| `lib/unipile/client.ts` | Unipile API client (for Instagram DMs) |
| `lib/unipile/dms.ts` | Instagram DM sending via Unipile |
| `app/api/connections/unipile/route.ts` | Unipile credential management |
| `lib/inngest/functions/mention-check.ts` | Checks DB for existing mentions (no scraping) |
| `lib/workers/creator-search.ts` | Stub for future browser-based creator search |
| `lib/inngest/functions/creator-search.ts` | Stub: queues search job + creates intervention |
| `prisma/schema.prisma` | `MentionAsset`, `CreatorSearchJob`, `CreatorSearchResult` models |

### Recommended Next Steps (Priority Order)
1. **Instagram OAuth flow** — build `app/api/auth/instagram/route.ts` + callback for brands to connect their Instagram Business/Creator accounts via Meta Login
2. **Instagram Graph API client** — create `lib/instagram/client.ts` using the Instagram Graph API to:
   - Fetch tagged media (`/me/tags`)
   - Fetch mentions (`/{ig-user-id}/mentioned_media`)
   - Get media insights (likes, comments, reach)
3. **Automated mention polling** — upgrade the `mention-check` Inngest function to periodically poll the Instagram Graph API for new tagged posts/mentions per connected brand
4. **Instagram webhook subscription** — subscribe to `mentions` and `comments` webhooks via Meta's Webhook system for real-time notifications
5. **Instagram connection card** — add to the Connections page so brands can connect their Instagram account alongside Gmail and Shopify
6. **Social listening dashboard** — build a view showing all brand @mentions across connected accounts (Refunnel-style)

---

## 4. Track17

**Integration Level: None**

### What Exists
- No code references to `track17`, `Track17`, `TRACK17`, or `17track` anywhere in the codebase
- No env vars for Track17
- Shipment tracking is handled entirely by **Shopify fulfillment webhooks** — the `FulfillmentEvent` model stores tracking number, URL, carrier, and status updates received from Shopify webhooks

### What's Missing
- **No Track17 API client**
- **No independent shipment tracking** — all tracking data comes from Shopify webhook events
- **No tracking number lookup** — users can't query a tracking number to get current status; they only see what Shopify reports

### Files Involved
| File | Role |
|------|------|
| `app/api/webhooks/shopify/route.ts` | Receives fulfillment tracking data from Shopify |
| `prisma/schema.prisma` | `FulfillmentEvent` model (tracking_number, tracking_url, carrier) |

### Recommended Next Steps
1. Install Track17 API client or use their REST API
2. Create `lib/track17/client.ts` for tracking number registration and status polling
3. Build an Inngest function that registers tracking numbers with Track17 when fulfillment events arrive from Shopify
4. Subscribe to Track17 webhooks for real-time tracking updates (more granular than Shopify's)
5. Add tracking status display to the orders page with detailed carrier events
6. Consider Track17 as the canonical tracking source (Shopify fulfillment events can be spotty for detailed status)

---

## 5. Cloudinary

**Integration Level: None (credentials only)**

### What Exists
- `.env.local` has `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_URL` configured
- Zero code references to `cloudinary` or `Cloudinary` in the entire codebase
- No `cloudinary` npm package in `package.json`

### What's Missing
- **No Cloudinary SDK or client**
- **No media upload/storage pipeline** — MentionAsset stores `mediaUrl` as external URLs (e.g., Instagram post links), not uploaded assets
- **No image transformation or CDN usage**
- **No asset library** for campaign media, product images, or creator content

### Files Involved
None.

### Recommended Next Steps
1. Install `cloudinary` npm package
2. Create `lib/cloudinary/client.ts` with upload, transform, and URL generation helpers
3. Primary use cases to build:
   - **Mention media archival** — when a mention is detected/added, download the media (Instagram post image/video) and upload to Cloudinary for permanent storage (Instagram URLs expire)
   - **Product image management** — store campaign product images in Cloudinary
   - **Creator avatar/content storage** — cache creator profile pictures
4. Add `cloudinaryAssetId` field to `MentionAsset` model for backed-up media
5. Use Cloudinary transformations for generating thumbnails in the mentions and campaign views

---

## Summary Table

| Service | Level | Env Vars | Code Integration | Production Ready |
|---------|-------|----------|-----------------|-----------------|
| **Apify** | None | ✅ 3 vars | ❌ Label only | ❌ No |
| **Shopify** | Complete | ✅ 4 vars | ✅ Full CRUD + webhooks | ✅ Yes (core flow) |
| **Instagram/Meta** | Partial | ✅ 7 vars | ⚠️ Manual mentions only | ❌ No Graph API |
| **Track17** | None | ❌ None | ❌ None | ❌ No |
| **Cloudinary** | None | ✅ 4 vars | ❌ None | ❌ No |

### Critical Path
The most impactful next integration is **Instagram/Meta Graph API** — it's the core value prop for a seeding tool (automated mention detection → lifecycle advancement). The credentials are ready; the data model exists (`MentionAsset`); only the API integration layer and OAuth flow are missing.
