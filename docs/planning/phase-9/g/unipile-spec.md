# Unipile Instagram DM Integration Spec — Phase 9g

## Context

The n8n `[AC] Message System [Draft]` workflow sends Instagram DMs to creators via Unipile, a unified messaging API. This spec defines how to replicate that capability in the Seed Scale platform.

**Prerequisite**: Mo must confirm DMs are pilot-critical before this is built.

## Unipile API

- **Base URL**: `https://api11.unipile.com:14124`
- **Auth**: Bearer token in `Authorization` header
- **Storage**: `ProviderCredential` with `provider: "unipile"`, `credentialType: "api_key"`, encrypted token in `encryptedData`

## Key API Operations

### 1. Lookup User by Username
```
GET /api/v1/users/{instagram_username}
Authorization: Bearer {token}

Response: { id, provider_id, ... }
```
Returns the Unipile provider ID for an Instagram username. This is needed to find/create chats.

### 2. Search for Existing Chat
```
GET /api/v1/chats?account_id={account_id}&cursor={cursor}
Authorization: Bearer {token}

Response: { items: [...], cursor: "next_cursor" | null }
```
Cursor-based pagination. Match chat by checking `attendees[].provider_id` against the target user's `provider_messaging_id`.

The n8n workflow implements this as a full cursor pagination loop — iterate all pages until a match is found or pages are exhausted.

### 3. Create New Chat
```
POST /api/v1/chats
Authorization: Bearer {token}
Content-Type: application/json

Body: {
  "account_id": "{unipile_account_id}",
  "attendees_ids": ["{provider_id}"],
  "text": "{message}"
}

Response: { chat_id, ... }
```
Creates a new chat and sends the first message in one operation.

### 4. Send Message to Existing Chat
```
POST /api/v1/chats/{chat_id}/messages
Authorization: Bearer {token}
Content-Type: application/json

Body: {
  "text": "{message}"
}

Response: { message_id, ... }
```

## Rate Limiting

The n8n workflow enforces **20 DMs/day per account** via a Google Sheets counter.

### Platform implementation:
- Use `SendingMetric` table (already exists for email) with `channel: "instagram_dm"`
- Daily counter per brand, reset by cron at midnight
- Before each DM send: query `SendingMetric` for today's count
- If count >= 20: reject with clear error, create `InterventionCase` if in automated flow
- Between messages: enforce 15-minute wait (matches n8n's batch spacing) via Inngest step delay
- The n8n workflow also uses a lock flag to prevent concurrent runs — implement via `BackgroundJob` claim pattern (already in the worker contract)

## Data Model Changes

### No new tables needed — extend existing models:

**ConversationThread**
- Already has `channel` field — use value `"instagram_dm"`
- Add `unipileChatId: String?` — stores the Unipile chat ID for message routing
- The existing `externalThreadId` can also reference this

**Message**
- Already supports `direction: "outbound" | "inbound"`
- `channel` on the parent thread distinguishes DM messages from email messages
- `externalMessageId` stores the Unipile message ID for dedupe

**ProviderCredential**
- New credential: `provider: "unipile"`, `credentialType: "api_key"`
- Store the Unipile account ID in metadata (needed for API calls)

**SendingMetric**
- Extend to track DM sends: add row with `channel: "instagram_dm"` per brand per day

### Schema migration (minimal):
```prisma
// On ConversationThread — add optional Unipile reference
unipileChatId String?
```

## API Routes

### `POST /api/inbox/[threadId]/send-dm`
Request:
```json
{
  "message": "string"
}
```

Flow:
1. Auth check (Supabase → user → brand membership)
2. Load thread, verify `channel === "instagram_dm"`
3. Load brand's Unipile credential
4. Check daily DM rate limit (SendingMetric)
5. If thread has `unipileChatId` → send to existing chat
6. If no `unipileChatId` → lookup creator's Instagram username → get provider ID → search for existing chat → create if needed
7. Persist `Message` with `direction: "outbound"`
8. Increment `SendingMetric` counter
9. Return success

### `POST /api/campaigns/[campaignId]/creators/[creatorId]/send-dm`
Convenience endpoint for initiating DM outreach from the campaign creator view.

Flow:
1. Auth + load campaign creator
2. Get or create `ConversationThread` with `channel: "instagram_dm"`
3. Compose message from template (brand's DM template, or default)
4. Delegate to the send-dm logic above

## Inngest Functions

### `dm/outreach.send`
Triggered when a creator is approved and DM outreach is configured:
1. Check if creator has Instagram username
2. Check rate limit
3. Send DM via Unipile
4. Schedule follow-up DMs (same cadence pattern as email, using `BrandSettings.maxFollowUps`)

### `dm/followup.send`
Same pattern as email follow-up but via DM channel.

## UI Changes

### Inbox thread detail (`/inbox/[threadId]`)
- Already shows messages — DM messages render identically with a "DM" badge
- "Send" action detects thread channel and routes to DM send endpoint

### Campaign creator row
- Show DM status alongside email status
- "Send DM" action available for creators with Instagram usernames

### Brand settings
- Toggle: "Enable Instagram DM outreach"
- Unipile credential connection (similar to Gmail/Shopify OAuth but API key based)

## Error Handling

- **Unipile API errors** → Create `InterventionCase`, do not propagate as 500
- **Rate limit hit** → Queue for next day, create intervention if urgent
- **User not found** → Flag creator as "DM unavailable", fall back to email
- **Chat creation failure** → Retry once, then create intervention

## Testing

- Unit test: rate limit enforcement (mock SendingMetric queries)
- Integration test: Unipile API contract (mock HTTP responses for all 4 endpoints)
- E2E: send DM → verify Message persisted → verify SendingMetric incremented

## Estimated Effort

- Unipile client lib: 0.5 day
- API routes + Inngest functions: 1 day
- Schema migration: 0.25 day
- UI changes (inbox + campaign): 0.5 day
- Testing: 0.5 day
- **Total: ~2.5-3 days**
