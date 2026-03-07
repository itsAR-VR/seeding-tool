# Phase 9e — Completion

## Status: COMPLETE ✅

**Commit:** `feat(9e): campaigns, creators, approval queue, inbox, Gmail send/ingest, AI reply pipeline`
**Build:** `npm run web:build` — PASS (zero errors)

## What Was Built

### 1. Campaign CRUD
- **`/campaigns`** — Server-rendered list page with status badges, creator counts, product names
- **`/campaigns/new`** — Client-side form: name + description, POSTs to API, redirects to detail
- **`/campaigns/[campaignId]`** — Detail page with stats grid (total, pending, approved, declined, outreach sent, replied, address confirmed), product listing, creator table with review + lifecycle badges
- **API routes:**
  - `GET/POST /api/campaigns` — list/create with brand tenancy
  - `GET/PATCH /api/campaigns/[campaignId]` — detail/update

### 2. Creator Records + Approval Queue
- **`/campaigns/[campaignId]/review`** — Client-side review queue showing `PENDING` creators with Approve/Defer/Decline buttons
- **API routes:**
  - `GET/POST /api/campaigns/[campaignId]/creators` — list (with filters: reviewStatus, lifecycleStatus) / add creator (inline or by existing ID)
  - `POST /api/campaigns/[campaignId]/creators/[creatorId]/review` — action: approve|decline|defer, mutates both `reviewStatus` and `lifecycleStatus` correctly per finalplan

### 3. Inbox Data Model Services (`apps/web/lib/inbox/`)
- **`threads.ts`** — `listThreads(brandId, filters)`, `resolveThread(threadId, brandId)`, `getThreadWithMessages(threadId, brandId)`, `getOrCreateThread(campaignCreatorId, brandId, externalThreadId?)`
- **`messages.ts`** — `normalizeInboundMessage(raw)` strips quoted text, `persistMessage(threadId, payload)` with dedupe on `externalMessageId`
- **`ai.ts`** — `classifyReply(message)` → `{ intent, confidence }`, `extractAddress(messageBody)` → structured address, `generateDraft(thread)` → draft string. All use `response_format: { type: "json_object" }`. All create `Intervention` on failure.

### 4. Gmail Send Path (`apps/web/lib/gmail/send.ts`)
- `sendEmail({ aliasId, to, subject, body, threadId? })`:
  - Decrypts refresh token from `ProviderCredential`
  - Exchanges for access token via Google OAuth2
  - Sends via Gmail API with RFC 2822 encoding
  - Persists `Message` row with `direction: "outbound"`
  - Updates `SendingMetric` daily counters
- **API:** `POST /api/inbox/[threadId]/send` — `{ draftId, aliasId }` → confirms + sends draft, marks `AIDraft.status = "sent"`

### 5. Gmail Ingest Pipeline
- **`POST /api/gmail/webhook`** — Handles Gmail Pub/Sub push notifications:
  - Decodes Pub/Sub base64 data
  - Records `WebhookEvent`
  - Fetches new messages via Gmail API
  - Normalizes and persists (dedupe by Gmail message ID)
  - Emits `gmail/message.received` Inngest event; falls back to inline processing if Inngest not configured
- **`lib/gmail/ingest.ts`** — `fetchNewMessages(brandId)`, `resolveThreadByExternalId(id)`, `resolveBrandByEmail(email)`
- **`lib/inngest/functions/process-reply.ts`** — Inngest function:
  1. Classifies reply with AI
  2. Address → extract + create `ShippingAddressSnapshot` + update lifecycle
  3. Positive/question → generate AI draft
  4. Negative → create `Intervention`
  5. Low confidence (< 0.7) → always create `Intervention`

### 6. Inbox UI
- **`/inbox`** — Server-rendered thread list with badges (Draft, Address, status), last message preview, quick stats
- **`/inbox/[threadId]`** — Client-side thread detail:
  - Full message history with classification badges
  - Pending AI drafts with Edit/Send/Discard actions
  - Extracted address review with Confirm/Edit/Reject actions

## Invariants Enforced

All three invariants are enforced in code with explicit comments:

1. **`// INVARIANT: AI drafts are NEVER auto-sent. Send only fires on explicit human action.`**
   - Enforced in: `send.ts`, `process-reply.ts`, `inbox/[threadId]/send/route.ts`, `inbox/[threadId]/page.tsx`
   - AI drafts are created with `status: "draft"` — only the `/api/inbox/[threadId]/send` endpoint transitions to "sent" on explicit human POST

2. **`// INVARIANT: Message dedupe on externalId prevents replay duplicates.`**
   - Enforced in: `messages.ts` (`persistMessage` checks `externalMessageId` uniqueness before insert)
   - Schema: `externalMessageId String? @unique` on `Message` model

3. **`// INVARIANT: OpenAI failures create Interventions, never propagate as 500s.`**
   - Enforced in: `ai.ts` (all three functions: `classifyReply`, `extractAddress`, `generateDraft`)
   - Missing API key → `InterventionCase` created, graceful fallback returned
   - API errors → caught, `InterventionCase` created, never re-thrown

## Architecture Notes
- `maxFollowUps` comes from `BrandSettings` (queried in `process-reply.ts`), never hardcoded
- All API routes follow the established auth pattern: Supabase → `getUserBySupabaseId` → brand membership check
- Inngest integration gracefully handles missing keys (try/catch around `inngest.send()`, falls back to inline processing)

## Files Changed (22 files, ~3500 lines)
- 6 new UI pages (campaigns list/new/detail/review, inbox list/detail)
- 6 new API routes (campaigns CRUD, creators, review, inbox detail, inbox send, gmail webhook)
- 3 new lib modules (inbox/threads, inbox/messages, inbox/ai)
- 2 new gmail modules (send, ingest)
- 1 new Inngest function (process-reply)
- 2 modified files (inngest route registration, events types, brands/current API)
