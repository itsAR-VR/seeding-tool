# Phase 24b — Email Warmup System

## Focus

Implement gradual send volume ramp for new/cold email aliases. Integrates with the daily limit enforcement from Phase 22a.

Confidence: **90%** (after corrections applied)

## Deep Sweep Corrections Applied

- [x] CRITICAL: Data migration to set `isWarmedUp: true` for all existing aliases (prevents deploy-breaking all sends)
- [x] HIGH: Compute warmup day from `warmupStartedAt` date math (eliminates `warmupDay` counter, cron race condition, day-0 ambiguity)
- [x] HIGH: Update `send.ts` select clause to include `isWarmedUp` and `warmupStartedAt`
- [x] HIGH: Pass effective limit (not `alias.dailyLimit`) to `DailyLimitExceededError`
- [x] HIGH: Defer auto-pause on bounce rate until bounce data flows (document as known gap)
- [x] MEDIUM: Initialize `warmupStartedAt` on new alias creation
- [x] MEDIUM: Register Inngest function in route.ts

## Inputs

- `apps/web/lib/gmail/send.ts` — daily limit check at lines 186-190
- `apps/web/prisma/schema.prisma` — `EmailAlias` model (has `isWarmedUp`, needs `warmupStartedAt`)
- `apps/web/lib/outreach/errors.ts` — `DailyLimitExceededError`
- Phase 22a daily limit enforcement is the integration point

## Skills Available

- `backend-coding-agent`, `mo-book-email-deliverability-setup`, `tdd-guide`, `code-review`

## Work

### 0. PREREQUISITE: Schema Migration + Data Migration

**File**: `apps/web/prisma/schema.prisma`

Add to `EmailAlias`:
```prisma
warmupStartedAt DateTime?
```

Note: `warmupDay` is NOT needed — computed from date math.

**Migration SQL** must include data migration:
```sql
ALTER TABLE "email_aliases" ADD COLUMN "warmup_started_at" TIMESTAMP(3);
-- CRITICAL: Mark all existing aliases as warmed to prevent breaking sends
UPDATE "email_aliases" SET "is_warmed_up" = true WHERE "is_warmed_up" = false;
```

### 1. Warmup Logic Module

**New file**: `apps/web/lib/outreach/warmup.ts`

```ts
export function getEffectiveDailyLimit(alias: {
  isWarmedUp: boolean;
  warmupStartedAt: Date | null;
  dailyLimit: number;
}): number {
  if (alias.isWarmedUp) return alias.dailyLimit;
  if (!alias.warmupStartedAt) return 0;

  const daysSinceStart = Math.floor(
    (Date.now() - alias.warmupStartedAt.getTime()) / 86_400_000
  ) + 1;

  if (daysSinceStart <= 3) return 5;
  if (daysSinceStart <= 7) return 15;
  if (daysSinceStart <= 14) return 30;
  return alias.dailyLimit;
}

export function isWarmupComplete(alias: {
  warmupStartedAt: Date | null;
}): boolean {
  if (!alias.warmupStartedAt) return false;
  const days = Math.floor((Date.now() - alias.warmupStartedAt.getTime()) / 86_400_000) + 1;
  return days > 14;
}
```

Pure functions, no side effects, fully testable.

### 2. Integrate with Daily Limit Check

**File**: `apps/web/lib/gmail/send.ts`

- Update alias `select` clause to include `isWarmedUp`, `warmupStartedAt`
- Replace `alias.dailyLimit` with `getEffectiveDailyLimit(alias)` in the limit check
- Pass effective limit to `DailyLimitExceededError` (not raw `dailyLimit`)

### 3. Initialize Warmup on Alias Creation

**File**: `apps/web/app/api/auth/gmail/callback/route.ts`

When creating a new `EmailAlias`, set `warmupStartedAt: new Date()` and `isWarmedUp: false`.

### 4. Inngest Cron: Warmup Graduation

**New file**: `apps/web/lib/inngest/functions/warmup-check.ts`

Daily cron (`0 3 * * *`):
- Query all aliases where `isWarmedUp: false` AND `warmupStartedAt` is not null
- For each: if `isWarmupComplete()`, set `isWarmedUp: true`
- Log graduation events

Note: Auto-pause on bounce rate is DEFERRED — `SendingMetric.bounced` and `SendingMetric.complained` are never written by any code path. Will be implemented when bounce webhook ingestion is added (future phase).

### 5. Register Function

**File**: `apps/web/app/api/inngest/route.ts` — add `warmupCheck` to functions array.

### 6. Update Test Mocks

**File**: `apps/web/__tests__/_helpers/prisma-mock.ts` — add `isWarmedUp`, `warmupStartedAt` to `makeEmailAlias()`.

### 7. Tests

**New file**: `apps/web/__tests__/outreach/warmup.test.ts`

- Test: day 1 returns limit 5
- Test: day 5 returns limit 15
- Test: day 10 returns limit 30
- Test: day 15+ returns full dailyLimit
- Test: isWarmedUp=true returns full dailyLimit regardless of warmupStartedAt
- Test: warmupStartedAt=null returns 0
- Test: isWarmupComplete returns true after 14 days
- Test: isWarmupComplete returns false before 14 days
- Test: graduation cron marks aliases as warmed

## Output

**Status: COMPLETE**

- Gradual warmup: 5/day (days 1-3) -> 15/day (days 4-7) -> 30/day (days 8-14) -> full limit
- Date-based computation from `warmupStartedAt` (no stored counter, no race conditions)
- Existing aliases unaffected (data migration sets `isWarmedUp: true`)
- Daily cron (`warmup-check`, 03:00 UTC) graduates aliases after 14 days
- Auto-pause on bounce rate is DEFERRED (bounce data never written)

### Files Created
- `apps/web/lib/outreach/warmup.ts` — pure `getEffectiveDailyLimit()` + `isWarmupComplete()`
- `apps/web/lib/inngest/functions/warmup-check.ts` — daily cron for graduation
- `apps/web/__tests__/outreach/warmup.test.ts` — 19 tests (all pass)
- `apps/web/prisma/migrations/20260407140000_add_warmup_started_at/migration.sql`

### Files Modified
- `apps/web/prisma/schema.prisma` — added `warmupStartedAt DateTime?` to EmailAlias
- `apps/web/lib/gmail/send.ts` — select clause + effective limit integration
- `apps/web/app/api/auth/gmail/callback/route.ts` — initialize warmup on alias creation
- `apps/web/app/api/inngest/route.ts` — register `warmupCheck` function
- `apps/web/__tests__/_helpers/prisma-mock.ts` — added `isWarmedUp`, `warmupStartedAt` to mock + factory

### Build Status
- `npx tsc --noEmit`: no new errors (pre-existing errors in composite.ts, weekly-calibration.ts)
- `next build`: pre-existing failure in composite.ts (Phase 25 scope)
- Tests: 19/19 pass

## Handoff

Phase 24c (HTML Templates) should check `alias.isWarmedUp` before sending HTML -- cold aliases send plain text only.

Known gap: auto-pause on high bounce rate requires bounce webhook ingestion (future phase). `SendingMetric.bounced` and `SendingMetric.complained` columns exist but are never written.
