# Phase 9c — Implement auth, tenancy, and the protected platform shell

## Focus
Establish the authenticated runtime: Supabase auth flows, middleware protection, tenant bootstrap, and the first real platform shell. This subphase makes the app capable of having authenticated users and brand-scoped product state.

## Inputs
- `docs/planning/phase-9/plan.md`
- `docs/planning/phase-9/a/plan.md`
- `docs/planning/phase-9/b/plan.md`
- `docs/planning/phase-8/finalplan.md`
- `docs/planning/phase-8/review.md`
- `docs/planning/phase-8/a/architecture.md`
- `apps/web/lib/supabase/*`
- `apps/web/prisma/schema.prisma`

## Skills Available for This Subphase
- `find-local-skills` output: unavailable on this machine (missing local index); fallback to manual skill selection.
- `find-skills` output: unavailable on this machine; fallback to confirmed local skills only.
- Planned invocations:
  - `backend-development`
  - `context7-docs`
  - `react-dev`
  - `frontend-design`
  - `javascript-typescript`

## Work

### 1. Implement Supabase auth flows
- Add `(auth)` pages and callback handling:
  - login
  - signup
  - callback
  - logout / session clear path if needed
- Use the split browser/server/middleware client pattern from the Phase 8 reference map.

### 2. Implement middleware boundaries
- Protect `(platform)` routes.
- Keep `/`, `/pricing` (now in `(marketing)/` route group), auth callbacks, unsubscribe, and other explicitly public routes accessible.
- Fast-path requests that clearly do not need auth/session refresh.
- Marketing routes are already in `(marketing)/` from 9a — middleware must not disrupt them.

### 3. Implement tenant bootstrap
- After first authenticated entry:
  - ensure a `User` profile row exists
  - support creation/select of `Organization`
  - support creation/select of `Client`
  - support creation/select of `Brand`
- Add server actions or route handlers for tenant creation and selection.

### 4. Build the platform shell
- Add `(platform)/layout.tsx` with:
  - sidebar nav
  - brand switcher
  - user menu
  - pending-actions entry points
- Keep it visually and structurally separate from the marketing shell.

### 5. Add the first protected product routes
- At minimum:
  - `(platform)/dashboard`
  - `(platform)/settings`
  - `(platform)/onboarding`
- They can begin as skeletal but must be real, protected, and tenant-aware.

### 6. Establish server-action and auth patterns
- Use a consistent action/result contract.
- Ensure protected actions always resolve the current tenant scope.
- Avoid platform writes from client-only code paths.

### 7. Validation
- `npm run web:build` (from repo root)
- auth callback/path sanity checks
- targeted verification that unauthenticated access to `(platform)` redirects or blocks correctly
- verify public marketing routes still render without auth (`/` returns 200, `/pricing` returns 200)
- verify auth callback URL matches Supabase dashboard configuration

## Validation (RED TEAM)
- Supabase project must exist with auth enabled before this subphase can execute
- Callback URL (`/auth/callback`) must be registered in Supabase Auth settings
- Middleware must NOT break marketing server action at `app/(marketing)/actions/submit-form.ts` (moved in 9a)
- Platform shell must NOT import or reference marketing `Shell.tsx`
- Tenant bootstrap must handle the case where a user signs up but doesn't complete org creation (resumable state)

## Output
- The app supports authenticated entry, protected platform routes, tenant bootstrap, and a real platform shell.
- Later feature work can now assume user/org/client/brand context exists.

## Handoff
Phase 9d should use this authenticated shell and tenant context to build billing, onboarding, brand configuration, and provider connection flows instead of stubbing them behind unauthenticated placeholders.

## Assumptions / Open Questions (RED TEAM)
- Supabase Auth is configured with email + password signup (confidence ~95%).
  - Mitigation: if Google OAuth is also needed for signup, add it as an optional provider.
- Callback URL is `/auth/callback` (must match Supabase dashboard).
  - Why it matters: mismatched callback URLs cause auth to silently fail.
  - Current default: `/auth/callback` as the single callback route.
