# Phase 8c — Define integrations, background jobs, webhooks, and idempotency contracts

## Focus
Specify exactly how the new platform talks to Stripe, Shopify, Gmail, Meta Creator Marketplace, and mentions/listening sources, including async execution, dedupe, retries, and failure handling.

## Inputs
- `docs/planning/phase-8/plan.md` (root plan with RED TEAM findings)
- `docs/planning/phase-8/a/architecture.md` (architecture lock — stack, providers, deployment target, job runner choice)
- `docs/planning/phase-8/b/schema.md` (canonical schema — entities, dedupe keys, status enums, ProviderCredential table)
- `docs/n8n-audit-2026-03-01/workflow-node-audit.md` (current n8n workflow inventory — node counts, triggers, integrations)
- `docs/seed-scale-handoff/appendix/source-truth-map.md` (current provider endpoints, credential references, hardcoded values)
- `docs/seed-scale-handoff/appendix/open-choices.md` (Choice Set D: reliability model, Choice Set F: observability)

NOTE: The ZRG Dashboard reference architecture is at `/Users/AR180/Desktop/Codespace/ZRG-Dashboard`. It is a production Next.js SaaS using the identical stack (Supabase, Prisma, Inngest, OpenAI, Vercel). Execution agents MUST read the relevant ZRG files listed in the Skills section below before implementing integration contracts.

## Work

### 1. Define the public integration surface and entrypoints

| Provider | Entrypoint | Route | Auth |
|----------|-----------|-------|------|
| Stripe | Checkout completion + subscription lifecycle webhooks | `apps/web/app/api/webhooks/stripe/route.ts` | `stripe-signature` header verification |
| Shopify | OAuth callback + fulfillment/order webhooks | `apps/web/app/api/webhooks/shopify/route.ts` + `apps/web/app/api/auth/shopify/callback/route.ts` | HMAC verification for webhooks, OAuth for callback |
| Gmail | OAuth callback + push notification webhook (or poll via cron) | `apps/web/app/api/auth/gmail/callback/route.ts` + `apps/web/app/api/webhooks/gmail/route.ts` | OAuth2 for callback, Google push notification token for webhook |
| Meta Creator Marketplace | Internal API from browser worker (not public) | `apps/web/app/api/internal/creator-search/route.ts` | Internal API key or service token |
| Meta/Instagram mentions | Webhook + poll fallback via cron | `apps/web/app/api/webhooks/instagram/route.ts` + cron endpoint | App secret verification for webhook |
| Cron | Scheduled jobs (follow-up cadence, reminder checks, poll fallbacks) | `apps/web/app/api/cron/[job]/route.ts` | `CRON_SECRET` header (Vercel cron pattern) |

### 2. Define the BackgroundJob model and execution contract

Using Inngest (LOCKED). Reference implementation: `ZRG-Dashboard/lib/inngest/` for client setup, event definitions, and function patterns. Reference `ZRG-Dashboard/lib/background-jobs/` for fair scheduling, dispatch windowing, and autoscale control.

- **Job types** (event-driven):
  - `outreach/send` — send initial outreach email
  - `outreach/follow-up` — send follow-up N
  - `email/process-reply` — classify inbound email, extract address, generate AI draft
  - `shopify/create-order` — create Shopify draft order from captured address
  - `shopify/sync-fulfillment` — update fulfillment status from webhook
  - `reminder/schedule` — schedule post-delivery reminder
  - `reminder/send` — send reminder email
  - `mentions/process` — process mention webhook/poll result
  - `creator-search/execute` — dispatch search request to browser worker
  - `creator-search/process-results` — normalize and store search results
  - `billing/sync-subscription` — update subscription status from Stripe webhook

- **Dedupe-key rules**: Every job has a dedupe key = `{job_type}:{entity_id}:{idempotency_suffix}`. Example: `outreach/send:campaigncreator_abc123:v1`. If a job with the same dedupe key is already queued or completed, skip.

- **Retry policy**: 3 retries with exponential backoff (1min, 5min, 25min). After 3 failures, mark as `failed` and create an `InterventionFlag` for the affected CampaignCreator.

- **Poison-job handling**: Jobs that fail 3x are moved to a dead-letter state. Operator dashboard shows failed jobs with error details and a "retry" button.

- **Operator visibility**: All jobs visible in platform admin. Filter by type, status, brand, date range. Failed jobs highlighted.

### 3. Define webhook normalization rules

All incoming webhooks follow the same pattern:

1. Receive raw payload at provider-specific route handler.
2. Verify signature/HMAC (reject if invalid, return 401).
3. Compute idempotency key from payload (provider + event type + provider event ID).
4. Check `WebhookEvent` table for existing key. If found, return 200 (already processed).
5. Insert `WebhookEvent` record with status `received`.
6. Enqueue the appropriate background job.
7. Return 200 immediately (do not process inline).
8. Background job processes the event, updates `WebhookEvent` status to `processed` or `failed`.

This pattern makes all webhook handlers replay-safe and auditable.

### 4. Define the creator-search worker contract

The Meta Creator Marketplace browser worker is a **separate service** (not inline in Next.js):

- **Request payload**: `{ brandId, searchCriteria: { niche, audienceSize, location, seedCreatorHandles[] }, sessionId }`
- **Search session handling**: Each search is a session. Worker creates a Playwright browser context, navigates to Meta Creator Marketplace, executes search with the provided criteria, paginates through results.
- **Browser session ownership**: One browser context per search session. Sessions are short-lived (max 5 minutes). No persistent browser sessions.
- **Anti-detection strategy**: Random delays between actions (2-5s), realistic viewport sizes, user-agent rotation. If CAPTCHA detected, pause session, mark as `captcha_blocked`, notify operator.
- **Evidence capture**: For each candidate creator found, capture: handle, display name, follower count, bio snippet, niche tags, profile URL, fit score (computed from criteria match). Screenshot of profile as evidence artifact.
- **Result normalization**: Worker posts results back to the app via internal API (`/api/internal/creator-search`). Results are normalized into `Creator` records with source = `meta_marketplace`. Dedupe by `platform + handle`.
- **Rate limiting**: Max 3 concurrent search sessions per organization. Max 50 searches per hour per organization. These limits are enforced by the app, not the worker.
- **Fallback**: If browser worker is unavailable, operator can manually add creators via CSV import or form entry. Manual entry creates `Creator` records with source = `manual`.

### 5. Define idempotency for high-risk lifecycle steps

| Step | Dedupe key | Guard condition | Failure behavior |
|------|-----------|-----------------|------------------|
| Outreach send | `outreach:send:{campaign_creator_id}` | CampaignCreator status must be `approved` | Retry 3x, then intervention flag |
| Follow-up send | `outreach:followup:{campaign_creator_id}:{followup_number}` | Previous follow-up sent, no reply received | Retry 3x, then intervention flag |
| Reply ingestion | `email:reply:{message_id}` (Gmail message ID) | Message not already in DB | Skip duplicate silently |
| Address capture | `address:capture:{campaign_creator_id}` | ShippingSnapshot not already created for this CampaignCreator | Skip if snapshot exists |
| Order creation | `shopify:order:{campaign_creator_id}` | ShopifyOrder not already created for this CampaignCreator | Skip if order exists, retry 3x on Shopify API failure |
| Delivery update | `shopify:delivery:{shopify_order_id}` | Order exists, not already marked delivered | Update idempotently |
| Mention creation | `mention:{platform}:{media_url}` | Mention not already in DB | Skip duplicate silently |
| Reminder scheduling | `reminder:schedule:{campaign_creator_id}` | Delivery confirmed, no existing scheduled reminder | Skip if reminder exists |

### 6. Define email deliverability contract

Per-brand Gmail OAuth with multi-alias support:

- **Alias selection**: Round-robin across active aliases for the brand. Skip aliases that are warming up and have hit their daily limit.
- **Per-alias daily tracking**: Before each send, check `SendingMetric` for today. If `sent_count >= current_daily_limit`, skip this alias and try the next.
- **Soft rate limiting**: Platform caps sending at 80% of Gmail's hard limit (1600/day per account) to preserve deliverability reputation.
- **Warm-up schedule**: New aliases start at 50 emails/day. Increase 25% weekly if bounce rate <2% and complaint rate <0.1%. Warm-up progression is an Inngest cron job that runs daily.
- **Bounce processing**: Gmail push notifications or poll for bounce/complaint signals. Update `SendingMetric` bounce/complaint counts. If bounce rate >5% for an alias, auto-pause the alias and create intervention flag.
- **Complaint processing**: If complaint rate >0.3% for an alias, auto-pause and create intervention flag. Operator must review and re-enable.
- **Future scaling**: When a brand's total daily volume exceeds what their Gmail aliases can handle, surface a "connect transactional email" prompt in brand settings. Transactional provider (Resend/SendGrid) integration is a future feature, not v1.

### 7. Define provider-specific stop conditions and escalation paths

- **Gmail**: If send fails with 429 (rate limit), back off 60s and retry. If send fails with 401 (token expired), refresh token. If refresh fails, create intervention flag and pause outreach for that brand's alias. If alias bounce rate >5%, auto-pause alias.
- **Shopify**: If order creation fails with 422 (validation error), log details and create intervention flag (likely address issue). If 429 (rate limit), back off and retry. If 5xx, retry 3x then intervention flag.
- **Meta browser worker**: If CAPTCHA detected, pause and notify. If session crashes, retry once with fresh context. If 3 consecutive failures, pause search for that organization and notify.
- **OpenAI**: If 429, back off with retry-after header. If 5xx, retry 3x. If response doesn't parse (invalid JSON, missing fields), log raw response, create intervention flag, skip AI draft (operator must handle manually).
- **Instagram webhook**: If mention payload is malformed, log and skip. Never retry malformed payloads.

## Output
- Completed artifact: `docs/planning/phase-8/c/integrations.md`
- The artifact now locks:
  - the public provider entrypoint map for Stripe, Shopify, Gmail, Instagram, Inngest, cron, and the internal creator-search callback
  - the dual async model of Inngest orchestration plus durable DB queue rows
  - deterministic cron dispatch-window behavior instead of inline cron execution
  - webhook normalization as `verify -> dedupe -> persist -> enqueue -> return`
  - the browser-worker bridge contract for Meta Creator Marketplace
  - a concrete background-job catalog with dedupe keys, retry envelopes, and visible failure states
  - provider-specific stop conditions, intervention rules, and daily health visibility

## Coordination Notes

- Re-read before editing:
  - `docs/planning/phase-8/b/schema.md`
  - `docs/n8n-audit-2026-03-01/workflow-node-audit.md`
  - `docs/seed-scale-handoff/appendix/source-truth-map.md`
  - `docs/seed-scale-handoff/appendix/open-choices.md`
- Integrated from ZRG reference review:
  - thin Inngest route + server-only client pattern
  - DB-backed background/webhook queue shape
  - deterministic cron dispatch keys
  - “ingest fast, do heavy work later” webhook design
- Integrated from handoff-doc review:
  - legacy workflow mapping into new provider surfaces
  - provider choice treated as replaceable where legacy docs disagree, behavior treated as fixed

## Validation Notes

- Every active n8n workflow family now has a mapped surface in the new platform contract.
- High-risk lifecycle steps now have explicit dedupe-key patterns.
- Signature/auth verification is specified for every public provider ingress.
- Gmail verification delay and Instagram webhook/business-verification uncertainty are both acknowledged with fallback paths.

## Handoff
Subphase 8d should now design the actual product surface against concrete runtime behavior. The UI/state-machine work must assume:

- queue-backed, replay-safe transitions rather than inline mutations
- explicit pause/error/intervention states on aliases, search jobs, reminders, and orders
- a one-thread-per-campaign-creator inbox model
- creator search as a worker-mediated job, not an instant synchronous search box

8d should verify that every visible operator state or decision point maps back to:
- a schema state from 8b, and
- a provider/job contract from 8c.

## Validation (RED TEAM)
- Verify that every n8n workflow from `workflow-node-audit.md` has a corresponding integration contract in the new system.
- Verify that every webhook handler has signature verification specified.
- Verify that every high-risk lifecycle step from `behavior-parity-checklist.md` has an idempotency key.
- Verify that the creator-search worker contract addresses CAPTCHA, rate limiting, and fallback.
- Verify that Gmail production requirements (OAuth verification) are acknowledged with a timeline.

## Skills Available for This Subphase
- `backend-development`: available — for integration patterns and webhook handling
- `llm-application-dev`: available — for AI provider integration (OpenAI structured output, retry, fallback)
- `browser-automation`: available — for Meta browser worker architecture
- `context7-docs`: available — for up-to-date Stripe/Shopify/Gmail/Inngest API docs
- `phase-gaps`: available — for re-validating after writing the integration contracts
- Planned invocations: `backend-development`, `llm-application-dev`, `browser-automation`, `context7-docs`
- ZRG references (MUST READ before implementing):
  - Inngest functions: `ZRG-Dashboard/lib/inngest/functions/` — idempotency via dispatchKey, retry config, concurrency
  - Webhook processing: `ZRG-Dashboard/lib/webhook-events/runner.ts` — lock-based queue, stale release, backoff + jitter
  - Background jobs: `ZRG-Dashboard/lib/background-jobs/runner.ts` — fair scheduling, dispatch windowing, time budgets
  - AI drafts: `ZRG-Dashboard/lib/ai-drafts/` and `ZRG-Dashboard/lib/draft-pipeline/` — context packing, model config, artifact storage

## Assumptions / Open Questions (RED TEAM)
- Gmail OAuth verification for production can take 2-6 weeks. This may not be complete before v1 launch.
  - Why it matters: without verification, Gmail API is limited to 100 users and shows "unverified app" warning.
  - Current default: plan for verification in parallel with development; use test accounts during development.
- Instagram webhook access requires a Facebook App with `instagram_manage_insights` permission and Business verification.
  - Why it matters: without this, mentions tracking falls back to polling (less real-time, more API calls).
  - Current default: implement both webhook and poll; use poll as primary until webhook access is verified.
