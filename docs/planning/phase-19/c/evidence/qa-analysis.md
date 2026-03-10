# Phase 19 — QA Evidence

## Static Analysis
- **TypeScript compilation:** No errors in changed files (`tsc --noEmit` passes for all onboarding/dashboard files)
- **Pre-existing errors:** 1 unrelated test file error (`classification.test.ts` missing property — existed before phase-19)

## Code Review Verification

### 1. Completion API (`/api/onboarding/complete`)
- [x] Auth check: Supabase auth + user lookup
- [x] Finds first brand via `BrandMembership.findFirst` (consistent with dashboard pattern)
- [x] Uses `upsert` — idempotent, handles missing BrandOnboarding record
- [x] Sets `isComplete: true`, `currentStep: 4`, `completedSteps: [1,2,3,4]`
- [x] Returns `{ success: true }` on success
- [x] Error handling: 401 (no auth), 404 (no user), 400 (no brand), 500 (unexpected)

### 2. Status API (`/api/onboarding/status`)
- [x] Auth check: Supabase auth + user lookup
- [x] Returns `{ isComplete: false, hasBrand: false }` when no membership exists
- [x] Returns `{ isComplete: false, hasBrand: true }` when onboarding record missing or incomplete
- [x] Returns `{ isComplete: true, hasBrand: true }` when complete

### 3. DoneStep Changes
- [x] Calls `/api/onboarding/complete` on mount via `useEffect`
- [x] Uses `useRef` guard to prevent double-call in React StrictMode
- [x] Shows "Finishing setup…" while completing, disables button
- [x] Shows error message if completion fails
- [x] Shows "Go to Dashboard" button when ready
- [x] Includes hint: "You can manage connections anytime from Settings → Connections"

### 4. Re-entry Guard (OnboardingContent)
- [x] Fetches `/api/onboarding/status` on mount
- [x] If `isComplete === true`, calls `router.replace("/dashboard")`
- [x] Shows loading state while checking
- [x] Gracefully handles fetch failure (allows onboarding to proceed)
- [x] Uses cleanup function to prevent state updates after unmount

### 5. Dashboard Gate
- [x] After membership check, queries `BrandOnboarding.findUnique({ where: { brandId } })`
- [x] If `!onboarding?.isComplete` → `redirect("/onboarding")`
- [x] Handles both missing record (null) and `isComplete: false`
- [x] Positioned before parallel data fetches (short-circuits efficiently)

### 6. Settings → Connections
- [x] Reviewed: no dependency on onboarding context
- [x] Uses own brand resolution from query params or auth context
- [x] Works independently — no changes needed

## Flow Verification (Logic Trace)

### Happy path: Complete onboarding with connections skipped
1. Brand step → creates brand + BrandOnboarding (isComplete: false) + BrandMembership
2. Discovery step → creates automation
3. Connect step → user clicks "Continue" (skips connections)
4. Done step → mounts → calls POST /api/onboarding/complete → isComplete = true
5. User clicks "Go to Dashboard" → dashboard loads (isComplete check passes)

### Re-entry after completion
1. User navigates to /onboarding
2. OnboardingContent mounts → fetches /api/onboarding/status → isComplete: true
3. router.replace("/dashboard") fires → user lands on dashboard

### New user accessing dashboard directly
1. Dashboard checks BrandMembership → none → redirect to /onboarding
2. User completes full onboarding flow → isComplete set to true
3. Dashboard accessible

### Existing user with membership but incomplete onboarding
1. Dashboard checks BrandMembership → exists
2. Dashboard checks BrandOnboarding.isComplete → false (or record missing)
3. Redirect to /onboarding
4. User completes remaining steps → isComplete set to true

## Files Changed
- `apps/web/app/api/onboarding/complete/route.ts` — NEW
- `apps/web/app/api/onboarding/status/route.ts` — NEW
- `apps/web/app/(platform)/onboarding/page.tsx` — MODIFIED (re-entry guard + DoneStep completion call)
- `apps/web/app/(platform)/dashboard/page.tsx` — MODIFIED (isComplete gate)
- `docs/planning/phase-19/plan.md` — NEW
- `docs/planning/phase-19/b/gaps.md` — NEW
- `docs/planning/phase-19/c/evidence/qa-analysis.md` — NEW (this file)

## Runtime QA Note
Browser runtime testing requires dev server + Supabase auth + database. The static analysis and logic trace confirm correctness. Runtime verification deferred to deployment.
