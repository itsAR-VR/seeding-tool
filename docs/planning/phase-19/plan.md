# Phase 19 — Onboarding Gate Fix

## Goal
Make `BrandOnboarding.isComplete` the single source of truth for whether onboarding is done. Once `isComplete === true`, the full platform is unlocked regardless of whether connections were skipped.

## Problem
- `BrandOnboarding.isComplete` exists in the schema (`@default(false)`) but **nothing ever sets it to `true`**.
- Dashboard gate at `dashboard/page.tsx` checks `BrandMembership` existence only — not `isComplete`.
- The "done" step in onboarding just client-side redirects to `/dashboard` without persisting completion.
- Result: onboarding state is never properly closed. Platform works by accident (membership exists from brand creation).

## Scope

### In scope
1. **Mark onboarding complete** — API route that sets `BrandOnboarding.isComplete = true` when user reaches the "done" step.
2. **Dashboard gate** — Check `isComplete` in addition to membership. Redirect to onboarding if incomplete.
3. **Re-entry guard** — If user navigates to `/onboarding` after completion, redirect to dashboard.
4. **Verify connections from Settings** — Confirm `Settings → Connections` works independently of onboarding context.

### Out of scope
- No changes to onboarding step content/UI (brand, discovery, connect steps unchanged).
- No schema migration needed (`isComplete` field already exists).
- No changes to platform layout beyond the onboarding gate.

## Key files
- `apps/web/prisma/schema.prisma` — `BrandOnboarding` model (read-only, no changes)
- `apps/web/app/api/onboarding/complete/route.ts` — NEW: marks onboarding complete
- `apps/web/app/(platform)/onboarding/page.tsx` — DoneStep calls completion API
- `apps/web/app/(platform)/dashboard/page.tsx` — Gate checks `isComplete`
- `apps/web/app/(platform)/settings/connections/page.tsx` — verify standalone operation

## Implementation approach
- Add `POST /api/onboarding/complete` that upserts `BrandOnboarding.isComplete = true` (idempotent).
- DoneStep calls this API on mount (useEffect), then shows dashboard button.
- Dashboard checks `BrandOnboarding.isComplete` — redirects to onboarding if false/missing.
- Onboarding page checks `isComplete` on load — redirects to dashboard if already done.
