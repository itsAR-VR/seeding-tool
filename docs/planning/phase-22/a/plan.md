# Phase 22a — Revenue & Safety Guards

## Focus

Fix critical safety gaps: credit enforcement (revenue leak), daily send limits (deliverability risk), List-Unsubscribe header (CAN-SPAM compliance), and security hardening of the suppression system. Deep sweep confidence: **68%** (up from ~90%) due to mint() blocker and dual-enforcement contradiction.

## Deep Sweep Corrections Applied

- **CRITICAL**: `mint()` has zero callers — must wire to billing before enforcement
- **CRITICAL**: Worker already has soft-fail debit — must reconcile with route-level enforcement
- **CRITICAL**: `verifyUnsubscribeToken` uses `===` (timing attack), empty key fallback
- **HIGH**: POST handler missing for RFC 8058 one-click unsubscribe
- **HIGH**: `DailyLimitExceededError` class doesn't exist — must define it
- **HIGH**: 3 callers of sendEmail() need error handling for new limit errors
- **HIGH**: Cross-brand alias send possible (no `alias.brandId === membership.brandId` check)
- **MEDIUM**: Suppression is not durable for emails not in Creator table

## Inputs

- Deep sweep findings at `docs/planning/phase-22/deep-sweep-findings.md`
- `lib/credits.ts` — has `ensureCredits()`, `debitForOperation()`, `mint()` (all uncalled)
- `lib/workers/creator-search.ts:964-988` — existing soft-fail debit in worker
- `lib/gmail/send.ts` — `buildRawEmail()` missing List-Unsubscribe; no daily limit check
- `lib/compliance/suppression.ts` — `generateUnsubscribeToken()`, timing-unsafe verify
- `app/api/webhooks/unsubscribe/route.ts` — GET-only, needs POST handler
- `app/api/billing/webhook/route.ts` — no `invoice.paid` handler, no mint() call

## Skills Available for This Subphase

- `backend-coding-agent` — credit enforcement, send pipeline, billing webhook
- `gstack-cso` — security audit on billing and suppression code
- `security-reviewer` — timing attack fix, key validation
- `mo-book-email-deliverability-setup` — List-Unsubscribe header compliance
- `context7-docs` — CAN-SPAM requirements, Stripe webhook events
- `code-review` — post-implementation review
- Stripe MCP tools — verify credit flow end-to-end

## Work

### 0. PREREQUISITE: Wire mint() to Billing Webhook

**File**: `app/api/billing/webhook/route.ts`

Without this step, deploying credit enforcement blocks ALL users.

- Add `invoice.paid` handler that calls `mint(brandId, creditAmount)`
- Resolve org-to-brand mapping (Subscription is per-Organization, credits are per-Brand)
- Define credit amounts per plan via `SubscriptionEntitlement` or BrandSettings
- Backfill `BrandCreditBalance` rows for all existing paying brands via migration script
- Add `CREDIT_ENFORCEMENT_ENABLED` env var feature flag (default `false`) for safe rollout

### 0.5. PREREQUISITE: Security Hardening of Suppression

**File**: `lib/compliance/suppression.ts`

- Replace `token === expected` with `crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))` in `verifyUnsubscribeToken()`
- Add length check before `timingSafeEqual` (buffers must be same length)
- Replace `process.env.APP_ENCRYPTION_KEY || ""` with a throw if key is unset in production
- Create durable `EmailSuppression` model (independent of Creator table) for emails that unsubscribe but have no Creator row

### 1. Credit Enforcement on Search Routes

**File**: `app/api/creators/search/route.ts`

Strategy: **Reservation at route, settlement in worker.** This reconciles the dual enforcement points.

- Route level: `ensureCredits()` check + `debit()` pessimistic reservation (estimated cost)
- Worker level: Refactor `debitSearchCredits()` to be a settlement step — adjust the reservation based on actual cost (refund overage or accept rounding)
- Add idempotency: check for existing transaction with `jobId` before debiting in worker
- Gate behind `CREDIT_ENFORCEMENT_ENABLED` env var
- Catch `CreditInsufficientError` and return HTTP 402

Also audit enrichment route (`api/creators/enrich/route.ts`) for credit enforcement.

### 2. Daily Send Limit Enforcement

**File**: `lib/gmail/send.ts`

Define custom error class first:
```ts
// lib/outreach/errors.ts
export class DailyLimitExceededError extends Error {
  constructor(public aliasId: string, public sent: number, public dailyLimit: number) {
    super(`Daily send limit (${dailyLimit}) reached for alias`);
  }
}
```

In `sendEmail()`, update the alias select to include `isPaused` and `dailyLimit`:
- Check `alias.isPaused` — throw if paused
- Check `alias.brandId === membership.brandId` — prevent cross-brand alias use
- Increment metric BEFORE send, decrement on failure (mitigates TOCTOU race)
- On `DailyLimitExceededError`, each caller handles appropriately:
  - `send-pipeline.ts`: mark draft as `"daily_limit_reached"` (not `"failed"`)
  - `inbox/[threadId]/send/route.ts`: return HTTP 429
  - `mention-check.ts` (Inngest): create InterventionCase, reschedule for next day

### 3. List-Unsubscribe Header + POST Handler

**File**: `lib/gmail/send.ts`, function `buildRawEmail()`

Add headers using the existing `generateUnsubscribeToken()`:
```ts
const unsubUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/unsubscribe?email=${encodeURIComponent(params.to)}&token=${generateUnsubscribeToken(params.to)}`;
lines.push(`List-Unsubscribe: <${unsubUrl}>`);
lines.push(`List-Unsubscribe-Post: List-Unsubscribe=One-Click`);
```

**File**: `app/api/webhooks/unsubscribe/route.ts`

Add POST handler for RFC 8058 one-click:
- Parse URL-encoded body (`List-Unsubscribe=One-Click`)
- Extract email + token from query params
- Verify HMAC token (now using `timingSafeEqual`)
- Call `addSuppression()` + write to durable `EmailSuppression` table

### 4. Credits Re-Export Cleanup

**File**: `lib/credits/credits.ts` — verify zero imports then delete.

### 5. Integration Tests

**New file**: `apps/web/__tests__/integration/credit-enforcement.test.ts`

- Test: search with 0 credits + CREDIT_ENFORCEMENT_ENABLED=true returns 402
- Test: search with sufficient credits succeeds and debits
- Test: worker settlement adjusts reservation correctly
- Test: duplicate Inngest delivery does not double-debit (idempotency)
- Test: send email at daily limit throws DailyLimitExceededError
- Test: send email with paused alias throws error
- Test: send email with wrong-brand alias throws error
- Test: sent email headers contain List-Unsubscribe with valid HMAC token
- Test: POST to unsubscribe endpoint with valid token adds suppression
- Test: POST with forged token returns 403
- Test: unsubscribe for email not in Creator table still records suppression
- Test: `verifyUnsubscribeToken` uses constant-time comparison

## Rollback Plan

- `CREDIT_ENFORCEMENT_ENABLED=false` disables credit checks without code deploy
- Daily limit check can be bypassed by setting `dailyLimit: 99999` per alias
- List-Unsubscribe header is additive — no rollback needed
- Monitor for 402/429 spike alerts after deployment

## Output (Completed 2026-04-07)

### Files Modified
- `apps/web/lib/credits.ts` — Added `CREDITS_PER_PLAN`, `isCreditEnforcementEnabled()`
- `apps/web/app/api/billing/webhook/route.ts` — Added `invoice.paid` handler calling `mint()` for all brands under subscription org
- `apps/web/lib/compliance/suppression.ts` — Replaced `===` with `timingSafeEqual`, throw on missing `APP_ENCRYPTION_KEY`, added durable `EmailSuppression` table support in `isSuppressed()` and `addSuppression()`
- `apps/web/app/api/creators/search/route.ts` — Added credit enforcement (gated behind `CREDIT_ENFORCEMENT_ENABLED`), returns 402 on insufficient credits
- `apps/web/lib/gmail/send.ts` — Added daily limit check, alias pause check, cross-brand alias validation, `List-Unsubscribe` + `List-Unsubscribe-Post` headers in `buildRawEmail()`
- `apps/web/lib/outreach/send-pipeline.ts` — Handle `DailyLimitExceededError` with `"daily_limit_reached"` status
- `apps/web/app/api/inbox/[threadId]/send/route.ts` — Handle `DailyLimitExceededError` with HTTP 429
- `apps/web/lib/inngest/functions/mention-check.ts` — Handle `DailyLimitExceededError` with InterventionCase + deferred status
- `apps/web/app/api/webhooks/unsubscribe/route.ts` — Added POST handler for RFC 8058 one-click unsubscribe
- `apps/web/prisma/schema.prisma` — Added `EmailSuppression` model

### Files Created
- `apps/web/lib/outreach/errors.ts` — `DailyLimitExceededError`, `AliasPausedError`, `CrossBrandAliasError`

### Files Deleted
- `apps/web/lib/credits/credits.ts` — Removed unused re-export (zero imports)
- `apps/web/lib/credits/` — Removed empty directory

### Tests Written (29 tests, 6 files — all passing)
- `apps/web/__tests__/safety-guards/credit-enforcement.test.ts` (2 tests)
- `apps/web/__tests__/safety-guards/daily-limit.test.ts` (5 tests)
- `apps/web/__tests__/safety-guards/suppression-security.test.ts` (9 tests)
- `apps/web/__tests__/safety-guards/unsubscribe-endpoint.test.ts` (6 tests)
- `apps/web/__tests__/safety-guards/list-unsubscribe-header.test.ts` (4 tests)
- `apps/web/__tests__/safety-guards/billing-webhook-mint.test.ts` (3 tests)

### Build Status
- `npx tsc --noEmit` — 1 pre-existing error (in `classification.test.ts`, not related to phase 22a)
- `vitest run` — 136/137 pass; 1 pre-existing failure (in `gmail.test.ts`, not related to phase 22a)
- All 29 new safety-guards tests pass

### Key Decisions
- Credit enforcement uses `CREDIT_ENFORCEMENT_ENABLED` env var (default `false`) for safe rollout
- Daily limit check reads `alias.dailyLimit` from DB (default 50), no hardcoded values
- `List-Unsubscribe-Post` header follows RFC 8058 spec exactly
- Suppression is now durable via `EmailSuppression` table — emails not in Creator table can still unsubscribe
- `verifyUnsubscribeToken` uses `timingSafeEqual` with length pre-check

### Open Questions
- Migration script for backfilling `BrandCreditBalance` rows for existing paying brands should be run before enabling `CREDIT_ENFORCEMENT_ENABLED=true`
- The `Prisma` migration for `EmailSuppression` needs `npx prisma migrate dev` before deploy
- Worker-level credit settlement (Step 1 refinement in plan) was deferred — the current approach does pessimistic reservation at route level, with the existing soft-fail debit in the worker left as-is until the reservation/settlement pattern is fully reconciled

## Handoff

Subphase b (RBAC & Multi-Brand Fix) builds on the cleaned `brand-access.ts` patterns. Credit enforcement at routes demonstrates the guard pattern that RBAC reuses. Subphase b must use cookie-based (not header-based) brand selection.

Before deploying this subphase:
1. Run `npx prisma migrate dev --name add-email-suppression` to create the `email_suppressions` table
2. Run a backfill script to create `BrandCreditBalance` rows for all existing paying brands
3. Deploy with `CREDIT_ENFORCEMENT_ENABLED=false` initially
4. Verify `invoice.paid` webhook is firing and minting credits
5. Then toggle `CREDIT_ENFORCEMENT_ENABLED=true` once all brands have balances
