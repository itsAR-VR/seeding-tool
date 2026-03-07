# Phase 9g — Completion

## Summary

Phase 9g implements the creator search worker stub, creator search/filter UI, review-to-campaign import flow, source-agnostic creator import, and Unipile Instagram DM integration.

## What was built

### 1. Creator Import (source-agnostic)
- **Page**: `/creators/import` — CSV upload form with preview table before confirming
- **API**: `POST /api/creators/import` — parses CSV rows, upserts by `instagramHandle`, tags `discoverySource`
- Accepts columns: `username, email, followerCount, avgViews, bioCategory, discoverySource`
- Returns `{ created, updated, skipped }` counts
- Creates `CreatorProfile` (instagram) alongside each Creator

### 2. Creator Search + Filter UI
- **Page**: `/creators` — search bar, multi-filter (followers, views, category, source), paginated table
- **API**: `GET /api/creators` — query params: `search, minFollowers, maxFollowers, minViews, maxViews, category, source, page, limit`
- "Add to Campaign" button per row → modal to select campaign → creates `CampaignCreator` row
- Nav item added to platform sidebar

### 3. Playwright Creator Search Worker (STUB)
- **Worker stub**: `lib/workers/creator-search.ts` — emits `creator-search/requested` Inngest event
- **Inngest function**: `lib/inngest/functions/creator-search.ts` — creates `CreatorSearchJob` + `InterventionCase` for tracking
- **API**: `POST /api/campaigns/:campaignId/search` — triggers search with criteria
- Real browser automation deferred until hosting decision

### 4. Review-to-Campaign Import
- **Page**: `/campaigns/:campaignId/import` — multi-select table of existing creators not yet in campaign
- **API**: `POST /api/campaigns/:campaignId/import` — `{ creatorIds: string[] }` → batch upsert `CampaignCreator` with `reviewStatus: "pending"`
- Returns `{ added, skipped, invalid }` counts

### 5. Unipile Instagram DM Channel
- **Client**: `lib/unipile/client.ts` — decrypts API key from `ProviderCredential`, returns configured HTTP client
- **DMs**: `lib/unipile/dms.ts`:
  - `checkDailyLimit(brandId)` — 20 DM/day limit per brand
  - `getOrCreateChat(brandId, username)` — user lookup → chat search → create if needed
  - `sendDm(brandId, chatId, message)` — POST to Unipile chat messages endpoint
- **API**: `POST /api/inbox/:threadId/send-dm` — auth, rate limit check, send DM, persist Message

### 6. DM Inbox UI Additions
- Thread detail page: channel badge (📧 Email / 📱 DM) in header
- DM compose section for instagram_dm threads or creators with Instagram handle
- Send DM button calls `/api/inbox/[threadId]/send-dm`

### 7. Unipile Connection Setup
- Settings → Connections page: "Connect Unipile" card with API key + account ID inputs
- **API**: `POST /api/connections/unipile` — encrypts and stores `ProviderCredential` + `BrandConnection`

## Schema Changes

### Creator model additions
- `instagramHandle` (`String?`) — unique per brand for dedup
- `discoverySource` (`String`, default `"manual"`) — always tagged, never null
- `followerCount` (`Int?`), `avgViews` (`Int?`), `bioCategory` (`String?`)
- Unique constraint: `@@unique([brandId, instagramHandle])`

### ConversationThread additions
- `channel` (`String`, default `"email"`) — `email | instagram_dm`
- `unipileChatId` (`String?`) — Unipile chat ID for DM routing

### Message channel
- Updated to include `instagram_dm` as valid value

### ProviderCredential
- Now accepts `provider: "unipile"`

## Invariants Enforced

All invariants documented in code comments:
- `// INVARIANT: Creators are deduplicated by instagramHandle on import`
- `// INVARIANT: discoverySource is always tagged — never null`
- `// INVARIANT: Unipile DMs limited to 20/day per brand account`
- `// INVARIANT: DM send only on explicit human action — never automated`

## Validation

- `npm run web:build` — ✅ passes
- All 18 files compiled without TypeScript errors
- Prisma schema regenerated after model changes

## What was NOT built (by design)

- **Meta Creator Marketplace worker**: Explicitly deferred to post-pilot
- **Real Playwright browser automation**: Stub only — deferred until hosting decision
- **Inngest DM follow-up functions**: Pipeline exists but automated DM sequences deferred
- **17track delivery tracking**: Deferred post-pilot
- **PhantomBuster/Apify discovery worker**: n8n pipeline continues externally

## Commit

```
e1fa48c feat(9g): creator import, search UI, Playwright worker stub, Unipile DM channel, review-to-campaign import
```

Pushed to `main`.
