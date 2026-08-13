# Phase 22 — Deep Sweep Findings

Date: 2026-04-07
Models: Opus 4.6 (4 deep analysis + 3 RED TEAM) + GPT-5.4 (Codex cross-verification)

## Severity Summary

| Severity | Count | Sources |
|----------|-------|---------|
| CRITICAL | 11 | All agents |
| HIGH | 15 | All agents |
| MEDIUM | 14 | All agents |
| LOW | 7 | All agents |

---

## CRITICAL Findings (Must Fix Before Implementation)

### 1. `mint()` has ZERO callers — enforcing credits blocks ALL users
**Source**: Opus P1 + RED TEAM 22a + Codex
**Files**: `lib/credits.ts:58`, `app/api/billing/webhook/route.ts`

`mint()` is defined but never called. The billing webhook creates a `Subscription` but never provisions credits. Deploying credit enforcement without wiring `mint()` to billing will return HTTP 402 to EVERY user.

**Required**: Add prerequisite Step 0 to 22a: wire `mint()` to `invoice.paid` webhook, backfill existing balances.

### 2. Worker already has soft-fail debit — route-level hard-fail creates contradiction
**Source**: Opus P1 + RED TEAM 22a + Codex
**Files**: `lib/workers/creator-search.ts:964-988`

The worker imports `debit` and calls it, but soft-fails (logs warning, continues). Adding `ensureCredits()` at the route creates two enforcement points with contradictory behavior.

**Required**: Decide single enforcement strategy: reservation at route + settlement in worker, OR worker-only enforcement.

### 3. Schema default is "member" not "viewer" — requireWriteAccess() fails
**Source**: Opus P3-RBAC + RED TEAM 22b
**Files**: `prisma/schema.prisma:126`

`BrandMembership.role` defaults to `"member"`, but `requireWriteAccess()` only blocks `"viewer"`. Users with `"member"` role bypass the guard entirely.

**Required**: Use allowlist (`role === "owner" || role === "editor"`) not denylist (`role === "viewer"`).

### 4. RSC pages do inline findFirst — X-Brand-Id header won't reach them
**Source**: RED TEAM 22b
**Files**: 6 RSC pages (dashboard, campaigns, inbox, etc.)

Browser page loads don't set custom headers. X-Brand-Id only works for `fetch()` from client components.

**Required**: Use cookie-based brand selection (cookies are available in RSC via `cookies()`).

### 5. Shopify API version in 3 files, plan only addresses 1
**Source**: RED TEAM 22c + Codex
**Files**: `lib/shopify/client.ts:39`, `lib/shopify/webhooks.ts:1`, `app/api/connections/shopify/route.ts:16`

**Required**: Create shared constant in `lib/shopify/config.ts`, import in all 3 files.

### 6. AI model: 9 occurrences in 3 files, not 7 in 2
**Source**: RED TEAM 22c + Codex
**Files**: `lib/inbox/ai.ts` (6), `lib/workers/creator-search.ts` (2), `lib/ai/outreach-drafter.ts` (1)

Worker file completely missing from plan. Suffixed variants (`@fly-worker`, `@local`) need template literals.

**Required**: Add `lib/workers/creator-search.ts` to update list. Handle template literal suffixes.

### 7. Inngest client generic syntax is wrong
**Source**: RED TEAM 22c
**Current plan**: `new Inngest<{ events: AppEventPayloads }>()`
**Correct**: `new Inngest({ schemas: new EventSchemas().fromRecord<AppEventPayloads>() })`

**Required**: Use `context7-docs` to verify exact Inngest v3 typing API before implementing.

### 8. Plan lists 5 non-existent Inngest events
**Source**: RED TEAM 22c

Events that DO NOT EXIST in codebase:
- `mention/check` (file is named mention-check.ts but consumes `reminder/send`)
- `shopify/order.created` (webhook topic, not Inngest event)
- `track17/register` (triggered by `shopify/order.fulfilled`)
- `track17/poll` (triggered by cron)
- `automation/run` (triggered by cron)

**Corrected event catalog (10 real events):**

| Event | Senders | Consumers | Declared? |
|-------|---------|-----------|-----------|
| `app/ping` | 0 | 0 | YES (dead) |
| `gmail/message.received` | 1 | 1 | YES |
| `mention/media.archive` | 1 | 1 | YES |
| `creator-search/requested` | 3 | 2 | NO |
| `creator-avg-views/requested` | 3 | 1 | NO |
| `reminder/send` | 1 | 1 | NO |
| `shopify/order.fulfilled` | 1 | 2 | NO |
| `shopify/fulfillment.updated` | 2 | 0 | NO |
| `unipile/message.received` | 1 | 0 | NO |
| `metrics/snapshots-collected` | 1 | 1 | NO |

### 9. Cross-brand alias send is possible
**Source**: Codex
**Files**: `app/api/inbox/[threadId]/send/route.ts:103`, `lib/gmail/send.ts:102`

Inbox send route accepts any `aliasId` from request body. `sendEmail()` checks alias exists but never verifies `alias.brandId === membership.brandId`.

### 10. Unsubscribe suppression is not durable for unknown emails
**Source**: Codex
**Files**: `lib/compliance/suppression.ts:47,23`

`addSuppression()` only `updateMany()`s existing `Creator` rows. If email not in Creator table, unsubscribe is a no-op. Need durable suppression store independent of Creator existence.

### 11. `verifyUnsubscribeToken` timing-unsafe + empty key fallback
**Source**: Opus P3 + RED TEAM 22a
**Files**: `lib/compliance/suppression.ts:87,78`

Uses `===` instead of `crypto.timingSafeEqual`. Falls back to `""` when `APP_ENCRYPTION_KEY` unset.

---

## HIGH Findings

1. **POST handler missing for unsubscribe** (RFC 8058 one-click) — route is GET-only
2. **3 callers of sendEmail() need DailyLimitExceededError handling** — especially Inngest reminder sends
3. **DailyLimitExceededError class doesn't exist yet** — plan references it, never defines it
4. **Daily limit TOCTOU race** — check and increment are not atomic
5. **brands/[brandId] PATCH has no role check** — anyone can rename brand
6. **~50 findFirst call sites, plan names only ~12** — "all other" is not actionable
7. **Plan needs 3 access tiers** (write, admin, owner), not 1
8. **No client-side plumbing for brand switching** — no UI, no fetch wrapper
9. **creator-search/requested payload divergence** — Apify consumer expects `criteria`, senders send `query`
10. **Missing events: metrics/snapshots-collected and creator-avg-views/requested** — actively used, omitted from plan
11. **event.data `as` casts bypass type safety** — must remove after typing client
12. **`await headers()` required in Next.js 16** — plan snippet uses synchronous `headers()`
13. **Outbound email can double-send** — Gmail send before DB update; retry causes duplicate
14. **Stripe webhook not idempotent** — processes before logging, duplicate delivery re-runs logic
15. **No rollback plan for any subphase** — need feature flags or env-var killswitches

---

## Corrected Confidence Ratings

| Subphase | Original | After Sweep | Key Issue |
|----------|----------|-------------|-----------|
| 22a (Safety) | ~90% | **68%** | mint() blocker, dual enforcement contradiction |
| 22b (RBAC) | ~89% | **72%** | "member" vs "viewer", RSC pages, client plumbing |
| 22c (Cleanup) | ~95% | **78%** | Wrong event catalog, wrong Inngest API, wrong file count |
| Phase 23 | 88% | **85%** | Well-scoped, minor gaps |
| Phase 24 | 72% | **65%** | Warmup system complexity confirmed |
| Phase 25 | 65% | **58%** | Scoring regression risk, vector storage decision |
| Phase 26 | 52% | **45%** | Real-time inbox on Vercel infeasible with serverless |

---

## Required Plan Updates

### 22a — Add before implementation:
- [ ] Step 0: Wire mint() to billing webhook (invoice.paid handler)
- [ ] Step 0.5: Add feature flag for credit enforcement (`CREDIT_ENFORCEMENT_ENABLED`)
- [ ] Reconcile route vs worker credit logic
- [ ] Fix timing-unsafe HMAC comparison
- [ ] Throw on missing APP_ENCRYPTION_KEY
- [ ] Add POST handler for unsubscribe
- [ ] Define DailyLimitExceededError class
- [ ] Add alias.brandId verification in sendEmail()
- [ ] Create durable suppression store independent of Creator table
- [ ] Add rollback plan

### 22b — Fix before implementation:
- [ ] Use allowlist for role checks (owner|editor), not denylist (not viewer)
- [ ] Switch from X-Brand-Id header to cookie-based selection
- [ ] Migrate 6 RSC pages, not just API routes
- [ ] Generate full inventory of all 50 findFirst call sites
- [ ] Add brands/[brandId] PATCH to migration list
- [ ] Add 3 access tiers (write, admin, owner)
- [ ] Fix `await headers()` for Next.js 16
- [ ] Add client-side brand switcher UI step
- [ ] Add rollback plan with feature flag

### 22c — Fix before implementation:
- [ ] Remove 5 non-existent events from catalog
- [ ] Add 2 missing real events (metrics/snapshots-collected, creator-avg-views/requested)
- [ ] Fix Inngest client generic syntax (use schemas, not events)
- [ ] Add lib/workers/creator-search.ts to AI model update list (9 occurrences, not 7)
- [ ] Add app/api/connections/shopify/route.ts to Shopify version update (3 files, not 1)
- [ ] Create shared Shopify config constant
- [ ] Remove event.data `as` casts after typing
- [ ] Handle template literal suffixes for AI model
- [ ] Add rollback plan
