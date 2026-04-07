# Phase 24b — Email Warmup System

## Focus

Implement gradual send volume ramp for new/cold email aliases. The schema has `EmailAlias.isWarmedUp` (boolean) and `SendingMetric` tracks daily sends — but no warmup logic exists.

## Inputs
- `EmailAlias.isWarmedUp` flag (exists, never used)
- `SendingMetric` model (tracks sent/bounced/complained per alias per day)
- Phase 22a daily limit enforcement in `sendEmail()`
- `mo-book-email-deliverability-setup` skill for warmup schedule best practices

## Skills Available for This Subphase
- `backend-coding-agent` — warmup scheduler
- `mo-book-email-deliverability-setup` — warmup schedule design
- `tdd-guide` — TDD for warmup logic
- `code-review` — post-implementation

## Work

### 1. Add Warmup Fields to EmailAlias

**File**: `apps/web/prisma/schema.prisma`

Add `warmupStartedAt DateTime?` and `warmupDay Int @default(0)` to `EmailAlias`.

### 2. Warmup Schedule Logic

**New file**: `apps/web/lib/outreach/warmup.ts`

```ts
export function getEffectiveDailyLimit(alias: EmailAlias): number {
  if (alias.isWarmedUp) return alias.dailyLimit;
  if (!alias.warmupStartedAt) return 0; // Not started yet

  const day = alias.warmupDay;
  if (day <= 3) return 5;
  if (day <= 7) return 15;
  if (day <= 14) return 30;
  return alias.dailyLimit; // Fully warmed
}
```

### 3. Integrate with Daily Limit Check

**File**: `apps/web/lib/gmail/send.ts`

Replace `alias.dailyLimit` with `getEffectiveDailyLimit(alias)` in the daily limit check.

### 4. Inngest Cron: Daily Warmup Progression

**New file**: `apps/web/lib/inngest/functions/warmup-check.ts`

Daily cron that:
- Increments `warmupDay` for active aliases
- Checks bounce/complaint rates from `SendingMetric`
- Auto-pauses alias if bounce rate > 5% or complaint rate > 0.1%
- Marks `isWarmedUp: true` when warmup day reaches 15

### 5. Tests
- Test: warmup schedule returns correct limits per day
- Test: auto-pause on high bounce rate
- Test: warmup completion marks alias as warmed

## Output
- Gradual warmup: 5→15→30→full over 14 days
- Auto-pause on deliverability issues
- Integrates with existing daily limit enforcement

## Handoff
Subphase c (HTML Templates) depends on warmup being active — HTML from cold aliases will be flagged as spam.
